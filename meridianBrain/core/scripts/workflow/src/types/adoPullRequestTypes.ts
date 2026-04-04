/**
 * Azure DevOps Pull Request Types
 * Type definitions for PR analysis operations
 */

import type { IdentityRef } from "./adoWorkItemTypes.js";

/**
 * Reviewer vote values from the ADO API
 */
export type ReviewerVote = 10 | 5 | 0 | -5 | -10;

/**
 * Reviewer vote labels
 */
export const REVIEWER_VOTE_LABELS: Record<ReviewerVote, string> = {
  10: "Approved",
  5: "Approved with suggestions",
  0: "No vote",
  "-5": "Waiting for author",
  "-10": "Rejected",
} as unknown as Record<ReviewerVote, string>;

/**
 * PR reviewer with vote
 */
export interface PullRequestReviewer {
  identity: IdentityRef;
  vote: ReviewerVote;
  voteLabel: string;
  isRequired: boolean;
}

/**
 * PR status values
 */
export type PullRequestStatus = "active" | "completed" | "abandoned" | "all";

/**
 * Pull request detail
 */
export interface PullRequestDetail {
  pullRequestId: number;
  title: string;
  description: string;
  status: string;
  createdBy: IdentityRef;
  creationDate: string;
  closedDate: string | null;
  sourceRefName: string;
  targetRefName: string;
  mergeStatus: string;
  isDraft: boolean;
  repository: {
    id: string;
    name: string;
    url: string;
  };
  reviewers: PullRequestReviewer[];
  labels: string[];
  url: string;
  workItemRefs: PullRequestWorkItemRef[];
}

/**
 * Change type for a file in a PR
 */
export type FileChangeType = "add" | "edit" | "delete" | "rename" | "unknown";

/**
 * Diff output mode
 * - context: sourceContent + unifiedDiff (no targetContent) — default
 * - full: sourceContent + targetContent + unifiedDiff
 * - diff-only: unifiedDiff only (no full file content)
 */
export type DiffMode = "context" | "full" | "diff-only";

/**
 * A single file change in a PR diff
 */
export interface PullRequestFileChange {
  /** File path in the repository */
  path: string;
  /** Original path (for renames) */
  originalPath: string | null;
  /** Type of change */
  changeType: FileChangeType;
  /** File content from the source branch (new content) */
  sourceContent: string | null;
  /** File content from the target branch (old content) */
  targetContent: string | null;
  /** Unified diff between target (old) and source (new) */
  unifiedDiff: string | null;
  /** Whether the file is binary */
  isBinary: boolean;
  /** Whether content was truncated due to size limits */
  isTruncated: boolean;
}

/**
 * Full diff result for a PR
 */
export interface PullRequestDiff {
  pullRequestId: number;
  repository: string;
  sourceBranch: string;
  targetBranch: string;
  files: PullRequestFileChange[];
  totalFiles: number;
  filesIncluded: number;
  filesSkipped: number;
}

/**
 * Thread status values
 */
export type ThreadStatus =
  | "active"
  | "fixed"
  | "wontFix"
  | "closed"
  | "byDesign"
  | "pending"
  | "unknown";

/**
 * A comment within a thread
 */
export interface PullRequestCommentEntry {
  id: number;
  author: IdentityRef;
  content: string;
  publishedDate: string;
  lastUpdatedDate: string;
  commentType: string;
}

/**
 * A comment thread on a PR
 */
export interface PullRequestThreadDetail {
  id: number;
  status: ThreadStatus;
  filePath: string | null;
  lineNumber: number | null;
  comments: PullRequestCommentEntry[];
  isDeleted: boolean;
}

/**
 * All threads for a PR
 */
export interface PullRequestThreads {
  pullRequestId: number;
  threads: PullRequestThreadDetail[];
  totalThreads: number;
  activeThreads: number;
  resolvedThreads: number;
}

/**
 * A linked work item reference from a PR
 */
export interface PullRequestWorkItemRef {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  url: string;
}

/**
 * Parsed PR URL components
 */
export interface ParsedPrUrl {
  orgUrl: string;
  project: string;
  repositoryId: string;
  pullRequestId: number;
}

/**
 * Options for fetching PR diff
 */
export interface GetPullRequestDiffOptions {
  /** Only include this file path */
  filePath?: string;
  /** Maximum number of files to include (default: 50) */
  maxFiles?: number;
  /** Maximum content size per file in bytes (default: 100KB) */
  maxContentSize?: number;
  /** Include file content (default: true) */
  includeContent?: boolean;
  /** Diff output mode: context (default), full, or diff-only */
  mode?: DiffMode;
}

/**
 * A PR reference discovered from a work item's artifact links
 */
export interface WorkItemPullRequest {
  pullRequestId: number;
  repositoryId: string;
  repositoryName: string;
  title: string;
  status: string;
  createdBy: string;
  sourceRefName: string;
  targetRefName: string;
  creationDate: string;
  closedDate: string | null;
  url: string;
}
