/**
 * Azure DevOps Activity Report Types
 * Type definitions for activity tracking and reporting
 */

/**
 * Target person to track activity for
 */
export interface ActivityTarget {
  name: string;
  email: string;
}

/**
 * Activity types that can be tracked
 */
export type ActivityType =
  | "Edit"
  | "Comment"
  | "AssignedTo"
  | "ActionableMention"
  | "FYIMention"
  | "DiscussionMention"
  | "WikiCreate"
  | "WikiEdit"
  | "WikiMove"
  | "WikiDelete"
  | "PRCreated"
  | "PRApproved"
  | "PRApprovedWithSuggestions"
  | "PRWaitingOnAuthor"
  | "PRRejected"
  | "PRComment"
  | "SFLogin"
  | "SFMetadataChange";

/**
 * A single activity record
 */
export interface ActivityRecord {
  /** Target person this activity is for */
  target: string;
  /** ISO timestamp of the activity */
  date: string;
  /** Work item ID (or Wiki:hash, PR number, etc.) */
  workItemId: string;
  /** PR number if applicable */
  prNumber?: string;
  /** Type of work item (User Story, Bug, Wiki, PullRequest, etc.) */
  workItemType: string;
  /** State of the work item */
  state: string;
  /** Area path */
  areaPath: string;
  /** Title of the work item/PR/wiki page */
  title: string;
  /** Type of activity */
  activityType: ActivityType;
  /** Details/description of the activity */
  details: string;
  /** Person who performed the action */
  actor: string;
  /** Link to the item */
  link?: string;
  /** Current assignee of the work item */
  assignedTo?: string;
  /** Parent work item ID (Feature or User Story) */
  parentId?: string;
  /** Parent work item title */
  parentTitle?: string;
  /** Iteration path (sprint) */
  iterationPath?: string;
  /** Tags (comma-separated) */
  tags?: string;
  /** Story points */
  storyPoints?: string;
  /** Priority (1-4) */
  priority?: string;
  /** SF metadata component name or PR branch name — used for SF↔ADO correlation */
  componentName?: string;
  /** Completed work hours (tasks) */
  completedWork?: string;
  /** Remaining work hours (tasks) */
  remainingWork?: string;
  /** Original estimate hours (tasks) */
  originalEstimate?: string;
  /** Activity type — Development, Testing, Design, etc. (tasks) */
  activityType2?: string;
  /** SF metadata components identified from PR file changes (semicolon-separated) */
  prChangedComponents?: string;
  /** Board column (Kanban column) for the work item */
  boardColumn?: string;
  /** Development summary (Custom.DevelopmentSummary) */
  developmentSummary?: string;
  /** Work item description (System.Description) — fetched separately to avoid bulk-stream bloat */
  description?: string;
  /** Acceptance criteria (Microsoft.VSTS.Common.AcceptanceCriteria) — User Stories */
  acceptanceCriteria?: string;
  /** Repro steps (Microsoft.VSTS.TCM.ReproSteps) — Bugs/Defects */
  reproSteps?: string;
}

/**
 * Options for generating activity report
 */
export interface ActivityReportOptions {
  /** People to track */
  people: ActivityTarget[];
  /** Number of days to look back (used when startDate/endDate not provided) */
  days: number;
  /** Explicit start date (ISO string, e.g. "2025-01-01"). Overrides days-based calculation when provided with endDate. */
  startDate?: string;
  /** Explicit end date (ISO string, e.g. "2025-01-31"). Defaults to today if startDate is provided without endDate. */
  endDate?: string;
  /** Include wiki activities */
  includeWiki?: boolean;
  /** Include pull request activities */
  includePullRequests?: boolean;
  /** Salesforce org alias for login/metadata activity (omit to skip SF) */
  sfOrg?: string;
  /** Output directory for reports */
  outputDir?: string;
  /** Generate narrative HTML report alongside CSV */
  narrative?: boolean;
  /** Path to team-members JSON for peer comparison in narrative */
  teamJsonPath?: string;
}

/**
 * Per-person metrics extracted from the revision stream for peer comparison
 */
export interface PeerMetrics {
  name: string;
  email: string;
  /** Total revision-level activities in the period */
  totalActivities: number;
  /** Unique work items touched */
  workItemsTouched: number;
  /** Unique calendar days with activity */
  daysActive: number;
  /** State transitions (New→Active, Active→Closed, etc.) */
  stateTransitions: number;
  /** Items moved to Closed or Resolved */
  itemsClosed: number;
  /** Total completed work hours logged */
  completedWorkHours: number;
}

/**
 * Result of activity report generation
 */
export interface ActivityReportResult {
  success: boolean;
  message: string;
  /** Generated report files */
  files: string[];
  /** Activity counts by target */
  activityCounts: Record<string, number>;
  /** Total activities found */
  totalActivities: number;
}

/**
 * Work item update from ADO API
 */
export interface WorkItemUpdate {
  id: number;
  rev: number;
  revisedBy: {
    displayName: string;
    uniqueName: string;
    id: string;
  };
  revisedDate: string;
  fields?: Record<
    string,
    {
      oldValue?: unknown;
      newValue?: unknown;
    }
  >;
  relations?: {
    added?: Array<{
      rel: string;
      url: string;
      attributes?: {
        comment?: string;
        name?: string;
      };
    }>;
    removed?: Array<{
      rel: string;
      url: string;
    }>;
  };
}

/**
 * A single revision entry from the Reporting Revisions API bulk stream.
 * Field values are snapshots at that revision (not old/new diffs).
 */
export interface RevisionEntry {
  /** Work item ID */
  id: number;
  /** Revision number (ascending per work item) */
  rev: number;
  /** ISO timestamp of the revision */
  changedDate: string;
  /** Display name of the person who made this revision */
  changedBy: string;
  /** Full field values snapshot at this revision */
  fields: Record<string, unknown>;
}

/**
 * Git commit from wiki repository
 */
export interface WikiCommit {
  commitId: string;
  comment: string;
  author: {
    name: string;
    email: string;
    date: string;
  };
  changeCounts: {
    Add: number;
    Edit: number;
    Delete: number;
  };
  remoteUrl: string;
}

/**
 * Pull request from ADO Git API
 */
export interface PullRequest {
  pullRequestId: number;
  title: string;
  creationDate: string;
  closedDate?: string;
  status: "active" | "abandoned" | "completed";
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  reviewers: Array<{
    displayName: string;
    uniqueName: string;
    vote: number; // 10=approved, 5=approved with suggestions, -5=waiting, -10=rejected
  }>;
  repository: {
    id: string;
    name: string;
  };
}

/**
 * PR thread/comment
 */
export interface PRThread {
  id: number;
  comments: Array<{
    id: number;
    author: {
      displayName: string;
      uniqueName: string;
    };
    content: string;
    publishedDate: string;
  }>;
}
