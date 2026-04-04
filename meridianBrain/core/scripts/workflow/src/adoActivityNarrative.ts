/**
 * Activity Narrative Report Generator
 *
 * Reads enriched CSV activity data and generates a rich, story-driven HTML report.
 * The narrative groups ALL activities (ADO edits, comments, PRs, SF changes) by topic,
 * explains what each ticket is about, what was done and why, and cross-references
 * related work — assuming the reader knows nothing about the project.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { getProjectRoot } from "./lib/configLoader.js";
import { logInfo } from "./lib/loggerStructured.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CsvRow {
  Date: string;
  WorkItemId: string;
  PRNumber: string;
  WorkItemType: string;
  State: string;
  AreaPath: string;
  IterationPath: string;
  Title: string;
  ActivityType: string;
  Details: string;
  Actor: string;
  AssignedTo: string;
  ParentId: string;
  ParentTitle: string;
  Tags: string;
  StoryPoints: string;
  Priority: string;
  ComponentName: string;
  CompletedWork: string;
  RemainingWork: string;
  OriginalEstimate: string;
  ActivityType2: string;
  PrChangedComponents: string;
  BoardColumn: string;
  DevelopmentSummary: string;
  Description: string;
  AcceptanceCriteria: string;
  ReproSteps: string;
}

/** A topic cluster groups all related activities around a single workstream */
interface TopicCluster {
  /** Display name for this topic (parent title, or work item title if no parent) */
  topicName: string;
  /** Parent work item ID, if any */
  parentId: string;
  /** Area path for context (e.g., "CRM - DREAM\FastTrack") */
  areaPath: string;
  /** All unique work item IDs in this cluster */
  workItemIds: Set<string>;
  /** ADO edit/state/assignment activities */
  edits: CsvRow[];
  /** Comments and mentions */
  comments: CsvRow[];
  /** Pull requests related to this topic */
  prs: CsvRow[];
  /** Salesforce metadata changes correlated to this topic */
  sfChanges: CsvRow[];
  /** Wiki activities related to this topic */
  wiki: CsvRow[];
}

interface TeamMember {
  name: string;
  email: string;
  relationship: string;
  title: string;
}

interface PeerMetrics {
  name: string;
  email: string;
  totalActivities: number;
  workItemsTouched: number;
  daysActive: number;
  stateTransitions: number;
  itemsClosed: number;
  completedWorkHours: number;
}

interface NarrativeOptions {
  csvPath: string;
  personName: string;
  dateRange: string;
  peerMetrics?: PeerMetrics[];
  teamMembers?: TeamMember[];
  days?: number;
}

// ---------------------------------------------------------------------------
// CSV Parser (handles quoted fields)
// ---------------------------------------------------------------------------

function parseCsv(content: string): CsvRow[] {
  // Reassemble logical lines: a line ending inside an open quote is part of the same record
  const rawLines = content.split("\n");
  const logicalLines: string[] = [];
  let buffer = "";
  let open = false;
  for (const raw of rawLines) {
    if (buffer) buffer += "\n";
    buffer += raw;
    // Count unescaped quotes to determine if we're still inside a quoted field
    for (const ch of raw) {
      if (ch === '"') open = !open;
    }
    if (!open) {
      logicalLines.push(buffer);
      buffer = "";
    }
  }
  if (buffer) logicalLines.push(buffer); // flush any trailing partial

  const lines = logicalLines.filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]!);
  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]!);
    // Skip malformed rows that don't have enough columns
    if (values.length < headers.length * 0.5) continue;
    const row: Record<string, string> = {};
    for (let h = 0; h < headers.length; h++) {
      row[headers[h]!] = values[h] || "";
    }
    rows.push(row as unknown as CsvRow);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function stripEmail(actor: string): string {
  return actor.replace(/<[^>]+>/g, "").trim();
}

function describeAreaPath(area: string): string {
  const parts = area.split("\\");
  // "Digital Platforms\CRM - DREAM\FastTrack" → "CRM - DREAM / FastTrack"
  return parts.slice(1).join(" / ") || parts[0] || "Unknown";
}

// Topic Clustering Engine
// ---------------------------------------------------------------------------

function buildTopicClusters(rows: CsvRow[]): TopicCluster[] {
  // Step 1: Separate row types
  const adoRows = rows.filter((r) => r.WorkItemId && !r.ActivityType.startsWith("SF"));
  const sfRows = rows.filter((r) => r.ActivityType === "SFMetadataChange");
  const sfLogins = rows.filter((r) => r.ActivityType === "SFLogin");
  const prRows = rows.filter((r) => r.ActivityType.startsWith("PR"));
  const wikiRows = rows.filter((r) => r.ActivityType.startsWith("Wiki"));

  // Step 2: Build clusters from ADO rows, grouped by workstream.
  // Tasks cluster by their parent (user story / bug) — they're subtasks of a story.
  // User Stories, Bugs, and other non-Task types cluster by their OWN title —
  // each story/bug IS the workstream, not the Feature/Epic above it.
  const clusterMap = new Map<string, TopicCluster>();
  const taskTypes = new Set(["Task"]);

  for (const row of adoRows) {
    const isTask = taskTypes.has(row.WorkItemType);
    // Tasks group under their parent story; stories/bugs group by themselves
    const clusterKey =
      isTask && row.ParentTitle ? row.ParentTitle : row.Title || row.ParentTitle || "Uncategorized";
    const clusterId = isTask && row.ParentId ? row.ParentId : row.WorkItemId || row.ParentId || "";
    let cluster = clusterMap.get(clusterKey);
    if (!cluster) {
      cluster = {
        topicName: clusterKey,
        parentId: clusterId,
        areaPath: row.AreaPath,
        workItemIds: new Set<string>(),
        edits: [],
        comments: [],
        prs: [],
        sfChanges: [],
        wiki: [],
      };
      clusterMap.set(clusterKey, cluster);
    }

    cluster.workItemIds.add(row.WorkItemId);
    if (!cluster.areaPath && row.AreaPath) cluster.areaPath = row.AreaPath;
    if (!cluster.parentId && clusterId) cluster.parentId = clusterId;

    // Classify into subcategory
    if (row.ActivityType === "Comment" || row.ActivityType.includes("Mention")) {
      cluster.comments.push(row);
    } else {
      cluster.edits.push(row);
    }
  }

  // Step 3: Assign PRs to clusters by matching branch name or title keywords
  for (const pr of prRows) {
    let assigned = false;
    const prTitle = pr.Title.toLowerCase();
    const prBranch = (pr.ComponentName || "").toLowerCase();

    for (const cluster of clusterMap.values()) {
      // Match by work item ID in branch name (e.g., "feature/234519-phone-actions")
      for (const wiId of cluster.workItemIds) {
        if (prBranch.includes(wiId) || prTitle.includes(wiId)) {
          cluster.prs.push(pr);
          assigned = true;
          break;
        }
      }
      if (assigned) break;

      // Match by topic name keywords overlap
      const topicWords = cluster.topicName
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      const matchCount = topicWords.filter(
        (w) => prTitle.includes(w) || prBranch.includes(w),
      ).length;
      if (matchCount >= 2) {
        cluster.prs.push(pr);
        assigned = true;
        break;
      }
    }

    // Unassigned PRs get their own cluster
    if (!assigned) {
      const key = `PR: ${pr.Title}`;
      let cluster = clusterMap.get(key);
      if (!cluster) {
        cluster = {
          topicName: pr.Title,
          parentId: "",
          areaPath: "Git",
          workItemIds: new Set<string>(),
          edits: [],
          comments: [],
          prs: [],
          sfChanges: [],
          wiki: [],
        };
        clusterMap.set(key, cluster);
      }
      cluster.prs.push(pr);
    }
  }

  // Step 4: Assign SF metadata changes to clusters by component name matching
  for (const sf of sfRows) {
    let assigned = false;
    const sfComp = (sf.ComponentName || sf.Title).toLowerCase();

    for (const cluster of clusterMap.values()) {
      const topicWords = cluster.topicName
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 3);
      // Check component name against topic words or work item titles in cluster
      const compWords = sfComp
        .split(/(?=[A-Z])|[-_\s]+/)
        .map((w) => w.toLowerCase())
        .filter((w) => w.length > 3);

      // Check if any ADO item titles in this cluster relate to the SF component
      let relatedByTitle = false;
      const allTitles = [...cluster.edits, ...cluster.comments].map((r) => r.Title.toLowerCase());
      for (const title of allTitles) {
        const titleOverlap = compWords.filter((w) => title.includes(w));
        if (titleOverlap.length >= 2) {
          relatedByTitle = true;
          break;
        }
      }

      // Also check topic-level
      const topicOverlap = compWords.filter((w) =>
        topicWords.some((tw) => tw.includes(w) || w.includes(tw)),
      );

      if (relatedByTitle || topicOverlap.length >= 2) {
        cluster.sfChanges.push(sf);
        assigned = true;
        break;
      }
    }

    // Unassigned SF changes go to a general SF cluster
    if (!assigned) {
      const key = "__sf_uncorrelated__";
      let cluster = clusterMap.get(key);
      if (!cluster) {
        cluster = {
          topicName: "Salesforce Platform Work",
          parentId: "",
          areaPath: "Salesforce",
          workItemIds: new Set<string>(),
          edits: [],
          comments: [],
          prs: [],
          sfChanges: [],
          wiki: [],
        };
        clusterMap.set(key, cluster);
      }
      cluster.sfChanges.push(sf);
    }
  }

  // Step 5: SF Logins — add to a special cluster
  if (sfLogins.length > 0) {
    clusterMap.set("__sf_logins__", {
      topicName: "Salesforce Platform Access",
      parentId: "",
      areaPath: "Salesforce",
      workItemIds: new Set<string>(),
      edits: sfLogins, // store logins as "edits" for this special cluster
      comments: [],
      prs: [],
      sfChanges: [],
      wiki: [],
    });
  }

  // Step 6: Wiki
  if (wikiRows.length > 0) {
    clusterMap.set("__wiki__", {
      topicName: "Documentation & Wiki",
      parentId: "",
      areaPath: "Wiki",
      workItemIds: new Set<string>(),
      edits: [],
      comments: [],
      prs: [],
      sfChanges: [],
      wiki: wikiRows,
    });
  }

  // Sort clusters: most activities first, SF logins/wiki last
  const clusters = Array.from(clusterMap.entries());
  clusters.sort((a, b) => {
    // Special clusters go last
    const aSpecial = a[0].startsWith("__") ? 1 : 0;
    const bSpecial = b[0].startsWith("__") ? 1 : 0;
    if (aSpecial !== bSpecial) return aSpecial - bSpecial;

    const aCount =
      a[1].edits.length + a[1].comments.length + a[1].prs.length + a[1].sfChanges.length;
    const bCount =
      b[1].edits.length + b[1].comments.length + b[1].prs.length + b[1].sfChanges.length;
    return bCount - aCount;
  });

  return clusters.map(([, v]) => v);
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

interface SelfMetrics {
  totalActivities: number;
  workItemsTouched: number;
  daysActive: number;
  stateTransitions: number;
  itemsClosed: number;
  completedWorkHours: number;
}

interface PeerAverages {
  peerCount: number;
  avgActivities: number;
  avgWorkItems: number;
  avgDaysActive: number;
  avgItemsClosed: number;
  avgHours: number;
}

function computeSelfMetrics(rows: CsvRow[]): SelfMetrics {
  const workItems = new Set(rows.filter((r) => r.WorkItemId).map((r) => r.WorkItemId));
  const days = new Set(rows.map((r) => r.Date.substring(0, 10)));
  const stateChanges = rows.filter((r) => r.Details.includes("State:"));
  const closed = rows.filter(
    (r) => r.Details.includes("->Closed") || r.Details.includes("->Resolved"),
  );

  let totalHours = 0;
  const seenWi = new Set<string>();
  for (const r of rows) {
    if (r.WorkItemId && r.CompletedWork && !seenWi.has(r.WorkItemId)) {
      seenWi.add(r.WorkItemId);
      totalHours += parseFloat(r.CompletedWork) || 0;
    }
  }

  return {
    totalActivities: rows.length,
    workItemsTouched: workItems.size,
    daysActive: days.size,
    stateTransitions: stateChanges.length,
    itemsClosed: closed.length,
    completedWorkHours: totalHours,
  };
}

function computePeerAverages(peers: PeerMetrics[]): PeerAverages {
  if (peers.length === 0) {
    return {
      peerCount: 0,
      avgActivities: 0,
      avgWorkItems: 0,
      avgDaysActive: 0,
      avgItemsClosed: 0,
      avgHours: 0,
    };
  }
  const n = peers.length;
  return {
    peerCount: n,
    avgActivities: Math.round(peers.reduce((s, p) => s + p.totalActivities, 0) / n),
    avgWorkItems: Math.round(peers.reduce((s, p) => s + p.workItemsTouched, 0) / n),
    avgDaysActive: Math.round(peers.reduce((s, p) => s + p.daysActive, 0) / n),
    avgItemsClosed: Math.round(peers.reduce((s, p) => s + p.itemsClosed, 0) / n),
    avgHours: Math.round((peers.reduce((s, p) => s + p.completedWorkHours, 0) / n) * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Signal vs Noise classification for timeline events
// ---------------------------------------------------------------------------

function isNoiseActivity(row: CsvRow): boolean {
  const d = row.Details.toLowerCase();
  // Mechanical ADO events that don't convey what was done
  if (d.includes("made initial updates to this work item")) return true;
  if (d === "work item updated" || d === "work item created") return true;
  if (d.startsWith("field changes:") && !d.includes("state:")) return true;
  // Service-account assignments
  if (row.ActivityType === "AssignedTo" && row.Actor.toLowerCase().includes("svc-")) return true;
  // Generic edits with only field changes (no state change, no hours)
  if (
    row.ActivityType === "Edit" &&
    !d.includes("state:") &&
    !d.includes("completedwork") &&
    !d.includes("storypoints")
  )
    return true;
  return false;
}

// ---------------------------------------------------------------------------
// Workstream Digest — structured markdown for LLM narrative generation
// ---------------------------------------------------------------------------
/* ---- HTML generation functions removed ----
   All narrative, charts, and visual rendering is now handled by the agent.
   The script only produces structured evidence (CSV + digest markdown).
   See .github/prompts/util-activity-report.prompt.md for the agent workflow.
   ---- */

// NOTE: The following dead HTML functions were removed in this refactor:
// generateExecutiveSummary, synthesizeComments, pickBestSnippets, generateStatusLine,
// generateTechFootprint, generateTopicSection, stateBadge, activityIcon, humanizeDetails,
// generateSfLoginSection, generateWikiSection, generateFlowHealthSection,
// generateActivityTypeChart, generateActivityPatternsSection, generateTeamContextSection,
// generateCelebrationsSection, generateConversationStartersSection, convertHtmlToPdf

function generateWorkstreamDigest(
  rows: CsvRow[],
  clusters: TopicCluster[],
  personName: string,
  dateRange: string,
  reportDays: number,
  selfMetrics: SelfMetrics,
  peerMetrics: PeerMetrics[] | undefined,
  peerAvg: PeerAverages,
): string {
  const name = stripEmail(personName);
  const uniqueItems = new Set(rows.filter((r) => r.WorkItemId).map((r) => r.WorkItemId)).size;
  const totalComments = rows.filter((r) => r.ActivityType === "Comment").length;
  const totalMentions = rows.filter((r) => r.ActivityType.includes("Mention")).length;
  const totalPRs = rows.filter((r) => r.ActivityType === "PRCreated").length;
  const totalSF = rows.filter((r) => r.ActivityType === "SFMetadataChange").length;
  const sfLogins = rows.filter((r) => r.ActivityType === "SFLogin").length;
  const closedTotal = rows.filter(
    (r) => r.Details.includes("->Closed") || r.Details.includes("->Resolved"),
  ).length;

  let md = `# Activity Digest: ${name}\n\n`;
  md += `**Period:** ${dateRange} (${reportDays} days)\n`;
  md += `**Overall:** ${uniqueItems} work items · ${rows.length} total activities · ${totalComments} comments · ${totalMentions} mentions · ${totalPRs} PRs · ${totalSF} SF deploys · ${sfLogins} SF logins · ${closedTotal} items closed\n`;
  md += `**Hours logged:** ${selfMetrics.completedWorkHours}h · **Days active:** ${selfMetrics.daysActive}\n\n`;

  // --- Activity Type Breakdown ---
  md += `## Activity Type Breakdown\n\n`;
  const typeCounts: Record<string, number> = {};
  const typeLabels: Record<string, string> = {
    Edit: "ADO Edits",
    Comment: "Comments",
    AssignedTo: "Assignments",
    ActionableMention: "Action Mentions",
    DiscussionMention: "Discussion Mentions",
    FYIMention: "FYI Mentions",
    SFMetadataChange: "SF Metadata",
    SFLogin: "SF Logins",
    PRCreated: "PRs Created",
    PRReviewed: "PRs Reviewed",
    PRMerged: "PRs Merged",
    WikiEdit: "Wiki Edits",
  };
  for (const r of rows) {
    const label = typeLabels[r.ActivityType] || r.ActivityType;
    typeCounts[label] = (typeCounts[label] || 0) + 1;
  }
  const sortedTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
  md += `| Activity Type | Count | % |\n`;
  md += `|---------------|-------|---|\n`;
  for (const [label, count] of sortedTypes) {
    md += `| ${label} | ${count} | ${((count / rows.length) * 100).toFixed(0)}% |\n`;
  }
  md += `\n`;

  // --- Daily Activity Pattern ---
  md += `## Daily Activity Pattern\n\n`;
  const byDay = new Map<string, CsvRow[]>();
  for (const r of rows) {
    const day = r.Date.substring(0, 10);
    const list = byDay.get(day) || [];
    list.push(r);
    byDay.set(day, list);
  }
  const sortedDays = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  md += `| Date | Day | Activities | Types |\n`;
  md += `|------|-----|------------|-------|\n`;
  for (const [day, dayRows] of sortedDays) {
    const d = new Date(day + "T12:00:00");
    const dayName = d.toLocaleDateString("en-US", { weekday: "short" });
    const typeSet = new Set(dayRows.map((r) => typeLabels[r.ActivityType] || r.ActivityType));
    md += `| ${day} | ${dayName} | ${dayRows.length} | ${[...typeSet].join(", ")} |\n`;
  }
  md += `\n`;

  // --- Peer Comparison ---
  if (peerMetrics && peerMetrics.length > 0) {
    md += `## Peer Comparison\n\n`;
    md += `### Summary (${name} vs Team Average)\n\n`;
    md += `| Metric | ${name} | Team Avg (${peerAvg.peerCount} peers) |\n`;
    md += `|--------|---------|----------|\n`;
    md += `| Total activities | ${selfMetrics.totalActivities} | ${peerAvg.avgActivities} |\n`;
    md += `| Work items touched | ${selfMetrics.workItemsTouched} | ${peerAvg.avgWorkItems} |\n`;
    md += `| Days active | ${selfMetrics.daysActive} | ${peerAvg.avgDaysActive} |\n`;
    md += `| Items closed | ${selfMetrics.itemsClosed} | ${peerAvg.avgItemsClosed} |\n`;
    md += `| Hours logged | ${selfMetrics.completedWorkHours}h | ${peerAvg.avgHours}h |\n\n`;

    md += `### Individual Peer Metrics\n\n`;
    md += `| Name | Activities | Work Items | Days Active | Items Closed | Hours |\n`;
    md += `|------|-----------|------------|-------------|--------------|-------|\n`;
    const sorted = [...peerMetrics].sort((a, b) => b.totalActivities - a.totalActivities);
    for (const p of sorted) {
      md += `| ${p.name} | ${p.totalActivities} | ${p.workItemsTouched} | ${p.daysActive} | ${p.itemsClosed} | ${p.completedWorkHours}h |\n`;
    }
    md += `\n`;
  }

  // --- Per-workstream digest ---
  const adoClusters = clusters.filter(
    (c) =>
      c.areaPath !== "Salesforce" &&
      c.areaPath !== "Wiki" &&
      (c.edits.length > 0 || c.comments.length > 0 || c.prs.length > 0),
  );

  md += `---\n\n`;
  md += `## Workstreams (${adoClusters.length})\n\n`;

  for (let i = 0; i < adoClusters.length; i++) {
    const cluster = adoClusters[i]!;
    md += generateClusterDigest(cluster, i + 1, name, rows);
  }

  // SF uncorrelated
  const sfUncorrelated = clusters.find((c) => c.topicName === "Salesforce Platform Work");
  if (sfUncorrelated && sfUncorrelated.sfChanges.length > 0) {
    md += `---\n\n### Salesforce Platform Work (uncorrelated to ADO work items)\n\n`;
    const compNames = [
      ...new Set(sfUncorrelated.sfChanges.map((sf) => sf.ComponentName || sf.Title)),
    ];
    md += `**${compNames.length} components deployed:** ${compNames.join(", ")}\n\n`;
  }

  // SF logins
  const sfLoginCluster = clusters.find((c) => c.topicName === "Salesforce Platform Access");
  if (sfLoginCluster) {
    const logins = sfLoginCluster.edits;
    const loginDays = new Set(logins.map((r) => r.Date.substring(0, 10))).size;
    const successful = logins.filter((r) => !r.Details.toLowerCase().includes("fail"));
    const failed = logins.length - successful.length;
    md += `---\n\n### Salesforce Platform Access\n\n`;
    md += `**${logins.length} logins** across **${loginDays} days** (${successful.length} successful, ${failed} failed)\n\n`;
  }

  // --- Artifact references for the agent ---
  md += `---\n\n## Report Generation References\n\n`;
  md += `- **HTML template:** \`core/templates/report-activity-narrative.html\`\n`;
  md += `- **Agent prompt:** \`.github/prompts/util-activity-report.prompt.md\`\n`;
  md += `- **Person name:** ${name}\n`;
  md += `- **Date range:** ${dateRange}\n`;
  md += `- **Report days:** ${reportDays}\n`;

  return md;
}

function generateClusterDigest(
  cluster: TopicCluster,
  idx: number,
  personName: string,
  allRows?: CsvRow[],
): string {
  let md = `---\n\n### ${idx}. ${cluster.topicName}\n\n`;

  // Workstream identity + parent context (critical for red flag detection)
  if (cluster.parentId) {
    const clusterRows = [...cluster.edits, ...cluster.comments];
    const isSelfCluster = cluster.workItemIds.has(cluster.parentId);

    if (isSelfCluster) {
      // Story/Bug cluster — parentId IS the story itself. Show its state + Feature parent for context.
      const selfRow = clusterRows.find((r) => r.WorkItemId === cluster.parentId);
      const selfDirect = allRows?.find((r) => r.WorkItemId === cluster.parentId);
      const selfState = selfDirect?.State || selfRow?.State || "";
      md += `**Work Item:** #${cluster.parentId}`;
      if (selfState) md += ` — Current State: **${selfState}**`;
      if (selfRow) {
        md += ` — Type: ${selfRow.WorkItemType} — Tags: ${selfRow.Tags || "none"} — SP: ${selfRow.StoryPoints || "?"} — Priority: P${selfRow.Priority || "?"}`;
      }
      md += `\n`;
      // Show Feature parent if available
      if (selfRow?.ParentId) {
        const featureRow = allRows?.find((r) => r.WorkItemId === selfRow.ParentId);
        md += `**Feature Parent:** #${selfRow.ParentId}`;
        if (selfRow.ParentTitle) md += ` — ${selfRow.ParentTitle}`;
        if (featureRow?.State) md += ` — State: **${featureRow.State}**`;
        md += `\n`;
      }
    } else {
      // Task cluster — parentId is the user story parent. Show its current state.
      const parentRow = clusterRows.find((r) => r.ParentId === cluster.parentId);
      const parentDirect = allRows?.find((r) => r.WorkItemId === cluster.parentId);
      const parentState = parentDirect?.State || "";
      md += `**Parent:** #${cluster.parentId}`;
      if (parentState) md += ` — Current State: **${parentState}**`;
      if (parentRow) {
        md += ` — Tags: ${parentRow.Tags || "none"} — SP: ${parentRow.StoryPoints || "?"} — Priority: P${parentRow.Priority || "?"}`;
      }
      md += `\n`;
    }
  }
  md += `**Area:** ${describeAreaPath(cluster.areaPath)}\n\n`;

  // Child work items table
  const byWi = new Map<string, CsvRow[]>();
  for (const r of [...cluster.edits, ...cluster.comments]) {
    if (r.WorkItemId) {
      const list = byWi.get(r.WorkItemId) || [];
      list.push(r);
      byWi.set(r.WorkItemId, list);
    }
  }

  if (byWi.size > 0) {
    md += `**Work Items:**\n\n`;
    md += `| ID | Title | Type | Current State | Board Column | Hours | Activity Type |\n`;
    md += `|----|-------|------|---------------|--------------|-------|---------------|\n`;
    for (const [wiId, wiRows] of byWi) {
      const latest = wiRows[0]!; // sorted newest-first from cluster building
      const hours = latest.CompletedWork ? `${latest.CompletedWork}h` : "-";
      md += `| #${wiId} | ${latest.Title} | ${latest.WorkItemType} | **${latest.State || "?"}** | ${latest.BoardColumn || "-"} | ${hours} | ${latest.ActivityType2 || "-"} |\n`;
    }
    md += `\n`;

    // Surface Development Summary if any work item has one
    const devSummaries = [...byWi.values()]
      .map((rows) => ({ id: rows[0]!.WorkItemId, summary: rows[0]!.DevelopmentSummary }))
      .filter((d) => d.summary && d.summary.trim().length > 0);
    if (devSummaries.length > 0) {
      md += `**Development Summary:**\n`;
      for (const ds of devSummaries) {
        // Strip HTML tags for clean markdown
        const clean = ds.summary
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (clean.length > 0) {
          md += `- #${ds.id}: ${clean.substring(0, 500)}${clean.length > 500 ? "…" : ""}\n`;
        }
      }
      md += `\n`;
    }

    // Surface Description for parent-level items (User Stories, Bugs, Defects)
    const stripHtml = (s: string) =>
      s
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&#\d+;/g, "")
        .replace(/\s+/g, " ")
        .trim();

    const descriptions = [...byWi.values()]
      .map((rows) => ({
        id: rows[0]!.WorkItemId,
        type: rows[0]!.WorkItemType,
        desc: rows[0]!.Description,
      }))
      .filter(
        (d) =>
          d.desc && d.desc.trim().length > 0 && ["User Story", "Bug", "Defect"].includes(d.type),
      );
    if (descriptions.length > 0) {
      md += `**Description:**\n`;
      for (const d of descriptions) {
        const clean = stripHtml(d.desc);
        if (clean.length > 0) {
          md += `- #${d.id}: ${clean.substring(0, 500)}${clean.length > 500 ? "…" : ""}\n`;
        }
      }
      md += `\n`;
    }

    // Surface Acceptance Criteria for User Stories
    const acItems = [...byWi.values()]
      .map((rows) => ({
        id: rows[0]!.WorkItemId,
        type: rows[0]!.WorkItemType,
        ac: rows[0]!.AcceptanceCriteria,
      }))
      .filter((d) => d.ac && d.ac.trim().length > 0 && d.type === "User Story");
    if (acItems.length > 0) {
      md += `**Acceptance Criteria:**\n`;
      for (const d of acItems) {
        const clean = stripHtml(d.ac);
        if (clean.length > 0) {
          md += `- #${d.id}: ${clean.substring(0, 500)}${clean.length > 500 ? "…" : ""}\n`;
        }
      }
      md += `\n`;
    }

    // Surface Repro Steps for Bugs/Defects
    const reproItems = [...byWi.values()]
      .map((rows) => ({
        id: rows[0]!.WorkItemId,
        type: rows[0]!.WorkItemType,
        repro: rows[0]!.ReproSteps,
      }))
      .filter((d) => d.repro && d.repro.trim().length > 0 && ["Bug", "Defect"].includes(d.type));
    if (reproItems.length > 0) {
      md += `**Repro Steps:**\n`;
      for (const d of reproItems) {
        const clean = stripHtml(d.repro);
        if (clean.length > 0) {
          md += `- #${d.id}: ${clean.substring(0, 500)}${clean.length > 500 ? "…" : ""}\n`;
        }
      }
      md += `\n`;
    }
  }

  // Related PRs
  if (cluster.prs.length > 0) {
    md += `**Pull Requests:**\n`;
    for (const pr of cluster.prs) {
      const action =
        pr.ActivityType === "PRCreated"
          ? "Created"
          : pr.ActivityType === "PRApproved"
            ? "Approved"
            : pr.ActivityType.replace("PR", "");
      md += `- ${action}: "${pr.Title}"`;
      if (pr.PrChangedComponents) md += ` — SF components: ${pr.PrChangedComponents}`;
      if (pr.ComponentName) md += ` — branch: ${pr.ComponentName}`;
      md += ` (${fmtDate(pr.Date)})\n`;
    }
    md += `\n`;
  }

  // Related SF changes
  if (cluster.sfChanges.length > 0) {
    const compNames = [...new Set(cluster.sfChanges.map((sf) => sf.ComponentName || sf.Title))];
    md += `**Salesforce Deployments:** ${compNames.join(", ")}\n\n`;
  }

  // Full chronological timeline — this is what the LLM needs to reason about
  const allEvents = [...cluster.edits, ...cluster.comments].sort((a, b) =>
    a.Date.localeCompare(b.Date),
  );

  if (allEvents.length > 0) {
    md += `**Timeline (chronological):**\n\n`;
    for (const evt of allEvents) {
      const date = fmtDate(evt.Date);
      const actor = stripEmail(evt.Actor);
      const wiRef = evt.WorkItemId ? ` on #${evt.WorkItemId}` : "";

      if (evt.ActivityType === "Comment") {
        // Full comment text — this is critical for LLM reasoning
        let text = evt.Details.replace(/^Comment:\s*/i, "");
        text = text
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#\d+;/g, "")
          .replace(/\s+/g, " ")
          .trim();
        md += `${date} — **${actor}** commented${wiRef}:\n> ${text}\n\n`;
      } else if (evt.ActivityType.includes("Mention")) {
        let text = evt.Details.replace(/^Mentioned in comment:\s*/i, "");
        text = text
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&#\d+;/g, "")
          .replace(/\s+/g, " ")
          .trim();
        md += `${date} — **${actor}** mentioned ${stripEmail(evt.AssignedTo || personName)}${wiRef}:\n> ${text}\n\n`;
      } else if (evt.Details.includes("State:")) {
        const stateMatch = evt.Details.match(/State:\s*(\S+)->(\S+)/);
        if (stateMatch) {
          md += `${date} — **${actor}** changed state${wiRef}: **${stateMatch[1]} → ${stateMatch[2]}**\n\n`;
        } else {
          md += `${date} — **${actor}**${wiRef}: ${evt.Details}\n\n`;
        }
      } else if (evt.ActivityType === "AssignedTo") {
        md += `${date} — ${evt.Details}${wiRef}\n\n`;
      } else if (evt.Details.includes("CompletedWork")) {
        md += `${date} — **${actor}** updated hours${wiRef}\n\n`;
      } else if (!isNoiseActivity(evt)) {
        md += `${date} — **${actor}**${wiRef}: ${evt.Details}\n\n`;
      }
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Main Generator
// ---------------------------------------------------------------------------

export function generateActivityDigest(options: NarrativeOptions): string {
  const { csvPath, personName, dateRange, peerMetrics, teamMembers: _teamMembers, days } = options;

  logInfo(`[PHASE] Generating activity digest...`);

  // Read and parse CSV
  const csvContent = readFileSync(csvPath, "utf-8");
  const rows = parseCsv(csvContent);
  logInfo(`  Parsed ${rows.length} activity rows from CSV`);

  // Build topic clusters
  const clusters = buildTopicClusters(rows);
  logInfo(`  Organized into ${clusters.length} topic clusters`);

  // Compute metrics
  const selfMetrics = computeSelfMetrics(rows);
  const peerAvg = peerMetrics ? computePeerAverages(peerMetrics) : computePeerAverages([]);
  const reportDays = days || 7;

  // Build comprehensive digest — all evidence, no narrative
  const digest = generateWorkstreamDigest(
    rows,
    clusters,
    personName,
    dateRange,
    reportDays,
    selfMetrics,
    peerMetrics,
    peerAvg,
  );

  // Write digest file alongside the CSV
  const digestPath = csvPath.replace(/\.csv$/, "-digest.md");
  const digestDir = dirname(digestPath);
  if (!existsSync(digestDir)) {
    mkdirSync(digestDir, { recursive: true });
  }
  writeFileSync(digestPath, digest, "utf-8");
  logInfo(`  Activity digest written to: ${digestPath}`);

  // Reference paths for the agent
  const templatePath = join(
    getProjectRoot(),
    "core",
    "templates",
    "report-activity-narrative.html",
  );
  logInfo(`  HTML template: ${templatePath}`);
  logInfo(`  CSV data: ${csvPath}`);

  return digestPath;
}
