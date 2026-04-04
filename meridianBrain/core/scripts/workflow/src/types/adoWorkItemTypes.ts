/**
 * Azure DevOps Work Item Types
 * Type definitions for work item operations
 */

import type {
  WorkItemType,
  WorkClassType,
  RequiresQA,
  Priority,
  Severity,
  ValueArea,
  Risk,
  AreaPath,
  IterationPath,
} from "./adoFieldTypes.js";

/**
 * Identity reference for users
 */
export interface IdentityRef {
  displayName: string;
  url: string;
  id: string;
  uniqueName: string;
  imageUrl?: string;
  descriptor?: string;
}

/**
 * Work item relation/link
 */
export interface WorkItemRelation {
  rel: string;
  url: string;
  attributes: {
    name?: string;
    isLocked?: boolean;
    comment?: string;
  };
}

/**
 * Work item comment
 */
export interface WorkItemComment {
  id: number;
  workItemId: number;
  text: string;
  createdBy: IdentityRef;
  createdDate: string;
  modifiedBy?: IdentityRef;
  modifiedDate?: string;
  format: "html" | "markdown" | "text";
}

/**
 * Work item fields interface
 * All fields are optional for updates
 */
export interface WorkItemFields {
  // System fields
  "System.Id"?: number;
  "System.Title"?: string;
  "System.Description"?: string;
  "System.State"?: string;
  "System.BoardColumn"?: string;
  "System.Reason"?: string;
  "System.CreatedDate"?: string;
  "System.ChangedDate"?: string;
  "System.AreaPath"?: AreaPath;
  "System.IterationPath"?: IterationPath;
  "System.WorkItemType"?: WorkItemType;
  "System.AssignedTo"?: string | IdentityRef;
  "System.Tags"?: string;
  "System.History"?: string;

  // Microsoft VSTS Common fields
  "Microsoft.VSTS.Scheduling.StoryPoints"?: number;
  "Microsoft.VSTS.Common.Priority"?: Priority;
  "Microsoft.VSTS.Common.Severity"?: Severity;
  "Microsoft.VSTS.Common.ValueArea"?: ValueArea;
  "Microsoft.VSTS.Common.Risk"?: Risk;
  "Microsoft.VSTS.Common.StackRank"?: number;
  "Microsoft.VSTS.Common.BacklogPriority"?: number;
  "Microsoft.VSTS.Common.AcceptanceCriteria"?: string;

  // Microsoft VSTS TCM fields (Bug-specific)
  "Microsoft.VSTS.TCM.ReproSteps"?: string;
  "Microsoft.VSTS.TCM.SystemInfo"?: string;

  // Custom fields
  "Custom.WorkClassType"?: WorkClassType;
  "Custom.RequiresQA"?: RequiresQA;
  "Custom.SFComponents"?: string;
  "Custom.DevelopmentSummary"?: string;
  "Custom.TechnicalNotes"?: string;
  "Custom.RootCauseDetail"?: string;

  // Allow additional custom fields
  [key: string]: unknown;
}

/**
 * Full work item representation
 */
export interface WorkItem {
  id: number;
  rev: number;
  url: string;
  fields: WorkItemFields;
  relations: WorkItemRelation[];
  _links?: Record<string, { href: string }>;
}

/**
 * Work item with expanded comments
 */
export interface WorkItemWithComments extends WorkItem {
  comments: WorkItemComment[];
}

/**
 * Patch operation for updating work items
 */
export interface PatchOperation {
  op: "add" | "remove" | "replace" | "copy" | "move" | "test";
  path: string;
  value?: unknown;
  from?: string;
}

/**
 * Options for getting a work item
 */
export interface GetWorkItemOptions {
  expand?: "None" | "Relations" | "Fields" | "Links" | "All";
  includeComments?: boolean;
  fields?: string[];
}

/**
 * Options for creating a work item
 */
export interface CreateWorkItemOptions {
  type: WorkItemType;
  title: string;
  description?: string;
  parentId?: number;
  areaPath?: AreaPath;
  iterationPath?: IterationPath;
  assignedTo?: string;
  tags?: string[];
  additionalFields?: WorkItemFields;
}

/**
 * Options for updating a work item
 */
export interface UpdateWorkItemOptions {
  fields?: WorkItemFields;
  comment?: string;
}

/**
 * Options for searching work items
 */
export interface SearchWorkItemsOptions {
  searchText?: string;
  wiql?: string;
  workItemType?: WorkItemType;
  state?: string;
  assignedTo?: string;
  areaPath?: AreaPath;
  iterationPath?: IterationPath;
  tags?: string[];
  top?: number;
}

/**
 * Search result
 */
export interface WorkItemSearchResult {
  workItems: WorkItem[];
  count: number;
}

export interface BacklogItem {
  id: number;
  title: string;
  description: string;
  acceptanceCriteria: string;
  developmentSummary: string;
  stackRank: number | null;
  state: string;
  boardColumn: string;
  createdDate: string;
  changedDate: string;
  commentCount: number;
  workItemType: WorkItemType;
  areaPath: AreaPath;
  assignedTo?: string;
  parent: {
    id: number;
    title: string;
  } | null;
}

export type BacklogDetailLevel = "light" | "summary" | "full";

export interface BacklogQueryOptions {
  areaPath: AreaPath;
  workItemType?: WorkItemType;
  states?: string[];
  top?: number;
  detailLevel?: BacklogDetailLevel;
}

export interface BacklogQueryResult {
  items: BacklogItem[];
  field: "StackRank" | "BacklogPriority";
  count: number;
}

export interface ReorderSingleOptions {
  workItemId: number;
  position: number;
  areaPath: AreaPath;
  workItemType?: WorkItemType;
}

export interface ReorderBulkOptions {
  orderedIds: number[];
  areaPath: AreaPath;
  workItemType?: WorkItemType;
  startRank?: number;
  spacing?: number;
  dryRun?: boolean;
}

export interface ReorderResult {
  workItemId: number;
  previousRank: number | null;
  newRank: number;
  position: number;
}

export interface BacklogIssue {
  type: "duplicate_rank" | "missing_rank" | "gap_too_small" | "out_of_range";
  workItemIds: number[];
  detail: string;
}

export interface BacklogValidationResult {
  valid: boolean;
  issues: BacklogIssue[];
  items: BacklogItem[];
}
