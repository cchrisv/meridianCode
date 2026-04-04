/**
 * Stub platform CLI (Section 4.3) — returns JSON until real suites ship.
 */

import { Command } from "commander";

export function attachStubPlatformCommands(
  program: Command,
  platformId: string,
  vendorLabel: string,
): void {
  program
    .command("auth-status")
    .description("Check platform authentication")
    .option("--json", "JSON output")
    .action((opts: { json?: boolean }) => {
      const out = {
        authenticated: false,
        org: "",
        user: "",
        message: `Stub ${vendorLabel} — configure ${platformId} tools (Meridian extension).`,
      };
      console.log(opts.json ? JSON.stringify(out, null, 2) : JSON.stringify(out, null, 2));
    });

  program
    .command("describe")
    .argument("[object]", "object name")
    .option("--json", "JSON output")
    .action(() => {
      console.log(JSON.stringify({ name: "", fields: [], relationships: [], stub: true }, null, 2));
    });

  program
    .command("query")
    .argument("[expression]", "query")
    .option("--json", "JSON output")
    .action(() => {
      console.log(JSON.stringify({ records: [], totalCount: 0, stub: true }, null, 2));
    });

  program
    .command("discover-dependencies")
    .argument("[scope]", "scope")
    .option("--json", "JSON output")
    .action(() => {
      console.log(JSON.stringify({ dependencies: [], scope: "", stub: true }, null, 2));
    });

  program
    .command("discover-integrations")
    .option("--json", "JSON output")
    .action(() => {
      console.log(JSON.stringify({ integrations: [], stub: true }, null, 2));
    });
}
