/**
 * Azure DevOps Backlog Reordering
 * Read, validate, and rewrite backlog rank fields for a scoped area path.
 */

import type {
  WorkItem as AdoWorkItem,
  Wiql,
} from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { createAdoConnection } from "./adoClient.js";
import { logDebug, logInfo, createTimer } from "./lib/loggerStructured.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import {
  validate,
  BacklogQueryOptionsSchema,
  ReorderSingleOptionsSchema,
  ReorderBulkOptionsSchema,
} from "./lib/validationSchemas.js";
import { updateWorkItem } from "./adoWorkItems.js";
import { ADO_FIELDS } from "./types/adoFieldTypes.js";
import type {
  BacklogDetailLevel,
  BacklogItem,
  BacklogIssue,
  BacklogQueryOptions,
  BacklogQueryResult,
  BacklogValidationResult,
  ReorderBulkOptions,
  ReorderResult,
  ReorderSingleOptions,
  WorkItem,
} from "./types/adoWorkItemTypes.js";

type RankFieldLabel = BacklogQueryResult["field"];

const rankFieldCache = new Map<string, RankFieldLabel>();

const DEFAULT_REORDER_START_RANK = 1000;
const DEFAULT_REORDER_SPACING = 1000;
const MAX_SAFE_RANK = Number.MAX_SAFE_INTEGER - DEFAULT_REORDER_SPACING;

function shouldIncludeRichText(detailLevel: BacklogDetailLevel | undefined): boolean {
  return detailLevel === "summary" || detailLevel === "full";
}

export function clearRankFieldCache(): void {
  rankFieldCache.clear();
}

function escapeWiqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getRankFieldPath(field: RankFieldLabel): string {
  return field === "StackRank" ? ADO_FIELDS.STACK_RANK : ADO_FIELDS.BACKLOG_PRIORITY;
}

function normalizeRank(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getAssignedToDisplay(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (value && typeof value === "object") {
    const candidate = value as { displayName?: unknown; uniqueName?: unknown };
    if (typeof candidate.displayName === "string" && candidate.displayName.trim().length > 0) {
      return candidate.displayName;
    }
    if (typeof candidate.uniqueName === "string" && candidate.uniqueName.trim().length > 0) {
      return candidate.uniqueName;
    }
  }

  return undefined;
}

function toBacklogItem(
  workItem: { id: number; fields: Record<string, unknown> },
  rankFieldPath: string,
): BacklogItem {
  return {
    id: workItem.id,
    title: String(workItem.fields[ADO_FIELDS.TITLE] ?? ""),
    description: String(workItem.fields[ADO_FIELDS.DESCRIPTION] ?? ""),
    acceptanceCriteria: String(workItem.fields[ADO_FIELDS.ACCEPTANCE_CRITERIA] ?? ""),
    developmentSummary: String(workItem.fields[ADO_FIELDS.DEVELOPMENT_SUMMARY] ?? ""),
    stackRank: normalizeRank(workItem.fields[rankFieldPath]),
    state: String(workItem.fields[ADO_FIELDS.STATE] ?? ""),
    boardColumn: String(workItem.fields["System.BoardColumn"] ?? ""),
    createdDate: String(workItem.fields[ADO_FIELDS.CREATED_DATE] ?? ""),
    changedDate: String(workItem.fields[ADO_FIELDS.CHANGED_DATE] ?? ""),
    commentCount:
      typeof workItem.fields["System.CommentCount"] === "number"
        ? (workItem.fields["System.CommentCount"] as number)
        : Number(workItem.fields["System.CommentCount"] ?? 0),
    workItemType: String(
      workItem.fields[ADO_FIELDS.WORK_ITEM_TYPE] ?? "",
    ) as BacklogItem["workItemType"],
    areaPath: String(workItem.fields[ADO_FIELDS.AREA_PATH] ?? ""),
    assignedTo: getAssignedToDisplay(workItem.fields[ADO_FIELDS.ASSIGNED_TO]),
    parent: null,
  };
}

async function queryBacklogIds(wiqlQuery: string, top: number | undefined): Promise<number[]> {
  const conn = await createAdoConnection();
  const witApi = await conn.getWorkItemTrackingApi();
  const wiql: Wiql = { query: wiqlQuery };

  const queryResult = await retryWithBackoff(
    () => witApi.queryByWiql(wiql, { project: conn.project }),
    { ...RETRY_PRESETS.standard, operationName: "queryBacklogIds" },
  );

  const ids = (queryResult.workItems ?? [])
    .map((workItemRef) => workItemRef.id)
    .filter((id): id is number => typeof id === "number");

  return top && ids.length > top ? ids.slice(0, top) : ids;
}

async function fetchWorkItemsByFields(
  itemIds: number[],
  fields: string[],
  batchSize: number,
): Promise<Map<number, AdoWorkItem>> {
  const conn = await createAdoConnection();
  const witApi = await conn.getWorkItemTrackingApi();
  const results = new Map<number, AdoWorkItem>();

  for (let index = 0; index < itemIds.length; index += batchSize) {
    const batch = itemIds.slice(index, index + batchSize);
    const items = await retryWithBackoff(
      () => witApi.getWorkItems(batch, fields, undefined, undefined, undefined, conn.project),
      {
        ...RETRY_PRESETS.standard,
        operationName: `getWorkItems(fields batch ${Math.floor(index / batchSize) + 1})`,
      },
    );

    for (const item of items ?? []) {
      if (item?.id) {
        results.set(item.id, item);
      }
    }
  }

  return results;
}

async function fetchParentMap(
  itemIds: number[],
): Promise<Map<number, { id: number; title: string }>> {
  const conn = await createAdoConnection();
  const witApi = await conn.getWorkItemTrackingApi();
  const batchSize = 200;
  const childToParent = new Map<number, number>();
  const parentIds = new Set<number>();
  const result = new Map<number, { id: number; title: string }>();

  for (let index = 0; index < itemIds.length; index += batchSize) {
    const batch = itemIds.slice(index, index + batchSize);
    const items = await retryWithBackoff(
      () => witApi.getWorkItems(batch, undefined, undefined, 4, undefined, conn.project),
      {
        ...RETRY_PRESETS.standard,
        operationName: `getWorkItems(relations batch ${Math.floor(index / batchSize) + 1})`,
      },
    );

    for (const item of items ?? []) {
      if (!item?.id || !item.relations) continue;
      for (const relation of item.relations) {
        if (relation.rel === "System.LinkTypes.Hierarchy-Reverse" && relation.url) {
          const match = relation.url.match(/\/workItems\/(\d+)$/);
          if (match?.[1]) {
            const parentId = parseInt(match[1], 10);
            childToParent.set(item.id, parentId);
            parentIds.add(parentId);
            break;
          }
        }
      }
    }
  }

  if (parentIds.size === 0) {
    return result;
  }

  const parentTitleMap = await fetchWorkItemsByFields(
    Array.from(parentIds),
    [ADO_FIELDS.TITLE],
    200,
  );
  for (const [childId, parentId] of childToParent.entries()) {
    const parent = parentTitleMap.get(parentId);
    result.set(childId, {
      id: parentId,
      title: String(parent?.fields?.[ADO_FIELDS.TITLE] ?? ""),
    });
  }

  return result;
}

async function buildBacklogItems(
  itemIds: number[],
  rankFieldPath: string,
  detailLevel: BacklogDetailLevel | undefined,
): Promise<BacklogItem[]> {
  if (itemIds.length === 0) {
    return [];
  }

  const metadataFields = [
    ADO_FIELDS.TITLE,
    ADO_FIELDS.STATE,
    "System.BoardColumn",
    ADO_FIELDS.WORK_ITEM_TYPE,
    ADO_FIELDS.AREA_PATH,
    ADO_FIELDS.ASSIGNED_TO,
    ADO_FIELDS.CREATED_DATE,
    ADO_FIELDS.CHANGED_DATE,
    rankFieldPath,
    "System.CommentCount",
  ];
  const richTextFields = [
    ADO_FIELDS.DESCRIPTION,
    ADO_FIELDS.ACCEPTANCE_CRITERIA,
    ADO_FIELDS.DEVELOPMENT_SUMMARY,
  ];

  const [metadataMap, richTextMap, parentMap] = await Promise.all([
    fetchWorkItemsByFields(itemIds, metadataFields, 200),
    shouldIncludeRichText(detailLevel)
      ? fetchWorkItemsByFields(itemIds, richTextFields, 20)
      : Promise.resolve(new Map<number, AdoWorkItem>()),
    fetchParentMap(itemIds),
  ]);

  const items: BacklogItem[] = [];
  for (const itemId of itemIds) {
    const metadata = metadataMap.get(itemId);
    if (!metadata?.id) {
      continue;
    }

    const mergedFields = {
      ...(metadata.fields ?? {}),
      ...(richTextMap.get(itemId)?.fields ?? {}),
    } as Record<string, unknown>;

    const backlogItem = toBacklogItem({ id: metadata.id, fields: mergedFields }, rankFieldPath);
    backlogItem.parent = parentMap.get(itemId) ?? null;
    items.push(backlogItem);
  }

  return sortBacklogItems(items);
}

export function sortBacklogItems(items: BacklogItem[]): BacklogItem[] {
  return [...items].sort((left, right) => {
    if (left.stackRank === null && right.stackRank === null) {
      return left.id - right.id;
    }

    if (left.stackRank === null) {
      return 1;
    }

    if (right.stackRank === null) {
      return -1;
    }

    if (left.stackRank === right.stackRank) {
      return left.id - right.id;
    }

    return left.stackRank - right.stackRank;
  });
}

export function buildBacklogWiql(options: BacklogQueryOptions, rankFieldPath: string): string {
  const conditions: string[] = [
    `[${ADO_FIELDS.AREA_PATH}] UNDER '${escapeWiqlLiteral(options.areaPath)}'`,
  ];

  if (options.workItemType) {
    conditions.push(
      `[${ADO_FIELDS.WORK_ITEM_TYPE}] = '${escapeWiqlLiteral(options.workItemType)}'`,
    );
  }

  if (options.states && options.states.length > 0) {
    const serializedStates = options.states
      .map((state) => `'${escapeWiqlLiteral(state)}'`)
      .join(", ");
    conditions.push(`[${ADO_FIELDS.STATE}] IN (${serializedStates})`);
  } else {
    conditions.push(`[${ADO_FIELDS.STATE}] <> 'Closed'`);
    conditions.push(`[${ADO_FIELDS.STATE}] <> 'Removed'`);
  }

  return [
    "SELECT [System.Id] FROM WorkItems",
    `WHERE ${conditions.join(" AND ")}`,
    `ORDER BY [${rankFieldPath}] ASC, [${ADO_FIELDS.ID}] ASC`,
  ].join(" ");
}

export async function detectRankField(
  areaPath: string,
  workItemType?: BacklogQueryOptions["workItemType"],
): Promise<RankFieldLabel> {
  const cacheKey = areaPath.trim().toLowerCase();
  const cached = rankFieldCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const conditions = [`[${ADO_FIELDS.AREA_PATH}] UNDER '${escapeWiqlLiteral(areaPath)}'`];
  if (workItemType) {
    conditions.push(`[${ADO_FIELDS.WORK_ITEM_TYPE}] = '${escapeWiqlLiteral(workItemType)}'`);
  }

  const seedQuery = [
    "SELECT [System.Id] FROM WorkItems",
    `WHERE ${conditions.join(" AND ")}`,
    `ORDER BY [${ADO_FIELDS.ID}] ASC`,
  ].join(" ");

  const seedIds = await queryBacklogIds(seedQuery, 20);
  if (seedIds.length === 0) {
    throw new Error(`No work items found under area path "${areaPath}"`);
  }

  const seedItems = await fetchWorkItemsByFields(
    seedIds,
    [ADO_FIELDS.STACK_RANK, ADO_FIELDS.BACKLOG_PRIORITY],
    20,
  );

  for (const itemId of seedIds) {
    const workItem = seedItems.get(itemId);
    const stackRank = normalizeRank(workItem?.fields?.[ADO_FIELDS.STACK_RANK]);
    if (stackRank !== null) {
      rankFieldCache.set(cacheKey, "StackRank");
      return "StackRank";
    }

    const backlogPriority = normalizeRank(workItem?.fields?.[ADO_FIELDS.BACKLOG_PRIORITY]);
    if (backlogPriority !== null) {
      rankFieldCache.set(cacheKey, "BacklogPriority");
      return "BacklogPriority";
    }
  }

  const detected = "StackRank";

  rankFieldCache.set(cacheKey, detected);
  return detected;
}

export function calculateInsertionRank(aboveRank: number | null, belowRank: number | null): number {
  if (aboveRank !== null && belowRank !== null) {
    const midpoint = aboveRank + (belowRank - aboveRank) / 2;
    if (!Number.isFinite(midpoint) || midpoint === aboveRank || midpoint === belowRank) {
      throw new Error("Unable to compute a stable midpoint rank between neighboring items");
    }
    return midpoint;
  }

  if (belowRank !== null) {
    return belowRank - DEFAULT_REORDER_SPACING;
  }

  if (aboveRank !== null) {
    return aboveRank + DEFAULT_REORDER_SPACING;
  }

  return DEFAULT_REORDER_START_RANK;
}

export async function getBacklog(options: BacklogQueryOptions): Promise<BacklogQueryResult> {
  const timer = createTimer();
  const validatedOptions = validate(BacklogQueryOptionsSchema, options);
  const rankField = await detectRankField(validatedOptions.areaPath, validatedOptions.workItemType);
  const rankFieldPath = getRankFieldPath(rankField);
  const wiql = buildBacklogWiql(validatedOptions, rankFieldPath);

  logInfo("Fetching backlog", {
    areaPath: validatedOptions.areaPath,
    workItemType: validatedOptions.workItemType,
    detailLevel: validatedOptions.detailLevel ?? "full",
    rankField,
    top: validatedOptions.top,
  });
  logDebug("Backlog WIQL", { wiql });

  const itemIds = await queryBacklogIds(wiql, validatedOptions.top);
  const items = await buildBacklogItems(itemIds, rankFieldPath, validatedOptions.detailLevel);

  timer.log("getBacklog");
  return {
    items,
    field: rankField,
    count: items.length,
  };
}

export async function reorderSingle(options: ReorderSingleOptions): Promise<ReorderResult> {
  const timer = createTimer();
  const validatedOptions = validate(ReorderSingleOptionsSchema, options);
  const backlog = await getBacklog({
    areaPath: validatedOptions.areaPath,
    workItemType: validatedOptions.workItemType,
    detailLevel: "light",
  });

  const currentIndex = backlog.items.findIndex((item) => item.id === validatedOptions.workItemId);
  if (currentIndex === -1) {
    throw new Error(`Work item ${validatedOptions.workItemId} is not in the scoped backlog`);
  }

  const targetItem = backlog.items[currentIndex];
  const normalizedPosition = Math.max(1, Math.min(validatedOptions.position, backlog.items.length));

  if (normalizedPosition === currentIndex + 1 && targetItem.stackRank !== null) {
    return {
      workItemId: validatedOptions.workItemId,
      previousRank: targetItem.stackRank,
      newRank: targetItem.stackRank,
      position: normalizedPosition,
    };
  }

  const remainingItems = backlog.items.filter((item) => item.id !== validatedOptions.workItemId);
  const insertIndex = Math.max(0, Math.min(normalizedPosition - 1, remainingItems.length));
  const above = remainingItems[insertIndex - 1] ?? null;
  const below = remainingItems[insertIndex] ?? null;
  const newRank = calculateInsertionRank(above?.stackRank ?? null, below?.stackRank ?? null);
  const rankFieldPath = getRankFieldPath(backlog.field);

  await updateWorkItem(validatedOptions.workItemId, {
    fields: {
      [rankFieldPath]: newRank,
    },
  });

  timer.log("reorderSingle");
  return {
    workItemId: validatedOptions.workItemId,
    previousRank: targetItem.stackRank,
    newRank,
    position: normalizedPosition,
  };
}

export async function reorderBulk(options: ReorderBulkOptions): Promise<ReorderResult[]> {
  const timer = createTimer();
  const validatedOptions = validate(ReorderBulkOptionsSchema, options);
  const backlog = await getBacklog({
    areaPath: validatedOptions.areaPath,
    workItemType: validatedOptions.workItemType,
    detailLevel: "light",
  });
  const itemsById = new Map(backlog.items.map((item) => [item.id, item]));

  for (const workItemId of validatedOptions.orderedIds) {
    if (!itemsById.has(workItemId)) {
      throw new Error(`Work item ${workItemId} is not in the scoped backlog`);
    }
  }

  const startRank = validatedOptions.startRank ?? DEFAULT_REORDER_START_RANK;
  const spacing = validatedOptions.spacing ?? DEFAULT_REORDER_SPACING;
  const rankFieldPath = getRankFieldPath(backlog.field);
  const results = validatedOptions.orderedIds.map((workItemId, index) => ({
    workItemId,
    previousRank: itemsById.get(workItemId)?.stackRank ?? null,
    newRank: startRank + index * spacing,
    position: index + 1,
  }));

  if (!validatedOptions.dryRun) {
    for (const result of results) {
      await updateWorkItem(result.workItemId, {
        fields: {
          [rankFieldPath]: result.newRank,
        },
      });
    }
  }

  timer.log("reorderBulk");
  return results;
}

export async function validateBacklog(
  options: BacklogQueryOptions,
): Promise<BacklogValidationResult> {
  const timer = createTimer();
  const backlog = await getBacklog(options);
  const issues: BacklogIssue[] = [];

  const missingRankIds = backlog.items
    .filter((item) => item.stackRank === null)
    .map((item) => item.id);
  if (missingRankIds.length > 0) {
    issues.push({
      type: "missing_rank",
      workItemIds: missingRankIds,
      detail: `${missingRankIds.length} work item(s) are missing ${backlog.field}`,
    });
  }

  const duplicateGroups = new Map<number, number[]>();
  for (const item of backlog.items) {
    if (item.stackRank === null) {
      continue;
    }

    const existing = duplicateGroups.get(item.stackRank) ?? [];
    existing.push(item.id);
    duplicateGroups.set(item.stackRank, existing);
  }

  for (const [rank, ids] of duplicateGroups.entries()) {
    if (ids.length > 1) {
      issues.push({
        type: "duplicate_rank",
        workItemIds: ids,
        detail: `${backlog.field} ${rank} is assigned to multiple work items`,
      });
    }
  }

  const rankedItems = backlog.items.filter((item) => item.stackRank !== null);
  for (let index = 1; index < rankedItems.length; index += 1) {
    const previous = rankedItems[index - 1];
    const current = rankedItems[index];
    const gap = (current.stackRank ?? 0) - (previous.stackRank ?? 0);

    if (gap < 1) {
      issues.push({
        type: "gap_too_small",
        workItemIds: [previous.id, current.id],
        detail: `Gap between ${previous.id} and ${current.id} is ${gap}`,
      });
    }
  }

  const outOfRangeIds = backlog.items
    .filter((item) => item.stackRank !== null && Math.abs(item.stackRank) > MAX_SAFE_RANK)
    .map((item) => item.id);
  if (outOfRangeIds.length > 0) {
    issues.push({
      type: "out_of_range",
      workItemIds: outOfRangeIds,
      detail: `${outOfRangeIds.length} work item(s) have rank values near numeric precision limits`,
    });
  }

  timer.log("validateBacklog");
  return {
    valid: issues.length === 0,
    issues,
    items: backlog.items,
  };
}
