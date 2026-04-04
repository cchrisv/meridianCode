#!/usr/bin/env node
/**
 * Template Tools CLI
 * Command-line interface for template scaffold generation, rendering, and validation.
 * Ensures AI never touches raw HTML — only structured JSON fill specs.
 */

import { Command } from "commander";
import { writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { readContentFile, adoFieldToContextKey } from "../src/lib/fileUtils.js";
import {
  getTemplateEntry,
  listTemplates,
  generateFillSpec,
  generatePhaseFillSpec,
  renderTemplate,
  renderPhaseTemplates,
  validateRendered,
  extractVariables,
  loadTemplateHtml,
} from "../src/templateEngine.js";
import { configureLogger } from "../src/lib/loggerStructured.js";
import type { FillSlot } from "../src/types/templateTypes.js";

const program = new Command();

program
  .name("template-tools")
  .description("Template scaffold generation, rendering, and validation")
  .version("1.0.0");

// ---------------------------------------------------------------------------
// list — List available templates
// ---------------------------------------------------------------------------
program
  .command("list")
  .description("List available templates, optionally filtered by phase and/or work item type")
  .option("--phase <phase>", "Filter by phase (grooming, solutioning, closeout, reporting, wiki)")
  .option("--type <type>", "Filter by work item type (User Story, Bug, Feature, etc.)")
  .option("--requirement-type <type>", "Filter by requirement type (functional or technical)")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      const templates = listTemplates({
        phase: options.phase,
        workItemType: options.type,
        requirementType: options.requirementType,
      });

      const keys = Object.keys(templates);

      if (options.json) {
        const summary = keys.map((key) => {
          const entry = templates[key]!;
          return {
            key,
            file: entry.file,
            phase: entry.phase,
            work_item_types: entry.work_item_types,
            requirement_types: entry.requirement_types ?? [],
            ado_field: entry.ado_field,
            description: entry.description,
            variable_count: Object.keys(entry.variables).length,
          };
        });
        console.log(JSON.stringify({ count: keys.length, templates: summary }, null, 2));
      } else {
        console.log(`Found ${keys.length} template(s):`);
        for (const key of keys) {
          const entry = templates[key]!;
          console.log(`  ${key}`);
          console.log(`    Phase: ${entry.phase} | Types: ${entry.work_item_types.join(", ")}`);
          if (entry.requirement_types && entry.requirement_types.length > 0) {
            console.log(`    Requirement Types: ${entry.requirement_types.join(", ")}`);
          }
          console.log(`    ADO Field: ${entry.ado_field ?? "(none — wiki/markdown)"}`);
          console.log(`    Variables: ${Object.keys(entry.variables).length}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// scaffold — Generate a fill spec for a single template
// ---------------------------------------------------------------------------
program
  .command("scaffold")
  .description("Generate a fill spec (JSON) for a single template — the shape the AI must fill")
  .requiredOption("--template <key>", "Template registry key (e.g. field-user-story-description)")
  .option("--context <file>", "Pre-fill from ticket-context.json")
  .option("--output <file>", "Write fill spec to file instead of stdout")
  .option("--json", "Output as JSON (default for scaffold)")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      let prefill: Record<string, unknown> | undefined;
      if (options.context && existsSync(options.context)) {
        const ctx = JSON.parse(readContentFile(options.context, "--context"));
        // Try to extract prefill from context based on template phase
        const entry = getTemplateEntry(options.template);
        prefill = ctx?.[entry.phase]?.prefill?.[options.template];
      }

      const fillSpec = generateFillSpec(options.template, prefill);

      const output = JSON.stringify(fillSpec, null, 2);
      if (options.output) {
        writeFileSync(options.output, output, "utf-8");
        console.log(`Fill spec written to ${options.output}`);
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// scaffold-phase — Generate fill specs for all templates in a phase
// ---------------------------------------------------------------------------
program
  .command("scaffold-phase")
  .description("Generate fill specs for ALL templates needed by a phase + work item type")
  .requiredOption("--phase <phase>", "Phase (grooming, solutioning, closeout, reporting, wiki)")
  .requiredOption("--type <type>", "Work item type (User Story, Bug, Feature, etc.)")
  .option("--requirement-type <type>", "Requirement type (functional or technical)")
  .requiredOption("-w, --work-item <id>", "Work item ID")
  .option("--context <file>", "Pre-fill from ticket-context.json")
  .option("--output <file>", "Write combined fill spec to file")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      let prefill: Record<string, Record<string, unknown>> | undefined;
      if (options.context && existsSync(options.context)) {
        const ctx = JSON.parse(readContentFile(options.context, "--context"));
        prefill = ctx?.[options.phase]?.prefill;
      }

      const phaseFillSpec = generatePhaseFillSpec(
        options.phase,
        options.type,
        String(options.workItem),
        prefill,
        options.requirementType,
      );

      const templateCount = Object.keys(phaseFillSpec.templates).length;
      const output = JSON.stringify(phaseFillSpec, null, 2);

      if (options.output) {
        writeFileSync(options.output, output, "utf-8");
        if (!options.json) {
          console.log(`Phase fill spec written to ${options.output}`);
          console.log(`  Templates: ${templateCount}`);
          if (phaseFillSpec.requirement_type) {
            console.log(`  Requirement Type: ${phaseFillSpec.requirement_type}`);
          }
          for (const key of Object.keys(phaseFillSpec.templates)) {
            const spec = phaseFillSpec.templates[key]!;
            console.log(
              `    ${key} → ${spec.ado_field ?? "(wiki)"} (${Object.keys(spec.slots).length} slots)`,
            );
          }
        } else {
          console.log(
            JSON.stringify({
              success: true,
              output: options.output,
              template_count: templateCount,
            }),
          );
        }
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// render — Render a template from filled slot data
// ---------------------------------------------------------------------------
program
  .command("render")
  .description("Render a template from filled slot data, producing final HTML")
  .requiredOption("--template <key>", "Template registry key")
  .requiredOption("--data <file>", "Path to filled slots JSON (FillSpec or context file)")
  .option("--output <file>", "Write rendered HTML to file")
  .option(
    "--context-path <path>",
    "JSON path in context file to read slots from (e.g. grooming.filled_slots.field-user-story-description)",
  )
  .option("--json", "Output metadata as JSON")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      const rawData = JSON.parse(readContentFile(options.data, "--data"));

      // Extract slots from data — supports FillSpec format or direct slots object
      let slots: Record<string, FillSlot>;

      if (options.contextPath) {
        // Navigate the context JSON to the specified path
        const pathParts = (options.contextPath as string).split(".");
        let current: unknown = rawData;
        for (const part of pathParts) {
          if (
            current &&
            typeof current === "object" &&
            part in (current as Record<string, unknown>)
          ) {
            current = (current as Record<string, unknown>)[part];
          } else {
            console.error(`Error: path "${options.contextPath}" not found in data file`);
            process.exit(1);
          }
        }
        slots = current as Record<string, FillSlot>;
      } else if (rawData.slots) {
        // FillSpec format
        slots = rawData.slots;
      } else {
        // Direct slots object
        slots = rawData;
      }

      const result = renderTemplate(options.template, slots);

      if (options.output) {
        writeFileSync(options.output, result.html, "utf-8");
      }

      if (options.json) {
        const meta: Record<string, unknown> = { ...result };
        if (options.output) {
          // Don't include full HTML in JSON output if written to file
          meta["html"] = `(written to ${options.output})`;
          meta["output_path"] = options.output;
        }
        console.log(JSON.stringify(meta, null, 2));
      } else {
        if (options.output) {
          console.log(`Rendered ${options.template} → ${options.output}`);
          console.log(`  Slots filled: ${result.slots_filled}`);
          console.log(`  Slots missing: ${result.slots_missing}`);
          if (result.missing_slots.length > 0) {
            console.log(`  Missing: ${result.missing_slots.join(", ")}`);
          }
          console.log(`  HTML length: ${result.html_length} chars`);
        } else {
          // Output the rendered HTML to stdout
          console.log(result.html);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// render-phase — Render all templates for a phase from context file
// ---------------------------------------------------------------------------
program
  .command("render-phase")
  .description("Render all templates for a phase from filled slots in context file")
  .requiredOption("--phase <phase>", "Phase name")
  .requiredOption("-w, --work-item <id>", "Work item ID")
  .requiredOption("--context <file>", "Path to ticket-context.json with filled_slots")
  .option("--output-dir <dir>", "Write rendered HTML files to directory")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      const ctx = JSON.parse(readContentFile(options.context, "--context"));
      const phaseData = ctx?.[options.phase];

      if (!phaseData?.filled_slots) {
        console.error(`Error: ${options.phase}.filled_slots not found in context file`);
        console.error("Run scaffold-phase first, then fill the slots, then render.");
        process.exit(1);
      }

      const filledSlots = phaseData.filled_slots as Record<string, Record<string, FillSlot>>;
      const result = renderPhaseTemplates(options.phase, String(options.workItem), filledSlots);

      // Optionally write rendered HTML files
      if (options.outputDir) {
        for (const [templateKey, renderResult] of Object.entries(result.templates)) {
          const outputPath = resolve(options.outputDir, `${templateKey}.html`);
          writeFileSync(outputPath, renderResult.html, "utf-8");
        }
      }

      // Also write rendered content back to context as applied_content
      if (result.success) {
        const appliedContent: Record<string, string> = {};
        for (const [templateKey, renderResult] of Object.entries(result.templates)) {
          const entry = getTemplateEntry(templateKey);
          if (entry.ado_field) {
            // Map template key to a friendly field name for --from-context
            const fieldName = adoFieldToContextKey(entry.ado_field);
            appliedContent[fieldName] = renderResult.html;
          }
        }
        // Write applied_content back to context
        if (!phaseData.templates_applied) phaseData.templates_applied = {};
        phaseData.templates_applied.applied_content = appliedContent;
        ctx[options.phase] = phaseData;
        writeFileSync(options.context, JSON.stringify(ctx, null, 2), "utf-8");
      }

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(
          `Rendered ${Object.keys(result.templates).length} template(s) for ${options.phase}`,
        );
        for (const [key, r] of Object.entries(result.templates)) {
          const status = r.success ? "✓" : "✗";
          console.log(
            `  ${status} ${key}: ${r.slots_filled} filled, ${r.slots_missing} missing, ${r.html_length} chars`,
          );
        }
        if (!result.all_valid) {
          console.log(`\n⚠ Some templates have missing required slots. Review and fill them.`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// validate — Validate rendered HTML against template structure
// ---------------------------------------------------------------------------
program
  .command("validate")
  .description("Validate rendered HTML against its template registry entry")
  .requiredOption("--template <key>", "Template registry key")
  .requiredOption("--rendered <file>", "Path to rendered HTML file")
  .option("--json", "Output as JSON")
  .option("-v, --verbose", "Verbose output")
  .action((options) => {
    try {
      if (options.verbose) configureLogger({ minLevel: "debug" });

      const renderedHtml = readContentFile(options.rendered, "--rendered");
      const result = validateRendered(options.template, renderedHtml);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Validation: ${result.valid ? "✓ PASS" : "✗ FAIL"}`);
        console.log(`  Template: ${result.template}`);
        console.log(`  Checks:`);
        for (const [check, passed] of Object.entries(result.checks)) {
          console.log(`    ${passed ? "✓" : "✗"} ${check}`);
        }
        if (result.issues.length > 0) {
          console.log(`  Issues (${result.issues.length}):`);
          for (const issue of result.issues) {
            console.log(`    [${issue.severity}] ${issue.code}: ${issue.message}`);
          }
        }
      }

      if (!result.valid) process.exit(1);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// extract-vars — Extract {{variable}} tokens from a template HTML file
// ---------------------------------------------------------------------------
program
  .command("extract-vars")
  .description(
    "Extract all {{variable}} tokens from a template (useful for bootstrapping registry)",
  )
  .requiredOption("--template <key>", "Template registry key")
  .option("--json", "Output as JSON")
  .action((options) => {
    try {
      const entry = getTemplateEntry(options.template);
      const html = loadTemplateHtml(entry);
      const vars = extractVariables(html);

      if (options.json) {
        console.log(
          JSON.stringify(
            { template: options.template, variables: vars, count: vars.length },
            null,
            2,
          ),
        );
      } else {
        console.log(`Variables in ${options.template} (${vars.length}):`);
        for (const v of vars) {
          console.log(`  {{${v}}}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// info — Show detailed info about a template
// ---------------------------------------------------------------------------
program
  .command("info")
  .description("Show detailed information about a specific template")
  .requiredOption("--template <key>", "Template registry key")
  .option("--json", "Output as JSON")
  .action((options) => {
    try {
      const entry = getTemplateEntry(options.template);

      if (options.json) {
        console.log(JSON.stringify({ key: options.template, ...entry }, null, 2));
      } else {
        console.log(`Template: ${options.template}`);
        console.log(`  File: ${entry.file}`);
        console.log(`  Phase: ${entry.phase}`);
        console.log(`  Work Item Types: ${entry.work_item_types.join(", ")}`);
        console.log(`  ADO Field: ${entry.ado_field ?? "(none)"}`);
        console.log(`  Description: ${entry.description}`);
        console.log(`  Variables:`);
        for (const [name, def] of Object.entries(entry.variables)) {
          const req = def.required ? "(required)" : "(optional)";
          console.log(`    ${name}: ${def.type} ${req} — ${def.description}`);
        }
        console.log(`  Sections:`);
        for (const section of entry.sections) {
          const req = section.required ? "(required)" : "(optional)";
          console.log(`    ${section.id}: ${section.name} ${req}`);
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
