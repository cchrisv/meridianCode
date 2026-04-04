#!/usr/bin/env node
/**
 * Workflow Tools CLI
 * Command-line interface for workflow automation
 */

import { Command } from "commander";
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "fs";
import { resolve } from "path";
import { configureLogger } from "../src/lib/loggerStructured.js";
import { getWorkItem } from "../src/adoWorkItems.js";
import { loadSharedConfig, getProjectRoot } from "../src/lib/configLoader.js";
import { detectPlatformFromWorkItem } from "../src/lib/meridianPlatform.js";
import { appendAuditEntry } from "../src/lib/auditLog.js";

const program = new Command();

program.name("workflow-tools").description("Workflow automation operations").version("2.0.0");

// Prepare command
program
  .command("prepare")
  .description("Initialize workflow artifacts for a work item")
  .requiredOption("-w, --work-item <id>", "Work item ID", parseInt)
  .option("--force", "Overwrite existing run state")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItemId = options.workItem;

      // Load shared config
      const config = loadSharedConfig();
      const projectRoot = getProjectRoot();
      const artifactsRoot = config.paths.artifacts_root;

      // Single directory + single context file
      const root = resolve(projectRoot, artifactsRoot, String(workItemId));
      const contextPath = resolve(root, "ticket-context.json");

      // Check if already initialized
      if (existsSync(contextPath) && !options.force) {
        const result = {
          success: false,
          message: `Workflow already initialized for ${workItemId}. Use --force to reinitialize.`,
          contextPath,
        };
        console.log(options.json ? JSON.stringify(result, null, 2) : result.message);
        process.exit(0);
      }

      // Fetch work item to validate it exists
      const workItem = await getWorkItem(workItemId, { expand: "All" });

      // Create root directory only (no subdirectories)
      if (!existsSync(root)) {
        mkdirSync(root, { recursive: true });
      }

      // Create unified ticket-context.json
      const now = new Date().toISOString();
      const platform = detectPlatformFromWorkItem(workItem);
      const ticketContext = {
        metadata: {
          work_item_id: String(workItemId),
          created_at: now,
          last_updated: now,
          current_phase: "research",
          phases_completed: [] as string[],
          version: "1.0",
          platform: platform ?? undefined,
        },
        platform: platform ?? null,
        detectedIntegrations: [] as string[],
        crossPlatformImpacts: [] as unknown[],
        run_state: {
          completed_steps: [] as string[],
          generation_history: [] as object[],
          errors: [] as object[],
          metrics: {
            research: {},
            grooming: {},
            solutioning: {},
          },
        },
        research: {},
        grooming: {},
        solutioning: {},
        wiki: {},
        finalization: {},
        dev_updates: { updates: [] as object[] },
        closeout: {},
      };
      writeFileSync(contextPath, JSON.stringify(ticketContext, null, 2), "utf-8");

      appendAuditEntry({
        timestamp: now,
        platformDomain: platform ?? undefined,
        invoked: "workflow-tools prepare",
        commands: [`workflow-tools prepare -w ${workItemId}`],
        outcome: "completed",
      });

      const result = {
        success: true,
        workItemId,
        workItemType: workItem.fields["System.WorkItemType"],
        title: workItem.fields["System.Title"],
        root,
        contextPath,
        message: `Workflow initialized for ${workItemId}. Next: Run research phase.`,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `✓ Initialized workflow for ${workItem.fields["System.WorkItemType"]} #${workItemId}`,
        );
        console.log(`  Title: ${workItem.fields["System.Title"]}`);
        console.log(`  Context: ${contextPath}`);
        console.log(`  Next step: Run research phase`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Status command
program
  .command("status")
  .description("Get workflow status")
  .requiredOption("-w, --work-item <id>", "Work item ID", parseInt)
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItemId = options.workItem;
      const config = loadSharedConfig();
      const projectRoot = getProjectRoot();
      const artifactsRoot = config.paths.artifacts_root;
      const root = resolve(projectRoot, artifactsRoot, String(workItemId));
      const contextPath = resolve(root, "ticket-context.json");

      if (!existsSync(contextPath)) {
        const result = {
          success: false,
          workItemId,
          message: `No workflow found for ${workItemId}. Run 'workflow-tools prepare' first.`,
        };
        console.log(options.json ? JSON.stringify(result, null, 2) : result.message);
        process.exit(1);
      }

      const context = JSON.parse(readFileSync(contextPath, "utf-8"));
      const metadata = context.metadata || {};
      const runState = context.run_state || {};

      // Check which sections have data (sections instead of directories)
      const hasData = (section: unknown): boolean => {
        if (!section || typeof section !== "object") return false;
        return Object.keys(section as object).length > 0;
      };

      const result = {
        success: true,
        workItemId,
        currentPhase: metadata.current_phase,
        phasesCompleted: metadata.phases_completed || [],
        completedSteps: (runState.completed_steps || []).length,
        errors: (runState.errors || []).length,
        sections: {
          research: hasData(context.research),
          grooming: hasData(context.grooming),
          solutioning: hasData(context.solutioning),
          wiki: hasData(context.wiki),
          finalization: hasData(context.finalization),
          dev_updates: (context.dev_updates?.updates || []).length > 0,
          closeout: hasData(context.closeout),
        },
        createdAt: metadata.created_at,
        lastUpdated: metadata.last_updated,
        contextPath,
      };

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Workflow Status for #${workItemId}`);
        console.log(`  Current Phase: ${metadata.current_phase}`);
        console.log(
          `  Phases Completed: ${(metadata.phases_completed || []).join(", ") || "none"}`,
        );
        console.log(`  Completed Steps: ${(runState.completed_steps || []).length}`);
        console.log(`  Errors: ${(runState.errors || []).length}`);
        const populated = Object.entries(result.sections)
          .filter(([, v]) => v)
          .map(([k]) => k);
        console.log(`  Populated Sections: ${populated.join(", ") || "none"}`);
        console.log(`  Created: ${metadata.created_at || "N/A"}`);
        console.log(`  Last Updated: ${metadata.last_updated}`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Reset command
program
  .command("reset")
  .description("Reset workflow state (all phases or specific phase)")
  .requiredOption("-w, --work-item <id>", "Work item ID", parseInt)
  .option(
    "-p, --phase <phase>",
    "Specific section to reset (research, grooming, solutioning, wiki, finalization, dev_updates, closeout)",
  )
  .option("--force", "Skip confirmation")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (!options.force) {
        const scope = options.phase ? `${options.phase} section` : "entire workflow";
        console.error(`Error: Use --force to confirm reset. This will clear ${scope}.`);
        process.exit(1);
      }

      const workItemId = options.workItem;
      const phase = options.phase;
      const validSections = [
        "research",
        "grooming",
        "solutioning_research",
        "solutioning",
        "test_cases",
        "wiki",
        "finalization",
        "dev_updates",
        "closeout",
      ];
      const phaseOrder = [
        "research",
        "grooming",
        "solutioning_research",
        "solutioning",
        "test_cases",
        "wiki",
        "finalization",
      ];

      // Validate section if provided
      if (phase && !validSections.includes(phase)) {
        console.error(
          `Error: Invalid section '${phase}'. Valid sections: ${validSections.join(", ")}`,
        );
        process.exit(1);
      }

      const config = loadSharedConfig();
      const projectRoot = getProjectRoot();
      const artifactsRoot = config.paths.artifacts_root;
      const root = resolve(projectRoot, artifactsRoot, String(workItemId));
      const contextPath = resolve(root, "ticket-context.json");

      if (!existsSync(contextPath)) {
        const result = {
          success: false,
          workItemId,
          message: `No workflow found for ${workItemId}.`,
        };
        console.log(options.json ? JSON.stringify(result, null, 2) : result.message);
        process.exit(0);
      }

      if (phase) {
        // Reset specific section in ticket-context.json
        const context = JSON.parse(readFileSync(contextPath, "utf-8"));
        // test_cases data lives under .solutioning.testing, not a top-level key
        const isTestCases = phase === "test_cases";
        const previousData = isTestCases ? context.solutioning?.testing : context[phase];
        const hadData =
          previousData && typeof previousData === "object" && Object.keys(previousData).length > 0;

        // Clear the section
        if (isTestCases) {
          // Only clear the testing sub-section, preserve rest of solutioning
          if (context.solutioning) {
            delete context.solutioning.testing;
          }
        } else if (phase === "dev_updates") {
          context[phase] = { updates: [] };
        } else {
          context[phase] = {};
        }

        // Update metadata: remove from phases_completed, rewind current_phase
        const phaseIndex = phaseOrder.indexOf(phase);
        if (phaseIndex >= 0) {
          context.metadata.phases_completed = (context.metadata.phases_completed || []).filter(
            (p: string) => phaseOrder.indexOf(p) < phaseIndex,
          );
          context.metadata.current_phase =
            phase === "research" ? "research" : phaseOrder[Math.max(0, phaseIndex)];
        }

        // Clear related completed_steps (handles both string and object entries)
        context.run_state.completed_steps = (context.run_state.completed_steps || []).filter(
          (step: unknown) => {
            if (typeof step === "string") return !step.toLowerCase().includes(phase);
            if (typeof step === "object" && step !== null && "phase" in step)
              return (step as Record<string, string>)["phase"] !== phase;
            return true;
          },
        );

        // Clear phase metrics if applicable
        if (context.run_state.metrics?.[phase]) {
          context.run_state.metrics[phase] = {};
        }

        context.metadata.last_updated = new Date().toISOString();
        writeFileSync(contextPath, JSON.stringify(context, null, 2), "utf-8");

        const result = {
          success: true,
          workItemId,
          section: phase,
          hadData,
          currentPhase: context.metadata.current_phase,
          phasesCompleted: context.metadata.phases_completed,
          message: `Section '${phase}' reset for ${workItemId}.`,
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`✓ Section '${phase}' reset for #${workItemId}`);
          console.log(`  Had data: ${hadData}`);
          console.log(`  Current phase: ${context.metadata.current_phase}`);
          console.log(
            `  Phases completed: ${context.metadata.phases_completed.join(", ") || "none"}`,
          );
        }
      } else {
        // Reset all — delete entire directory
        rmSync(root, { recursive: true, force: true });

        const result = {
          success: true,
          workItemId,
          section: "all",
          message: `Workflow reset for ${workItemId}. All artifacts deleted.`,
          deletedPath: root,
        };

        if (options.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log(`✓ Workflow reset for #${workItemId}`);
          console.log(`  Deleted: ${root}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
