#!/usr/bin/env node
/**
 * ADO Tools CLI
 * Command-line interface for Azure DevOps operations
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import { readContentFile, adoFieldToContextKey } from "../src/lib/fileUtils.js";
import {
  getWorkItem,
  updateWorkItem,
  createWorkItem,
  searchWorkItems,
} from "../src/adoWorkItems.js";
import {
  getBacklog,
  reorderSingle,
  reorderBulk,
  validateBacklog,
} from "../src/adoBacklogReorder.js";
import { linkWorkItems, unlinkWorkItems, getWorkItemRelations } from "../src/adoWorkItemLinks.js";
import { getIteration, listIterations } from "../src/adoIterations.js";
import { configureLogger } from "../src/lib/loggerStructured.js";
import type { WorkItemType } from "../src/types/adoFieldTypes.js";
import type { LinkTypeAlias } from "../src/types/adoLinkTypes.js";
import type { BacklogDetailLevel, BacklogItem } from "../src/types/adoWorkItemTypes.js";

function parseTagList(input?: string): string[] | undefined {
  if (!input) return undefined;

  const normalizedInput = input.trim();
  if (!normalizedInput) return undefined;

  if (normalizedInput.startsWith("[") && normalizedInput.endsWith("]")) {
    try {
      const parsed = JSON.parse(normalizedInput);
      if (Array.isArray(parsed)) {
        const tags = parsed.map((tag) => String(tag).trim()).filter((tag) => tag.length > 0);
        return tags.length > 0 ? tags : undefined;
      }
    } catch {
      // Fall through to delimiter parsing
    }
  }

  const tags = input
    .split(/[;,]/)
    .map((tag) => tag.trim().replace(/^['"\[]+|['"\]]+$/g, ""))
    .filter((tag) => tag.length > 0);
  return tags.length > 0 ? tags : undefined;
}

function parseNumberList(input?: string): number[] | undefined {
  if (!input) return undefined;

  const values = input
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
    .map((value) => parseInt(value, 10));

  if (values.some((value) => Number.isNaN(value))) {
    throw new Error("IDs must be a comma, semicolon, or whitespace separated list of integers");
  }

  return values.length > 0 ? values : undefined;
}

function parseIdsFile(filePath: string): number[] {
  const content = readFileSync(filePath, "utf-8");
  return parseNumberList(content) ?? [];
}

function parseStates(input?: string): string[] | undefined {
  if (!input) return undefined;

  const states = input
    .split(/[;,]/)
    .map((state) => state.trim())
    .filter((state) => state.length > 0);

  return states.length > 0 ? states : undefined;
}

function parseInteger(value: string): number {
  return parseInt(value, 10);
}

function parseBacklogDetailLevel(value: string): BacklogDetailLevel {
  if (value === "light" || value === "summary" || value === "full") {
    return value;
  }

  throw new Error("Detail level must be one of: light, summary, full");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function htmlToPlainText(value: string): string {
  if (!value) {
    return "";
  }

  return decodeHtmlEntities(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\r/g, "")
    .replace(/\n\s+/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function summarizeContent(value: string, maxLength = 220): string | null {
  const plainText = htmlToPlainText(value);
  if (!plainText) {
    return null;
  }

  if (plainText.length <= maxLength) {
    return plainText;
  }

  return `${plainText.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatParent(parent: BacklogItem["parent"]): string {
  if (!parent) {
    return "none";
  }

  return `#${parent.id} ${parent.title}`;
}

function formatAssignedTo(assignedTo?: string): string {
  return assignedTo ?? "Unassigned";
}

function formatBacklogSummaryLine(item: BacklogItem, position: number): string {
  return `${position}. #${item.id} [${item.workItemType}] ${item.title}`;
}

function formatBacklogMetaLine(item: BacklogItem): string {
  return `   Rank: ${item.stackRank ?? "missing"} | State: ${item.state || "n/a"} | Board: ${item.boardColumn || "n/a"} | Assigned: ${formatAssignedTo(item.assignedTo)} | Parent: ${formatParent(item.parent)} | Comments: ${item.commentCount}`;
}

function formatBacklogTextBlock(
  item: BacklogItem,
  position: number,
  detailLevel: BacklogDetailLevel,
): string[] {
  const lines = [
    formatBacklogSummaryLine(item, position),
    formatBacklogMetaLine(item),
    `   Created: ${item.createdDate || "n/a"} | Changed: ${item.changedDate || "n/a"}`,
  ];

  if (detailLevel !== "light") {
    const descriptionSummary = summarizeContent(item.description);
    const acceptanceSummary = summarizeContent(item.acceptanceCriteria);
    const developmentSummary = summarizeContent(item.developmentSummary);

    if (descriptionSummary) {
      lines.push(`   Description: ${descriptionSummary}`);
    }
    if (acceptanceSummary) {
      lines.push(`   Acceptance Criteria: ${acceptanceSummary}`);
    }
    if (developmentSummary) {
      lines.push(`   Development Summary: ${developmentSummary}`);
    }
  }

  return lines;
}

function formatBacklogNeighbor(
  item: BacklogItem | undefined,
  detailLevel: BacklogDetailLevel,
): {
  id: number;
  title: string;
  workItemType: string;
  state: string;
  boardColumn: string;
  createdDate: string;
  changedDate: string;
  commentCount: number;
  assignedTo: string | null;
  stackRank: number | null;
  parent: { id: number; title: string } | null;
  descriptionSummary?: string | null;
  acceptanceCriteriaSummary?: string | null;
  developmentSummarySummary?: string | null;
  description?: string;
  acceptanceCriteria?: string;
  developmentSummary?: string;
} | null {
  if (!item) {
    return null;
  }

  const payload: {
    id: number;
    title: string;
    workItemType: string;
    state: string;
    boardColumn: string;
    createdDate: string;
    changedDate: string;
    commentCount: number;
    assignedTo: string | null;
    stackRank: number | null;
    parent: { id: number; title: string } | null;
    descriptionSummary?: string | null;
    acceptanceCriteriaSummary?: string | null;
    developmentSummarySummary?: string | null;
    description?: string;
    acceptanceCriteria?: string;
    developmentSummary?: string;
  } = {
    id: item.id,
    title: item.title,
    workItemType: item.workItemType,
    state: item.state,
    boardColumn: item.boardColumn,
    createdDate: item.createdDate,
    changedDate: item.changedDate,
    commentCount: item.commentCount,
    assignedTo: item.assignedTo ?? null,
    stackRank: item.stackRank,
    parent: item.parent,
  };

  if (detailLevel === "summary") {
    payload.descriptionSummary = summarizeContent(item.description);
    payload.acceptanceCriteriaSummary = summarizeContent(item.acceptanceCriteria);
    payload.developmentSummarySummary = summarizeContent(item.developmentSummary);
  }

  if (detailLevel === "full") {
    payload.description = item.description;
    payload.acceptanceCriteria = item.acceptanceCriteria;
    payload.developmentSummary = item.developmentSummary;
  }

  return payload;
}

function formatBacklogRow(
  item: BacklogItem,
  position: number,
  detailLevel: BacklogDetailLevel,
): Record<string, unknown> {
  const row: Record<string, unknown> = {
    position,
    id: item.id,
    title: item.title,
    workItemType: item.workItemType,
    stackRank: item.stackRank,
    state: item.state,
    boardColumn: item.boardColumn,
    createdDate: item.createdDate,
    changedDate: item.changedDate,
    commentCount: item.commentCount,
    assignedTo: item.assignedTo ?? null,
    parent: item.parent,
  };

  if (detailLevel === "summary") {
    row.descriptionSummary = summarizeContent(item.description);
    row.acceptanceCriteriaSummary = summarizeContent(item.acceptanceCriteria);
    row.developmentSummarySummary = summarizeContent(item.developmentSummary);
  }

  if (detailLevel === "full") {
    row.description = item.description;
    row.acceptanceCriteria = item.acceptanceCriteria;
    row.developmentSummary = item.developmentSummary;
  }

  return row;
}

function printNeighbor(label: string, item: BacklogItem | undefined): void {
  if (!item) {
    console.log(`${label}: none`);
    return;
  }

  console.log(`${label}: #${item.id} [${item.workItemType}] ${item.title}`);
  console.log(
    `   Rank: ${item.stackRank ?? "missing"} | State: ${item.state || "n/a"} | Board: ${item.boardColumn || "n/a"} | Assigned: ${formatAssignedTo(item.assignedTo)}`,
  );
}

function printValidationSummary(
  validation: Awaited<ReturnType<typeof validateBacklog>>,
  areaPath: string,
  top?: number,
  fixApplied?: boolean,
  fixResults?: Awaited<ReturnType<typeof reorderBulk>>,
): void {
  console.log(`Backlog validation for ${areaPath}`);
  console.log(
    `Status: ${validation.valid ? "passed" : "failed"} | Issues: ${validation.issues.length} | Items inspected: ${validation.items.length}${top ? ` (top ${top})` : ""}`,
  );

  if (validation.issues.length === 0) {
    return;
  }

  console.log("Issues:");
  for (const issue of validation.issues) {
    console.log(
      `- ${issue.type}: ${issue.detail} [${issue.workItemIds.map((id) => `#${id}`).join(", ")}]`,
    );
  }

  if (fixApplied) {
    console.log(`Fix applied: resequenced ${fixResults?.length ?? 0} work item(s)`);
  }
}

const program = new Command();

program.name("ado-tools").description("Azure DevOps work item operations").version("2.0.0");

// Get command
program
  .command("get <id>")
  .description("Get a work item by ID")
  .option("-e, --expand <type>", "Expand relations (None, Relations, Fields, Links, All)", "None")
  .option("-c, --comments", "Include comments")
  .option("-f, --fields <fields>", "Comma-separated list of fields to include")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (id: string, options) => {
    try {
      // Silence logs when outputting JSON to keep stdout clean
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItem = await getWorkItem(parseInt(id, 10), {
        expand: options.expand,
        includeComments: options.comments,
        fields: options.fields?.split(","),
      });

      if (options.json) {
        console.log(JSON.stringify(workItem, null, 2));
      } else {
        console.log(`Work Item ${workItem.id}: ${workItem.fields["System.Title"]}`);
        console.log(`  Type: ${workItem.fields["System.WorkItemType"]}`);
        console.log(`  State: ${workItem.fields["System.State"]}`);
        console.log(`  Assigned To: ${workItem.fields["System.AssignedTo"] ?? "Unassigned"}`);

        if (workItem.relations && workItem.relations.length > 0) {
          console.log(`  Relations: ${workItem.relations.length}`);
        }

        if (workItem.comments && workItem.comments.length > 0) {
          console.log(`  Comments: ${workItem.comments.length}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Update command
program
  .command("update <id>")
  .description("Update a work item")
  // Basic fields (inline)
  .option("-t, --title <title>", "New title")
  .option("-d, --description <description>", "New description (HTML)")
  .option("-s, --state <state>", "New state")
  .option("--tags <tags>", 'Tags (semicolon-separated, e.g., "Tag1; Tag2")')
  // Acceptance Criteria
  .option("--ac <criteria>", "Acceptance criteria (HTML)")
  .option("--acceptance-criteria <criteria>", "Acceptance criteria (HTML) - alias for --ac")
  // Bug-specific fields
  .option("--repro-steps <steps>", "Repro steps for bugs (HTML)")
  .option("--system-info <info>", "System info for bugs (HTML)")
  .option("--root-cause-detail <detail>", "Root cause detail for bugs (HTML)")
  // Numeric/picklist fields
  .option("--story-points <points>", "Story points", parseFloat)
  .option("--priority <priority>", "Priority (1-4)", parseInt)
  .option("--work-class <type>", "Work class type")
  .option("--requires-qa <value>", "Requires QA (Yes/No)")
  // File-based content (for large HTML)
  .option("--description-file <file>", "Read description from file")
  .option("--ac-file <file>", "Read acceptance criteria from file")
  .option("--repro-steps-file <file>", "Read repro steps from file")
  .option("--system-info-file <file>", "Read system info from file")
  .option("--root-cause-detail-file <file>", "Read root cause detail from file")
  // Arbitrary field updates
  .option("--field <path>", "Field path for arbitrary update (use with --value)")
  .option("--value <value>", "Value for arbitrary field update (use with --field)")
  .option("--value-file <file>", "Read value from file for arbitrary field update")
  // Bulk update from JSON
  .option(
    "--fields-file <file>",
    'Read fields from JSON file (expects { "fields": { ... } } or grooming-result.json format)',
  )
  // Context-driven update (reads phase output from ticket-context.json)
  .option(
    "--from-context <file>",
    "Read applied_content from ticket-context.json and map to ADO fields",
  )
  .option(
    "--phase <phase>",
    "Phase section to read from context (grooming|solutioning). Default: grooming",
  )
  // Standalone filled-spec update (render + validate + push without context file)
  .option(
    "--from-filled <files>",
    'Comma-separated filled-spec JSON files (each must have "template" and "slots" keys). Renders, validates, maps ado_field, and pushes in one call.',
  )
  // Comment
  .option("--comment <comment>", "Add a comment/history entry")
  .option("--comment-file <file>", "Read comment content from file")
  // Dry run
  .option(
    "--dry-run",
    "Render and validate without pushing to ADO. Shows fields that would be updated.",
  )
  // Output
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (id: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const fields: Record<string, unknown> = {};

      // Basic inline fields
      if (options.title) fields["System.Title"] = options.title;
      if (options.description) fields["System.Description"] = options.description;
      if (options.state) fields["System.State"] = options.state;
      if (options.tags) fields["System.Tags"] = options.tags;

      // Acceptance criteria (support both --ac and --acceptance-criteria)
      const acValue = options.ac || options.acceptanceCriteria;
      if (acValue) fields["Microsoft.VSTS.Common.AcceptanceCriteria"] = acValue;

      // Bug-specific fields
      if (options.reproSteps) fields["Microsoft.VSTS.TCM.ReproSteps"] = options.reproSteps;
      if (options.systemInfo) fields["Microsoft.VSTS.TCM.SystemInfo"] = options.systemInfo;
      if (options.rootCauseDetail) fields["Custom.RootCauseDetail"] = options.rootCauseDetail;

      // Numeric/picklist fields
      if (options.storyPoints)
        fields["Microsoft.VSTS.Scheduling.StoryPoints"] = options.storyPoints;
      if (options.priority) fields["Microsoft.VSTS.Common.Priority"] = options.priority;
      if (options.workClass) fields["Custom.WorkClassType"] = options.workClass;
      if (options.requiresQa) fields["Custom.RequiresQA"] = options.requiresQa;

      // File-based content (for large HTML that can't be passed inline)
      // Uses readContentFile for BOM-safe, validated reads
      if (options.descriptionFile) {
        fields["System.Description"] = readContentFile(
          options.descriptionFile,
          "--description-file",
        );
      }
      if (options.acFile) {
        fields["Microsoft.VSTS.Common.AcceptanceCriteria"] = readContentFile(
          options.acFile,
          "--ac-file",
        );
      }
      if (options.reproStepsFile) {
        fields["Microsoft.VSTS.TCM.ReproSteps"] = readContentFile(
          options.reproStepsFile,
          "--repro-steps-file",
        );
      }
      if (options.systemInfoFile) {
        fields["Microsoft.VSTS.TCM.SystemInfo"] = readContentFile(
          options.systemInfoFile,
          "--system-info-file",
        );
      }
      if (options.rootCauseDetailFile) {
        fields["Custom.RootCauseDetail"] = readContentFile(
          options.rootCauseDetailFile,
          "--root-cause-detail-file",
        );
      }

      // Arbitrary field update (--field + --value or --value-file)
      if (options.field) {
        if (options.valueFile) {
          fields[options.field] = readContentFile(options.valueFile, "--value-file");
        } else if (options.value !== undefined) {
          fields[options.field] = options.value;
        } else {
          console.error("Error: --field requires either --value or --value-file");
          process.exit(1);
        }
      }

      // Bulk update from JSON file (grooming-result.json format)
      if (options.fieldsFile) {
        const fileContent = readContentFile(options.fieldsFile, "--fields-file");
        const parsed = JSON.parse(fileContent);

        // Support both { "fields": {...} } and direct fields object
        const fieldsFromFile = parsed.fields || parsed;

        // Merge fields from file (file-based fields take precedence over inline)
        for (const [key, value] of Object.entries(fieldsFromFile)) {
          if (value !== undefined && value !== null) {
            fields[key] = value;
          }
        }
      }

      // Context-driven update: read filled_slots from ticket-context.json,
      // auto-render via template engine, validate, then map to ADO fields.
      if (options.fromContext) {
        const ctxContent = readContentFile(options.fromContext, "--from-context");
        const ctx = JSON.parse(ctxContent);
        const phase = options.phase || "grooming";
        const phaseData = ctx?.[phase];

        if (!phaseData) {
          console.error(`Error: --from-context file missing "${phase}" section`);
          process.exit(1);
        }

        // Require filled_slots (new template-engine flow)
        const filledSlots = phaseData?.filled_slots;
        if (
          !filledSlots ||
          typeof filledSlots !== "object" ||
          Object.keys(filledSlots).length === 0
        ) {
          console.error(`Error: ${phase}.filled_slots not found in context file.`);
          console.error(
            "Run: template-tools scaffold-phase --phase " + phase + " ... then fill the slots.",
          );
          process.exit(1);
        }

        // Auto-render each template via the template engine
        const { renderTemplate, validateRendered, getTemplateEntry } =
          await import("../src/templateEngine.js");

        for (const [templateKey, slots] of Object.entries(filledSlots)) {
          const renderResult = renderTemplate(
            templateKey,
            slots as Record<string, import("../src/types/templateTypes.js").FillSlot>,
          );

          if (!renderResult.success) {
            console.error(
              `Warning: template "${templateKey}" has ${renderResult.slots_missing} missing required slot(s): ${renderResult.missing_slots.join(", ")}`,
            );
          }

          // Validate structural integrity
          const validation = validateRendered(templateKey, renderResult.html);
          if (!validation.valid) {
            const errors = validation.issues.filter(
              (i: { severity: string }) => i.severity === "error",
            );
            console.error(`Error: template "${templateKey}" failed validation:`);
            for (const err of errors) {
              console.error(`  [${err.code}] ${err.message}`);
            }
            process.exit(1);
          }

          // Map rendered HTML to ADO field
          const entry = getTemplateEntry(templateKey);
          if (entry.ado_field) {
            fields[entry.ado_field] = renderResult.html;
          }
        }

        // Also pick up non-template fields from the phase (tags, story points, etc.)
        const extraFields = phaseData?.extra_fields;
        if (extraFields && typeof extraFields === "object") {
          if (Array.isArray(extraFields.tags) && extraFields.tags.length > 0) {
            fields["System.Tags"] = extraFields.tags.join("; ");
          }
          if (extraFields.title) fields["System.Title"] = extraFields.title;
          if (extraFields.story_points != null)
            fields["Microsoft.VSTS.Scheduling.StoryPoints"] = extraFields.story_points;
          if (extraFields.work_class_type)
            fields["Custom.WorkClassType"] = extraFields.work_class_type;
          if (extraFields.requires_qa) fields["Custom.RequiresQA"] = extraFields.requires_qa;
        }

        // Write rendered applied_content back to context for audit trail
        if (!phaseData.templates_applied) phaseData.templates_applied = {};
        const appliedContent: Record<string, string> = {};
        for (const [adoField, value] of Object.entries(fields)) {
          if (typeof value === "string" && value.includes("linear-gradient")) {
            const contextKey = adoFieldToContextKey(adoField);
            appliedContent[contextKey] = value;
          }
        }
        phaseData.templates_applied.applied_content = appliedContent;
        ctx[phase] = phaseData;
        const { writeFileSync: writeCtx } = await import("fs");
        writeCtx(options.fromContext, JSON.stringify(ctx, null, 2), "utf-8");
      }

      // Standalone filled-spec update: render + validate + map ado_field + push
      // Each file must be a FillSpec (with "template" and "slots" keys) from scaffold output.
      if (options.fromFilled) {
        const filePaths = (options.fromFilled as string).split(",").map((f: string) => f.trim());
        const {
          renderTemplate: renderTpl,
          validateRendered: validateHtml,
          getTemplateEntry: getEntry,
        } = await import("../src/templateEngine.js");

        for (const filePath of filePaths) {
          const raw = JSON.parse(readContentFile(filePath, "--from-filled"));

          // Require FillSpec format with template key
          const templateKey = raw.template;
          if (!templateKey) {
            console.error(
              `Error: file "${filePath}" missing "template" key. Use scaffold output format.`,
            );
            process.exit(1);
          }

          // Extract slots (support both .slots wrapper and direct slots object)
          const slots = raw.slots ?? raw;

          // Render
          const renderResult = renderTpl(
            templateKey,
            slots as Record<string, import("../src/types/templateTypes.js").FillSlot>,
          );
          if (!renderResult.success) {
            console.error(
              `Warning: template "${templateKey}" has ${renderResult.slots_missing} missing slot(s): ${renderResult.missing_slots.join(", ")}`,
            );
            if (renderResult.warnings.length > 0) {
              for (const w of renderResult.warnings) console.error(`  ⚠ ${w}`);
            }
          }

          // Validate
          const validation = validateHtml(templateKey, renderResult.html);
          if (!validation.valid) {
            const errors = validation.issues.filter(
              (i: { severity: string }) => i.severity === "error",
            );
            console.error(`Error: template "${templateKey}" failed validation:`);
            for (const err of errors) {
              console.error(`  [${err.code}] ${err.message}`);
            }
            process.exit(1);
          }

          // Map to ADO field from registry
          const entry = getEntry(templateKey);
          if (entry.ado_field) {
            fields[entry.ado_field] = renderResult.html;
          } else {
            console.error(
              `Warning: template "${templateKey}" has no ado_field mapping — skipping.`,
            );
          }
        }
      }

      // Resolve comment from file if --comment-file is provided
      const commentText = options.commentFile
        ? readContentFile(options.commentFile, "--comment-file")
        : (options.comment as string | undefined);

      // Dry-run: show what would be pushed without calling ADO API
      if (options.dryRun) {
        const dryResult: Record<string, unknown> = {
          dry_run: true,
          work_item_id: parseInt(id, 10),
          fields_count: Object.keys(fields).length,
          fields_to_update: Object.fromEntries(
            Object.entries(fields).map(([k, v]) => [
              k,
              typeof v === "string" && (v as string).length > 200
                ? `(${(v as string).length} chars HTML)`
                : v,
            ]),
          ),
          comment: commentText ?? null,
        };
        if (options.json) {
          console.log(JSON.stringify(dryResult, null, 2));
        } else {
          console.log(`[DRY RUN] Would update work item ${id}`);
          console.log(`  Fields: ${Object.keys(fields).length}`);
          for (const [k, v] of Object.entries(
            dryResult["fields_to_update"] as Record<string, unknown>,
          )) {
            console.log(`    ${k}: ${v}`);
          }
        }
        return;
      }

      const workItem = await updateWorkItem(parseInt(id, 10), {
        fields: Object.keys(fields).length > 0 ? fields : undefined,
        comment: commentText,
      });

      if (options.json) {
        console.log(JSON.stringify(workItem, null, 2));
      } else {
        console.log(`Updated work item ${workItem.id}`);
        console.log(`  Fields updated: ${Object.keys(fields).length}`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Create command
program
  .command("create <type>")
  .description("Create a new work item")
  .requiredOption("-t, --title <title>", "Work item title")
  .option("-d, --description <description>", "Description")
  .option("-p, --parent <id>", "Parent work item ID", parseInt)
  .option("-a, --area <path>", "Area path")
  .option("-i, --iteration <path>", "Iteration path")
  .option("--assigned-to <user>", "Assign to user")
  .option("--tags <tags>", "Tags (comma or semicolon-separated)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (type: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItem = await createWorkItem({
        type: type as WorkItemType,
        title: options.title,
        description: options.description,
        parentId: options.parent,
        areaPath: options.area,
        iterationPath: options.iteration,
        assignedTo: options.assignedTo,
        tags: parseTagList(options.tags),
      });

      if (options.json) {
        console.log(JSON.stringify(workItem, null, 2));
      } else {
        console.log(`Created work item ${workItem.id}: ${workItem.fields["System.Title"]}`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Search command
program
  .command("search")
  .description("Search for work items")
  .option("-t, --text <text>", "Search text")
  .option("--type <type>", "Work item type")
  .option("-s, --state <state>", "State filter")
  .option("-a, --assigned-to <user>", "Assigned to filter")
  .option("--area <path>", "Area path filter")
  .option("--iteration <path>", "Iteration path filter")
  .option("--tags <tags>", "Tags filter (comma or semicolon-separated)")
  .option("--wiql <query>", "Raw WIQL query")
  .option("--top <n>", "Maximum results", parseInt)
  .option("--all", "Return all matching results (disables --top limit)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (options.all && options.top) {
        console.error("Error: --all cannot be combined with --top");
        process.exit(1);
      }

      const results = await searchWorkItems({
        searchText: options.text,
        workItemType: options.type as WorkItemType,
        state: options.state,
        assignedTo: options.assignedTo,
        areaPath: options.area,
        iterationPath: options.iteration,
        tags: parseTagList(options.tags),
        wiql: options.wiql,
        top: options.all ? undefined : options.top,
      });

      if (options.json) {
        console.log(JSON.stringify(results, null, 2));
      } else {
        console.log(`Found ${results.count} work items:`);
        for (const wi of results.workItems) {
          console.log(`  ${wi.id}: ${wi.fields["System.Title"]} [${wi.fields["System.State"]}]`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("backlog")
  .description("List backlog order for an area path")
  .requiredOption("--area-path <path>", "Area path to inspect")
  .option("--type <type>", "Work item type", "User Story")
  .option("--states <states>", "Comma-separated states to include")
  .option("--top <n>", "Maximum backlog items to return", parseInteger, 50)
  .option("--detail <mode>", "Detail level: light, summary, full", parseBacklogDetailLevel, "light")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const backlog = await getBacklog({
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
        states: parseStates(options.states),
        top: options.top,
        detailLevel: options.detail,
      });

      const rows = backlog.items.map((item, index) =>
        formatBacklogRow(item, index + 1, options.detail),
      );

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              field: backlog.field,
              count: backlog.count,
              detailLevel: options.detail,
              items: rows,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(`Backlog (${backlog.field}) for ${options.areaPath}`);
        console.log(`Items: ${backlog.count} | Detail: ${options.detail}`);
        for (const [index, item] of backlog.items.entries()) {
          for (const line of formatBacklogTextBlock(item, index + 1, options.detail)) {
            console.log(line);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("reorder <id>")
  .description("Move a single work item to a new backlog position")
  .requiredOption("--position <n>", "1-based backlog position", parseInteger)
  .requiredOption("--area-path <path>", "Area path to reorder within")
  .option("--type <type>", "Work item type", "User Story")
  .option("--detail <mode>", "Detail level: light, summary, full", parseBacklogDetailLevel, "light")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (id: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const before = await getBacklog({
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
        detailLevel: "light",
      });

      const result = await reorderSingle({
        workItemId: parseInt(id, 10),
        position: options.position,
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
      });

      const after = await getBacklog({
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
        detailLevel: options.detail,
      });
      const movedIndex = after.items.findIndex((item) => item.id === result.workItemId);

      const payload = {
        ...result,
        detailLevel: options.detail,
        workItem: formatBacklogNeighbor(after.items[movedIndex], options.detail),
        neighbors: {
          above: formatBacklogNeighbor(after.items[movedIndex - 1], options.detail),
          below: formatBacklogNeighbor(after.items[movedIndex + 1], options.detail),
        },
        previousPosition: before.items.findIndex((item) => item.id === result.workItemId) + 1,
      };

      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        const movedItem = after.items[movedIndex];
        console.log(
          `Moved #${id} from position ${payload.previousPosition} to ${payload.position}`,
        );
        if (movedItem) {
          console.log(`#${movedItem.id} [${movedItem.workItemType}] ${movedItem.title}`);
          console.log(
            `Rank: ${payload.previousRank ?? "missing"} -> ${payload.newRank} | State: ${movedItem.state || "n/a"} | Board: ${movedItem.boardColumn || "n/a"} | Assigned: ${formatAssignedTo(movedItem.assignedTo)} | Parent: ${formatParent(movedItem.parent)}`,
          );
          if (options.detail !== "light") {
            const summary = summarizeContent(movedItem.description);
            if (summary) {
              console.log(`Description: ${summary}`);
            }
          }
        }
        printNeighbor("Above", after.items[movedIndex - 1]);
        printNeighbor("Below", after.items[movedIndex + 1]);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("reorder-bulk")
  .description("Rewrite the backlog order for multiple work items")
  .option("--ids <ids>", "Comma-separated IDs in desired order")
  .option("--ids-file <file>", "File containing IDs in desired order")
  .requiredOption("--area-path <path>", "Area path to reorder within")
  .option("--type <type>", "Work item type", "User Story")
  .option("--spacing <n>", "Rank spacing between items", parseFloat, 1000)
  .option("--start-rank <n>", "Starting rank value", parseFloat, 1000)
  .option("--dry-run", "Calculate new rank assignments without updating ADO")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (!options.ids && !options.idsFile) {
        console.error("Error: provide either --ids or --ids-file");
        process.exit(1);
      }

      const orderedIds = options.idsFile
        ? parseIdsFile(options.idsFile)
        : parseNumberList(options.ids);
      if (!orderedIds || orderedIds.length === 0) {
        console.error("Error: no work item IDs were provided");
        process.exit(1);
      }

      const results = await reorderBulk({
        orderedIds,
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
        spacing: options.spacing,
        startRank: options.startRank,
        dryRun: options.dryRun,
      });

      if (options.json) {
        console.log(JSON.stringify({ dryRun: Boolean(options.dryRun), results }, null, 2));
      } else {
        console.log(
          `${options.dryRun ? "Planned" : "Applied"} ${results.length} backlog rank updates`,
        );
        for (const result of results.slice(0, 20)) {
          console.log(
            `- #${result.workItemId}: ${result.previousRank ?? "missing"} -> ${result.newRank} (position ${result.position})`,
          );
        }
        if (results.length > 20) {
          console.log(`... ${results.length - 20} more update(s)`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command("backlog-validate")
  .description("Validate backlog rank health for an area path")
  .requiredOption("--area-path <path>", "Area path to inspect")
  .option("--type <type>", "Work item type", "User Story")
  .option("--states <states>", "Comma-separated states to include")
  .option("--top <n>", "Maximum backlog items to inspect", parseInteger, 50)
  .option("--detail <mode>", "Detail level: light, summary, full", parseBacklogDetailLevel, "light")
  .option("--fix", "Auto-resequence the current backlog with evenly spaced ranks")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const queryOptions = {
        areaPath: options.areaPath,
        workItemType: options.type as WorkItemType,
        states: parseStates(options.states),
        top: options.top,
        detailLevel: options.detail,
      };

      const validation = await validateBacklog(queryOptions);
      let fixApplied = false;
      let fixResults;

      if (options.fix && !validation.valid) {
        fixResults = await reorderBulk({
          orderedIds: validation.items.map((item) => item.id),
          areaPath: options.areaPath,
          workItemType: options.type as WorkItemType,
        });
        fixApplied = true;
      }

      const payload = {
        valid: validation.valid,
        issueCount: validation.issues.length,
        issues: validation.issues,
        detailLevel: options.detail,
        items: validation.items.map((item, index) =>
          formatBacklogRow(item, index + 1, options.detail),
        ),
        fixApplied,
        fixResults,
      };

      if (options.json) {
        console.log(JSON.stringify(payload, null, 2));
      } else {
        printValidationSummary(validation, options.areaPath, options.top, fixApplied, fixResults);
        if (validation.items.length > 0) {
          console.log("Backlog snapshot:");
          for (const [index, item] of validation.items.slice(0, 10).entries()) {
            for (const line of formatBacklogTextBlock(item, index + 1, options.detail)) {
              console.log(line);
            }
          }
          if (validation.items.length > 10) {
            console.log(`... ${validation.items.length - 10} more item(s)`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Link command
program
  .command("link <sourceId> <targetId>")
  .description("Link two work items")
  .requiredOption("--type <type>", "Link type (parent, child, related, predecessor, successor)")
  .option("--comment <comment>", "Link comment")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (sourceId: string, targetId: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItem = await linkWorkItems({
        sourceId: parseInt(sourceId, 10),
        targetId: parseInt(targetId, 10),
        linkType: options.type as LinkTypeAlias,
        comment: options.comment,
      });

      if (options.json) {
        console.log(JSON.stringify(workItem, null, 2));
      } else {
        console.log(`Linked ${sourceId} -> ${targetId} (${options.type})`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Unlink command
program
  .command("unlink <sourceId> <targetId>")
  .description("Remove a link between two work items")
  .requiredOption(
    "--type <type>",
    "Link type to remove (parent, child, related, predecessor, successor)",
  )
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (sourceId: string, targetId: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const workItem = await unlinkWorkItems(
        parseInt(sourceId, 10),
        parseInt(targetId, 10),
        options.type as LinkTypeAlias,
      );

      if (options.json) {
        console.log(JSON.stringify(workItem, null, 2));
      } else {
        console.log(`Unlinked ${sourceId} -> ${targetId} (${options.type})`);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Relations command
program
  .command("relations <id>")
  .description("Get work item relations")
  .option("--type <types>", "Filter by link types (comma-separated)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (id: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const result = await getWorkItemRelations({
        workItemId: parseInt(id, 10),
        linkTypes: options.type?.split(",") as LinkTypeAlias[],
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Work Item ${id} Relations:`);
        for (const rel of result.relations) {
          console.log(`  ${rel.linkType}: ${rel.targetId}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Iteration command
program
  .command("iteration")
  .description("Get iteration dates and validity for an iteration path")
  .option("-p, --path <path>", 'Iteration path (full or relative, e.g. "Release 26.03\\Sprint 42")')
  .option("-d, --depth <n>", "Depth of child iterations to include", parseInt)
  .option("-l, --list", "List child iterations under the path")
  .option("--current", "Filter to only current iterations (when listing)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (options.list) {
        let iterations = await listIterations({
          path: options.path,
          depth: options.depth,
        });

        if (options.current) {
          iterations = iterations.filter((i) => i.isCurrent);
        }

        if (options.json) {
          console.log(JSON.stringify(iterations, null, 2));
        } else {
          if (iterations.length === 0) {
            console.log("No iterations found.");
          } else {
            for (const iter of iterations) {
              const dates =
                iter.startDate && iter.finishDate
                  ? `${iter.startDate.slice(0, 10)} → ${iter.finishDate.slice(0, 10)}`
                  : "no dates";
              const badge =
                iter.timeFrame === "current"
                  ? " [CURRENT]"
                  : iter.timeFrame === "past"
                    ? " [PAST]"
                    : iter.timeFrame === "future"
                      ? " [FUTURE]"
                      : "";
              console.log(`  ${iter.path}  (${dates})${badge}`);
            }
          }
        }
      } else {
        const iteration = await getIteration({
          path: options.path,
          depth: options.depth,
        });

        if (options.json) {
          console.log(JSON.stringify(iteration, null, 2));
        } else {
          console.log(`Iteration: ${iteration.path}`);
          console.log(`Name:      ${iteration.name}`);
          console.log(`Start:     ${iteration.startDate ?? "not set"}`);
          console.log(`Finish:    ${iteration.finishDate ?? "not set"}`);
          console.log(`Status:    ${iteration.timeFrame}`);
          if (iteration.hasChildren) {
            console.log("Has child iterations (use --list --depth 1 to see them)");
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
