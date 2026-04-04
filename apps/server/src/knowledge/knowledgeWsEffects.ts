import { Effect } from "effect";

import type { GitCoreShape } from "../git/Services/GitCore.ts";
import type { ServerSettingsShape } from "../serverSettings.ts";
import type {
  GetKnowledgeStatusResult,
  KnowledgeStructureSummary,
  ListKnowledgeTreeResult,
  ReadKnowledgeFileResult,
  SyncKnowledgeResult,
  ValidateKnowledgeRootResult,
} from "@t3tools/contracts";
import { KnowledgeRpcError } from "@t3tools/contracts";

import {
  invalidateGlobalKnowledgeCache,
  loadGlobalKnowledgeText,
} from "./globalKnowledgeLoader.ts";
import { listKnowledgeTree, readKnowledgeFileUnderRoot } from "./knowledgeExplorer.ts";
import { countKnowledgeFiles, scanKnowledgeStructure } from "./knowledgeStructure.ts";
import { resolveExistingPath } from "./resolveKnowledgePath.ts";

const emptyStructure = (): KnowledgeStructureSummary => ({
  hasInstructions: false,
  skillCount: 0,
  agentCount: 0,
  promptFileCount: 0,
  coreKnowledgeFileCount: 0,
  platforms: [],
  hasSharedKnowledge: false,
});

function knowledgeFail(message: string, cause?: unknown) {
  return new KnowledgeRpcError({
    detail: message,
    ...(cause !== undefined ? { cause } : {}),
  });
}

export const validateKnowledgeRootWs = (input: { path: string }) =>
  Effect.tryPromise({
    try: async (): Promise<ValidateKnowledgeRootResult> => {
      const trimmed = input.path.trim();
      if (!trimmed) {
        return {
          valid: false,
          resolvedPath: "",
          issues: ["Enter a path to your Meridian clone."],
          structure: emptyStructure(),
        };
      }
      const resolved = await resolveExistingPath(trimmed);
      if (!resolved) {
        return {
          valid: false,
          resolvedPath: trimmed,
          issues: ["Path does not exist or could not be resolved."],
          structure: emptyStructure(),
        };
      }
      const { structure, issues } = await scanKnowledgeStructure(resolved);
      const valid = structure.hasInstructions && structure.coreKnowledgeFileCount > 0;
      return {
        valid,
        resolvedPath: resolved,
        issues,
        structure,
      };
    },
    catch: (cause) => knowledgeFail("Failed to validate knowledge root.", cause),
  });

export const getKnowledgeStatusWs = (deps: {
  readonly serverSettings: ServerSettingsShape;
  readonly git: GitCoreShape;
}) =>
  Effect.gen(function* () {
    const settings = yield* deps.serverSettings.getSettings;
    const raw = settings.globalKnowledgeRoot.trim();
    const lastChecked = new Date().toISOString();

    if (!raw) {
      const result: GetKnowledgeStatusResult = {
        configured: false,
        path: "",
        lastChecked,
        structure: null,
        git: null,
        pendingCommits: [],
        fileCounts: { skills: 0, agents: 0, prompts: 0, knowledge: 0 },
      };
      return result;
    }

    const resolved = yield* Effect.promise(() => resolveExistingPath(raw));

    if (!resolved) {
      const result: GetKnowledgeStatusResult = {
        configured: true,
        path: raw,
        lastChecked,
        structure: null,
        git: null,
        pendingCommits: [],
        fileCounts: { skills: 0, agents: 0, prompts: 0, knowledge: 0 },
      };
      return result;
    }

    const { structure } = yield* Effect.tryPromise({
      try: () => scanKnowledgeStructure(resolved),
      catch: (cause) => knowledgeFail("Failed to scan knowledge repository.", cause),
    });

    const fileCounts = yield* Effect.tryPromise({
      try: () => countKnowledgeFiles(resolved),
      catch: (cause) => knowledgeFail("Failed to count knowledge files.", cause),
    });

    const gitStatus = yield* deps.git
      .status({ cwd: resolved })
      .pipe(Effect.catch(() => Effect.succeed(null)));

    let pendingCommits: string[] = [];
    if (gitStatus?.isRepo && gitStatus.hasUpstream && gitStatus.behindCount > 0) {
      const logResult = yield* deps.git
        .execute({
          operation: "Knowledge.pendingCommits",
          cwd: resolved,
          args: ["log", "--oneline", "--no-decorate", `HEAD..@{upstream}`, "-n", "15"],
          maxOutputBytes: 16_384,
          truncateOutputAtMaxBytes: true,
        })
        .pipe(Effect.catch(() => Effect.succeed(null)));

      if (logResult && logResult.code === 0 && logResult.stdout.trim().length > 0) {
        pendingCommits = logResult.stdout
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
      }
    }

    const git =
      gitStatus && gitStatus.isRepo
        ? {
            isRepo: true,
            branch: gitStatus.branch,
            behindCount: gitStatus.behindCount,
            aheadCount: gitStatus.aheadCount,
            hasWorkingTreeChanges: gitStatus.hasWorkingTreeChanges,
            lastCommitSummary: null as string | null,
            upstreamLabel: gitStatus.hasUpstream
              ? `behind ${gitStatus.behindCount}`
              : gitStatus.hasOriginRemote
                ? "no upstream"
                : null,
          }
        : {
            isRepo: false,
            branch: null,
            behindCount: 0,
            aheadCount: 0,
            hasWorkingTreeChanges: false,
            lastCommitSummary: null as string | null,
            upstreamLabel: null,
          };

    const headLog = yield* deps.git
      .execute({
        operation: "Knowledge.headLog",
        cwd: resolved,
        args: ["log", "-1", "--oneline", "--no-decorate"],
        maxOutputBytes: 4096,
        truncateOutputAtMaxBytes: true,
      })
      .pipe(Effect.catch(() => Effect.succeed(null)));
    if (headLog && headLog.code === 0) {
      const line = headLog.stdout.split("\n")[0]?.trim() ?? "";
      git.lastCommitSummary = line.length > 0 ? line : null;
    }

    const result: GetKnowledgeStatusResult = {
      configured: true,
      path: resolved,
      lastChecked,
      structure,
      git,
      pendingCommits,
      fileCounts,
    };
    return result;
  });

export const syncKnowledgeWs = (deps: {
  readonly serverSettings: ServerSettingsShape;
  readonly git: GitCoreShape;
}) =>
  Effect.gen(function* () {
    const settings = yield* deps.serverSettings.getSettings;
    const raw = settings.globalKnowledgeRoot.trim();
    if (!raw) {
      const res: SyncKnowledgeResult = {
        success: false,
        pulled: false,
        errors: ["Meridian knowledge root is not configured."],
      };
      return res;
    }
    const resolved = yield* Effect.promise(() => resolveExistingPath(raw));
    if (!resolved) {
      const res: SyncKnowledgeResult = {
        success: false,
        pulled: false,
        errors: ["Knowledge root path is missing."],
      };
      return res;
    }

    const pull = yield* deps.git
      .pullCurrentBranch(resolved)
      .pipe(Effect.mapError((cause) => knowledgeFail(cause.message, cause)));

    yield* Effect.sync(() => {
      invalidateGlobalKnowledgeCache(resolved);
    });

    // Warm loader cache so the next turn sees fresh content (best-effort).
    yield* Effect.promise(() => loadGlobalKnowledgeText(resolved)).pipe(Effect.ignore);

    const res: SyncKnowledgeResult = {
      success: true,
      pulled: pull.status === "pulled",
      errors: [],
    };
    return res;
  });

export const listKnowledgeTreeWs = (deps: { readonly serverSettings: ServerSettingsShape }) =>
  Effect.gen(function* () {
    const settings = yield* deps.serverSettings.getSettings;
    const raw = settings.globalKnowledgeRoot.trim();
    if (!raw) {
      return yield* knowledgeFail("Meridian is not configured.");
    }
    const data = yield* Effect.tryPromise({
      try: () => listKnowledgeTree(raw),
      catch: (cause) => knowledgeFail("Failed to list knowledge tree.", cause),
    });
    if (!data.root) {
      return yield* knowledgeFail("Knowledge root path is missing.");
    }
    const result: ListKnowledgeTreeResult = {
      root: data.root,
      truncated: data.truncated,
      entries: data.entries,
    };
    return result;
  });

export const readKnowledgeFileWs = (
  deps: { readonly serverSettings: ServerSettingsShape },
  input: { path: string },
) =>
  Effect.gen(function* () {
    const settings = yield* deps.serverSettings.getSettings;
    const rawRoot = settings.globalKnowledgeRoot.trim();
    if (!rawRoot) {
      return yield* knowledgeFail("Meridian is not configured.");
    }
    const read = yield* Effect.tryPromise({
      try: () => readKnowledgeFileUnderRoot(rawRoot, input.path),
      catch: (cause) => knowledgeFail("Failed to read file.", cause),
    });
    if ("error" in read) {
      return yield* knowledgeFail(read.error);
    }
    const result: ReadKnowledgeFileResult = {
      path: read.path,
      content: read.content,
      size: read.size,
      category: read.category,
      frontmatter: read.frontmatter,
    };
    return result;
  });

/** Re-export for Copilot / command reactor integration tests */
export { loadGlobalKnowledgeText };
