#!/usr/bin/env node
/**
 * knowledge-tools — search Meridian knowledge roots (Section 4.2, 6.6)
 */

import { Command } from "commander";
import { readdirSync, readFileSync, existsSync } from "fs";
import { resolve, join, relative } from "path";
import { getProjectRoot, loadSharedConfig } from "../src/lib/configLoader.js";

function* walkMarkdownRoots(roots: string[]): Generator<string> {
  for (const r of roots) {
    if (!existsSync(r)) continue;
    const stack = [r];
    while (stack.length) {
      const dir = stack.pop()!;
      let entries: ReturnType<typeof readdirSync>;
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) stack.push(full);
        else if (e.isFile() && e.name.endsWith(".md")) yield full;
      }
    }
  }
}

function knowledgeRoots(): string[] {
  const root = getProjectRoot();
  try {
    const cfg = loadSharedConfig() as {
      paths?: { knowledge?: { core?: string; shared?: string } };
    };
    const k = cfg.paths?.knowledge;
    if (k?.core && k?.shared) {
      const paths = [resolve(root, k.core), resolve(root, k.shared)];
      const platforms = resolve(root, "platforms");
      if (existsSync(platforms)) {
        for (const name of readdirSync(platforms, { withFileTypes: true }).filter((d) =>
          d.isDirectory(),
        )) {
          const kk = resolve(platforms, name.name, "knowledge");
          if (existsSync(kk)) paths.push(kk);
        }
      }
      return paths;
    }
  } catch {
    /* */
  }
  return [resolve(root, "core/knowledge"), resolve(root, "shared/knowledge")];
}

const program = new Command();
program.name("knowledge-tools").description("Meridian knowledge graph search").version("1.0.0");

program
  .command("search")
  .description("Search markdown knowledge files for a term (simple substring match)")
  .argument("<term>", "Search term")
  .option("--json", "JSON output")
  .option("-l, --limit <n>", "max results", "20")
  .action((term: string, opts: { json?: boolean; limit?: string }) => {
    const limit = parseInt(opts.limit ?? "20", 10) || 20;
    const roots = knowledgeRoots();
    const lower = term.toLowerCase();
    const hits: { path: string; snippet: string }[] = [];
    const proj = getProjectRoot();
    for (const file of walkMarkdownRoots(roots)) {
      if (hits.length >= limit) break;
      let text: string;
      try {
        text = readFileSync(file, "utf-8");
      } catch {
        continue;
      }
      if (!text.toLowerCase().includes(lower)) continue;
      const idx = text.toLowerCase().indexOf(lower);
      const start = Math.max(0, idx - 60);
      const snippet = text.slice(start, start + 160).replace(/\s+/g, " ");
      hits.push({ path: relative(proj, file).replace(/\\/g, "/"), snippet });
    }
    const out = {
      success: true,
      term,
      roots: roots.map((r) => relative(proj, r).replace(/\\/g, "/")),
      hits,
    };
    console.log(opts.json ? JSON.stringify(out, null, 2) : JSON.stringify(out, null, 2));
  });

program
  .command("ingest")
  .description(
    "Stub: import external docs into knowledge format (use util-knowledge-ingest prompt)",
  )
  .option("--json", "JSON output")
  .action((opts: { json?: boolean }) => {
    const out = {
      success: false,
      message: "Use Copilot prompt util-knowledge-ingest for guided ingest.",
    };
    console.log(opts.json ? JSON.stringify(out, null, 2) : out.message);
  });

program.parse();
