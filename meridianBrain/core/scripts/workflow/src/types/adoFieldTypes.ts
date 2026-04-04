/**
 * Azure DevOps Field Types
 * Strongly-typed picklist values for ADO work item fields
 */

// Work Class Type picklist values
export type WorkClassType =
  | "Critical/Escalation"
  | "Development"
  | "Fixed Date Delivery"
  | "Maintenance/Recurring Tasks"
  | "Standard";

// Requires QA picklist values
export type RequiresQA = "Yes" | "No";

// Priority picklist values
export type Priority = 1 | 2 | 3 | 4;

// Severity picklist values
export type Severity = "1 - Critical" | "2 - High" | "3 - Medium" | "4 - Low";

// State values for different work item types
export type UserStoryState = "New" | "Active" | "Resolved" | "Closed" | "Removed";

export type TaskState = "New" | "Active" | "Closed" | "Removed";

export type BugState = "New" | "Active" | "Resolved" | "Closed";

// Work item types
export type WorkItemType =
  | "User Story"
  | "Task"
  | "Bug"
  | "Feature"
  | "Epic"
  | "Issue"
  | "Test Case"
  | "Test Plan"
  | "Test Suite";

// Value Area picklist
export type ValueArea = "Business" | "Architectural";

// Risk picklist
export type Risk = "1 - High" | "2 - Medium" | "3 - Low";

// Reason picklist values (common across types)
export type CommonReason =
  | "New"
  | "Build Failure"
  | "Implementation Started"
  | "Moved to the backlog"
  | "Moved out of the backlog";

// Area Path type (for organizational structure)
export type AreaPath = string;

// Iteration Path type (for sprint planning)
export type IterationPath = string;

// Constants for ADO configuration
export const ADO_RESOURCE_ID = "499b84ac-1321-427f-aa17-267ca6975798";
export const DEFAULT_ADO_ORG = "https://dev.azure.com/UMGC";
export const DEFAULT_ADO_PROJECT = "Digital Platforms";

// Field path constants
export const ADO_FIELDS = {
  // System fields
  ID: "System.Id",
  TITLE: "System.Title",
  DESCRIPTION: "System.Description",
  STATE: "System.State",
  REASON: "System.Reason",
  AREA_PATH: "System.AreaPath",
  ITERATION_PATH: "System.IterationPath",
  WORK_ITEM_TYPE: "System.WorkItemType",
  ASSIGNED_TO: "System.AssignedTo",
  CREATED_BY: "System.CreatedBy",
  CREATED_DATE: "System.CreatedDate",
  CHANGED_BY: "System.ChangedBy",
  CHANGED_DATE: "System.ChangedDate",
  TAGS: "System.Tags",
  HISTORY: "System.History",

  // Microsoft VSTS Common fields
  STORY_POINTS: "Microsoft.VSTS.Scheduling.StoryPoints",
  PRIORITY: "Microsoft.VSTS.Common.Priority",
  SEVERITY: "Microsoft.VSTS.Common.Severity",
  VALUE_AREA: "Microsoft.VSTS.Common.ValueArea",
  RISK: "Microsoft.VSTS.Common.Risk",
  STACK_RANK: "Microsoft.VSTS.Common.StackRank",
  BACKLOG_PRIORITY: "Microsoft.VSTS.Common.BacklogPriority",
  ACCEPTANCE_CRITERIA: "Microsoft.VSTS.Common.AcceptanceCriteria",

  // Microsoft VSTS TCM fields (Bug-specific)
  REPRO_STEPS: "Microsoft.VSTS.TCM.ReproSteps",
  SYSTEM_INFO: "Microsoft.VSTS.TCM.SystemInfo",

  // Custom fields
  WORK_CLASS_TYPE: "Custom.WorkClassType",
  REQUIRES_QA: "Custom.RequiresQA",
  SF_COMPONENTS: "Custom.SFComponents",
  DEVELOPMENT_SUMMARY: "Custom.DevelopmentSummary",
  TECHNICAL_NOTES: "Custom.TechnicalNotes",
  ROOT_CAUSE_DETAIL: "Custom.RootCauseDetail",
} as const;
