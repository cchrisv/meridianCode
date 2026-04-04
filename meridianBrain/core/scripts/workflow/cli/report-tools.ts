#!/usr/bin/env node
/**
 * Report Tools CLI
 * Command-line interface for generating Azure DevOps activity reports
 *
 * Usage:
 *   npx report-tools activity --people "Name|email@domain.com" --days 30
 */

import { Command } from "commander";
import { generateActivityReport, parsePerson } from "../src/adoActivityReport.js";
import { configureLogger } from "../src/lib/loggerStructured.js";

const program = new Command();

program
  .name("report-tools")
  .description("Azure DevOps activity report generation tool")
  .version("2.0.0");

// Activity report command
program
  .command("activity")
  .description("Generate comprehensive activity report for specified users")
  .requiredOption("-p, --people <people...>", 'People to track in format "Name|email@domain.com"')
  .option(
    "-d, --days <days>",
    "Number of days to look back (default: 30, ignored when --start is used)",
  )
  .option("--start <date>", "Start date for the report period (ISO format: YYYY-MM-DD)")
  .option(
    "--end <date>",
    "End date for the report period (ISO format: YYYY-MM-DD, defaults to today)",
  )
  .option("-o, --output <dir>", "Output directory for reports", "core/.ai-artifacts/reports")
  .option("--no-wiki", "Exclude wiki activities")
  .option("--no-prs", "Exclude pull request activities")
  .option("--sf-org <alias>", "Salesforce org alias for login/metadata activity (omit to skip SF)")
  .option("--narrative", "Generate narrative HTML report alongside CSV (for PDF sharing)")
  .option("--team-json <path>", "Path to team-members JSON for peer comparison in narrative")
  .option("--json", "Output result as JSON (suppresses progress output)")
  .option("-q, --quiet", "Quiet mode - minimal output")
  .option("-v, --verbose", "Verbose output with debug information")
  .action(async (options) => {
    const startTime = Date.now();

    try {
      // Configure logging based on options
      if (options.json) {
        configureLogger({ useStderr: true });
      } else if (options.quiet) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ minLevel: "info" });
      }

      // Parse people
      const people = options.people.map((p: string) => parsePerson(p));

      // Validate input
      if (people.length === 0) {
        console.error("Error: At least one person must be specified");
        console.error('Usage: report-tools activity --people "Name|email@domain.com"');
        process.exit(1);
      }

      // Resolve date range: --start/--end take precedence over --days
      let days: number;
      let startDate: string | undefined;
      let endDate: string | undefined;

      if (options.start) {
        // Validate start date
        const parsedStart = new Date(options.start);
        if (isNaN(parsedStart.getTime())) {
          console.error(
            `Error: --start '${options.start}' is not a valid date. Use YYYY-MM-DD format.`,
          );
          process.exit(1);
        }
        startDate = parsedStart.toISOString().split("T")[0];

        // Validate end date (default to today)
        if (options.end) {
          const parsedEnd = new Date(options.end);
          if (isNaN(parsedEnd.getTime())) {
            console.error(
              `Error: --end '${options.end}' is not a valid date. Use YYYY-MM-DD format.`,
            );
            process.exit(1);
          }
          endDate = parsedEnd.toISOString().split("T")[0];
          if (parsedEnd < parsedStart) {
            console.error("Error: --end date must be on or after --start date.");
            process.exit(1);
          }
        } else {
          endDate = new Date().toISOString().split("T")[0];
        }

        // Compute days for backward-compat (distance from start to today)
        const msPerDay = 86400000;
        days = Math.ceil((Date.now() - parsedStart.getTime()) / msPerDay);
      } else {
        // Classic mode: --days
        const daysStr = options.days || "30";
        days = parseInt(daysStr, 10);
        if (isNaN(days) || days < 1 || days > 365) {
          console.error("Error: --days must be a number between 1 and 365");
          process.exit(1);
        }
      }

      // Generate report
      const result = await generateActivityReport({
        people,
        days,
        startDate,
        endDate,
        outputDir: options.output,
        includeWiki: options.wiki !== false,
        includePullRequests: options.prs !== false,
        sfOrg: options.sfOrg,
        narrative: options.narrative === true,
        teamJsonPath: options.teamJson,
      });

      if (options.json) {
        // JSON output for programmatic use
        console.log(
          JSON.stringify(
            {
              ...result,
              durationMs: Date.now() - startTime,
            },
            null,
            2,
          ),
        );
      } else if (!options.quiet) {
        // Human-readable output (summary already printed by generateActivityReport)
        console.log("");
      }

      process.exit(result.success ? 0 : 1);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;

      if (options.json) {
        console.log(
          JSON.stringify(
            {
              success: false,
              message: errorMessage,
              error: {
                name: error instanceof Error ? error.name : "Error",
                message: errorMessage,
                stack: errorStack,
              },
              files: [],
              activityCounts: {},
              totalActivities: 0,
              durationMs: Date.now() - startTime,
            },
            null,
            2,
          ),
        );
      } else {
        console.error("\n========================================");
        console.error("              ERROR                     ");
        console.error("========================================");
        console.error(`Message: ${errorMessage}`);
        if (options.verbose && errorStack) {
          console.error("\nStack trace:");
          console.error(errorStack);
        }
        console.error("========================================");
        console.error("\nTroubleshooting:");
        console.error("  1. Ensure you are logged in: az login");
        console.error("  2. Check Azure DevOps access: az account show");
        console.error("  3. Verify the person name matches ADO exactly");
        console.error("  4. Run with --verbose for more details");
      }
      process.exit(1);
    }
  });

// Add help examples
program.addHelpText(
  "after",
  `
Examples:
  $ report-tools activity --people "John Doe|john.doe@company.com" --days 30
  $ report-tools activity --people "John Doe|john@co.com" "Jane Doe|jane@co.com" --days 7
  $ report-tools activity --people "John Doe|john@co.com" --start 2025-01-01 --end 2025-01-31
  $ report-tools activity --people "John Doe|john@co.com" --json > report.json

Output:
  CSV file with columns: Date, WorkItemId, PRNumber, WorkItemType, State,
  AreaPath, Title, ActivityType, Details, Actor
`,
);

program.parse();
