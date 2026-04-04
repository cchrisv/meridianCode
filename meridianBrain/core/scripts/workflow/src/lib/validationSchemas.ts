/**
 * Validation Schemas
 * Zod schemas for runtime validation of inputs
 */

import { z } from "zod";

// ============================================
// Azure DevOps Schemas
// ============================================

/**
 * Work Class Type enum
 */
export const WorkClassTypeSchema = z.enum([
  "Critical/Escalation",
  "Development",
  "Fixed Date Delivery",
  "Maintenance/Recurring Tasks",
  "Standard",
]);

/**
 * Requires QA enum
 */
export const RequiresQASchema = z.enum(["Yes", "No"]);

/**
 * Priority enum
 */
export const PrioritySchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

/**
 * Work item type enum
 */
export const WorkItemTypeSchema = z.enum([
  "User Story",
  "Task",
  "Bug",
  "Feature",
  "Epic",
  "Issue",
  "Test Case",
  "Test Plan",
  "Test Suite",
]);

/**
 * Link type alias enum
 */
export const LinkTypeAliasSchema = z.enum([
  "parent",
  "child",
  "related",
  "predecessor",
  "successor",
  "duplicate",
  "affects",
]);

/**
 * Work item fields schema (partial - only commonly used fields)
 */
export const WorkItemFieldsSchema = z
  .object({
    // System fields
    "System.Title": z.string().optional(),
    "System.Description": z.string().optional(),
    "System.State": z.string().optional(),
    "System.BoardColumn": z.string().optional(),
    "System.AreaPath": z.string().optional(),
    "System.IterationPath": z.string().optional(),
    "System.AssignedTo": z.string().optional(),
    "System.Tags": z.string().optional(),
    // Microsoft VSTS Common fields
    "Microsoft.VSTS.Scheduling.StoryPoints": z.number().optional(),
    "Microsoft.VSTS.Common.Priority": PrioritySchema.optional(),
    "Microsoft.VSTS.Common.StackRank": z.number().optional(),
    "Microsoft.VSTS.Common.BacklogPriority": z.number().optional(),
    "Microsoft.VSTS.Common.AcceptanceCriteria": z.string().optional(),
    // Microsoft VSTS TCM fields (Bug-specific)
    "Microsoft.VSTS.TCM.ReproSteps": z.string().optional(),
    "Microsoft.VSTS.TCM.SystemInfo": z.string().optional(),
    // Custom fields
    "Custom.WorkClassType": WorkClassTypeSchema.optional(),
    "Custom.RequiresQA": RequiresQASchema.optional(),
    "Custom.SFComponents": z.string().optional(),
    "Custom.TechnicalNotes": z.string().optional(),
    "Custom.RootCauseDetail": z.string().optional(),
  })
  .passthrough(); // Allow additional fields

/**
 * Get work item options schema
 */
export const GetWorkItemOptionsSchema = z.object({
  expand: z.enum(["None", "Relations", "Fields", "Links", "All"]).optional(),
  includeComments: z.boolean().optional(),
  fields: z.array(z.string()).optional(),
});

/**
 * Create work item options schema
 */
export const CreateWorkItemOptionsSchema = z.object({
  type: WorkItemTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  parentId: z.number().positive().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  assignedTo: z.string().optional(),
  tags: z.array(z.string()).optional(),
  additionalFields: WorkItemFieldsSchema.optional(),
});

/**
 * Update work item options schema
 */
export const UpdateWorkItemOptionsSchema = z.object({
  fields: WorkItemFieldsSchema.optional(),
  comment: z.string().optional(),
});

/**
 * Search work items options schema
 */
export const SearchWorkItemsOptionsSchema = z.object({
  searchText: z.string().optional(),
  wiql: z.string().optional(),
  workItemType: WorkItemTypeSchema.optional(),
  state: z.string().optional(),
  assignedTo: z.string().optional(),
  areaPath: z.string().optional(),
  iterationPath: z.string().optional(),
  tags: z.array(z.string()).optional(),
  top: z.number().positive().optional(),
});

export const BacklogQueryOptionsSchema = z.object({
  areaPath: z.string().min(1),
  workItemType: WorkItemTypeSchema.optional(),
  states: z.array(z.string().min(1)).optional(),
  top: z.number().int().positive().optional(),
  detailLevel: z.enum(["light", "summary", "full"]).optional(),
});

export const ReorderSingleOptionsSchema = z.object({
  workItemId: z.number().int().positive(),
  position: z.number().int().positive(),
  areaPath: z.string().min(1),
  workItemType: WorkItemTypeSchema.optional(),
});

export const ReorderBulkOptionsSchema = z.object({
  orderedIds: z
    .array(z.number().int().positive())
    .nonempty()
    .refine((ids) => new Set(ids).size === ids.length, "orderedIds must not contain duplicates"),
  areaPath: z.string().min(1),
  workItemType: WorkItemTypeSchema.optional(),
  startRank: z.number().finite().optional(),
  spacing: z.number().positive().finite().optional(),
  dryRun: z.boolean().optional(),
});

/**
 * Link work items options schema
 */
export const LinkWorkItemsOptionsSchema = z.object({
  sourceId: z.number().positive(),
  targetId: z.number().positive(),
  linkType: LinkTypeAliasSchema,
  comment: z.string().optional(),
});

// ============================================
// Salesforce Schemas
// ============================================

/**
 * Query options schema
 */
export const QueryOptionsSchema = z.object({
  query: z.string().min(1),
  useToolingApi: z.boolean().optional(),
  allRows: z.boolean().optional(),
  maxRecords: z.number().positive().optional(),
});

/**
 * Dependency discovery options schema
 */
export const MetadataTypeSchema = z.enum([
  "CustomObject",
  "CustomField",
  "ApexClass",
  "ApexTrigger",
  "ApexPage",
  "ApexComponent",
  "AuraDefinitionBundle",
  "LightningComponentBundle",
  "Flow",
  "FlowDefinition",
  "ValidationRule",
  "WorkflowRule",
  "WorkflowFieldUpdate",
  "WorkflowAlert",
  "ProcessBuilder",
  "CustomMetadataType",
  "CustomSetting",
  "CustomLabel",
  "Layout",
  "RecordType",
  "FieldSet",
  "CompactLayout",
  "ListView",
  "Report",
  "Dashboard",
  "PermissionSet",
  "Profile",
  "Unknown",
]);

export const DiscoverDependenciesOptionsSchema = z.object({
  rootType: MetadataTypeSchema,
  rootName: z.string().min(1),
  maxDepth: z.number().positive().optional(),
  includeStandardObjects: z.boolean().optional(),
  includeNamespaced: z.boolean().optional(),
  excludeTypes: z.array(MetadataTypeSchema).optional(),
  parallelQueries: z.number().positive().optional(),
});

// ============================================
// Validation Helpers
// ============================================

/**
 * Validate data against a schema and return typed result
 */
export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validate data, returning result or undefined
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | undefined {
  const result = schema.safeParse(data);
  return result.success ? result.data : undefined;
}

/**
 * Get validation errors as a formatted string
 */
export function getValidationErrors(schema: z.ZodSchema, data: unknown): string[] {
  const result = schema.safeParse(data);
  if (result.success) {
    return [];
  }
  return result.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`);
}
