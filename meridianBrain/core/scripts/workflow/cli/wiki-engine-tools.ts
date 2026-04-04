#!/usr/bin/env node
/**
 * Wiki Engine Tools CLI
 * Command-line interface for the block-based wiki page composition engine.
 * Exposes block menu, rendering, validation, and color scheme utilities.
 */

import { Command } from "commander";
import { readFileSync, writeFileSync } from "fs";
import {
  renderWikiPage,
  validateWikiSpec,
  getBlockMenu,
  getBlockMenuMarkdown,
  getColorScheme,
  getColorNames,
} from "../src/wikiEngine.js";
import type { WikiPageSpec } from "../src/types/wikiBlockTypes.js";

const program = new Command();

program
  .name("wiki-engine-tools")
  .description("Block-based wiki page composition engine")
  .version("1.0.0");

// ---------------------------------------------------------------------------
// block-menu — Output the block menu for AI prompt injection
// ---------------------------------------------------------------------------
program
  .command("block-menu")
  .description("Output the available block types menu (for AI prompt injection)")
  .option("--markdown", "Output as formatted markdown (default: JSON)")
  .option("--json", "Output as JSON")
  .action((options) => {
    try {
      if (options.markdown) {
        console.log(getBlockMenuMarkdown());
      } else {
        console.log(JSON.stringify(getBlockMenu(), null, 2));
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// render — Render a WikiPageSpec to wiki content
// ---------------------------------------------------------------------------
program
  .command("render")
  .description("Render a WikiPageSpec JSON file to wiki HTML content")
  .requiredOption("--spec <file>", "Path to WikiPageSpec JSON file")
  .option("--output <file>", "Write rendered wiki content to file instead of stdout")
  .option("--json", "Output render result as JSON (includes metadata)")
  .action((options) => {
    try {
      const specJson = readFileSync(options.spec, "utf-8");
      const spec = JSON.parse(specJson) as WikiPageSpec;
      // Always set timestamp to current date/time at render time
      spec.timestamp = new Date().toISOString();
      const result = renderWikiPage(spec);

      if (!result.success) {
        console.error("Render failed:");
        for (const warning of result.warnings) {
          console.error(`  - ${warning}`);
        }
        process.exit(1);
      }

      if (options.output) {
        writeFileSync(options.output, result.html, "utf-8");
      }

      if (options.json) {
        const meta: Record<string, unknown> = { ...result };
        if (options.output) {
          meta["html"] = `(written to ${options.output})`;
          meta["output_path"] = options.output;
        }
        console.log(JSON.stringify(meta, null, 2));
      } else {
        if (options.output) {
          console.log(`Rendered wiki page → ${options.output}`);
          console.log(`  Sections: ${result.sections_rendered}`);
          console.log(`  Blocks: ${result.blocks_rendered}`);
          console.log(`  HTML length: ${result.html_length} chars`);
          if (result.warnings.length > 0) {
            console.log(`  Warnings: ${result.warnings.length}`);
            for (const w of result.warnings) {
              console.log(`    - ${w}`);
            }
          }
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
// validate — Validate a WikiPageSpec JSON file
// ---------------------------------------------------------------------------
program
  .command("validate")
  .description("Validate a WikiPageSpec JSON file without rendering")
  .requiredOption("--spec <file>", "Path to WikiPageSpec JSON file")
  .option("--json", "Output as JSON")
  .action((options) => {
    try {
      const specJson = readFileSync(options.spec, "utf-8");
      const spec = JSON.parse(specJson) as WikiPageSpec;
      const result = validateWikiSpec(spec);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log(`Validation: ${result.valid ? "✓ PASS" : "✗ FAIL"}`);
        if (result.errors.length > 0) {
          console.log(`  Errors (${result.errors.length}):`);
          for (const err of result.errors) {
            console.log(`    - ${err}`);
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
// colors — List available color schemes
// ---------------------------------------------------------------------------
program
  .command("colors")
  .description("List available semantic color schemes with their derived values")
  .option("--json", "Output as JSON")
  .action((options) => {
    try {
      const names = getColorNames();
      const schemes = names.map((name) => ({
        name,
        ...getColorScheme(name),
      }));

      if (options.json) {
        console.log(JSON.stringify(schemes, null, 2));
      } else {
        console.log("Available color schemes:");
        for (const s of schemes) {
          console.log(`  ${s.name}`);
          console.log(
            `    primary: ${s.primary}  dark: ${s.dark}  light: ${s.light}  tint: ${s.tint}`,
          );
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
