import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";

import { validateKnowledgeRootWs } from "./knowledgeWsEffects.ts";

describe("validateKnowledgeRootWs", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("marks valid when instructions and core knowledge exist", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-vkr-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "ok", "utf8");
    fs.mkdirSync(path.join(root, "core", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(root, "core", "knowledge", "doc.md"), "x", "utf8");

    const res = await Effect.runPromise(validateKnowledgeRootWs({ path: root }));
    expect(res.valid).toBe(true);
    expect(res.resolvedPath).toContain("t3-vkr");
    expect(res.structure.hasInstructions).toBe(true);
    expect(res.structure.coreKnowledgeFileCount).toBeGreaterThan(0);
  });

  it("marks invalid when copilot-instructions is missing", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-vkr-bad-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, "core", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(root, "core", "knowledge", "doc.md"), "x", "utf8");

    const res = await Effect.runPromise(validateKnowledgeRootWs({ path: root }));
    expect(res.valid).toBe(false);
    expect(res.issues.some((i) => i.includes("copilot-instructions"))).toBe(true);
  });
});
