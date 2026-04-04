import * as Schema from "effect/Schema";

import { TrimmedNonEmptyString } from "./baseSchemas";

export class KnowledgeRpcError extends Schema.TaggedErrorClass<KnowledgeRpcError>()(
  "KnowledgeRpcError",
  {
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return this.detail;
  }
}

export const ValidateKnowledgeRootInput = Schema.Struct({
  path: Schema.String,
});
export type ValidateKnowledgeRootInput = typeof ValidateKnowledgeRootInput.Type;

export const KnowledgeStructureSummary = Schema.Struct({
  hasInstructions: Schema.Boolean,
  skillCount: Schema.Number,
  agentCount: Schema.Number,
  promptFileCount: Schema.Number,
  coreKnowledgeFileCount: Schema.Number,
  platforms: Schema.Array(Schema.String),
  hasSharedKnowledge: Schema.Boolean,
});
export type KnowledgeStructureSummary = typeof KnowledgeStructureSummary.Type;

export const ValidateKnowledgeRootResult = Schema.Struct({
  valid: Schema.Boolean,
  resolvedPath: Schema.String,
  issues: Schema.Array(Schema.String),
  structure: KnowledgeStructureSummary,
});
export type ValidateKnowledgeRootResult = typeof ValidateKnowledgeRootResult.Type;

export const KnowledgeGitStatus = Schema.Struct({
  isRepo: Schema.Boolean,
  branch: Schema.NullOr(Schema.String),
  behindCount: Schema.Number,
  aheadCount: Schema.Number,
  hasWorkingTreeChanges: Schema.Boolean,
  lastCommitSummary: Schema.NullOr(Schema.String),
  upstreamLabel: Schema.NullOr(Schema.String),
});
export type KnowledgeGitStatus = typeof KnowledgeGitStatus.Type;

export const KnowledgeFileCounts = Schema.Struct({
  skills: Schema.Number,
  agents: Schema.Number,
  prompts: Schema.Number,
  knowledge: Schema.Number,
});
export type KnowledgeFileCounts = typeof KnowledgeFileCounts.Type;

export const GetKnowledgeStatusResult = Schema.Struct({
  configured: Schema.Boolean,
  path: Schema.String,
  lastChecked: Schema.String,
  structure: Schema.NullOr(KnowledgeStructureSummary),
  git: Schema.NullOr(KnowledgeGitStatus),
  pendingCommits: Schema.Array(Schema.String),
  fileCounts: KnowledgeFileCounts,
});
export type GetKnowledgeStatusResult = typeof GetKnowledgeStatusResult.Type;

export const SyncKnowledgeResult = Schema.Struct({
  success: Schema.Boolean,
  pulled: Schema.Boolean,
  errors: Schema.Array(Schema.String),
});
export type SyncKnowledgeResult = typeof SyncKnowledgeResult.Type;

export const KnowledgeTreeEntryType = Schema.Literals(["file", "dir"]);
export type KnowledgeTreeEntryType = typeof KnowledgeTreeEntryType.Type;

export const KnowledgeFileCategory = Schema.Literals([
  "skill",
  "agent",
  "prompt",
  "knowledge",
  "standard",
  "config",
  "instructions",
  "file",
]);
export type KnowledgeFileCategory = typeof KnowledgeFileCategory.Type;

export interface KnowledgeTreeEntry {
  readonly path: string;
  readonly name: string;
  readonly type: typeof KnowledgeTreeEntryType.Type;
  readonly size?: number;
  readonly category?: typeof KnowledgeFileCategory.Type;
  readonly children?: ReadonlyArray<KnowledgeTreeEntry>;
}

export const KnowledgeTreeEntrySchema = Schema.Struct({
  /** Repo-relative POSIX path (forward slashes). */
  path: Schema.String,
  name: Schema.String,
  type: KnowledgeTreeEntryType,
  /** Present for files. */
  size: Schema.optional(Schema.Number),
  category: Schema.optional(KnowledgeFileCategory),
  children: Schema.optional(
    Schema.Array(Schema.suspend((): Schema.Schema<KnowledgeTreeEntry> => KnowledgeTreeEntrySchema)),
  ),
}) as Schema.Schema<KnowledgeTreeEntry>;

export const ListKnowledgeTreeResult = Schema.Struct({
  root: Schema.String,
  truncated: Schema.Boolean,
  entries: Schema.Array(KnowledgeTreeEntrySchema),
});
export type ListKnowledgeTreeResult = typeof ListKnowledgeTreeResult.Type;

export const ReadKnowledgeFileInput = Schema.Struct({
  /** Absolute path to file under the configured knowledge root. */
  path: TrimmedNonEmptyString,
});
export type ReadKnowledgeFileInput = typeof ReadKnowledgeFileInput.Type;

export const ReadKnowledgeFileResult = Schema.Struct({
  path: Schema.String,
  content: Schema.String,
  size: Schema.Number,
  category: KnowledgeFileCategory,
  /** Raw YAML/JSON frontmatter for markdown, if present. */
  frontmatter: Schema.NullOr(Schema.String),
});
export type ReadKnowledgeFileResult = typeof ReadKnowledgeFileResult.Type;
