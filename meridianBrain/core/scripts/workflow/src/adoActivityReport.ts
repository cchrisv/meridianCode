/**
 * Azure DevOps Activity Report Generator
 * Generates comprehensive activity reports for specified users
 */

import { createWriteStream, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { createAdoConnection, type AdoConnection } from "./adoClient.js";
import { executeSoqlQuery } from "./sfQueryExecutor.js";
import { loadSharedConfig, getProjectRoot } from "./lib/configLoader.js";
import { logInfo, logWarn } from "./lib/loggerStructured.js";
import type {
  ActivityTarget,
  ActivityRecord,
  ActivityReportOptions,
  ActivityReportResult,
  ActivityType,
  RevisionEntry,
} from "./types/adoActivityTypes.js";

/** ADO defaults from config (organization name and wiki repo ID for activity report). */
interface AdoDefaultsConfig {
  organization_name?: string;
  wiki_repo_id?: string;
}

function getAdoReportConfig(): { adoOrg: string; wikiRepoId: string } {
  const config = loadSharedConfig() as { ado_defaults?: AdoDefaultsConfig };
  const ado = config.ado_defaults;
  return {
    adoOrg: ado?.organization_name ?? "UMGC",
    wikiRepoId: ado?.wiki_repo_id ?? "c7b64b09-35f3-4d8a-889c-5650655281ee",
  };
}

/**
 * Clean HTML tags from text
 */
function cleanHtml(rawHtml: string | null | undefined): string {
  if (!rawHtml) return "";
  const cleanText = rawHtml.replace(/<[^>]*>/g, "");
  return cleanText.replace(/\s+/g, " ").trim();
}

/**
 * Classify mention type based on text content
 */
function classifyMention(text: string): ActivityType {
  const lowerText = text.toLowerCase();

  // Strong signals for Actionable
  if (text.includes("?")) return "ActionableMention";
  const actionableKeywords = [
    "please",
    "can you",
    "could you",
    "review",
    "approve",
    "check",
    "verify",
    "update",
    "fix",
    "status",
    "what is",
    "when",
  ];
  if (actionableKeywords.some((k) => lowerText.includes(k))) {
    return "ActionableMention";
  }

  // Strong signals for FYI
  const fyiKeywords = [
    "fyi",
    "cc:",
    "cc ",
    "copying",
    "adding",
    "heads up",
    "for info",
    "just to note",
  ];
  if (fyiKeywords.some((k) => lowerText.includes(k))) {
    return "FYIMention";
  }

  // If text is very short, likely a CC
  const cleanText = lowerText.replace(/@[a-z\s]+/g, "").trim();
  if (cleanText.length < 10) return "FYIMention";

  return "DiscussionMention";
}

/**
 * Extract SF component name from SetupAuditTrail Display/Action fields.
 * Patterns: "Changed LeadTriggerHandlerTest Apex Class code"
 *           "Created flow MyFlow"
 *           "Changed validation rule MyRule on Account"
 *           "changedApexClass" (Action field)
 */
function extractSfComponentName(display: string, action: string): string {
  // Try Display field first — usually "Changed/Created <Name> <Type> code/..."
  const displayMatch = display.match(
    /(?:Changed|Created|Deleted|Updated)\s+(.+?)\s+(?:Apex Class|Apex Trigger|Flow|Validation Rule|Lightning Component|Aura Component|LWC|Custom Object|Custom Field|Page Layout|Permission Set|Profile|Report Type|Workflow Rule|Process Builder)\b/i,
  );
  if (displayMatch?.[1]) return displayMatch[1].trim();

  // Try Action field — camelCase like "changedApexClass" or "createdFlow"
  const actionMatch = action.match(/(?:changed|created|deleted|updated)(\w+)/i);
  if (actionMatch?.[1]) {
    // Extract from the remaining Display text after the verb
    const afterVerb = display.replace(/^(?:Changed|Created|Deleted|Updated)\s+/i, "");
    // Take the first word cluster before " code" or end
    const nameMatch = afterVerb.match(/^(.+?)(?:\s+(?:Apex|code|flow|rule|component)|\s*$)/i);
    if (nameMatch?.[1]) return nameMatch[1].trim();
  }

  // Fallback: first meaningful words from Display
  const fallback = display
    .replace(/^(?:Changed|Created|Deleted|Updated)\s+/i, "")
    .split(/\s+(?:code|on)\b/)[0];
  return fallback?.trim() || "";
}

/**
 * Parse a file path from a PR diff to identify Salesforce metadata components.
 * Returns a human-readable label like "Apex Class: MyClass" or empty string if not SF metadata.
 */
function parseSfMetadataPath(filePath: string): string {
  if (!filePath) return "";
  const p = filePath.replace(/\\/g, "/");

  const patterns: Array<[RegExp, string]> = [
    [/\/classes\/([^/]+?)(?:\.cls|-meta\.xml)$/, "Apex Class"],
    [/\/triggers\/([^/]+?)(?:\.trigger|-meta\.xml)$/, "Trigger"],
    [/\/lwc\/([^/]+?)\//, "LWC"],
    [/\/aura\/([^/]+?)\//, "Aura"],
    [/\/flows\/([^/]+?)(?:\.flow|-meta\.xml)$/, "Flow"],
    [/\/objects\/([^/]+?)\/fields\/([^/]+?)\.field-meta\.xml$/, "Field"],
    [/\/objects\/([^/]+?)\/[^/]*\.object-meta\.xml$/, "Object"],
    [/\/permissionsets\/([^/]+?)\.permissionset-meta\.xml$/, "Permission Set"],
    [/\/profiles\/([^/]+?)\.profile-meta\.xml$/, "Profile"],
    [/\/layouts\/([^/]+?)\.layout-meta\.xml$/, "Layout"],
    [/\/pages\/([^/]+?)(?:\.page|-meta\.xml)$/, "VF Page"],
    [/\/flexipages\/([^/]+?)\.flexipage-meta\.xml$/, "FlexiPage"],
    [/\/customMetadata\/([^/]+?)\.md-meta\.xml$/, "Custom Metadata"],
    [/\/staticresources\/([^/]+?)(?:\.resource|-meta\.xml)$/, "Static Resource"],
    [/\/tabs\/([^/]+?)\.tab-meta\.xml$/, "Tab"],
    [/\/reports\/([^/]+?)(?:\.report|-meta\.xml)$/, "Report"],
    [/\/dashboards\/([^/]+?)(?:\.dashboard|-meta\.xml)$/, "Dashboard"],
  ];

  for (const [regex, label] of patterns) {
    const m = p.match(regex);
    if (m) {
      if (label === "Field" && m[1] && m[2]) return `Field: ${m[1]}.${m[2]}`;
      return `${label}: ${m[1] || ""}`;
    }
  }
  return "";
}

/**
 * Check if a name/email matches the target
 */
function isMatch(target: ActivityTarget, nameToCheck: string, emailToCheck: string): boolean {
  if (!nameToCheck && !emailToCheck) return false;

  const nameMatch =
    target.name && nameToCheck && nameToCheck.toLowerCase().includes(target.name.toLowerCase());
  const emailMatch =
    target.email && emailToCheck && emailToCheck.toLowerCase().includes(target.email.toLowerCase());

  return !!(nameMatch || emailMatch);
}

/**
 * Bulk-fetch ALL revisions for the period using the Reporting Revisions API.
 * Returns a Map keyed by work item ID, each value is an array of RevisionEntry
 * sorted by revision number ascending.
 *
 * This replaces per-item getUpdates() calls (~N calls → ~5-10 paginated GETs).
 */
export async function bulkFetchRevisions(
  conn: AdoConnection,
  days: number,
): Promise<Map<number, RevisionEntry[]>> {
  const { getAzureBearerToken } = await import("./lib/authAzureCli.js");
  const token = getAzureBearerToken();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString();

  const revisionsMap = new Map<number, RevisionEntry[]>();
  let continuationToken: string | null = null;
  let totalRevisions = 0;
  const startTime = Date.now();

  logInfo(`[PHASE] Streaming all revisions since ${startDateStr.split("T")[0]}...`);
  const { adoOrg } = getAdoReportConfig();

  // Request only small metadata fields — System.Description and System.History
  // are full HTML blobs that repeat per revision, creating multi-GB responses.
  // Comments and mentions are handled separately via targeted fetches.
  const revisionFields = [
    "System.Id",
    "System.Rev",
    "System.ChangedDate",
    "System.ChangedBy",
    "System.State",
    "System.AssignedTo",
    "System.Title",
    "System.WorkItemType",
    "System.AreaPath",
    "System.IterationPath",
    "System.Tags",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "Microsoft.VSTS.Common.Priority",
    "Microsoft.VSTS.Scheduling.CompletedWork",
    "Microsoft.VSTS.Scheduling.RemainingWork",
    "Microsoft.VSTS.Scheduling.OriginalEstimate",
    "Microsoft.VSTS.Common.Activity",
    "System.BoardColumn",
    "Custom.DevelopmentSummary",
  ].join(",");
  const baseUrl = `https://dev.azure.com/${adoOrg}/${encodeURIComponent(conn.project)}/_apis/wit/reporting/workitemrevisions?startDateTime=${encodeURIComponent(startDateStr)}&fields=${encodeURIComponent(revisionFields)}&api-version=7.1`;

  let pageNumber = 0;

  do {
    pageNumber++;
    try {
      let url = baseUrl;
      if (continuationToken) {
        url += `&continuationToken=${encodeURIComponent(continuationToken)}`;
      }

      logInfo(`  Fetching revision page ${pageNumber}...`);

      // 60-second timeout per page to avoid hanging indefinitely
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60_000);

      let response: Response;
      try {
        response = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        logWarn(`Reporting API error: ${response.status} ${response.statusText}`);
        break;
      }

      const data = (await response.json()) as {
        values?: Array<{
          id?: number;
          rev?: number;
          fields?: Record<string, unknown>;
        }>;
        continuationToken?: string;
        isLastBatch?: boolean;
      };

      if (data.values) {
        for (const raw of data.values) {
          if (!raw.id || !raw.fields) continue;

          const entry: RevisionEntry = {
            id: raw.id,
            rev: raw.rev ?? 0,
            changedDate: String(raw.fields["System.ChangedDate"] || ""),
            changedBy: String(raw.fields["System.ChangedBy"] || ""),
            fields: raw.fields,
          };

          let list = revisionsMap.get(raw.id);
          if (!list) {
            list = [];
            revisionsMap.set(raw.id, list);
          }
          list.push(entry);
        }

        totalRevisions += data.values.length;
      }

      const pageSize = data.values?.length ?? 0;
      continuationToken = data.continuationToken || null;

      // Guard: if the API returns a continuation token but zero values, stop
      if (pageSize === 0 && continuationToken) {
        logInfo(`  Page ${pageNumber}: empty page with continuation token — stopping`);
        continuationToken = null;
        break;
      }

      // Log every page (but throttle to avoid spam)
      const elapsed = (Date.now() - startTime) / 1000;
      if (pageSize > 0 || !continuationToken) {
        logInfo(
          `  Page ${pageNumber}: +${pageSize.toLocaleString()} revisions (${totalRevisions.toLocaleString()} total, ${revisionsMap.size.toLocaleString()} items, ${elapsed.toFixed(1)}s)`,
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        logWarn(`  Page ${pageNumber} timed out after 60s — proceeding with data collected so far`);
      } else {
        logWarn(`Reporting API error on page ${pageNumber}: ${error}`);
      }
      break;
    }
  } while (continuationToken);

  // Sort each work item's revisions by rev number ascending
  for (const [, revisions] of revisionsMap) {
    revisions.sort((a, b) => a.rev - b.rev);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logInfo(
    `  Completed: ${totalRevisions.toLocaleString()} revisions across ${revisionsMap.size.toLocaleString()} work items in ${elapsed.toFixed(1)}s`,
  );

  return revisionsMap;
}

/**
 * Process all revisions locally to extract activity records.
 * Handles edits, state transitions, and assignments from metadata fields only
 * (no History/Description — those are fetched separately via Comments API).
 *
 * Also returns the set of work item IDs where any target was active, so we
 * can do a targeted comment/mention fetch for just those items.
 */
function processRevisionsLocally(
  revisionsMap: Map<number, RevisionEntry[]>,
  detailsMap: Map<number, Record<string, unknown>>,
  targets: ActivityTarget[],
  cutoffDate: Date,
): { activities: ActivityRecord[]; relevantItemIds: Set<number> } {
  const activities: ActivityRecord[] = [];
  const relevantItemIds = new Set<number>();
  const startTime = Date.now();
  let processedItems = 0;
  let lastReportTime = startTime;

  logInfo(`[PHASE] Processing ${revisionsMap.size.toLocaleString()} work items locally...`);

  for (const [workItemId, revisions] of revisionsMap) {
    const details = detailsMap.get(workItemId);
    const wiTitle = String(details?.["System.Title"] || "No Title");
    const wiType = String(details?.["System.WorkItemType"] || "Unknown");
    const wiState = String(details?.["System.State"] || "Unknown");
    const wiArea = String(details?.["System.AreaPath"] || "Unknown");
    const wiBase = {
      workItemId: String(workItemId),
      workItemType: wiType,
      state: wiState,
      areaPath: wiArea,
      title: wiTitle,
      assignedTo: String(details?.["System.AssignedTo"] || ""),
      iterationPath: String(details?.["System.IterationPath"] || ""),
      tags: String(details?.["System.Tags"] || ""),
      storyPoints:
        details?.["Microsoft.VSTS.Scheduling.StoryPoints"] != null
          ? String(details["Microsoft.VSTS.Scheduling.StoryPoints"])
          : "",
      priority:
        details?.["Microsoft.VSTS.Common.Priority"] != null
          ? String(details["Microsoft.VSTS.Common.Priority"])
          : "",
      completedWork:
        details?.["Microsoft.VSTS.Scheduling.CompletedWork"] != null
          ? String(details["Microsoft.VSTS.Scheduling.CompletedWork"])
          : "",
      remainingWork:
        details?.["Microsoft.VSTS.Scheduling.RemainingWork"] != null
          ? String(details["Microsoft.VSTS.Scheduling.RemainingWork"])
          : "",
      originalEstimate:
        details?.["Microsoft.VSTS.Scheduling.OriginalEstimate"] != null
          ? String(details["Microsoft.VSTS.Scheduling.OriginalEstimate"])
          : "",
      activityType2: String(details?.["Microsoft.VSTS.Common.Activity"] || ""),
      boardColumn: String(details?.["System.BoardColumn"] || ""),
      developmentSummary: String(details?.["Custom.DevelopmentSummary"] || ""),
    };

    for (let ri = 0; ri < revisions.length; ri++) {
      const rev = revisions[ri]!;
      const prev: RevisionEntry | null = ri > 0 ? revisions[ri - 1]! : null;

      // Parse and validate the revision date
      const revDate = new Date(rev.changedDate);
      if (isNaN(revDate.getTime()) || revDate.getFullYear() > 3000) continue;
      if (revDate < cutoffDate) continue;

      const changedBy = rev.changedBy;

      for (const target of targets) {
        const actorIsTarget = isMatch(target, changedBy, "");

        // --- 1. Edits / State changes by target ---
        if (actorIsTarget && prev) {
          const changes: string[] = [];

          // Compare fields to detect what changed
          const allKeys = new Set([...Object.keys(rev.fields), ...Object.keys(prev.fields)]);

          for (const key of allKeys) {
            // Skip metadata fields that always change
            if (
              key === "System.Rev" ||
              key === "System.ChangedDate" ||
              key === "System.ChangedBy" ||
              key === "System.Watermark"
            )
              continue;

            const newVal = rev.fields[key];
            const oldVal = prev.fields[key];

            if (key === "System.State" && newVal !== oldVal) {
              changes.push(`State: ${String(oldVal || "New")}->${String(newVal || "Unknown")}`);
            } else if (newVal !== oldVal) {
              if (JSON.stringify(newVal) !== JSON.stringify(oldVal)) {
                changes.push(key);
              }
            }
          }

          if (changes.length > 0) {
            relevantItemIds.add(workItemId);
            activities.push({
              target: target.name,
              date: rev.changedDate,
              ...wiBase,
              activityType: "Edit",
              details: `Changed: ${changes.join(", ")}`,
              actor: changedBy,
            });
          }
        }

        // --- 1b. First revision in window by target (no prev to diff) ---
        if (actorIsTarget && !prev) {
          relevantItemIds.add(workItemId);
          activities.push({
            target: target.name,
            date: rev.changedDate,
            ...wiBase,
            activityType: "Edit",
            details: "Work item updated",
            actor: changedBy,
          });
        }

        // --- 2. AssignedTo changes targeting this person ---
        if (prev) {
          const newAssigned = String(rev.fields["System.AssignedTo"] || "");
          const oldAssigned = String(prev.fields["System.AssignedTo"] || "");
          if (newAssigned !== oldAssigned && isMatch(target, newAssigned, "")) {
            relevantItemIds.add(workItemId);
            activities.push({
              target: target.name,
              date: rev.changedDate,
              ...wiBase,
              activityType: "AssignedTo",
              details: `Assigned to ${target.name} by ${changedBy}`,
              actor: changedBy,
            });
          }
        } else {
          // First revision — check if assigned to target at creation
          const assigned = String(rev.fields["System.AssignedTo"] || "");
          if (assigned && isMatch(target, assigned, "") && !actorIsTarget) {
            relevantItemIds.add(workItemId);
            activities.push({
              target: target.name,
              date: rev.changedDate,
              ...wiBase,
              activityType: "AssignedTo",
              details: `Assigned to ${target.name} by ${changedBy}`,
              actor: changedBy,
            });
          }
        }
      }
    }

    processedItems++;

    // Progress reporting every 10 seconds
    const now = Date.now();
    if (now - lastReportTime > 10000 || processedItems === revisionsMap.size) {
      const elapsed = (now - startTime) / 1000;
      const pct = ((processedItems / revisionsMap.size) * 100).toFixed(1);
      logInfo(
        `[PROGRESS] ${processedItems}/${revisionsMap.size} (${pct}%) | ${elapsed.toFixed(0)}s | Activities: ${activities.length}`,
      );
      lastReportTime = now;
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logInfo(
    `  Local processing complete: ${activities.length} activities from ${revisionsMap.size} work items in ${elapsed.toFixed(1)}s`,
  );
  logInfo(`  Relevant items for comment/mention scan: ${relevantItemIds.size}`);

  return { activities, relevantItemIds };
}

/**
 * Fetch comments for relevant work items and extract comment activities + mentions.
 * Uses the Comments API in parallel batches — only called for items where a target
 * was already detected as active via the metadata revision scan.
 */
async function fetchCommentsForRelevantItems(
  conn: AdoConnection,
  itemIds: number[],
  detailsMap: Map<number, Record<string, unknown>>,
  targets: ActivityTarget[],
  cutoffDate: Date,
): Promise<ActivityRecord[]> {
  if (itemIds.length === 0) return [];

  const witApi = await conn.getWorkItemTrackingApi();
  const activities: ActivityRecord[] = [];
  const startTime = Date.now();
  const concurrency = 20;
  let errors = 0;

  logInfo(`[PHASE] Fetching comments for ${itemIds.length} relevant work items...`);

  // Process in parallel batches
  for (let i = 0; i < itemIds.length; i += concurrency) {
    const batch = itemIds.slice(i, i + concurrency);

    const batchPromises = batch.map(async (itemId) => {
      try {
        const commentsResult = await witApi.getComments(conn.project, itemId);
        const comments = (
          commentsResult as {
            comments?: Array<{
              id?: number;
              text?: string;
              createdBy?: { displayName?: string; uniqueName?: string };
              createdDate?: Date | string;
            }>;
          }
        ).comments;

        if (!comments) return;

        const details = detailsMap.get(itemId);
        const wiBase = {
          workItemId: String(itemId),
          workItemType: String(details?.["System.WorkItemType"] || "Unknown"),
          state: String(details?.["System.State"] || "Unknown"),
          areaPath: String(details?.["System.AreaPath"] || "Unknown"),
          title: String(details?.["System.Title"] || "No Title"),
          assignedTo: String(details?.["System.AssignedTo"] || ""),
          iterationPath: String(details?.["System.IterationPath"] || ""),
          tags: String(details?.["System.Tags"] || ""),
          storyPoints:
            details?.["Microsoft.VSTS.Scheduling.StoryPoints"] != null
              ? String(details["Microsoft.VSTS.Scheduling.StoryPoints"])
              : "",
          priority:
            details?.["Microsoft.VSTS.Common.Priority"] != null
              ? String(details["Microsoft.VSTS.Common.Priority"])
              : "",
          boardColumn: String(details?.["System.BoardColumn"] || ""),
          developmentSummary: String(details?.["Custom.DevelopmentSummary"] || ""),
        };

        for (const comment of comments) {
          const commentDate = comment.createdDate
            ? typeof comment.createdDate === "string"
              ? new Date(comment.createdDate)
              : comment.createdDate
            : null;

          if (!commentDate || commentDate < cutoffDate) continue;
          if (commentDate.getFullYear() > 3000) continue;

          const authorName = comment.createdBy?.displayName || "";
          const authorEmail = comment.createdBy?.uniqueName || "";
          const commentText = cleanHtml(comment.text || "");

          for (const target of targets) {
            // Comment by target
            if (isMatch(target, authorName, authorEmail)) {
              activities.push({
                target: target.name,
                date: commentDate.toISOString(),
                ...wiBase,
                activityType: "Comment",
                details: `Comment: ${commentText.substring(0, 300)}`,
                actor: authorName,
              });
            }

            // Mention of target by someone else
            if (!isMatch(target, authorName, authorEmail) && commentText) {
              const textLower = commentText.toLowerCase();
              const nameInText = target.name && textLower.includes(target.name.toLowerCase());
              const emailInText = target.email && textLower.includes(target.email.toLowerCase());
              if (nameInText || emailInText) {
                const mentionType = classifyMention(commentText);
                activities.push({
                  target: target.name,
                  date: commentDate.toISOString(),
                  ...wiBase,
                  activityType: mentionType,
                  details: `Mentioned in comment: ${commentText.substring(0, 300)}`,
                  actor: authorName,
                });
              }
            }
          }
        }
      } catch {
        errors++;
      }
    });

    await Promise.all(batchPromises);
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logInfo(
    `  Comment scan complete: ${activities.length} activities from ${itemIds.length} items in ${elapsed.toFixed(1)}s${errors > 0 ? ` (${errors} errors)` : ""}`,
  );

  return activities;
}

/**
 * Batch-fetch parent work item IDs and titles for a set of work item IDs.
 * Uses the ADO Work Item Tracking API with $expand=Relations to find parent links,
 * then fetches parent titles in a second batch.
 * Returns a Map<childId, { parentId, parentTitle }>.
 */
async function fetchParentRelations(
  conn: AdoConnection,
  itemIds: number[],
): Promise<Map<number, { parentId: string; parentTitle: string }>> {
  const result = new Map<number, { parentId: string; parentTitle: string }>();
  if (itemIds.length === 0) return result;

  const witApi = await conn.getWorkItemTrackingApi();
  const startTime = Date.now();
  const batchSize = 200; // ADO max per getWorkItems call
  const parentIdSet = new Set<number>();
  const childToParent = new Map<number, number>();

  logInfo(`[PHASE] Fetching parent relations for ${itemIds.length} work items...`);

  // Step 1: Fetch work items with relations to find parent links
  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    try {
      const items = await witApi.getWorkItems(
        batch,
        undefined, // fields
        undefined, // asOf
        4, // WorkItemExpand.Relations
      );

      for (const item of items || []) {
        if (!item?.id || !item.relations) continue;
        for (const rel of item.relations) {
          if (rel.rel === "System.LinkTypes.Hierarchy-Reverse" && rel.url) {
            // Parent link — extract ID from URL
            const match = rel.url.match(/\/workItems\/(\d+)$/);
            if (match?.[1]) {
              const parentId = parseInt(match[1], 10);
              childToParent.set(item.id, parentId);
              parentIdSet.add(parentId);
            }
          }
        }
      }
    } catch {
      logWarn(`  Failed to fetch relations for batch starting at ${batch[0]}`);
    }
  }

  // Step 2: Fetch parent titles
  if (parentIdSet.size > 0) {
    const parentIds = Array.from(parentIdSet);
    for (let i = 0; i < parentIds.length; i += batchSize) {
      const batch = parentIds.slice(i, i + batchSize);
      try {
        const items = await witApi.getWorkItems(batch, ["System.Title"]);
        const titleMap = new Map<number, string>();
        for (const item of items || []) {
          if (item?.id && item.fields) {
            titleMap.set(item.id, String(item.fields["System.Title"] || ""));
          }
        }

        // Populate result
        for (const [childId, parentId] of childToParent) {
          if (titleMap.has(parentId)) {
            result.set(childId, {
              parentId: String(parentId),
              parentTitle: titleMap.get(parentId) || "",
            });
          }
        }
      } catch {
        logWarn(`  Failed to fetch parent titles for batch starting at ${batch[0]}`);
      }
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logInfo(`  Found ${result.size} parent relations in ${elapsed.toFixed(1)}s`);

  return result;
}

/**
 * Batch-fetch Description, AcceptanceCriteria, and ReproSteps for relevant work items.
 * These fields are excluded from the bulk revision stream (large HTML blobs that repeat
 * per revision would create multi-GB responses). Instead, we fetch them once per item
 * using getWorkItems with specific fields.
 * Returns a Map<workItemId, { description, acceptanceCriteria, reproSteps }>.
 */
async function fetchWorkItemDescriptions(
  conn: AdoConnection,
  itemIds: number[],
): Promise<Map<number, { description: string; acceptanceCriteria: string; reproSteps: string }>> {
  const result = new Map<
    number,
    { description: string; acceptanceCriteria: string; reproSteps: string }
  >();
  if (itemIds.length === 0) return result;

  const witApi = await conn.getWorkItemTrackingApi();
  const startTime = Date.now();
  // Small batches: Description/AC/ReproSteps are large HTML blobs.
  // Batches >~20 items can exceed ADO response size limits and return empty.
  const batchSize = 20;
  const fields = [
    "System.Description",
    "Microsoft.VSTS.Common.AcceptanceCriteria",
    "Microsoft.VSTS.TCM.ReproSteps",
  ];

  logInfo(
    `[PHASE] Fetching descriptions for ${itemIds.length} work items (batches of ${batchSize})...`,
  );

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batch = itemIds.slice(i, i + batchSize);
    try {
      const items = await witApi.getWorkItems(batch, fields);
      for (const item of items || []) {
        if (!item?.id || !item.fields) continue;
        const desc = String(item.fields["System.Description"] || "");
        const ac = String(item.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "");
        const repro = String(item.fields["Microsoft.VSTS.TCM.ReproSteps"] || "");
        if (desc || ac || repro) {
          result.set(item.id, { description: desc, acceptanceCriteria: ac, reproSteps: repro });
        }
      }
    } catch (err) {
      logWarn(`  Failed to fetch descriptions for batch starting at ${batch[0]}: ${err}`);
    }
  }

  const elapsed = (Date.now() - startTime) / 1000;
  logInfo(`  Fetched descriptions for ${result.size} items in ${elapsed.toFixed(1)}s`);

  return result;
}

/**
 * Extract per-person metrics from the revision stream for peer comparison.
 * The revision data already contains ALL users' changes — we just need to
 * filter to the peer list and compute aggregate stats.
 */
function extractPeerMetrics(
  revisionsMap: Map<number, RevisionEntry[]>,
  peerEmails: Set<string>,
  peerNameMap: Map<string, string>,
  cutoffDate: Date,
): import("./types/adoActivityTypes.js").PeerMetrics[] {
  // Build a map: normalized email → metrics accumulator
  const metricsMap = new Map<
    string,
    {
      name: string;
      email: string;
      activities: number;
      workItems: Set<number>;
      days: Set<string>;
      stateTransitions: number;
      itemsClosed: number;
      completedHours: number;
    }
  >();

  // Initialize accumulators for each peer
  for (const email of peerEmails) {
    const name = peerNameMap.get(email) || email;
    metricsMap.set(email.toLowerCase(), {
      name,
      email,
      activities: 0,
      workItems: new Set(),
      days: new Set(),
      stateTransitions: 0,
      itemsClosed: 0,
      completedHours: 0,
    });
  }

  // Scan all revisions
  for (const [workItemId, revisions] of revisionsMap) {
    for (let ri = 0; ri < revisions.length; ri++) {
      const rev = revisions[ri]!;
      const prev = ri > 0 ? revisions[ri - 1]! : null;

      const revDate = new Date(rev.changedDate);
      if (isNaN(revDate.getTime()) || revDate < cutoffDate) continue;

      // Extract email from changedBy (format: "Name <email>")
      const emailMatch = rev.changedBy.match(/<([^>]+)>/);
      const email = (emailMatch?.[1] || "").toLowerCase();
      if (!email) continue;

      const acc = metricsMap.get(email);
      if (!acc) continue;

      acc.activities++;
      acc.workItems.add(workItemId);
      acc.days.add(revDate.toISOString().substring(0, 10));

      // Detect state transitions
      if (prev) {
        const prevState = String(prev.fields["System.State"] || "");
        const curState = String(rev.fields["System.State"] || "");
        if (prevState && curState && prevState !== curState) {
          acc.stateTransitions++;
          if (curState === "Closed" || curState === "Resolved") {
            acc.itemsClosed++;
          }
        }
      }

      // Track completed work from the latest revision of each work item
      const completedWork = rev.fields["Microsoft.VSTS.Scheduling.CompletedWork"];
      if (completedWork != null && ri === revisions.length - 1) {
        acc.completedHours += parseFloat(String(completedWork)) || 0;
      }
    }
  }

  return Array.from(metricsMap.values())
    .filter((m) => m.activities > 0)
    .map((m) => ({
      name: m.name,
      email: m.email,
      totalActivities: m.activities,
      workItemsTouched: m.workItems.size,
      daysActive: m.days.size,
      stateTransitions: m.stateTransitions,
      itemsClosed: m.itemsClosed,
      completedWorkHours: m.completedHours,
    }));
}

/**
 * Write activities to CSV file
 */
async function writeCsvReport(
  activities: ActivityRecord[],
  targetName: string,
  outputDir: string,
  timestamp: string,
): Promise<string> {
  // Resolve output dir relative to project root (not CWD)
  const resolvedDir = join(getProjectRoot(), outputDir);
  // Ensure output directory exists
  if (!existsSync(resolvedDir)) {
    mkdirSync(resolvedDir, { recursive: true });
  }

  const safeName = targetName.toLowerCase().replace(/\s+/g, "-");
  const filename = `${safeName}-activity-${timestamp}.csv`;
  const filepath = join(resolvedDir, filename);

  // Sort by date descending
  activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const stream = createWriteStream(filepath, { encoding: "utf-8" });

  // Write header
  const headers = [
    "Date",
    "WorkItemId",
    "PRNumber",
    "WorkItemType",
    "State",
    "AreaPath",
    "IterationPath",
    "Title",
    "ActivityType",
    "Details",
    "Actor",
    "AssignedTo",
    "ParentId",
    "ParentTitle",
    "Tags",
    "StoryPoints",
    "Priority",
    "ComponentName",
    "CompletedWork",
    "RemainingWork",
    "OriginalEstimate",
    "ActivityType2",
    "PrChangedComponents",
    "BoardColumn",
    "DevelopmentSummary",
    "Description",
    "AcceptanceCriteria",
    "ReproSteps",
  ];
  stream.write(headers.join(",") + "\n");

  // Write rows
  for (const activity of activities) {
    const esc = (s: string | undefined) => (s ? `"${s.replace(/"/g, '""')}"` : "");
    const row = [
      activity.date,
      activity.workItemId,
      activity.prNumber || "",
      activity.workItemType,
      activity.state,
      esc(activity.areaPath),
      esc(activity.iterationPath),
      esc(activity.title),
      activity.activityType,
      `"${(activity.details || "").replace(/"/g, '""').substring(0, 500)}"`,
      activity.actor,
      esc(activity.assignedTo),
      activity.parentId || "",
      esc(activity.parentTitle),
      esc(activity.tags),
      activity.storyPoints || "",
      activity.priority || "",
      esc(activity.componentName),
      activity.completedWork || "",
      activity.remainingWork || "",
      activity.originalEstimate || "",
      esc(activity.activityType2),
      esc(activity.prChangedComponents),
      esc(activity.boardColumn),
      esc(activity.developmentSummary),
      esc(activity.description),
      esc(activity.acceptanceCriteria),
      esc(activity.reproSteps),
    ];
    stream.write(row.join(",") + "\n");
  }

  // Wait for stream to finish before returning (H1 - stream flush issue)
  return new Promise((resolve, reject) => {
    stream.on("finish", () => resolve(filepath));
    stream.on("error", reject);
    stream.end();
  });
}

/**
 * Format duration in human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hrs}h ${mins}m`;
  }
}

/**
 * Fetch wiki commits for a target person
 */
async function fetchWikiActivities(
  conn: AdoConnection,
  target: ActivityTarget,
  startDate: Date,
  endDate: Date,
): Promise<ActivityRecord[]> {
  const activities: ActivityRecord[] = [];

  try {
    const gitApi = await conn.getGitApi();
    const { wikiRepoId } = getAdoReportConfig();

    const commits = await gitApi.getCommits(
      wikiRepoId,
      {
        author: target.name,
        fromDate: startDate as unknown as Date,
        toDate: endDate as unknown as Date,
      } as Record<string, unknown>,
      conn.project,
    );

    if (!commits || commits.length === 0) {
      logInfo(`  No wiki commits found for ${target.name}`);
      return activities;
    }

    logInfo(`  Found ${commits.length} wiki commits for ${target.name}`);

    for (const commit of commits) {
      const commitId = commit.commitId?.substring(0, 8) || "unknown";
      const comment = commit.comment?.trim() || "Wiki commit";
      const authorDate = commit.author?.date;
      const changeCounts = (commit.changeCounts || {}) as Record<string, number>;

      // Determine activity type
      let activityType: ActivityType = "WikiEdit";
      if (comment.toLowerCase().startsWith("added")) {
        activityType = "WikiCreate";
      } else if (
        comment.toLowerCase().includes("page move") ||
        comment.toLowerCase().includes("rename")
      ) {
        activityType = "WikiMove";
      } else if (
        (changeCounts["Delete"] ?? 0) > 0 &&
        (changeCounts["Add"] ?? 0) === 0 &&
        (changeCounts["Edit"] ?? 0) === 0
      ) {
        activityType = "WikiDelete";
      }

      activities.push({
        target: target.name,
        date: authorDate?.toISOString() || new Date().toISOString(),
        workItemId: `Wiki:${commitId}`,
        workItemType: "Wiki",
        state: "",
        areaPath: "Wiki",
        title: comment.substring(0, 100),
        activityType,
        details: `Changes: +${changeCounts["Add"] ?? 0} ~${changeCounts["Edit"] ?? 0} -${changeCounts["Delete"] ?? 0}`,
        actor: target.name,
      });
    }
  } catch (error) {
    logWarn(`Failed to fetch wiki commits for ${target.name}: ${error}`);
  }

  return activities;
}

/**
 * Fetch PR activities for ALL targets at once.
 * Fetches repo list once, fans out getPullRequests in parallel across repos,
 * then filters locally for each target person.
 */
async function fetchAllPRActivities(
  conn: AdoConnection,
  targets: ActivityTarget[],
  startDate: Date,
  endDate: Date,
): Promise<ActivityRecord[]> {
  const activities: ActivityRecord[] = [];

  try {
    const gitApi = await conn.getGitApi();
    const { adoOrg } = getAdoReportConfig();

    // Fetch repo list ONCE
    const repos = await gitApi.getRepositories(conn.project);
    if (!repos) return activities;

    const activeRepos = repos.filter((r) => !r.isDisabled && r.id);
    logInfo(`  Scanning ${activeRepos.length} repositories for PR activity (parallel)...`);

    // Fan out PR fetching in parallel across all repos
    type PRResult = {
      repo: (typeof activeRepos)[0];
      prs: Awaited<ReturnType<typeof gitApi.getPullRequests>>;
    };
    const prPromises = activeRepos.map((repo) =>
      gitApi
        .getPullRequests(
          repo.id!,
          {
            status: 4, // All statuses
          },
          conn.project,
          undefined,
          undefined,
          50,
        )
        .then((prs): PRResult => ({ repo, prs: prs || [] }))
        .catch((): PRResult => ({ repo, prs: [] })),
    );

    const repoResults = await Promise.all(prPromises);

    const processedPRs = new Set<number>();

    // Filter locally for all targets
    for (const { repo, prs } of repoResults) {
      for (const pr of prs) {
        if (!pr.pullRequestId || processedPRs.has(pr.pullRequestId)) continue;

        const creationDate = pr.creationDate ? new Date(pr.creationDate) : null;
        const closedDate = pr.closedDate ? new Date(pr.closedDate) : null;

        // Check if PR is in date range
        const inRange =
          (creationDate && creationDate >= startDate && creationDate <= endDate) ||
          (closedDate && closedDate >= startDate && closedDate <= endDate);
        if (!inRange) continue;

        processedPRs.add(pr.pullRequestId);
        const prLink = `https://dev.azure.com/${adoOrg}/${conn.project}/_git/${repo.name}/pullrequest/${pr.pullRequestId}`;
        const prBranch =
          (pr as { sourceRefName?: string }).sourceRefName?.replace("refs/heads/", "") || "";

        for (const target of targets) {
          // Check if created by target
          const createdByName = pr.createdBy?.displayName || "";
          const createdByEmail = pr.createdBy?.uniqueName || "";

          if (
            isMatch(target, createdByName, createdByEmail) &&
            creationDate &&
            creationDate >= startDate
          ) {
            activities.push({
              target: target.name,
              date: creationDate.toISOString(),
              workItemId: "",
              prNumber: String(pr.pullRequestId),
              workItemType: "PullRequest",
              state: "",
              areaPath: "Git",
              title: pr.title || "Pull Request",
              activityType: "PRCreated",
              details: `Created PR in ${repo.name}`,
              actor: target.name,
              link: prLink,
              componentName: prBranch,
            });
          }

          // Check reviewer votes
          if (pr.reviewers) {
            for (const reviewer of pr.reviewers) {
              const reviewerName = reviewer.displayName || "";
              const reviewerEmail = reviewer.uniqueName || "";
              const vote = reviewer.vote || 0;

              if (isMatch(target, reviewerName, reviewerEmail) && vote !== 0) {
                let activityType: ActivityType;
                let details: string;

                if (vote === 10) {
                  activityType = "PRApproved";
                  details = `Approved PR in ${repo.name}`;
                } else if (vote === 5) {
                  activityType = "PRApprovedWithSuggestions";
                  details = `Approved with suggestions PR in ${repo.name}`;
                } else if (vote === -5) {
                  activityType = "PRWaitingOnAuthor";
                  details = `Requested changes on PR in ${repo.name}`;
                } else if (vote === -10) {
                  activityType = "PRRejected";
                  details = `Rejected PR in ${repo.name}`;
                } else {
                  continue;
                }

                const voteDate = closedDate || creationDate;
                if (voteDate) {
                  activities.push({
                    target: target.name,
                    date: voteDate.toISOString(),
                    workItemId: "",
                    prNumber: String(pr.pullRequestId),
                    workItemType: "PullRequest",
                    state: "",
                    areaPath: "Git",
                    title: pr.title || "Pull Request",
                    activityType,
                    details,
                    actor: target.name,
                    link: prLink,
                    componentName: prBranch,
                  });
                }
              }
            }
          }
        }
      }
    }

    logInfo(`  Found ${activities.length} PR activities across ${targets.length} people`);

    // Second pass: fetch file changes for PRCreated activities to identify SF metadata
    const createdPRs = activities.filter((a) => a.activityType === "PRCreated");
    if (createdPRs.length > 0) {
      logInfo(`  Fetching file changes for ${createdPRs.length} created PRs...`);
      for (const act of createdPRs) {
        try {
          const prId = parseInt(act.prNumber || "0", 10);
          // Find the repo ID for this PR
          const repoName = act.details.replace("Created PR in ", "");
          const repo = activeRepos.find((r) => r.name === repoName);
          if (!repo?.id || !prId) continue;

          const iterations = await gitApi.getPullRequestIterations(repo.id, prId, conn.project);
          if (!iterations?.length) continue;
          const lastIterId = iterations[iterations.length - 1]!.id!;

          const iterChanges = await gitApi.getPullRequestIterationChanges(
            repo.id,
            prId,
            lastIterId,
            conn.project,
          );
          const entries = (iterChanges as { changeEntries?: Array<{ item?: { path?: string } }> })
            ?.changeEntries;
          if (!entries?.length) continue;

          const sfComponents: string[] = [];
          const allFiles: string[] = [];
          for (const entry of entries) {
            const path = entry.item?.path || "";
            allFiles.push(path);
            const component = parseSfMetadataPath(path);
            if (component) sfComponents.push(component);
          }

          // Deduplicate (LWC/Aura have multiple files per component)
          const uniqueComponents = [...new Set(sfComponents)];
          if (uniqueComponents.length > 0) {
            act.prChangedComponents = uniqueComponents.join("; ");
            act.details += ` | SF Components: ${uniqueComponents.join(", ")}`;
          }
          act.details += ` | ${allFiles.length} files changed`;
        } catch {
          // Non-fatal — file list is enrichment
        }
      }
    }
  } catch (error) {
    logWarn(`Failed to fetch PR activities: ${error}`);
  }

  return activities;
}

/**
 * Resolve a person's Salesforce UserId from their email
 */
async function resolveSfUserId(email: string, sfOrg: string): Promise<string | null> {
  try {
    const result = await executeSoqlQuery<{ Id: string; Name: string }>(
      `SELECT Id, Name FROM User WHERE Email = '${email}' AND IsActive = true LIMIT 1`,
      { alias: sfOrg },
    );
    const firstRecord = result.records[0];
    if (firstRecord) {
      return firstRecord.Id;
    }
    return null;
  } catch (error) {
    logWarn(`Failed to resolve SF UserId for ${email}: ${error}`);
    return null;
  }
}

/**
 * Fetch Salesforce login history and metadata changes for a target person
 */
async function fetchSalesforceActivities(
  target: ActivityTarget,
  days: number,
  sfOrg: string,
): Promise<ActivityRecord[]> {
  const activities: ActivityRecord[] = [];

  if (!target.email) {
    logWarn(`  No email for ${target.name}, skipping SF activity`);
    return activities;
  }

  // Resolve email to SF UserId
  const userId = await resolveSfUserId(target.email, sfOrg);
  if (!userId) {
    logWarn(`  Could not resolve SF user for ${target.email}, skipping SF activity`);
    return activities;
  }

  logInfo(`  Resolved SF UserId for ${target.name}: ${userId}`);

  // Fetch LoginHistory
  try {
    const loginResult = await executeSoqlQuery<{
      Id: string;
      LoginTime: string;
      Status: string;
      SourceIp: string;
      LoginType: string;
      Application: string;
    }>(
      `SELECT Id, LoginTime, Status, SourceIp, LoginType, Application FROM LoginHistory WHERE UserId = '${userId}' AND LoginTime >= LAST_N_DAYS:${days} ORDER BY LoginTime DESC`,
      { alias: sfOrg },
    );

    for (const login of loginResult.records) {
      activities.push({
        target: target.name,
        date: login.LoginTime,
        workItemId: "",
        workItemType: "Salesforce",
        state: login.Status,
        areaPath: "Salesforce",
        title: `Login via ${login.LoginType || "Unknown"}`,
        activityType: "SFLogin",
        details: `App: ${login.Application || "N/A"} | IP: ${login.SourceIp || "N/A"} | Status: ${login.Status || "Success"}`,
        actor: target.name,
      });
    }

    logInfo(`  Found ${loginResult.records.length} SF logins for ${target.name}`);
  } catch (error) {
    logWarn(`  Failed to fetch LoginHistory for ${target.name}: ${error}`);
  }

  // Fetch SetupAuditTrail
  try {
    const auditResult = await executeSoqlQuery<{
      Id: string;
      Action: string;
      Section: string;
      CreatedDate: string;
      Display: string;
      DelegateUser: string;
    }>(
      `SELECT Id, Action, Section, CreatedDate, Display, DelegateUser FROM SetupAuditTrail WHERE CreatedById = '${userId}' AND CreatedDate >= LAST_N_DAYS:${days} ORDER BY CreatedDate DESC`,
      { alias: sfOrg },
    );

    for (const audit of auditResult.records) {
      // Extract component name from Display field for SF↔ADO correlation
      // Patterns: "Changed LeadTriggerHandlerTest Apex Class code"
      //           "Created flow MyFlow"
      //           "Changed validation rule MyRule on Account"
      const componentName = extractSfComponentName(audit.Display || "", audit.Action || "");

      activities.push({
        target: target.name,
        date: audit.CreatedDate,
        workItemId: "",
        workItemType: "Salesforce",
        state: "",
        areaPath: `Salesforce/${audit.Section || "Setup"}`,
        title: audit.Display || audit.Action || "Setup Change",
        activityType: "SFMetadataChange",
        details:
          `Action: ${audit.Action || "N/A"} | Section: ${audit.Section || "N/A"} | ${audit.Display || ""}`.trim(),
        actor: audit.DelegateUser || target.name,
        componentName,
      });
    }

    logInfo(`  Found ${auditResult.records.length} SF metadata changes for ${target.name}`);
  } catch (error) {
    logWarn(`  Failed to fetch SetupAuditTrail for ${target.name}: ${error}`);
  }

  return activities;
}

/**
 * Generate activity report for specified users.
 *
 * Uses bulk-fetch approach: stream all revisions + batch-fetch work item details,
 * then process locally. ~30 API calls instead of ~3,000.
 */
export async function generateActivityReport(
  options: ActivityReportOptions,
): Promise<ActivityReportResult> {
  const {
    people,
    days,
    startDate: startDateStr,
    endDate: endDateStr,
    outputDir = "reports",
    includeWiki = true,
    includePullRequests = true,
    sfOrg,
    narrative = false,
    teamJsonPath,
  } = options;

  if (people.length === 0) {
    return {
      success: false,
      message: "No people specified for report",
      files: [],
      activityCounts: {},
      totalActivities: 0,
    };
  }

  const startTime = Date.now();

  // Resolve date range: explicit --start/--end takes precedence over --days
  let cutoffDate: Date;
  let endDate: Date;
  if (startDateStr) {
    cutoffDate = new Date(startDateStr + "T00:00:00Z");
    endDate = endDateStr ? new Date(endDateStr + "T23:59:59Z") : new Date();
    logInfo(
      `[PHASE] Starting activity report for ${people.length} people, ${startDateStr} to ${endDateStr || "today"}`,
    );
  } else {
    cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    endDate = new Date();
    logInfo(`[PHASE] Starting activity report for ${people.length} people, last ${days} days`);
  }
  logInfo(`Mode: BULK (stream revisions + local processing)`);

  // Compute days-back for APIs that require it (bulkFetchRevisions, SF LAST_N_DAYS).
  // When using --start/--end, we fetch from startDate to today (may over-fetch) and filter later.
  const msPerDay = 86400000;
  const daysBack = Math.max(1, Math.ceil((Date.now() - cutoffDate.getTime()) / msPerDay));

  for (const p of people) {
    logInfo(`  - ${p.name} (${p.email})`);
  }

  // Create ADO connection
  const conn = await createAdoConnection();

  // --- PHASE 1: Bulk data collection (parallel where possible) ---
  // Stream all revisions and kick off wiki/PR/SF fetches in parallel
  const revisionsPromise = bulkFetchRevisions(conn, daysBack);

  const wikiPromise = includeWiki
    ? (logInfo("[PHASE] Fetching wiki activities..."),
      Promise.all(people.map((target) => fetchWikiActivities(conn, target, cutoffDate, endDate))))
    : Promise.resolve(people.map(() => [] as ActivityRecord[]));

  const prPromise = includePullRequests
    ? (logInfo("[PHASE] Fetching PR activities (parallel across repos)..."),
      fetchAllPRActivities(conn, people, cutoffDate, endDate))
    : Promise.resolve([] as ActivityRecord[]);

  const sfPromise = sfOrg
    ? (logInfo(`[PHASE] Fetching Salesforce activities from org '${sfOrg}'...`),
      Promise.all(people.map((target) => fetchSalesforceActivities(target, daysBack, sfOrg))))
    : Promise.resolve(people.map(() => [] as ActivityRecord[]));

  // Wait for revisions stream + supplemental fetches
  const [revisionsMap, wikiResults, prActivities, sfResults] = await Promise.all([
    revisionsPromise,
    wikiPromise,
    prPromise,
    sfPromise,
  ]);

  // --- PHASE 2: Build details map from revision data (zero API calls) ---
  // The last revision for each work item contains the current title/type/state/area.
  const detailsMap = new Map<number, Record<string, unknown>>();
  for (const [wiId, revisions] of revisionsMap) {
    const last = revisions[revisions.length - 1];
    if (last) {
      detailsMap.set(wiId, last.fields);
    }
  }
  logInfo(
    `  Built details map for ${detailsMap.size.toLocaleString()} work items from revision data (0 API calls)`,
  );

  // --- PHASE 3: Local processing (edits, state changes, assignments) ---
  const { activities: metadataActivities, relevantItemIds } = processRevisionsLocally(
    revisionsMap,
    detailsMap,
    people,
    cutoffDate,
  );

  // --- PHASE 3b: Targeted comment/mention fetch for relevant items only ---
  const commentActivities = await fetchCommentsForRelevantItems(
    conn,
    Array.from(relevantItemIds),
    detailsMap,
    people,
    cutoffDate,
  );

  // --- PHASE 3c: Fetch parent relations for relevant items ---
  const parentMap = await fetchParentRelations(conn, Array.from(relevantItemIds));

  // Apply parent data to all work item activities
  const workItemActivities = [...metadataActivities, ...commentActivities];
  for (const act of workItemActivities) {
    if (act.workItemId) {
      const parent = parentMap.get(parseInt(act.workItemId, 10));
      if (parent) {
        act.parentId = parent.parentId;
        act.parentTitle = parent.parentTitle;
      }
    }
  }

  // --- PHASE 3d: Fetch Description/AC/ReproSteps for relevant items + parents ---
  const allItemIds = new Set(relevantItemIds);
  for (const { parentId } of parentMap.values()) {
    allItemIds.add(parseInt(parentId, 10));
  }
  const descMap = await fetchWorkItemDescriptions(conn, Array.from(allItemIds));

  // Apply description data to all work item activities
  for (const act of workItemActivities) {
    if (act.workItemId) {
      const desc = descMap.get(parseInt(act.workItemId, 10));
      if (desc) {
        act.description = desc.description;
        act.acceptanceCriteria = desc.acceptanceCriteria;
        act.reproSteps = desc.reproSteps;
      }
    }
  }

  // --- PHASE 4: Merge all activity sources ---
  const activitiesByTarget: Record<string, ActivityRecord[]> = {};
  for (const p of people) {
    activitiesByTarget[p.name] = [];
  }

  // Work item activities
  for (const activity of workItemActivities) {
    const bucket = activitiesByTarget[activity.target];
    if (bucket) {
      bucket.push(activity);
    }
  }

  // Wiki activities
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const wikiActs = wikiResults[i];
    if (person && wikiActs) {
      activitiesByTarget[person.name]?.push(...wikiActs);
    }
  }

  // PR activities (already flat, grouped by target)
  for (const activity of prActivities) {
    const bucket = activitiesByTarget[activity.target];
    if (bucket) {
      bucket.push(activity);
    }
  }

  // Salesforce activities
  for (let i = 0; i < people.length; i++) {
    const person = people[i];
    const sfActs = sfResults[i];
    if (person && sfActs) {
      activitiesByTarget[person.name]?.push(...sfActs);
    }
  }

  // --- PHASE 4b: Filter by endDate when using --start/--end (bounded range) ---
  // bulkFetchRevisions and SF queries may over-fetch; clip to the requested window.
  if (endDateStr) {
    const endCutoff = endDate.getTime();
    for (const [targetName, activities] of Object.entries(activitiesByTarget)) {
      activitiesByTarget[targetName] = activities.filter((a) => {
        if (!a.date) return true;
        return new Date(a.date).getTime() <= endCutoff;
      });
    }
  }

  // Extract peer metrics from revision data if team JSON is provided
  let peerMetrics: import("./types/adoActivityTypes.js").PeerMetrics[] = [];
  let teamMembers: Array<{ name: string; email: string; relationship: string; title: string }> = [];
  if (teamJsonPath && narrative) {
    try {
      const resolvedTeamPath =
        teamJsonPath.startsWith("/") ||
        teamJsonPath.startsWith("\\") ||
        /^[a-zA-Z]:/.test(teamJsonPath)
          ? teamJsonPath
          : join(getProjectRoot(), teamJsonPath);
      const teamJson = JSON.parse(readFileSync(resolvedTeamPath, "utf-8"));
      teamMembers = (teamJson.members || []).map((m: Record<string, unknown>) => ({
        name: String(m["name"] || ""),
        email: String(m["email"] || ""),
        relationship: String(m["relationship"] || ""),
        title: String(m["title"] || ""),
      }));
      // Identify peers — Subordinate, Peer, Peer's Team (exclude You, Your Manager, Leader)
      const peerEntries = teamMembers.filter(
        (m) => !["You", "Your Manager", "Leader"].includes(m.relationship),
      );
      const peerEmails = new Set(peerEntries.map((m) => m.email.toLowerCase()));
      const peerNameMap = new Map(peerEntries.map((m) => [m.email.toLowerCase(), m.name]));

      logInfo(
        `[PHASE] Extracting peer metrics for ${peerEmails.size} team members from revision data...`,
      );
      peerMetrics = extractPeerMetrics(revisionsMap, peerEmails, peerNameMap, cutoffDate);
      logInfo(`  Found activity for ${peerMetrics.length} of ${peerEmails.size} peers`);
    } catch (err) {
      logInfo(`  ⚠️ Could not read team JSON: ${err instanceof Error ? err.message : err}`);
    }
  }

  logInfo("[PHASE] Writing reports...");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const files: string[] = [];
  const activityCounts: Record<string, number> = {};
  let totalActivities = 0;

  for (const [targetName, activities] of Object.entries(activitiesByTarget)) {
    if (activities.length > 0) {
      const filepath = await writeCsvReport(activities, targetName, outputDir, timestamp);
      files.push(filepath);
      activityCounts[targetName] = activities.length;
      totalActivities += activities.length;

      // Generate activity digest for agent-driven narrative generation
      if (narrative) {
        const { generateActivityDigest } = await import("./adoActivityNarrative.js");
        const dateRange = `${cutoffDate.toLocaleDateString()} – ${endDate.toLocaleDateString()}`;
        const digestPath = generateActivityDigest({
          csvPath: filepath,
          personName: targetName,
          dateRange,
          peerMetrics: peerMetrics.length > 0 ? peerMetrics : undefined,
          teamMembers: teamMembers.length > 0 ? teamMembers : undefined,
          days,
        });
        files.push(digestPath);
      }
    }
  }

  // Calculate activity type breakdown
  const activityTypeBreakdown: Record<string, number> = {};
  for (const activities of Object.values(activitiesByTarget)) {
    for (const activity of activities) {
      activityTypeBreakdown[activity.activityType] =
        (activityTypeBreakdown[activity.activityType] || 0) + 1;
    }
  }

  // Calculate source counts
  const wikiCount = wikiResults.reduce((sum: number, arr: ActivityRecord[]) => sum + arr.length, 0);
  const prCount = prActivities.length;
  const sfCount = sfResults.reduce((sum: number, arr: ActivityRecord[]) => sum + arr.length, 0);
  const workItemCount = workItemActivities.length;

  // Final summary
  const elapsed = (Date.now() - startTime) / 1000;

  logInfo(`[PHASE] Complete — ${totalActivities} activities found`);
  logInfo("");
  logInfo("========================================");
  logInfo("         ACTIVITY REPORT SUMMARY        ");
  logInfo("========================================");
  logInfo(`Date Range: ${cutoffDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`);
  logInfo(`Mode: BULK (stream revisions + local processing)`);
  logInfo(
    `Revisions streamed: ${Array.from(revisionsMap.values())
      .reduce((s, r) => s + r.length, 0)
      .toLocaleString()}`,
  );
  logInfo(`Work items in scope: ${revisionsMap.size.toLocaleString()}`);
  logInfo("");
  logInfo("--- Sources ---");
  logInfo(`  Work Items: ${workItemCount} activities`);
  logInfo(`  Wiki: ${wikiCount} activities`);
  logInfo(`  Pull Requests: ${prCount} activities`);
  if (sfOrg) logInfo(`  Salesforce (${sfOrg}): ${sfCount} activities`);
  logInfo("");
  logInfo("--- Activity Types ---");
  const sortedTypes = Object.entries(activityTypeBreakdown).sort((a, b) => b[1] - a[1]);
  for (const [type, count] of sortedTypes) {
    const pct = ((count / totalActivities) * 100).toFixed(1);
    logInfo(`  ${type}: ${count} (${pct}%)`);
  }
  logInfo("");
  logInfo("--- Per Person ---");
  for (const [name, count] of Object.entries(activityCounts)) {
    logInfo(`  ${name}: ${count} activities`);
  }
  logInfo("");
  logInfo("--- Output ---");
  for (const file of files) {
    logInfo(`  ${file}`);
  }
  logInfo("");
  logInfo(`Total: ${totalActivities} activities`);
  logInfo(`Duration: ${formatDuration(elapsed)}`);
  logInfo("========================================");

  return {
    success: true,
    message: `Generated ${files.length} report(s) with ${totalActivities} total activities in ${formatDuration(elapsed)}`,
    files,
    activityCounts,
    totalActivities,
  };
}

/**
 * Parse person string in format "Name|email@domain.com"
 */
export function parsePerson(input: string): ActivityTarget {
  if (input.includes("|")) {
    const [name, email] = input.split("|");
    return { name: (name ?? "").trim(), email: (email ?? "").trim() };
  }
  // If no email provided, use input as name
  return { name: input.trim(), email: "" };
}
