import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadGlobalKnowledgeText } from "./globalKnowledgeLoader.ts";

describe("loadGlobalKnowledgeText", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("loads copilot-instructions and core/knowledge markdown with section headers", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-gkl-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "alpha-instr", "utf8");
    fs.mkdirSync(path.join(root, "core", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(root, "core", "knowledge", "b.md"), "beta-know", "utf8");

    const text = await loadGlobalKnowledgeText(root);
    expect(text).toContain("Meridian — copilot-instructions");
    expect(text).toContain("alpha-instr");
    expect(text).toContain("Meridian — core/knowledge/b.md");
    expect(text).toContain("beta-know");
  });

  it("returns empty string for missing root", async () => {
    expect(await loadGlobalKnowledgeText("")).toBe("");
    expect(await loadGlobalKnowledgeText("   ")).toBe("");
    expect(await loadGlobalKnowledgeText(path.join(os.tmpdir(), "t3-missing-meridian-xyz"))).toBe(
      "",
    );
  });
});
