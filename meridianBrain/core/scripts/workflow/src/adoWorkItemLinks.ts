/**
 * Azure DevOps Work Item Links
 * Operations for linking work items together
 */

import {
  Operation,
  type JsonPatchOperation,
} from "azure-devops-node-api/interfaces/common/VSSInterfaces.js";
import { createAdoConnection, type AdoConnectionConfig } from "./adoClient.js";
import { getWorkItem } from "./adoWorkItems.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, logDebug, createTimer } from "./lib/loggerStructured.js";
import { validate, LinkWorkItemsOptionsSchema } from "./lib/validationSchemas.js";
import type { WorkItem } from "./types/adoWorkItemTypes.js";
import {
  type LinkWorkItemsOptions,
  type GetRelationsOptions,
  type RelationResult,
  type ParsedRelation,
  type LinkTypeAlias,
  resolveLinkType,
  parseLinkType,
  extractWorkItemIdFromUrl,
} from "./types/adoLinkTypes.js";

/**
 * Link two work items together
 *
 * @param options - Link options
 * @param config - Connection config
 * @returns Updated source work item
 */
export async function linkWorkItems(
  options: LinkWorkItemsOptions,
  config?: AdoConnectionConfig,
): Promise<WorkItem> {
  const timer = createTimer();
  const validatedOptions = validate(LinkWorkItemsOptionsSchema, options);

  const { sourceId, targetId, linkType, comment } = validatedOptions;
  const linkTypeName = resolveLinkType(linkType);

  logInfo(`Linking work items: ${sourceId} -> ${targetId} (${linkType})`);

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  // Build the relation URL
  const targetUrl = `${conn.orgUrl}/${conn.project}/_apis/wit/workItems/${targetId}`;

  // Build patch document to add the link
  const patchDoc: JsonPatchOperation[] = [
    {
      op: Operation.Add,
      path: "/relations/-",
      value: {
        rel: linkTypeName,
        url: targetUrl,
        attributes: comment ? { comment } : {},
      },
    },
  ];

  logDebug(`Adding link: ${linkTypeName} to ${targetUrl}`);

  const updatedItem = await retryWithBackoff(
    () =>
      witApi.updateWorkItem(
        undefined, // customHeaders
        patchDoc,
        sourceId,
        conn.project,
      ),
    { ...RETRY_PRESETS.standard, operationName: `linkWorkItems(${sourceId}->${targetId})` },
  );

  if (!updatedItem) {
    throw new Error(`Failed to link work items ${sourceId} -> ${targetId}`);
  }

  logInfo(`Successfully linked work items ${sourceId} -> ${targetId}`);
  timer.log(`linkWorkItems(${sourceId}->${targetId})`);

  return {
    id: updatedItem.id ?? 0,
    rev: updatedItem.rev ?? 0,
    url: updatedItem.url ?? "",
    fields: (updatedItem.fields ?? {}) as WorkItem["fields"],
    relations:
      updatedItem.relations?.map((r) => ({
        rel: r.rel ?? "",
        url: r.url ?? "",
        attributes: r.attributes ?? {},
      })) ?? [],
  };
}

/**
 * Remove a link between two work items
 *
 * @param sourceId - Source work item ID
 * @param targetId - Target work item ID
 * @param linkType - Type of link to remove
 * @param config - Connection config
 * @returns Updated source work item
 */
export async function unlinkWorkItems(
  sourceId: number,
  targetId: number,
  linkType: LinkTypeAlias,
  config?: AdoConnectionConfig,
): Promise<WorkItem> {
  const timer = createTimer();

  logInfo(`Unlinking work items: ${sourceId} -> ${targetId} (${linkType})`);

  // First, get the work item to find the relation index
  const workItem = await getWorkItem(sourceId, { expand: "Relations" }, config);

  if (!workItem.relations || workItem.relations.length === 0) {
    throw new Error(`Work item ${sourceId} has no relations`);
  }

  // Find the relation to remove
  const linkTypeName = resolveLinkType(linkType);
  const relationIndex = workItem.relations.findIndex((r) => {
    const relTargetId = extractWorkItemIdFromUrl(r.url);
    return r.rel === linkTypeName && relTargetId === targetId;
  });

  if (relationIndex === -1) {
    throw new Error(`No ${linkType} link found from ${sourceId} to ${targetId}`);
  }

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  // Build patch document to remove the link
  const patchDoc: JsonPatchOperation[] = [
    {
      op: Operation.Remove,
      path: `/relations/${relationIndex}`,
    },
  ];

  logDebug(`Removing relation at index ${relationIndex}`);

  const updatedItem = await retryWithBackoff(
    () => witApi.updateWorkItem(undefined, patchDoc, sourceId, conn.project),
    { ...RETRY_PRESETS.standard, operationName: `unlinkWorkItems(${sourceId}->${targetId})` },
  );

  if (!updatedItem) {
    throw new Error(`Failed to unlink work items ${sourceId} -> ${targetId}`);
  }

  logInfo(`Successfully unlinked work items ${sourceId} -> ${targetId}`);
  timer.log(`unlinkWorkItems(${sourceId}->${targetId})`);

  return {
    id: updatedItem.id ?? 0,
    rev: updatedItem.rev ?? 0,
    url: updatedItem.url ?? "",
    fields: (updatedItem.fields ?? {}) as WorkItem["fields"],
    relations:
      updatedItem.relations?.map((r) => ({
        rel: r.rel ?? "",
        url: r.url ?? "",
        attributes: r.attributes ?? {},
      })) ?? [],
  };
}

/**
 * Get all relations for a work item
 *
 * @param options - Get relations options
 * @param config - Connection config
 * @returns Relation result with parsed relations
 */
export async function getWorkItemRelations(
  options: GetRelationsOptions,
  config?: AdoConnectionConfig,
): Promise<RelationResult> {
  const timer = createTimer();
  const { workItemId, linkTypes } = options;

  logInfo(`Getting relations for work item ${workItemId}`);

  // Get work item with relations expanded
  const workItem = await getWorkItem(workItemId, { expand: "Relations" }, config);

  if (!workItem.relations || workItem.relations.length === 0) {
    logDebug(`Work item ${workItemId} has no relations`);
    return { workItemId, relations: [] };
  }

  // Parse and filter relations
  const parsedRelations: ParsedRelation[] = [];

  for (const relation of workItem.relations) {
    const friendlyType = parseLinkType(relation.rel);

    // Skip if we're filtering by link types and this doesn't match
    if (linkTypes && linkTypes.length > 0 && friendlyType && !linkTypes.includes(friendlyType)) {
      continue;
    }

    const targetId = extractWorkItemIdFromUrl(relation.url);

    if (targetId !== undefined) {
      const parsed: ParsedRelation = {
        targetId,
        linkType: friendlyType ?? "related",
        linkTypeName: relation.rel as ParsedRelation["linkTypeName"],
        url: relation.url,
      };

      // Only add comment if it exists
      const commentValue = relation.attributes?.comment;
      if (typeof commentValue === "string") {
        parsed.comment = commentValue;
      }

      parsedRelations.push(parsed);
    }
  }

  logDebug(`Found ${parsedRelations.length} relations for work item ${workItemId}`);
  timer.log(`getWorkItemRelations(${workItemId})`);

  return { workItemId, relations: parsedRelations };
}

/**
 * Get related work items by link type
 *
 * @param workItemId - Work item ID
 * @param linkType - Type of link to filter by
 * @param config - Connection config
 * @returns Array of related work item IDs
 */
export async function getRelatedWorkItemIds(
  workItemId: number,
  linkType: LinkTypeAlias,
  config?: AdoConnectionConfig,
): Promise<number[]> {
  const result = await getWorkItemRelations({ workItemId, linkTypes: [linkType] }, config);

  return result.relations.map((r) => r.targetId);
}

/**
 * Get parent work item ID
 *
 * @param workItemId - Work item ID
 * @param config - Connection config
 * @returns Parent work item ID or undefined
 */
export async function getParentWorkItemId(
  workItemId: number,
  config?: AdoConnectionConfig,
): Promise<number | undefined> {
  const ids = await getRelatedWorkItemIds(workItemId, "parent", config);
  return ids[0];
}

/**
 * Get child work item IDs
 *
 * @param workItemId - Work item ID
 * @param config - Connection config
 * @returns Array of child work item IDs
 */
export async function getChildWorkItemIds(
  workItemId: number,
  config?: AdoConnectionConfig,
): Promise<number[]> {
  return getRelatedWorkItemIds(workItemId, "child", config);
}

/**
 * Check if a link exists between two work items
 *
 * @param sourceId - Source work item ID
 * @param targetId - Target work item ID
 * @param linkType - Type of link (optional - checks any if not specified)
 * @param config - Connection config
 * @returns True if link exists
 */
export async function hasLink(
  sourceId: number,
  targetId: number,
  linkType?: LinkTypeAlias,
  config?: AdoConnectionConfig,
): Promise<boolean> {
  const options: GetRelationsOptions = { workItemId: sourceId };
  if (linkType) {
    options.linkTypes = [linkType];
  }

  const result = await getWorkItemRelations(options, config);

  return result.relations.some((r) => r.targetId === targetId);
}
