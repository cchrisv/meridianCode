/**
 * Azure DevOps Work Items
 * Operations for getting, creating, updating, and searching work items
 */

import {
  Operation,
  type JsonPatchOperation,
} from "azure-devops-node-api/interfaces/common/VSSInterfaces.js";
import type {
  WorkItem as AdoWorkItem,
  WorkItemExpand,
  Wiql,
} from "azure-devops-node-api/interfaces/WorkItemTrackingInterfaces.js";
import { createAdoConnection, type AdoConnectionConfig } from "./adoClient.js";
import { retryWithBackoff, RETRY_PRESETS } from "./lib/retryWithBackoff.js";
import { logInfo, logDebug, createTimer } from "./lib/loggerStructured.js";
import {
  validate,
  GetWorkItemOptionsSchema,
  CreateWorkItemOptionsSchema,
  UpdateWorkItemOptionsSchema,
  SearchWorkItemsOptionsSchema,
} from "./lib/validationSchemas.js";
import type {
  WorkItem,
  WorkItemWithComments,
  WorkItemFields,
  GetWorkItemOptions,
  CreateWorkItemOptions,
  UpdateWorkItemOptions,
  SearchWorkItemsOptions,
  WorkItemSearchResult,
} from "./types/adoWorkItemTypes.js";
import { ADO_FIELDS } from "./types/adoFieldTypes.js";

/**
 * Convert ADO API work item to our WorkItem type
 */
function convertWorkItem(item: AdoWorkItem): WorkItem {
  return {
    id: item.id ?? 0,
    rev: item.rev ?? 0,
    url: item.url ?? "",
    fields: (item.fields ?? {}) as WorkItemFields,
    relations:
      item.relations?.map((r) => ({
        rel: r.rel ?? "",
        url: r.url ?? "",
        attributes: r.attributes ?? {},
      })) ?? [],
    _links: item._links as Record<string, { href: string }> | undefined,
  };
}

/**
 * Map expand option to API enum
 */
function mapExpandOption(expand?: string): WorkItemExpand | undefined {
  if (!expand) return undefined;
  const expandMap: Record<string, WorkItemExpand> = {
    None: 0,
    Relations: 1,
    Fields: 2,
    Links: 3,
    All: 4,
  };
  return expandMap[expand];
}

/**
 * Get a work item by ID
 *
 * @param id - Work item ID
 * @param options - Get options
 * @param config - Connection config
 * @returns Work item
 */
export async function getWorkItem(
  id: number,
  options: GetWorkItemOptions = {},
  config?: AdoConnectionConfig,
): Promise<WorkItemWithComments> {
  const timer = createTimer();
  const validatedOptions = validate(GetWorkItemOptionsSchema, options);

  logInfo(`Getting work item ${id}`, { expand: validatedOptions.expand });

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  const workItem = await retryWithBackoff(
    () =>
      witApi.getWorkItem(
        id,
        validatedOptions.fields,
        undefined,
        mapExpandOption(validatedOptions.expand),
        conn.project,
      ),
    { ...RETRY_PRESETS.standard, operationName: `getWorkItem(${id})` },
  );

  if (!workItem) {
    throw new Error(`Work item ${id} not found`);
  }

  const result: WorkItemWithComments = convertWorkItem(workItem);

  // Fetch comments if requested
  if (validatedOptions.includeComments) {
    logDebug(`Fetching comments for work item ${id}`);
    const comments = await retryWithBackoff(() => witApi.getComments(conn.project, id), {
      ...RETRY_PRESETS.standard,
      operationName: `getComments(${id})`,
    });

    result.comments =
      comments.comments?.map((c) => ({
        id: c.id ?? 0,
        workItemId: c.workItemId ?? id,
        text: c.text ?? "",
        createdBy: {
          displayName: c.createdBy?.displayName ?? "",
          url: c.createdBy?.url ?? "",
          id: c.createdBy?.id ?? "",
          uniqueName: c.createdBy?.uniqueName ?? "",
        },
        createdDate: c.createdDate?.toISOString() ?? "",
        format: "html",
      })) ?? [];
  }

  timer.log(`getWorkItem(${id})`);
  return result;
}

/**
 * Update a work item
 *
 * @param id - Work item ID
 * @param options - Update options
 * @param config - Connection config
 * @returns Updated work item
 */
export async function updateWorkItem(
  id: number,
  options: UpdateWorkItemOptions,
  config?: AdoConnectionConfig,
): Promise<WorkItem> {
  const timer = createTimer();
  const validatedOptions = validate(UpdateWorkItemOptionsSchema, options);

  logInfo(`Updating work item ${id}`);

  // Build patch document
  const patchDoc: JsonPatchOperation[] = [];

  // Add fields from options
  if (validatedOptions.fields) {
    for (const [key, value] of Object.entries(validatedOptions.fields)) {
      if (value !== undefined) {
        patchDoc.push({
          op: Operation.Add,
          path: `/fields/${key}`,
          value,
        });
      }
    }
  }

  // Add comment/history if specified
  if (validatedOptions.comment) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.HISTORY}`,
      value: validatedOptions.comment,
    });
  }

  if (patchDoc.length === 0) {
    logDebug("No updates to apply");
    return getWorkItem(id, {}, config);
  }

  logDebug(`Applying ${patchDoc.length} patch operations`);

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  const updatedItem = await retryWithBackoff(
    () =>
      witApi.updateWorkItem(
        undefined, // customHeaders
        patchDoc,
        id,
        conn.project,
      ),
    { ...RETRY_PRESETS.standard, operationName: `updateWorkItem(${id})` },
  );

  if (!updatedItem) {
    throw new Error(`Failed to update work item ${id}`);
  }

  timer.log(`updateWorkItem(${id})`);
  return convertWorkItem(updatedItem);
}

/**
 * Create a new work item
 *
 * @param options - Create options
 * @param config - Connection config
 * @returns Created work item
 */
export async function createWorkItem(
  options: CreateWorkItemOptions,
  config?: AdoConnectionConfig,
): Promise<WorkItem> {
  const timer = createTimer();
  const validatedOptions = validate(CreateWorkItemOptionsSchema, options);

  logInfo(`Creating ${validatedOptions.type} work item: ${validatedOptions.title}`);

  // Build patch document
  const patchDoc: JsonPatchOperation[] = [];

  // Required: Title
  patchDoc.push({
    op: Operation.Add,
    path: `/fields/${ADO_FIELDS.TITLE}`,
    value: validatedOptions.title,
  });

  // Optional fields
  if (validatedOptions.description) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.DESCRIPTION}`,
      value: validatedOptions.description,
    });
  }

  if (validatedOptions.areaPath) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.AREA_PATH}`,
      value: validatedOptions.areaPath,
    });
  }

  if (validatedOptions.iterationPath) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.ITERATION_PATH}`,
      value: validatedOptions.iterationPath,
    });
  }

  if (validatedOptions.assignedTo) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.ASSIGNED_TO}`,
      value: validatedOptions.assignedTo,
    });
  }

  if (validatedOptions.tags && validatedOptions.tags.length > 0) {
    patchDoc.push({
      op: Operation.Add,
      path: `/fields/${ADO_FIELDS.TAGS}`,
      value: validatedOptions.tags.join("; "),
    });
  }

  // Add parent link if specified
  if (validatedOptions.parentId) {
    const conn = await createAdoConnection(config);
    patchDoc.push({
      op: Operation.Add,
      path: "/relations/-",
      value: {
        rel: "System.LinkTypes.Hierarchy-Reverse",
        url: `${conn.orgUrl}/${conn.project}/_apis/wit/workItems/${validatedOptions.parentId}`,
      },
    });
  }

  // Add any additional fields
  if (validatedOptions.additionalFields) {
    for (const [key, value] of Object.entries(validatedOptions.additionalFields)) {
      if (value !== undefined && !key.startsWith("System.")) {
        patchDoc.push({
          op: Operation.Add,
          path: `/fields/${key}`,
          value,
        });
      }
    }
  }

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  const createdItem = await retryWithBackoff(
    () =>
      witApi.createWorkItem(
        undefined, // customHeaders
        patchDoc,
        conn.project,
        validatedOptions.type,
      ),
    { ...RETRY_PRESETS.standard, operationName: "createWorkItem" },
  );

  if (!createdItem) {
    throw new Error("Failed to create work item");
  }

  logInfo(`Created work item ${createdItem.id}`);
  timer.log("createWorkItem");
  return convertWorkItem(createdItem);
}

/**
 * Search for work items
 *
 * @param options - Search options
 * @param config - Connection config
 * @returns Search results
 */
export async function searchWorkItems(
  options: SearchWorkItemsOptions,
  config?: AdoConnectionConfig,
): Promise<WorkItemSearchResult> {
  const timer = createTimer();
  const validatedOptions = validate(SearchWorkItemsOptionsSchema, options);

  logInfo("Searching work items", validatedOptions);

  const conn = await createAdoConnection(config);
  const witApi = await conn.getWorkItemTrackingApi();

  let wiqlQuery: string;

  if (validatedOptions.wiql) {
    // Use provided WIQL directly
    wiqlQuery = validatedOptions.wiql;
  } else {
    // Build WIQL from options
    const conditions: string[] = [];

    if (validatedOptions.searchText) {
      conditions.push(`[System.Title] CONTAINS '${validatedOptions.searchText}'`);
    }

    if (validatedOptions.workItemType) {
      conditions.push(`[System.WorkItemType] = '${validatedOptions.workItemType}'`);
    }

    if (validatedOptions.state) {
      conditions.push(`[System.State] = '${validatedOptions.state}'`);
    }

    if (validatedOptions.assignedTo) {
      conditions.push(`[System.AssignedTo] = '${validatedOptions.assignedTo}'`);
    }

    if (validatedOptions.areaPath) {
      conditions.push(`[System.AreaPath] UNDER '${validatedOptions.areaPath}'`);
    }

    if (validatedOptions.iterationPath) {
      conditions.push(`[System.IterationPath] UNDER '${validatedOptions.iterationPath}'`);
    }

    if (validatedOptions.tags && validatedOptions.tags.length > 0) {
      for (const tag of validatedOptions.tags) {
        conditions.push(`[System.Tags] CONTAINS '${tag}'`);
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // WIQL format: SELECT [fields] FROM WorkItems WHERE ... ORDER BY ...
    // Note: WIQL doesn't support TOP in the query - we limit in code instead
    wiqlQuery = `SELECT [System.Id] FROM WorkItems ${whereClause} ORDER BY [System.ChangedDate] DESC`;
  }

  logDebug("Executing WIQL", { wiql: wiqlQuery });

  const wiql: Wiql = { query: wiqlQuery };

  const queryResult = await retryWithBackoff(
    () => witApi.queryByWiql(wiql, { project: conn.project }),
    { ...RETRY_PRESETS.standard, operationName: "queryByWiql" },
  );

  if (!queryResult.workItems || queryResult.workItems.length === 0) {
    logDebug("No work items found");
    return { workItems: [], count: 0 };
  }

  // Get full work item details
  let ids = queryResult.workItems.map((wi) => wi.id).filter((id): id is number => id !== undefined);

  // Apply top limit if specified
  if (validatedOptions.top && ids.length > validatedOptions.top) {
    ids = ids.slice(0, validatedOptions.top);
  }

  logDebug(`Found ${ids.length} work items, fetching details`);

  // Azure DevOps API has a 200 work item limit per request
  // Fetch in batches to handle larger result sets
  const BATCH_SIZE = 200;
  const allWorkItems: AdoWorkItem[] = [];

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const batchIds = ids.slice(i, i + BATCH_SIZE);
    logDebug(
      `Fetching batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(ids.length / BATCH_SIZE)} (${batchIds.length} items)`,
    );

    const batchWorkItems = await retryWithBackoff(
      () => witApi.getWorkItems(batchIds, undefined, undefined, undefined, undefined, conn.project),
      {
        ...RETRY_PRESETS.standard,
        operationName: `getWorkItems(batch ${Math.floor(i / BATCH_SIZE) + 1})`,
      },
    );

    allWorkItems.push(...batchWorkItems.filter((wi): wi is AdoWorkItem => wi !== null));
  }

  const results = allWorkItems.map(convertWorkItem);

  timer.log("searchWorkItems");
  return {
    workItems: results,
    count: results.length,
  };
}
