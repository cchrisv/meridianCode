/**
 * Microsoft Graph Team Member Discovery
 * Discovers org hierarchy (manager, peers, subordinates, department) via Graph API
 */

import { mkdirSync, existsSync, writeFileSync } from "fs";
import { join } from "path";
import { getGraphBearerToken, validateAzureAuth } from "./lib/authAzureCli.js";
import { logInfo, createTimer } from "./lib/loggerStructured.js";
import { loadSharedConfig } from "./lib/configLoader.js";
import { executeSoqlQuery } from "./sfQueryExecutor.js";
import type {
  GraphUser,
  GraphUserWithManager,
  GraphManagerRef,
  GraphCollection,
  TeamMember,
  TeamDiscoveryOptions,
  TeamDiscoveryResult,
  TeamDiscoverySummary,
} from "./types/graphTeamTypes.js";
import { GRAPH_API_BASE, GRAPH_USER_SELECT } from "./types/graphTeamTypes.js";

/**
 * Make an authenticated GET request to Microsoft Graph
 */
async function graphGet<T>(path: string): Promise<T> {
  const token = getGraphBearerToken();
  const url = path.startsWith("http") ? path : `${GRAPH_API_BASE}${path}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Graph API ${response.status}: ${response.statusText} – ${body}`);
  }

  return (await response.json()) as T;
}

/**
 * Safely fetch a Graph endpoint, returning null on 404 (e.g. no manager)
 */
async function graphGetOptional<T>(path: string): Promise<T | null> {
  try {
    return await graphGet<T>(path);
  } catch (error) {
    if (error instanceof Error && error.message.includes("404")) {
      return null;
    }
    throw error;
  }
}

/**
 * Get the current logged-in user from Graph /me
 */
async function getCurrentUser(): Promise<GraphUserWithManager> {
  const user = await graphGet<GraphUser>(`/me?$select=${GRAPH_USER_SELECT}`);
  const manager = await graphGetOptional<GraphManagerRef>(
    "/me/manager?$select=displayName,mail,id",
  );
  return { ...user, manager };
}

/**
 * Get a user's details by ID (with manager)
 */
async function getUserDetails(userId: string): Promise<GraphUserWithManager> {
  const user = await graphGet<GraphUser>(`/users/${userId}?$select=${GRAPH_USER_SELECT}`);
  const manager = await graphGetOptional<GraphManagerRef>(
    `/users/${userId}/manager?$select=displayName,mail,id`,
  );
  return { ...user, manager };
}

/**
 * Recursively collect direct reports
 */
async function getDirectReportsRecursive(
  userId: string,
  visited: Set<string>,
): Promise<GraphUser[]> {
  if (visited.has(userId)) return [];
  visited.add(userId);

  const resp = await graphGet<GraphCollection<GraphUser>>(
    `/users/${userId}/directReports?$select=${GRAPH_USER_SELECT}`,
  );

  if (!resp.value || resp.value.length === 0) return [];

  const allReports: GraphUser[] = [...resp.value];

  for (const report of resp.value) {
    const subReports = await getDirectReportsRecursive(report.id, visited);
    allReports.push(...subReports);
  }

  return allReports;
}

/**
 * Filter out service accounts and disabled users
 */
function isRealUser(user: GraphUser): boolean {
  // Disabled accounts
  if (user.accountEnabled === false) return false;
  // No mail and no department — likely a service/test account
  if (!user.mail && !user.department) return false;
  // UPN patterns for service/test accounts
  const upn = user.userPrincipalName.toLowerCase();
  if (upn.startsWith("test-") || upn.startsWith("svc-") || upn.startsWith("admin-")) return false;
  // Display name patterns
  const name = user.displayName.toLowerCase();
  if (name.startsWith("test ") || name.startsWith("svc ") || name.includes("service account"))
    return false;
  return true;
}

/**
 * Salesforce User record shape from SOQL query
 */
interface SfUserRecord {
  Email: string;
  Username: string;
  FederationIdentifier: string | null;
  Profile: { Name: string } | null;
  UserRole: { Name: string } | null;
  UMUC_Department__c: string | null;
  IsActive: boolean;
  LastLoginDate: string | null;
  CreatedDate: string | null;
  Alias: string | null;
  Department_License__c: string | null;
  Department: string | null;
}

/**
 * Success_Team_Member__c record shape — team membership junction
 */
interface SfTeamMemberRecord {
  User__r: { Email: string } | null;
  Success_Team__r: {
    Name: string;
    Department__r: { Name: string } | null;
    Type__c: string | null;
  } | null;
  Title__c: string | null;
  Active__c: boolean;
  Total_Hours__c: number | null;
}

/**
 * Enrich team members with Salesforce user data.
 * Runs two query sets in batches:
 *   1. User object — profile, role, login, license, etc.
 *   2. Success_Team_Member__c — team assignments with department/title/hours
 */
async function enrichWithSalesforce(members: TeamMember[]): Promise<void> {
  const BATCH_SIZE = 150; // stay under SOQL limits
  const emails = members.map((m) => m.email.toLowerCase()).filter(Boolean);
  if (emails.length === 0) return;

  // ── Query 1: User records ──
  const sfMap = new Map<string, SfUserRecord>();

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const inClause = batch.map((e) => `'${e.replace(/'/g, "\\'")}'`).join(",");
    const soql = `SELECT Email, Username, FederationIdentifier, Profile.Name, UserRole.Name, UMUC_Department__c, IsActive, LastLoginDate, CreatedDate, Alias, Department_License__c, Department FROM User WHERE Email IN (${inClause})`;

    try {
      const result = await executeSoqlQuery<SfUserRecord>(soql);
      for (const rec of result.records) {
        if (rec.Email) sfMap.set(rec.Email.toLowerCase(), rec);
      }
    } catch (error) {
      logInfo(
        `  Warning: Salesforce User query batch failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logInfo(`  Matched ${sfMap.size} of ${members.length} team members in Salesforce`);

  // ── Query 2: Success Team memberships ──
  type TeamEntry = {
    teamName: string;
    departmentName: string;
    type: string;
    title: string;
    totalHours: number;
  };
  const teamMap = new Map<string, TeamEntry[]>();

  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    const inClause = batch.map((e) => `'${e.replace(/'/g, "\\'")}'`).join(",");
    const soql = `SELECT User__r.Email, Success_Team__r.Name, Success_Team__r.Department__r.Name, Success_Team__r.Type__c, Title__c, Active__c, Total_Hours__c FROM Success_Team_Member__c WHERE User__r.Email IN (${inClause}) AND Active__c = true`;

    try {
      const result = await executeSoqlQuery<SfTeamMemberRecord>(soql);
      for (const rec of result.records) {
        const email = rec.User__r?.Email?.toLowerCase();
        if (!email) continue;
        const entry: TeamEntry = {
          teamName: rec.Success_Team__r?.Name ?? "",
          departmentName: rec.Success_Team__r?.Department__r?.Name ?? "",
          type: rec.Success_Team__r?.Type__c ?? "",
          title: rec.Title__c ?? "",
          totalHours: rec.Total_Hours__c ?? 0,
        };
        const existing = teamMap.get(email);
        if (existing) existing.push(entry);
        else teamMap.set(email, [entry]);
      }
    } catch (error) {
      logInfo(
        `  Warning: Salesforce team membership query batch failed — ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const teamMemberCount = teamMap.size;
  if (teamMemberCount > 0) {
    logInfo(`  Matched ${teamMemberCount} team memberships in Success_Team_Member__c`);
  }

  // ── Merge into members ──
  for (const m of members) {
    const key = m.email.toLowerCase();
    const sfUser = sfMap.get(key);
    const teams = teamMap.get(key);
    if (sfUser) {
      m.salesforce = {
        isSalesforceUser: true,
        username: sfUser.Username,
        federationId: sfUser.FederationIdentifier ?? undefined,
        profile: sfUser.Profile?.Name ?? undefined,
        role: sfUser.UserRole?.Name ?? undefined,
        umgcDepartment: sfUser.UMUC_Department__c ?? undefined,
        lastLoginDate: sfUser.LastLoginDate ?? undefined,
        createdDate: sfUser.CreatedDate ?? undefined,
        alias: sfUser.Alias ?? undefined,
        departmentLicense: sfUser.Department_License__c ?? undefined,
        sfDepartment: sfUser.Department ?? undefined,
        teams: teams ?? undefined,
      };
    } else {
      m.salesforce = { isSalesforceUser: false };
    }
  }
}

/**
 * Build a TeamMember record from a Graph user
 */
function toTeamMember(
  user: GraphUserWithManager,
  relationship: TeamMember["relationship"],
): TeamMember {
  return {
    name: user.displayName,
    title: user.jobTitle ?? "",
    email: user.mail ?? user.userPrincipalName,
    manager: user.manager?.displayName ?? "",
    managerEmail: user.manager?.mail ?? "",
    department: user.department ?? "",
    relationship,
  };
}

/**
 * Build a Mermaid org-chart diagram from team members
 */
function buildMermaidDiagram(members: TeamMember[]): string {
  const lines: string[] = ["```mermaid", "graph TD"];

  const idMap = new Map<string, string>();
  members.forEach((m, i) => idMap.set(m.email, `P${i}`));

  const mermaidEsc = (s: string) => s.replace(/"/g, "#quot;");
  for (const m of members) {
    const nodeId = idMap.get(m.email) ?? "PX";
    const label = `${mermaidEsc(m.name)}<br/>${mermaidEsc(m.title)}`;
    let classSuffix = "";
    if (m.relationship === "You") classSuffix = ":::currentUser";
    else if (m.relationship === "Leader") classSuffix = ":::leader";
    else if (m.relationship === "Your Manager") classSuffix = ":::manager";
    else if (m.relationship === "Subordinate") classSuffix = ":::subordinate";
    else if (m.relationship === "Peer's Team") classSuffix = ":::peerTeam";
    lines.push(`    ${nodeId}["${label}"]${classSuffix}`);
  }

  lines.push("");

  for (const m of members) {
    if (m.managerEmail && idMap.has(m.managerEmail)) {
      const managerId = idMap.get(m.managerEmail)!;
      const memberId = idMap.get(m.email)!;
      lines.push(`    ${managerId} --> ${memberId}`);
    }
  }

  lines.push("");
  lines.push("    classDef currentUser fill:#4CAF50,stroke:#2E7D32,stroke-width:3px,color:#fff");
  lines.push("    classDef manager fill:#2196F3,stroke:#1565C0,stroke-width:2px,color:#fff");
  lines.push("    classDef subordinate fill:#FF9800,stroke:#E65100,stroke-width:2px,color:#fff");
  lines.push("    classDef peerTeam fill:#9C27B0,stroke:#6A1B9A,stroke-width:2px,color:#fff");
  lines.push("    classDef leader fill:#E91E63,stroke:#880E4F,stroke-width:3px,color:#fff");
  lines.push("```");

  return lines.join("\n");
}

/**
 * Write CSV report
 */
function writeCsv(members: TeamMember[], outputDir: string, timestamp: string): string {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const filepath = join(outputDir, `team-members-${timestamp}.csv`);
  const hasSf = members.some((m) => m.salesforce);
  const baseCols = "Name,Title,Email,Manager,ManagerEmail,Department,Relationship";
  const sfCols =
    "SF_User,SF_Username,SF_FederationId,SF_Profile,SF_Role,SF_UMUC_Dept,SF_Dept,SF_License,SF_Alias,SF_LastLogin,SF_Created,SF_Teams";
  const header = hasSf ? `${baseCols},${sfCols}` : baseCols;
  const esc = (s: string) => s.replace(/"/g, '""');
  const rows = members.map((m) => {
    const base = [
      `"${esc(m.name)}"`,
      `"${esc(m.title)}"`,
      `"${esc(m.email)}"`,
      `"${esc(m.manager)}"`,
      `"${esc(m.managerEmail)}"`,
      `"${esc(m.department)}"`,
      m.relationship,
    ];
    if (hasSf) {
      const sf = m.salesforce;
      const teamNames =
        sf?.teams?.map((t) => `${t.departmentName} > ${t.teamName}`).join("; ") ?? "";
      base.push(
        sf?.isSalesforceUser ? "Yes" : "No",
        `"${esc(sf?.username ?? "")}"`,
        `"${esc(sf?.federationId ?? "")}"`,
        `"${esc(sf?.profile ?? "")}"`,
        `"${esc(sf?.role ?? "")}"`,
        `"${esc(sf?.umgcDepartment ?? "")}"`,
        `"${esc(sf?.sfDepartment ?? "")}"`,
        `"${esc(sf?.departmentLicense ?? "")}"`,
        `"${esc(sf?.alias ?? "")}"`,
        `"${esc(sf?.lastLoginDate ?? "")}"`,
        `"${esc(sf?.createdDate ?? "")}"`,
        `"${esc(teamNames)}"`,
      );
    }
    return base.join(",");
  });

  writeFileSync(filepath, [header, ...rows].join("\n"), "utf-8");
  return filepath;
}

/**
 * Write Markdown report with Mermaid diagram
 */
function writeMarkdown(
  members: TeamMember[],
  currentUser: string,
  department: string,
  summary: TeamDiscoverySummary,
  includeDepartment: boolean,
  outputDir: string,
  timestamp: string,
  leaderName?: string,
): string {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const filepath = join(outputDir, `team-members-${timestamp}.md`);
  const dateStr = new Date().toLocaleString();
  const lines: string[] = [];
  const isLeaderMode = !!leaderName;

  lines.push(isLeaderMode ? `# ${leaderName}'s Team` : "# Team Organization Chart");
  lines.push("");
  lines.push(`**Generated:** ${dateStr}`);
  lines.push("");
  if (isLeaderMode) {
    lines.push(`**Team Leader:** ${leaderName}`);
    lines.push("");
    lines.push(`**Logged in as:** ${currentUser}`);
  } else {
    lines.push(`**Center of Organization:** ${currentUser}`);
  }
  lines.push("");
  lines.push(`**Department:** ${department}`);
  lines.push("");

  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("|--------|-------|");
  lines.push(`| **Total Team Members** | ${summary.total} |`);
  if (isLeaderMode) {
    const teamCount = members.filter((m) => m.relationship === "Team Member").length;
    lines.push(`| Team Members | ${teamCount} |`);
  } else {
    if (summary.managers > 0) lines.push(`| Manager(s) | ${summary.managers} |`);
    if (summary.peers > 0) lines.push(`| Peers | ${summary.peers} |`);
    if (summary.peerTeam > 0) lines.push(`| Peer's Team | ${summary.peerTeam} |`);
    if (summary.subordinates > 0)
      lines.push(`| Direct/Indirect Reports | ${summary.subordinates} |`);
  }
  if (includeDepartment && summary.department > 0) {
    lines.push(`| Department Colleagues | ${summary.department} |`);
  }
  lines.push("");

  lines.push("## Organization Chart");
  lines.push("");
  lines.push(buildMermaidDiagram(members));
  lines.push("");

  if (isLeaderMode) {
    // Leader mode sections
    const leader = members.filter((m) => m.relationship === "Leader");
    if (leader.length > 0) {
      lines.push("## Team Leader");
      lines.push("");
      lines.push("| Name | Title | Email |");
      lines.push("|------|-------|-------|");
      for (const m of leader) lines.push(`| ${m.name} | ${m.title} | ${m.email} |`);
      lines.push("");
    }

    const you = members.filter((m) => m.relationship === "You");
    if (you.length > 0 && !leader.some((l) => l.email === you[0]?.email)) {
      lines.push("## You");
      lines.push("");
      lines.push("| Name | Title | Email | Manager |");
      lines.push("|------|-------|-------|---------|");
      for (const m of you) lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
      lines.push("");
    }

    const team = members.filter((m) => m.relationship === "Team Member");
    if (team.length > 0) {
      lines.push("## Team Members");
      lines.push("");
      lines.push("| Name | Title | Email | Manager |");
      lines.push("|------|-------|-------|---------|");
      for (const m of team.sort((a, b) => a.name.localeCompare(b.name)))
        lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
      lines.push("");
    }
  } else {
    // You-centric mode sections
    const managers = members.filter((m) => m.relationship === "Your Manager");
    if (managers.length > 0) {
      lines.push("## Management");
      lines.push("");
      lines.push("| Name | Title | Email |");
      lines.push("|------|-------|-------|");
      for (const m of managers) lines.push(`| ${m.name} | ${m.title} | ${m.email} |`);
      lines.push("");
    }

    const you = members.filter((m) => m.relationship === "You");
    if (you.length > 0) {
      lines.push("## You");
      lines.push("");
      lines.push("| Name | Title | Email |");
      lines.push("|------|-------|-------|");
      for (const m of you) lines.push(`| ${m.name} | ${m.title} | ${m.email} |`);
      lines.push("");
    }

    const peers = members.filter((m) => m.relationship === "Peer");
    if (peers.length > 0) {
      lines.push("## Peers");
      lines.push("");
      lines.push("| Name | Title | Email | Manager |");
      lines.push("|------|-------|-------|---------|");
      for (const m of peers.sort((a, b) => a.name.localeCompare(b.name)))
        lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
      lines.push("");
    }

    const peerTeam = members.filter((m) => m.relationship === "Peer's Team");
    if (peerTeam.length > 0) {
      lines.push("## Peer's Team Members");
      lines.push("");
      lines.push("| Name | Title | Email | Manager |");
      lines.push("|------|-------|-------|---------|");
      for (const m of peerTeam.sort((a, b) => a.name.localeCompare(b.name)))
        lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
      lines.push("");
    }

    const subordinates = members.filter((m) => m.relationship === "Subordinate");
    if (subordinates.length > 0) {
      lines.push("## Team Members (Direct & Indirect Reports)");
      lines.push("");
      lines.push("| Name | Title | Email | Manager |");
      lines.push("|------|-------|-------|---------|");
      for (const m of subordinates.sort((a, b) => a.name.localeCompare(b.name)))
        lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
      lines.push("");
    }

    if (includeDepartment) {
      const dept = members.filter((m) => m.relationship === "Department");
      if (dept.length > 0) {
        lines.push("## Department Colleagues");
        lines.push("");
        lines.push("| Name | Title | Email | Manager |");
        lines.push("|------|-------|-------|---------|");
        for (const m of dept.sort((a, b) => a.name.localeCompare(b.name)))
          lines.push(`| ${m.name} | ${m.title} | ${m.email} | ${m.manager} |`);
        lines.push("");
      }
    }
  }

  lines.push("## Legend");
  lines.push("");
  lines.push("- **Green**: You");
  if (isLeaderMode) {
    lines.push("- **Pink**: Team leader");
  } else {
    lines.push("- **Blue**: Your manager");
    lines.push("- **Purple**: Peer's team members");
    lines.push("- **Orange**: Your subordinates");
  }
  lines.push("");
  lines.push("---");
  lines.push("");
  lines.push("*Generated by team-tools using Microsoft Graph API*");

  writeFileSync(filepath, lines.join("\n"), "utf-8");
  return filepath;
}

/**
 * Main entry point: discover team members from Microsoft Graph
 *
 * Two modes:
 *   --leader <email>  : roots tree at that person (deterministic, team-centric)
 *   (no --leader)     : roots tree at /me (you-centric, legacy)
 */
export async function discoverTeamMembers(
  options: TeamDiscoveryOptions = {},
): Promise<TeamDiscoveryResult> {
  const timer = createTimer();
  const files: string[] = [];
  const config = loadSharedConfig();
  const outputDir = options.outputDir ?? config.paths.reports;
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const CONCURRENCY = 10;

  validateAzureAuth();

  // Identify current user (always needed)
  logInfo("Step 1: Identifying current user...");
  const me = await getCurrentUser();
  const myEmail = (me.mail ?? me.userPrincipalName).toLowerCase();
  logInfo(`  Logged in as: ${me.displayName}`);

  const teamMembers: TeamMember[] = [];
  const discovered = new Set<string>();
  let leaderName: string | undefined;
  let rootDepartment: string;

  if (options.leaderEmail) {
    // ═══════════════════════════════════════════════
    // LEADER MODE — tree rooted at specified leader
    // ═══════════════════════════════════════════════
    logInfo(`Step 2: Finding team leader: ${options.leaderEmail}...`);
    const leader = await getUserDetails(options.leaderEmail);
    leaderName = leader.displayName;
    rootDepartment = leader.department ?? "";
    logInfo(`  Leader: ${leader.displayName} (${leader.jobTitle ?? "N/A"})`);
    logInfo(`  Department: ${rootDepartment || "N/A"}`);

    // Add the leader
    const leaderEmail = (leader.mail ?? leader.userPrincipalName).toLowerCase();
    const leaderIsMe = leaderEmail === myEmail;
    teamMembers.push(toTeamMember(leader, leaderIsMe ? "You" : "Leader"));
    discovered.add(leader.id);

    // Recursively discover everyone under the leader
    logInfo("Step 3: Discovering all team members (recursively)...");
    const allReports = await getDirectReportsRecursive(leader.id, new Set<string>());
    const newMembers = allReports.filter((u) => !discovered.has(u.id));
    for (const u of newMembers) discovered.add(u.id);

    for (let i = 0; i < newMembers.length; i += CONCURRENCY) {
      const batch = newMembers.slice(i, i + CONCURRENCY);
      const details = await Promise.all(batch.map((u) => getUserDetails(u.id)));
      for (const d of details) {
        if (!isRealUser(d)) continue;
        const email = (d.mail ?? d.userPrincipalName).toLowerCase();
        teamMembers.push(toTeamMember(d, email === myEmail ? "You" : "Team Member"));
      }
    }
    logInfo(`  Found ${newMembers.length} team members under ${leader.displayName}`);
  } else {
    // ═══════════════════════════════════════════════
    // YOU-CENTRIC MODE — existing behavior
    // ═══════════════════════════════════════════════
    rootDepartment = me.department ?? "";
    logInfo(`  Department: ${rootDepartment || "N/A"}`);

    teamMembers.push(toTeamMember(me, "You"));
    discovered.add(me.id);

    // Step 2 — manager
    if (me.manager) {
      logInfo("Step 2: Finding your manager...");
      const manager = await getUserDetails(me.manager.id);
      logInfo(`  Manager: ${manager.displayName} (${manager.jobTitle ?? "N/A"})`);

      if (!discovered.has(manager.id)) {
        teamMembers.push(toTeamMember(manager, "Your Manager"));
        discovered.add(manager.id);
      }

      // Step 3 — peers
      logInfo("Step 3: Finding your peers...");
      const peersResp = await graphGet<GraphCollection<GraphUser>>(
        `/users/${manager.id}/directReports?$select=${GRAPH_USER_SELECT}`,
      );
      let peerCount = 0;
      for (const peer of peersResp.value) {
        if (!discovered.has(peer.id) && isRealUser(peer)) {
          teamMembers.push(
            toTeamMember(
              {
                ...peer,
                manager: { id: manager.id, displayName: manager.displayName, mail: manager.mail },
              },
              "Peer",
            ),
          );
          discovered.add(peer.id);
          peerCount++;
        }
      }
      logInfo(`  Found ${peerCount} peers`);

      // Step 3b — peer subordinates (recursive)
      logInfo("Step 3b: Finding peer team hierarchies...");
      let peerTeamCount = 0;
      for (const peer of peersResp.value) {
        if (peer.id === me.id) continue;
        const peerSubs = await getDirectReportsRecursive(peer.id, new Set<string>());
        const newPeerSubs = peerSubs.filter((s) => !discovered.has(s.id));
        for (const s of newPeerSubs) discovered.add(s.id);

        for (let i = 0; i < newPeerSubs.length; i += CONCURRENCY) {
          const batch = newPeerSubs.slice(i, i + CONCURRENCY);
          const details = await Promise.all(batch.map((s) => getUserDetails(s.id)));
          for (const d of details) {
            if (!isRealUser(d)) continue;
            teamMembers.push(toTeamMember(d, "Peer's Team"));
          }
        }
        peerTeamCount += newPeerSubs.length;
      }
      logInfo(`  Found ${peerTeamCount} peer team members`);
    } else {
      logInfo("Step 2: No manager found — skipping peer discovery");
    }

    // Step 4 — subordinates (recursive)
    logInfo("Step 4: Finding your subordinates (recursively)...");
    const subordinates = await getDirectReportsRecursive(me.id, new Set<string>());
    const newSubs = subordinates.filter((sub) => !discovered.has(sub.id));
    for (const sub of newSubs) discovered.add(sub.id);

    for (let i = 0; i < newSubs.length; i += CONCURRENCY) {
      const batch = newSubs.slice(i, i + CONCURRENCY);
      const details = await Promise.all(batch.map((sub) => getUserDetails(sub.id)));
      for (const subDetails of details) {
        if (!isRealUser(subDetails)) continue;
        teamMembers.push(toTeamMember(subDetails, "Subordinate"));
      }
    }
    logInfo(`  Found ${newSubs.length} subordinates (including indirect)`);

    // Step 5 — department (optional)
    if (options.includeDepartment && me.department) {
      logInfo(`Step 5: Finding all members of '${me.department}' department...`);
      const safeDept = me.department.replace(/'/g, "''");
      const filter = `department eq '${safeDept}'`;
      let deptUrl: string | null =
        `${GRAPH_API_BASE}/users?$select=${GRAPH_USER_SELECT}&$filter=${encodeURIComponent(filter)}&$top=999`;

      while (deptUrl) {
        const deptResp: GraphCollection<GraphUser> =
          await graphGet<GraphCollection<GraphUser>>(deptUrl);
        const newDeptUsers = deptResp.value.filter((u) => !discovered.has(u.id));
        for (const u of newDeptUsers) discovered.add(u.id);

        for (let i = 0; i < newDeptUsers.length; i += CONCURRENCY) {
          const batch = newDeptUsers.slice(i, i + CONCURRENCY);
          const details = await Promise.all(batch.map((u) => getUserDetails(u.id)));
          for (const d of details) {
            if (!isRealUser(d)) continue;
            teamMembers.push(toTeamMember(d, "Department"));
          }
        }
        deptUrl = deptResp["@odata.nextLink"] ?? null;
      }

      const deptTotal = teamMembers.filter((m) => m.department === me.department).length;
      logInfo(`  Total department members: ${deptTotal}`);
    }
  }

  // Sort by name
  teamMembers.sort((a, b) => a.name.localeCompare(b.name));

  // Salesforce enrichment (optional)
  if (options.enrichSalesforce) {
    logInfo("Enriching with Salesforce user data...");
    try {
      await enrichWithSalesforce(teamMembers);
    } catch (error) {
      logInfo(
        `  Salesforce enrichment failed (non-fatal): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  // Build summary
  const summary: TeamDiscoverySummary = {
    total: teamMembers.length,
    managers: teamMembers.filter((m) => m.relationship === "Your Manager").length,
    peers: teamMembers.filter((m) => m.relationship === "Peer").length,
    peerTeam: teamMembers.filter((m) => m.relationship === "Peer's Team").length,
    subordinates: teamMembers.filter((m) => m.relationship === "Subordinate").length,
    department: teamMembers.filter((m) => m.relationship === "Department").length,
    withManager: teamMembers.filter((m) => m.manager).length,
    withoutManager: teamMembers.filter((m) => !m.manager).length,
  };

  // Always export CSV
  const csvPath = writeCsv(teamMembers, outputDir, timestamp);
  files.push(csvPath);
  logInfo(`Exported CSV: ${csvPath}`);

  if (options.exportMarkdown) {
    const mdPath = writeMarkdown(
      teamMembers,
      me.displayName,
      rootDepartment,
      summary,
      !!options.includeDepartment,
      outputDir,
      timestamp,
      leaderName,
    );
    files.push(mdPath);
    logInfo(`Exported Markdown: ${mdPath}`);
  }

  timer.log("Team member discovery");

  const result: TeamDiscoveryResult = {
    success: true,
    message: leaderName
      ? `Discovered ${teamMembers.length} members of ${leaderName}'s team`
      : `Discovered ${teamMembers.length} team members`,
    currentUser: me.displayName,
    leader: leaderName,
    department: rootDepartment,
    members: teamMembers,
    summary,
    files,
  };

  // Always write JSON to file
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const jsonPath = join(outputDir, `team-members-${timestamp}.json`);
  writeFileSync(jsonPath, JSON.stringify(result, null, 2), "utf-8");
  result.files.push(jsonPath);
  logInfo(`Exported JSON: ${jsonPath}`);

  return result;
}
