#!/usr/bin/env node
/**
 * Team Tools CLI
 * Command-line interface for discovering team members via Microsoft Graph
 *
 * Usage:
 *   npx team-tools discover
 *   npx team-tools discover --department --csv --markdown --json
 */

import { Command } from "commander";
import { discoverTeamMembers } from "../src/graphTeamMembers.js";
import { configureLogger } from "../src/lib/loggerStructured.js";
import { loadSharedConfig } from "../src/lib/configLoader.js";

const program = new Command();

program
  .name("team-tools")
  .description("Team member discovery via Microsoft Graph (Azure AD / Entra ID)")
  .version("2.0.0");

program
  .command("discover")
  .description("Discover team members from org hierarchy (manager, peers, subordinates)")
  .option("-l, --leader <email>", "Team leader email — roots tree at this person (deterministic)")
  .option("-d, --department", "Include all members of your department")
  .option("-s, --salesforce", "Enrich with Salesforce user data (profile, role, username, etc.)")
  .option("--csv", "Export results as CSV")
  .option("--markdown", "Export results as Markdown with Mermaid org chart")
  .option("-o, --output <dir>", "Output directory for reports")
  .option("--json", "Output result as JSON (suppresses progress output)")
  .option("-v, --verbose", "Verbose output with debug information")
  .option("-q, --quiet", "Quiet mode - minimal output")
  .action(async (options) => {
    const startTime = Date.now();

    try {
      if (options.json || options.quiet) {
        configureLogger({ silent: true });
      } else if (options.verbose) {
        configureLogger({ minLevel: "debug" });
      } else {
        configureLogger({ minLevel: "info" });
      }

      const outputDir = options.output ?? loadSharedConfig().paths.reports;

      const result = await discoverTeamMembers({
        leaderEmail: options.leader,
        includeDepartment: !!options.department,
        enrichSalesforce: !!options.salesforce,
        exportCsv: !!options.csv,
        exportMarkdown: !!options.markdown,
        outputDir,
      });

      if (options.json) {
        const jsonFile = result.files.find((f) => f.endsWith(".json"));
        console.log(
          JSON.stringify(
            {
              success: result.success,
              message: result.message,
              currentUser: result.currentUser,
              leader: result.leader,
              department: result.department,
              total: result.summary.total,
              durationMs: Date.now() - startTime,
              files: result.files,
              jsonFile,
            },
            null,
            2,
          ),
        );
      } else if (!options.quiet) {
        // Human-readable summary
        console.log("");
        console.log("Team Members:");
        console.log("");

        const colWidths = { name: 4, title: 5, email: 5, relationship: 12 };
        for (const m of result.members) {
          if (m.name.length > colWidths.name) colWidths.name = m.name.length;
          if (m.title.length > colWidths.title) colWidths.title = m.title.length;
          if (m.email.length > colWidths.email) colWidths.email = m.email.length;
          if (m.relationship.length > colWidths.relationship)
            colWidths.relationship = m.relationship.length;
        }

        const pad = (s: string, w: number) => s.padEnd(w);
        const header = `  ${pad("Name", colWidths.name)}  ${pad("Title", colWidths.title)}  ${pad("Email", colWidths.email)}  ${pad("Relationship", colWidths.relationship)}`;
        console.log(header);
        console.log("  " + "-".repeat(header.length - 2));

        for (const m of result.members) {
          console.log(
            `  ${pad(m.name, colWidths.name)}  ${pad(m.title, colWidths.title)}  ${pad(m.email, colWidths.email)}  ${pad(m.relationship, colWidths.relationship)}`,
          );
        }

        console.log("");
        console.log("Summary:");
        console.log(`  Total Discovered: ${result.summary.total}`);
        if (result.leader) {
          console.log(`  Leader: ${result.leader}`);
          const teamCount = result.members.filter((m) => m.relationship === "Team Member").length;
          console.log(`  Team Members: ${teamCount}`);
        } else {
          console.log(`  Manager(s): ${result.summary.managers}`);
          console.log(`  Peers: ${result.summary.peers}`);
          console.log(`  Peer's Team: ${result.summary.peerTeam}`);
          console.log(`  Subordinates: ${result.summary.subordinates}`);
        }
        if (options.department) {
          console.log(`  Department: ${result.summary.department}`);
        }
        console.log(`  With Manager: ${result.summary.withManager}`);
        console.log(`  Without Manager: ${result.summary.withoutManager}`);

        if (result.files.length > 0) {
          console.log("");
          console.log("Files:");
          for (const f of result.files) console.log(`  ${f}`);
        }
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
              currentUser: "",
              department: "",
              members: [],
              summary: {
                total: 0,
                managers: 0,
                peers: 0,
                peerTeam: 0,
                subordinates: 0,
                department: 0,
                withManager: 0,
                withoutManager: 0,
              },
              files: [],
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
        console.error(
          "  2. Verify Graph API access (User.Read.All may be required for full hierarchy)",
        );
        console.error("  3. Run with --verbose for more details");
      }
      process.exit(1);
    }
  });

program.addHelpText(
  "after",
  `
Examples:
  $ team-tools discover
  $ team-tools discover --leader denise.dyer@umgc.edu --json
  $ team-tools discover --leader denise.dyer@umgc.edu --csv --markdown
  $ team-tools discover --department --csv --markdown
  $ team-tools discover --json > team.json

Modes:
  Without --leader: discovers YOUR manager, peers, and subordinates (you-centric).
  With --leader:    discovers everyone under the specified leader (team-centric).
                    Anyone on the team gets the same deterministic result.
`,
);

program.parse();
