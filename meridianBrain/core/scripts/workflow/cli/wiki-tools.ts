#!/usr/bin/env node
/**
 * Wiki Tools CLI
 * Command-line interface for Azure DevOps Wiki operations
 */

import { Command } from "commander";
import {
  getWikiPage,
  updateWikiPage,
  createWikiPage,
  deleteWikiPage,
  listWikiPages,
  searchWikiPages,
  uploadWikiAttachment,
} from "../src/adoWikiPages.js";
import { configureLogger } from "../src/lib/loggerStructured.js";

const program = new Command();

program.name("wiki-tools").description("Azure DevOps wiki operations").version("2.0.0");

// Get command
program
  .command("get")
  .description("Get a wiki page by path or page ID")
  .option("--page-id <id>", "Page ID (alternative to --path)")
  .option("-p, --path <path>", "Page path (alternative to --page-id)")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--no-content", "Exclude content")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (!options.pageId && !options.path) {
        console.error("Error: Either --page-id or --path must be specified");
        process.exit(1);
      }

      const page = await getWikiPage({
        pageId: options.pageId ? parseInt(options.pageId, 10) : undefined,
        path: options.path,
        wikiId: options.wiki,
        includeContent: options.content !== false,
      });

      console.log(JSON.stringify(page, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Update command
program
  .command("update")
  .description(
    "Update an existing wiki page by path or page ID. When --page-id is used, the PATCH endpoint is called which only updates existing pages (never creates new ones).",
  )
  .option("--page-id <id>", "Page ID - uses PATCH endpoint (update only, never creates)")
  .option("-p, --path <path>", "Page path - uses PUT endpoint (create-or-update)")
  .option("-c, --content <content>", "Content (string or file path)")
  .option("--comment <comment>", "Update comment")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (!options.pageId && !options.path) {
        console.error("Error: Either --page-id or --path must be specified");
        process.exit(1);
      }

      if (!options.content) {
        console.error("Error: --content must be specified");
        process.exit(1);
      }

      const result = await updateWikiPage({
        pageId: options.pageId ? parseInt(options.pageId, 10) : undefined,
        path: options.path,
        content: options.content,
        comment: options.comment,
        wikiId: options.wiki,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Create command
program
  .command("create")
  .description("Create a new wiki page")
  .requiredOption("-p, --path <path>", "Page path")
  .requiredOption("-c, --content <content>", "Content (string or file path)")
  .option("--comment <comment>", "Creation comment")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const result = await createWikiPage({
        path: options.path,
        content: options.content,
        comment: options.comment,
        wikiId: options.wiki,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Upload attachment command
program
  .command("upload-attachment")
  .description("Upload a binary attachment to the wiki-wide .attachments store")
  .requiredOption("-f, --file <filePath>", "Local file path to upload")
  .option("-n, --name <name>", "Attachment name in the wiki; defaults to the local file name")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const result = await uploadWikiAttachment({
        filePath: options.file,
        name: options.name,
        wikiId: options.wiki,
      });

      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Delete command
program
  .command("delete")
  .description("Delete a wiki page")
  .requiredOption("-p, --path <path>", "Page path")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--force", "Skip confirmation")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      if (!options.force) {
        console.error("Error: Use --force to confirm deletion");
        process.exit(1);
      }

      await deleteWikiPage(options.path, options.wiki);
      console.log(`Deleted wiki page: ${options.path}`);
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// List command
program
  .command("list")
  .description("List wiki pages")
  .option("-p, --path <path>", "Parent path", "/")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const pages = await listWikiPages(options.path, options.wiki);
      console.log(JSON.stringify(pages, null, 2));
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// Search command
program
  .command("search <text>")
  .description("Search wiki pages by keyword (searches content + titles, returns ALL results)")
  .option("--wiki <id>", "Wiki ID or name")
  .option("--json", "Output as JSON (default)")
  .option("-v, --verbose", "Verbose output")
  .action(async (text: string, options) => {
    try {
      if (options.json) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      }

      const response = await searchWikiPages(text, options.wiki);

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              searchText: text,
              totalCount: response.totalCount,
              returnedCount: response.results.length,
              results: response.results,
            },
            null,
            2,
          ),
        );
      } else {
        console.log(
          `Found ${response.totalCount} wiki pages matching "${text}" (${response.results.length} unique):`,
        );
        for (const result of response.results) {
          console.log(`  ${result.path}`);
          if (result.highlights?.length > 0) {
            console.log(`    ${result.highlights[0]?.substring(0, 200)}...`);
          }
        }
      }
    } catch (error) {
      console.error("Error:", error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
