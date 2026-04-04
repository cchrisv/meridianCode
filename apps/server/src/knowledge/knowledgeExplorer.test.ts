import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { listKnowledgeTree, readKnowledgeFileUnderRoot } from "./knowledgeExplorer.ts";

describe("knowledgeExplorer", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("listKnowledgeTree nests directories and marks skill files", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-kexp-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github", "skills", "s1"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "skills", "s1", "SKILL.md"), "# Skill", "utf8");

    const tree = await listKnowledgeTree(root);
    expect(tree.root).toBeTruthy();
    expect(tree.entries.length).toBeGreaterThan(0);
    const flat = JSON.stringify(tree.entries);
    expect(flat).toContain("SKILL.md");
  });

  it("readKnowledgeFileUnderRoot rejects paths outside the root", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-kread-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "x", "utf8");

    const outside = path.join(os.tmpdir(), "t3-kread-secret.txt");
    fs.writeFileSync(outside, "secret", "utf8");
    try {
      const res = await readKnowledgeFileUnderRoot(root, outside);
      expect("error" in res).toBe(true);
      if ("error" in res) {
        expect(res.error).toContain("escapes");
      }
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});
