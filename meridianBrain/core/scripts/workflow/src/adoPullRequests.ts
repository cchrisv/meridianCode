/**
 * Azure DevOps Pull Request Operations
 * Service layer for fetching and analyzing pull requests
 */

import { createAdoConnection, type AdoConnectionConfig } from "./adoClient.js";
import { getWorkItem } from "./adoWorkItems.js";
import { logInfo, logDebug, logWarn } from "./lib/loggerStructured.js";
import { createTwoFilesPatch } from "diff";
import type {
  ParsedPrUrl,
  PullRequestDetail,
  PullRequestReviewer,
  PullRequestDiff,
  PullRequestFileChange,
  FileChangeType,
  DiffMode,
  PullRequestThreads,
  PullRequestThreadDetail,
  PullRequestCommentEntry,
  ThreadStatus,
  PullRequestWorkItemRef,
  GetPullRequestDiffOptions,
  WorkItemPullRequest,
} from "./types/adoPullRequestTypes.js";
import { DEFAULT_ADO_ORG, DEFAULT_ADO_PROJECT } from "./types/adoFieldTypes.js";

/**
 * Parse an Azure DevOps PR URL into its components.
 *
 * Supports formats:
 *   https://dev.azure.com/{org}/{project}/_git/{repoIdOrName}/pullrequest/{prId}
 *   https://dev.azure.com/{org}/{project}/_git/{repoIdOrName}/pullrequest/{prId}?_a=files&path=...
 */
export function parsePrUrl(url: string): ParsedPrUrl {
  // Decode URL-encoded characters for matching
  const decoded = decodeURIComponent(url);

  const pattern = /https:\/\/dev\.azure\.com\/([^/]+)\/([^/]+)\/_git\/([^/]+)\/pullrequest\/(\d+)/;
  const match = decoded.match(pattern);

  if (!match) {
    throw new Error(
      `Invalid PR URL format. Expected: https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{id}\nReceived: ${url}`,
    );
  }

  return {
    orgUrl: `https://dev.azure.com/${match[1]}`,
    project: match[2]!,
    repositoryId: match[3]!,
    pullRequestId: parseInt(match[4]!, 10),
  };
}

/**
 * Resolve a repository name or ID to its GUID.
 * If the input is already a GUID, returns it directly.
 * Otherwise, looks up the repo by name.
 */
async function resolveRepositoryId(
  repoIdOrName: string,
  config?: AdoConnectionConfig,
): Promise<string> {
  // Check if already a GUID
  const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (guidPattern.test(repoIdOrName)) {
    return repoIdOrName;
  }

  // Look up by name
  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();
  const repos = await gitApi.getRepositories(conn.project);
  const repo = repos?.find((r) => r.name?.toLowerCase() === repoIdOrName.toLowerCase());

  if (!repo?.id) {
    throw new Error(`Repository not found: ${repoIdOrName}`);
  }

  return repo.id;
}

/**
 * Map ADO VersionControlChangeType numeric to our FileChangeType
 */
function mapChangeType(changeType?: number): FileChangeType {
  // ADO VersionControlChangeType enum values
  switch (changeType) {
    case 1:
      return "add"; // Add
    case 2:
      return "edit"; // Edit
    case 16:
      return "delete"; // Delete
    case 8:
      return "rename"; // Rename
    default:
      return "unknown";
  }
}

/**
 * Map ADO comment thread status to our ThreadStatus
 */
function mapThreadStatus(status?: number): ThreadStatus {
  // ADO CommentThreadStatus enum
  switch (status) {
    case 1:
      return "active";
    case 2:
      return "fixed";
    case 3:
      return "wontFix";
    case 4:
      return "closed";
    case 5:
      return "byDesign";
    case 6:
      return "pending";
    default:
      return "unknown";
  }
}

/**
 * Check if a file path looks like a binary file
 */
function isBinaryPath(path: string): boolean {
  const binaryExtensions = [
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".ico",
    ".svg",
    ".pdf",
    ".zip",
    ".gz",
    ".tar",
    ".jar",
    ".war",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".otf",
    ".mp3",
    ".mp4",
    ".wav",
    ".avi",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".class",
    ".pyc",
    ".ds_store",
  ];
  const lower = path.toLowerCase();
  return binaryExtensions.some((ext) => lower.endsWith(ext));
}

/**
 * Build an identity ref from ADO API identity data
 */
function toIdentityRef(identity: Record<string, unknown> | undefined): {
  displayName: string;
  url: string;
  id: string;
  uniqueName: string;
  imageUrl?: string;
} {
  return {
    displayName: (identity?.displayName as string) || "Unknown",
    url: (identity?.url as string) || "",
    id: (identity?.id as string) || "",
    uniqueName: (identity?.uniqueName as string) || "",
    imageUrl: (identity?.imageUrl as string) || undefined,
  };
}

/**
 * Get pull request details by ID
 */
export async function getPullRequest(
  prId: number,
  repoIdOrName: string,
  config?: AdoConnectionConfig,
): Promise<PullRequestDetail> {
  const repoId = await resolveRepositoryId(repoIdOrName, config);
  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();

  logInfo(`Fetching PR #${prId} from repo ${repoId}`);
  const pr = await gitApi.getPullRequest(repoId, prId, conn.project);

  if (!pr) {
    throw new Error(`Pull request #${prId} not found in repository ${repoIdOrName}`);
  }

  const adoOrg = conn.orgUrl.replace("https://dev.azure.com/", "");

  // Map reviewers
  const reviewers: PullRequestReviewer[] = (pr.reviewers || []).map((r) => {
    const vote = (r.vote || 0) as PullRequestReviewer["vote"];
    const voteLabels: Record<number, string> = {
      10: "Approved",
      5: "Approved with suggestions",
      0: "No vote",
      "-5": "Waiting for author",
      "-10": "Rejected",
    };
    return {
      identity: toIdentityRef(r as unknown as Record<string, unknown>),
      vote,
      voteLabel: voteLabels[vote] || "No vote",
      isRequired: !!(r as { isRequired?: boolean }).isRequired,
    };
  });

  // Map labels
  const labels = ((pr as { labels?: Array<{ name?: string }> }).labels || [])
    .map((l) => l.name || "")
    .filter(Boolean);

  // Fetch linked work items
  let workItemRefs: PullRequestWorkItemRef[] = [];
  try {
    const wiRefs = await gitApi.getPullRequestWorkItemRefs(repoId, prId, conn.project);
    if (wiRefs?.length) {
      workItemRefs = await fetchWorkItemDetails(
        wiRefs
          .map((ref) => {
            const urlParts = ref.url?.split("/") || [];
            return parseInt(urlParts[urlParts.length - 1] || "0", 10);
          })
          .filter((id) => id > 0),
        config,
      );
    }
  } catch {
    logWarn("Failed to fetch linked work items for PR");
  }

  const prUrl = `https://dev.azure.com/${adoOrg}/${encodeURIComponent(conn.project)}/_git/${repoId}/pullrequest/${prId}`;

  return {
    pullRequestId: pr.pullRequestId!,
    title: pr.title || "",
    description: pr.description || "",
    status:
      pr.status === 1
        ? "active"
        : pr.status === 3
          ? "completed"
          : pr.status === 2
            ? "abandoned"
            : String(pr.status),
    createdBy: toIdentityRef(pr.createdBy as unknown as Record<string, unknown>),
    creationDate: pr.creationDate?.toISOString() || "",
    closedDate: pr.closedDate?.toISOString() || null,
    sourceRefName: (pr.sourceRefName || "").replace("refs/heads/", ""),
    targetRefName: (pr.targetRefName || "").replace("refs/heads/", ""),
    mergeStatus: String(pr.mergeStatus ?? ""),
    isDraft: !!pr.isDraft,
    repository: {
      id: repoId,
      name: (pr.repository as { name?: string })?.name || repoIdOrName,
      url: (pr.repository as { url?: string })?.url || "",
    },
    reviewers,
    labels,
    url: prUrl,
    workItemRefs,
  };
}

/**
 * Get the diff (file changes) for a pull request
 */
export async function getPullRequestDiff(
  prId: number,
  repoIdOrName: string,
  options: GetPullRequestDiffOptions = {},
  config?: AdoConnectionConfig,
): Promise<PullRequestDiff> {
  const {
    filePath,
    maxFiles = 50,
    maxContentSize = 100 * 1024, // 100KB
    includeContent = true,
    mode = "context",
  } = options;

  const repoId = await resolveRepositoryId(repoIdOrName, config);
  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();

  logInfo(`Fetching diff for PR #${prId}`);

  // Get the PR for branch info
  const pr = await gitApi.getPullRequest(repoId, prId, conn.project);
  if (!pr) {
    throw new Error(`Pull request #${prId} not found`);
  }

  // Get iterations to find the file changes
  const iterations = await gitApi.getPullRequestIterations(repoId, prId, conn.project);
  if (!iterations?.length) {
    return {
      pullRequestId: prId,
      repository: repoIdOrName,
      sourceBranch: (pr.sourceRefName || "").replace("refs/heads/", ""),
      targetBranch: (pr.targetRefName || "").replace("refs/heads/", ""),
      files: [],
      totalFiles: 0,
      filesIncluded: 0,
      filesSkipped: 0,
    };
  }

  // Use the last iteration for the most current state
  const lastIteration = iterations[iterations.length - 1]!;
  const iterationId = lastIteration.id!;

  logDebug(`Using iteration ${iterationId} (${iterations.length} total)`);

  // Get the changes in this iteration
  const iterChanges = await gitApi.getPullRequestIterationChanges(
    repoId,
    prId,
    iterationId,
    conn.project,
  );

  type ChangeEntry = {
    item?: { path?: string; objectId?: string; originalObjectId?: string };
    changeType?: number;
    originalPath?: string;
  };
  const entries = (iterChanges as { changeEntries?: ChangeEntry[] })?.changeEntries || [];

  // Filter by file path if specified
  let filteredEntries = entries;
  if (filePath) {
    filteredEntries = entries.filter((e) => e.item?.path === filePath);
  }

  const totalFiles = filteredEntries.length;
  const entriesToProcess = filteredEntries.slice(0, maxFiles);
  const filesSkipped = totalFiles - entriesToProcess.length;

  logInfo(`Processing ${entriesToProcess.length} of ${totalFiles} changed files`);

  const files: PullRequestFileChange[] = [];

  for (const entry of entriesToProcess) {
    const path = entry.item?.path || "";
    const changeType = mapChangeType(entry.changeType);
    const binary = isBinaryPath(path);

    const fileChange: PullRequestFileChange = {
      path,
      originalPath: entry.originalPath || null,
      changeType,
      sourceContent: null,
      targetContent: null,
      unifiedDiff: null,
      isBinary: binary,
      isTruncated: false,
    };

    // Fetch content using blob SHAs from iteration change entries.
    // objectId = new version (source branch), originalObjectId = old version (target branch).
    // This is stable regardless of whether branches have moved since PR creation.
    let rawSource: string | null = null;
    let rawTarget: string | null = null;
    const newBlobId = entry.item?.objectId;
    const oldBlobId = entry.item?.originalObjectId;

    if (includeContent && !binary && changeType !== "delete" && newBlobId) {
      try {
        const sourceStream = await gitApi.getBlobContent(repoId, newBlobId, conn.project);
        rawSource = await streamToString(sourceStream);
      } catch {
        logDebug(`Could not fetch source blob ${newBlobId?.substring(0, 8)} for ${path}`);
      }
    }

    if (includeContent && !binary && changeType !== "add" && oldBlobId) {
      try {
        const targetStream = await gitApi.getBlobContent(repoId, oldBlobId, conn.project);
        rawTarget = await streamToString(targetStream);
      } catch {
        logDebug(`Could not fetch target blob ${oldBlobId?.substring(0, 8)} for ${path}`);
      }
    }

    // Compute unified diff on FULL content BEFORE any truncation
    if (includeContent && !binary && (rawSource !== null || rawTarget !== null)) {
      const oldPath = entry.originalPath || path;
      fileChange.unifiedDiff = createTwoFilesPatch(
        oldPath,
        path,
        rawTarget || "",
        rawSource || "",
        "target",
        "source",
      );
    }

    // Truncate content AFTER diff computation
    if (rawSource !== null && rawSource.length > maxContentSize) {
      rawSource = rawSource.substring(0, maxContentSize);
      fileChange.isTruncated = true;
    }
    if (rawTarget !== null && rawTarget.length > maxContentSize) {
      rawTarget = rawTarget.substring(0, maxContentSize);
      fileChange.isTruncated = true;
    }

    // Apply mode to decide what content to include in output
    switch (mode) {
      case "context":
        // Full new source for context + diff for change visibility, drop old content
        fileChange.sourceContent = rawSource;
        fileChange.targetContent = null;
        break;
      case "diff-only":
        // Only the diff — minimal output
        fileChange.sourceContent = null;
        fileChange.targetContent = null;
        break;
      case "full":
      default:
        // Everything
        fileChange.sourceContent = rawSource;
        fileChange.targetContent = rawTarget;
        break;
    }

    files.push(fileChange);
  }

  return {
    pullRequestId: prId,
    repository: repoIdOrName,
    sourceBranch: (pr.sourceRefName || "").replace("refs/heads/", ""),
    targetBranch: (pr.targetRefName || "").replace("refs/heads/", ""),
    files,
    totalFiles,
    filesIncluded: files.length,
    filesSkipped,
  };
}

/**
 * Get comment threads for a pull request
 */
export async function getPullRequestThreads(
  prId: number,
  repoIdOrName: string,
  config?: AdoConnectionConfig,
): Promise<PullRequestThreads> {
  const repoId = await resolveRepositoryId(repoIdOrName, config);
  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();

  logInfo(`Fetching threads for PR #${prId}`);
  const threads = await gitApi.getThreads(repoId, prId, conn.project);

  if (!threads?.length) {
    return {
      pullRequestId: prId,
      threads: [],
      totalThreads: 0,
      activeThreads: 0,
      resolvedThreads: 0,
    };
  }

  const mappedThreads: PullRequestThreadDetail[] = threads
    .filter((t) => !t.isDeleted)
    .map((t) => {
      type ThreadContext = { filePath?: string; rightFileStart?: { line?: number } };
      const ctx = t.threadContext as ThreadContext | undefined;

      const comments: PullRequestCommentEntry[] = (t.comments || [])
        .filter((c) => !c.isDeleted)
        .map((c) => ({
          id: c.id || 0,
          author: toIdentityRef(c.author as unknown as Record<string, unknown>),
          content: c.content || "",
          publishedDate: c.publishedDate?.toISOString() || "",
          lastUpdatedDate: c.lastUpdatedDate?.toISOString() || "",
          commentType: c.commentType === 1 ? "text" : c.commentType === 2 ? "system" : "unknown",
        }));

      return {
        id: t.id || 0,
        status: mapThreadStatus(t.status),
        filePath: ctx?.filePath || null,
        lineNumber: ctx?.rightFileStart?.line || null,
        comments,
        isDeleted: !!t.isDeleted,
      };
    });

  // Filter out system-only threads (e.g., vote notifications)
  const contentThreads = mappedThreads.filter((t) =>
    t.comments.some((c) => c.commentType === "text"),
  );

  const activeThreads = contentThreads.filter((t) => t.status === "active").length;
  const resolvedThreads = contentThreads.filter(
    (t) =>
      t.status === "fixed" ||
      t.status === "closed" ||
      t.status === "wontFix" ||
      t.status === "byDesign",
  ).length;

  return {
    pullRequestId: prId,
    threads: contentThreads,
    totalThreads: contentThreads.length,
    activeThreads,
    resolvedThreads,
  };
}

/**
 * Get linked work items for a pull request
 */
export async function getPullRequestWorkItems(
  prId: number,
  repoIdOrName: string,
  config?: AdoConnectionConfig,
): Promise<PullRequestWorkItemRef[]> {
  const repoId = await resolveRepositoryId(repoIdOrName, config);
  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();

  logInfo(`Fetching linked work items for PR #${prId}`);
  const wiRefs = await gitApi.getPullRequestWorkItemRefs(repoId, prId, conn.project);

  if (!wiRefs?.length) {
    return [];
  }

  // Extract work item IDs from the refs
  const ids = wiRefs
    .map((ref) => {
      const urlParts = ref.url?.split("/") || [];
      return parseInt(urlParts[urlParts.length - 1] || "0", 10);
    })
    .filter((id) => id > 0);

  return fetchWorkItemDetails(ids, config);
}

/**
 * Batch-fetch basic work item details for a list of IDs
 */
async function fetchWorkItemDetails(
  ids: number[],
  config?: AdoConnectionConfig,
): Promise<PullRequestWorkItemRef[]> {
  const results: PullRequestWorkItemRef[] = [];

  for (const id of ids) {
    try {
      const wi = await getWorkItem(id, {
        fields: ["System.Title", "System.WorkItemType", "System.State"],
      });
      results.push({
        id: wi.id,
        title: (wi.fields["System.Title"] as string) || "",
        workItemType: (wi.fields["System.WorkItemType"] as string) || "",
        state: (wi.fields["System.State"] as string) || "",
        url: wi.url,
      });
    } catch {
      logWarn(`Could not fetch work item ${id}`);
      results.push({
        id,
        title: `(Work item ${id} — could not fetch)`,
        workItemType: "",
        state: "",
        url: "",
      });
    }
  }

  return results;
}

/**
 * Get all pull requests linked to a work item via artifact links.
 * Parses vstfs:///Git/PullRequestId/{projectId}%2F{repoId}%2F{prId} relations.
 */
export async function getPullRequestsForWorkItem(
  workItemId: number,
  config?: AdoConnectionConfig,
): Promise<WorkItemPullRequest[]> {
  const wi = await getWorkItem(workItemId, { expand: "Relations" }, config);

  if (!wi.relations?.length) {
    logDebug(`Work item ${workItemId} has no relations`);
    return [];
  }

  // Extract PR references from artifact links
  const prPattern = /vstfs:\/\/\/Git\/PullRequestId\/[^%]+%2F([^%]+)%2F(\d+)/;
  const prRefs: { repoId: string; prId: number }[] = [];

  for (const rel of wi.relations) {
    if (rel.rel !== "ArtifactLink") continue;
    const match = rel.url?.match(prPattern);
    if (match) {
      prRefs.push({ repoId: match[1]!, prId: parseInt(match[2]!, 10) });
    }
  }

  if (!prRefs.length) {
    logDebug(`Work item ${workItemId} has no PR artifact links`);
    return [];
  }

  logInfo(`Found ${prRefs.length} PR(s) linked to work item ${workItemId}`);

  const conn = await createAdoConnection(config);
  const gitApi = await conn.getGitApi();
  const adoOrg = conn.orgUrl.replace("https://dev.azure.com/", "");

  const results: WorkItemPullRequest[] = [];

  for (const ref of prRefs) {
    try {
      const pr = await gitApi.getPullRequest(ref.repoId, ref.prId, conn.project);
      if (!pr) continue;

      const repoName = (pr.repository as { name?: string })?.name || ref.repoId;
      const prUrl = `https://dev.azure.com/${adoOrg}/${encodeURIComponent(conn.project)}/_git/${repoName}/pullrequest/${ref.prId}`;

      results.push({
        pullRequestId: ref.prId,
        repositoryId: ref.repoId,
        repositoryName: repoName,
        title: pr.title || "",
        status:
          pr.status === 1
            ? "active"
            : pr.status === 3
              ? "completed"
              : pr.status === 2
                ? "abandoned"
                : String(pr.status),
        createdBy: (pr.createdBy as { displayName?: string })?.displayName || "Unknown",
        sourceRefName: (pr.sourceRefName || "").replace("refs/heads/", ""),
        targetRefName: (pr.targetRefName || "").replace("refs/heads/", ""),
        creationDate: pr.creationDate?.toISOString() || "",
        closedDate: pr.closedDate?.toISOString() || null,
        url: prUrl,
      });
    } catch {
      logWarn(`Could not fetch PR #${ref.prId} from repo ${ref.repoId}`);
    }
  }

  return results;
}

/**
 * Convert a readable stream to a string
 */
async function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
