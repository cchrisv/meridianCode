#!/usr/bin/env node
/**
 * integration-tools — integration registry (Section 4.2, 7)
 */

import { Command } from "commander";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, join, relative } from "path";
import { getProjectRoot } from "../src/lib/configLoader.js";

function integrationsDir(): string {
  return resolve(getProjectRoot(), "shared/knowledge/integrations");
}

const program = new Command();
program.name("integration-tools").description("Meridian integration registry").version("1.0.0");

program
  .command("list")
  .description("List integration record files")
  .option("--json", "JSON output")
  .action((opts: { json?: boolean }) => {
    const dir = integrationsDir();
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
    const out = { success: true, count: files.length, files };
    console.log(opts.json ? JSON.stringify(out, null, 2) : files.join("\n"));
  });

program
  .command("get")
  .description("Show one integration file by basename (without .md)")
  .argument("<id>", "file basename")
  .option("--json", "JSON output")
  .action((id: string, opts: { json?: boolean }) => {
    const file = join(integrationsDir(), id.endsWith(".md") ? id : `${id}.md`);
    if (!existsSync(file)) {
      const out = { success: false, message: `Not found: ${id}` };
      process.exitCode = 1;
      console.log(opts.json ? JSON.stringify(out, null, 2) : out.message);
      return;
    }
    const body = readFileSync(file, "utf-8");
    const out = { success: true, path: relative(getProjectRoot(), file).replace(/\\/g, "/"), body };
    console.log(opts.json ? JSON.stringify(out, null, 2) : body);
  });

program
  .command("trace")
  .description("Stub dependency trace (use impact-analysis skill for full trace)")
  .argument("[scope]", "change scope")
  .option("--json", "JSON output")
  .action((_scope: string | undefined, opts: { json?: boolean }) => {
    const out = {
      success: true,
      message: "Stub trace — populate shared/knowledge/integrations and use impact-analysis skill.",
      integrations: existsSync(integrationsDir())
        ? readdirSync(integrationsDir()).filter((f) => f.endsWith(".md"))
        : [],
    };
    console.log(opts.json ? JSON.stringify(out, null, 2) : JSON.stringify(out, null, 2));
  });

program.parse();
