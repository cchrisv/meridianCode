/**
 * Azure DevOps Iterations
 * Operations for querying iteration paths, dates, and validity
 */

import { TreeStructureGroup } from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { createAdoConnection, type AdoConnectionConfig } from "./adoClient.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, logDebug, createTimer } from "./lib/loggerStructured.js";

/**
 * Iteration info returned from classification node lookup
 */
export interface IterationInfo {
  /** Iteration name (e.g. "Sprint 42") */
  name: string;
  /** Full iteration path (e.g. "Digital Platforms\\Release 26.03\\Sprint 42") */
  path: string;
  /** Start date (ISO string, UTC midnight) */
  startDate: string | null;
  /** Finish date (ISO string, UTC midnight) */
  finishDate: string | null;
  /** Whether this iteration has child iterations */
  hasChildren: boolean;
  /** Whether the iteration is currently active (today falls within start–finish) */
  isCurrent: boolean;
  /** Whether the iteration is in the past */
  isPast: boolean;
  /** Whether the iteration is in the future */
  isFuture: boolean;
  /** Human-readable time frame label */
  timeFrame: "past" | "current" | "future" | "unknown";
}

/**
 * Options for getting iteration info
 */
export interface GetIterationOptions {
  /** Iteration path relative to project (omit project name prefix).
   *  e.g. "Release 26.03\\Sprint 42" for full path "Digital Platforms\\Release 26.03\\Sprint 42"
   */
  path?: string;
  /** Depth of child iterations to return (default: 0 = node only) */
  depth?: number;
}

/**
 * Strip the project name prefix from an iteration path if present.
 * ADO classification node API expects the path *without* the project prefix.
 */
function stripProjectPrefix(iterationPath: string, project: string): string {
  // Normalize separators and strip leading backslash
  let normalized = iterationPath.replace(/\//g, "\\");
  if (normalized.startsWith("\\")) {
    normalized = normalized.substring(1);
  }

  // Strip project prefix (e.g. "Digital Platforms\")
  const projectPrefix = project + "\\";
  if (normalized.startsWith(projectPrefix)) {
    normalized = normalized.substring(projectPrefix.length);
  }

  // Strip "Iteration\" prefix — the classification node API expects paths
  // relative to the structure group root, which IS the Iteration root.
  const iterPrefix = "Iteration\\";
  if (normalized.startsWith(iterPrefix)) {
    normalized = normalized.substring(iterPrefix.length);
  }

  return normalized;
}

/**
 * Compute the time frame for an iteration based on its dates
 */
function computeTimeFrame(
  startDate: string | null,
  finishDate: string | null,
): {
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
  timeFrame: "past" | "current" | "future" | "unknown";
} {
  if (!startDate || !finishDate) {
    return { isCurrent: false, isPast: false, isFuture: false, timeFrame: "unknown" };
  }

  const now = new Date();
  const start = new Date(startDate);
  const finish = new Date(finishDate);

  // Set finish to end of day for inclusive comparison
  finish.setUTCHours(23, 59, 59, 999);

  if (now < start) {
    return { isCurrent: false, isPast: false, isFuture: true, timeFrame: "future" };
  }
  if (now > finish) {
    return { isCurrent: false, isPast: true, isFuture: false, timeFrame: "past" };
  }
  return { isCurrent: true, isPast: false, isFuture: false, timeFrame: "current" };
}

/**
 * Get iteration info by path using the classification node API.
 *
 * @param options - path and depth options
 * @param config  - ADO connection config
 * @returns iteration info with dates and time frame
 */
export async function getIteration(
  options: GetIterationOptions,
  config?: AdoConnectionConfig,
): Promise<IterationInfo> {
  const timer = createTimer();

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  const relativePath = options.path ? stripProjectPrefix(options.path, conn.project) : undefined;

  logInfo("Getting iteration", { path: relativePath ?? "(root)", depth: options.depth });

  const node = await retryWithBackoff(
    () =>
      witApi.getClassificationNode(
        conn.project,
        TreeStructureGroup.Iterations,
        relativePath,
        options.depth ?? 0,
      ),
    { ...RETRY_PRESETS.standard, operationName: "getClassificationNode(iteration)" },
  );

  if (!node) {
    throw new Error(`Iteration not found: ${options.path ?? "(root)"}`);
  }

  const startDate = node.attributes?.startDate
    ? new Date(node.attributes.startDate).toISOString()
    : null;
  const finishDate = node.attributes?.finishDate
    ? new Date(node.attributes.finishDate).toISOString()
    : null;

  const tf = computeTimeFrame(startDate, finishDate);

  timer.log("getIteration");

  return {
    name: node.name ?? "",
    path: node.path ?? "",
    startDate,
    finishDate,
    hasChildren: node.hasChildren ?? false,
    ...tf,
  };
}

/**
 * List child iterations under a given path.
 *
 * @param options - path (parent) and depth (default 1)
 * @param config  - ADO connection config
 * @returns array of iteration info objects
 */
export async function listIterations(
  options: GetIterationOptions,
  config?: AdoConnectionConfig,
): Promise<IterationInfo[]> {
  const timer = createTimer();

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  const depth = options.depth ?? 1;
  const relativePath = options.path ? stripProjectPrefix(options.path, conn.project) : undefined;

  logInfo("Listing iterations", { path: relativePath ?? "(root)", depth });

  const node = await retryWithBackoff(
    () =>
      witApi.getClassificationNode(
        conn.project,
        TreeStructureGroup.Iterations,
        relativePath,
        depth,
      ),
    { ...RETRY_PRESETS.standard, operationName: "listIterations" },
  );

  if (!node) {
    throw new Error(`Iteration path not found: ${options.path ?? "(root)"}`);
  }

  const results: IterationInfo[] = [];

  function collectNodes(n: typeof node): void {
    const start = n.attributes?.startDate ? new Date(n.attributes.startDate).toISOString() : null;
    const finish = n.attributes?.finishDate
      ? new Date(n.attributes.finishDate).toISOString()
      : null;
    const tf = computeTimeFrame(start, finish);

    results.push({
      name: n.name ?? "",
      path: n.path ?? "",
      startDate: start,
      finishDate: finish,
      hasChildren: n.hasChildren ?? false,
      ...tf,
    });

    if (n.children) {
      for (const child of n.children) {
        collectNodes(child);
      }
    }
  }

  // Collect children (skip the root node itself unless it's the target)
  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      collectNodes(child);
    }
  } else {
    // No children — return the node itself
    collectNodes(node);
  }

  logDebug(`Found ${results.length} iteration(s)`);
  timer.log("listIterations");

  return results;
}
