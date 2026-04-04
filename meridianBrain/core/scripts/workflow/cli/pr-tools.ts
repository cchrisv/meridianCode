#!/usr/bin/env node
/**
 * PR Tools CLI
 * Command-line interface for Azure DevOps pull request operations
 */

import { Command } from "commander";
import {
  parsePrUrl,
  getPullRequest,
  getPullRequestDiff,
  getPullRequestThreads,
  getPullRequestWorkItems,
  getPullRequestsForWorkItem,
} from "../src/adoPullRequests.js";
import { configureLogger } from "../src/lib/loggerStructured.js";

/**
 * Resolve prId and repoId from either --url or positional args
 */
function resolveArgs(
  prIdArg: string | undefined,
  options: { url?: string; repo?: string },
): { prId: number; repoId: string } {
  if (options.url) {
    const parsed = parsePrUrl(options.url);
    return { prId: parsed.pullRequestId, repoId: parsed.repositoryId };
  }

  if (!prIdArg) {
    throw new Error("Provide either <prId> with --repo, or --url <fullUrl>");
  }

  if (!options.repo) {
    throw new Error("--repo is required when using <prId> (or use --url instead)");
  }

  return { prId: parseInt(prIdArg, 10), repoId: options.repo };
}

const program = new Command();

program.name("pr-tools").description("Azure DevOps pull request operations").version("1.0.0");

// Get command — PR metadata
program
  .command("get [prId]")
  .description("Get pull request details")
  .option("-r, --repo <repoIdOrName>", "Repository ID or name")
  .option("-u, --url <prUrl>", "Full PR URL (alternative to prId + --repo)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (prIdArg: string | undefined, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const { prId, repoId } = resolveArgs(prIdArg, options);
      const pr = await getPullRequest(prId, repoId);

      if (options.json) {
        console.log(JSON.stringify(pr, null, 2));
      } else {
        console.log(`PR #${pr.pullRequestId}: ${pr.title}`);
        console.log(`  Status: ${pr.status}${pr.isDraft ? " (draft)" : ""}`);
        console.log(`  Author: ${pr.createdBy.displayName}`);
        console.log(`  Branch: ${pr.sourceRefName} → ${pr.targetRefName}`);
        console.log(`  Created: ${pr.creationDate}`);
        if (pr.closedDate) console.log(`  Closed: ${pr.closedDate}`);
        console.log(`  Reviewers: ${pr.reviewers.length}`);
        for (const r of pr.reviewers) {
          console.log(`    ${r.identity.displayName}: ${r.voteLabel}`);
        }
        if (pr.workItemRefs.length > 0) {
          console.log(`  Work Items: ${pr.workItemRefs.length}`);
          for (const wi of pr.workItemRefs) {
            console.log(`    ${wi.id}: ${wi.title} [${wi.workItemType}] (${wi.state})`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Diff command — file changes
program
  .command("diff [prId]")
  .description("Get pull request file changes and diff")
  .option("-r, --repo <repoIdOrName>", "Repository ID or name")
  .option("-u, --url <prUrl>", "Full PR URL (alternative to prId + --repo)")
  .option("-f, --file <path>", "Only include this file path")
  .option(
    "-m, --mode <mode>",
    "Output mode: context (source+diff), full (source+target+diff), diff-only (diff only)",
    "context",
  )
  .option("--max-files <n>", "Maximum files to include (default: 50)", parseInt)
  .option(
    "--max-content-size <bytes>",
    "Maximum content size per file in bytes (default: 102400)",
    parseInt,
  )
  .option("--no-content", "Skip fetching file content (only list changed files)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (prIdArg: string | undefined, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const { prId, repoId } = resolveArgs(prIdArg, options);
      const diff = await getPullRequestDiff(prId, repoId, {
        filePath: options.file,
        maxFiles: options.maxFiles,
        maxContentSize: options.maxContentSize,
        includeContent: options.content !== false,
        mode: options.mode,
      });

      if (options.json) {
        console.log(JSON.stringify(diff, null, 2));
      } else {
        console.log(`PR #${diff.pullRequestId} Diff: ${diff.sourceBranch} → ${diff.targetBranch}`);
        console.log(
          `  Total files: ${diff.totalFiles} (showing ${diff.filesIncluded}, skipped ${diff.filesSkipped})`,
        );
        for (const f of diff.files) {
          const marker =
            f.changeType === "add"
              ? "+"
              : f.changeType === "delete"
                ? "-"
                : f.changeType === "rename"
                  ? "→"
                  : "~";
          const suffix = f.isBinary ? " (binary)" : f.isTruncated ? " (truncated)" : "";
          console.log(`  [${marker}] ${f.path}${suffix}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Threads command — review comments
program
  .command("threads [prId]")
  .description("Get pull request comment threads")
  .option("-r, --repo <repoIdOrName>", "Repository ID or name")
  .option("-u, --url <prUrl>", "Full PR URL (alternative to prId + --repo)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (prIdArg: string | undefined, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const { prId, repoId } = resolveArgs(prIdArg, options);
      const result = await getPullRequestThreads(prId, repoId);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`PR #${result.pullRequestId} Threads:`);
        console.log(
          `  Total: ${result.totalThreads} (${result.activeThreads} active, ${result.resolvedThreads} resolved)`,
        );
        for (const t of result.threads) {
          const location = t.filePath ? ` @ ${t.filePath}:${t.lineNumber || "?"}` : "";
          console.log(`  [${t.status}]${location}`);
          for (const c of t.comments) {
            const preview =
              c.content.length > 100 ? c.content.substring(0, 100) + "..." : c.content;
            console.log(`    ${c.author.displayName}: ${preview}`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Work-items command — linked work items
program
  .command("work-items [prId]")
  .description("Get work items linked to a pull request")
  .option("-r, --repo <repoIdOrName>", "Repository ID or name")
  .option("-u, --url <prUrl>", "Full PR URL (alternative to prId + --repo)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (prIdArg: string | undefined, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const { prId, repoId } = resolveArgs(prIdArg, options);
      const workItems = await getPullRequestWorkItems(prId, repoId);

      if (options.json) {
        console.log(JSON.stringify({ pullRequestId: prId, workItems }, null, 2));
      } else {
        console.log(`PR #${prId} Linked Work Items:`);
        if (workItems.length === 0) {
          console.log("  (none)");
        } else {
          for (const wi of workItems) {
            console.log(`  ${wi.id}: ${wi.title} [${wi.workItemType}] (${wi.state})`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command — find PRs linked to a work item
program
  .command("list")
  .description("List pull requests linked to a work item")
  .requiredOption("-w, --work-item <id>", "Work item ID", parseInt)
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const prs = await getPullRequestsForWorkItem(options.workItem);

      if (options.json) {
        console.log(
          JSON.stringify(
            { workItemId: options.workItem, pullRequests: prs, count: prs.length },
            null,
            2,
          ),
        );
      } else {
        console.log(`Work Item #${options.workItem} — ${prs.length} linked PR(s):`);
        if (prs.length === 0) {
          console.log("  (none)");
        } else {
          for (const pr of prs) {
            console.log(`  PR #${pr.pullRequestId}: ${pr.title}`);
            console.log(`    Status: ${pr.status} | Repo: ${pr.repositoryName}`);
            console.log(`    Branch: ${pr.sourceRefName} → ${pr.targetRefName}`);
            console.log(`    Author: ${pr.createdBy} | Created: ${pr.creationDate}`);
            console.log(`    URL: ${pr.url}`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
