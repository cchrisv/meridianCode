import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { DEFAULT_SERVER_SETTINGS } from "@t3tools/contracts";
import { afterEach, describe, expect, it } from "vitest";

import { buildCopilotSessionKnowledgeConfig } from "./copilotSessionKnowledge.ts";

describe("buildCopilotSessionKnowledgeConfig", () => {
  const dirs: string[] = [];

  afterEach(() => {
    for (const d of dirs.splice(0)) {
      fs.rmSync(d, { recursive: true, force: true });
    }
  });

  it("derives skillDirectories from globalKnowledgeRoot when unset", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-csk-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github", "skills", "a"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "skills", "a", "SKILL.md"), "s", "utf8");
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "SYSINLINE", "utf8");
    fs.mkdirSync(path.join(root, "core", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(root, "core", "knowledge", "k.md"), "k", "utf8");

    const settings = { ...DEFAULT_SERVER_SETTINGS, globalKnowledgeRoot: root };
    const cfg = await buildCopilotSessionKnowledgeConfig(settings, undefined);
    expect(cfg.skillDirectories?.length).toBe(1);
    expect(cfg.skillDirectories?.[0]).toContain(path.join(".github", "skills"));
    expect(cfg.systemMessage?.mode).toBe("append");
    expect(cfg.systemMessage?.content).toContain("SYSINLINE");
  });

  it("passes through disabledSkills", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "t3-csk2-"));
    dirs.push(root);
    fs.mkdirSync(path.join(root, ".github"), { recursive: true });
    fs.writeFileSync(path.join(root, ".github", "copilot-instructions.md"), "x", "utf8");
    fs.mkdirSync(path.join(root, "core", "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(root, "core", "knowledge", "k.md"), "k", "utf8");

    const settings = {
      ...DEFAULT_SERVER_SETTINGS,
      globalKnowledgeRoot: root,
      providers: {
        ...DEFAULT_SERVER_SETTINGS.providers,
        copilot: {
          ...DEFAULT_SERVER_SETTINGS.providers.copilot,
          disabledSkills: ["alpha", "beta"],
        },
      },
    };
    const cfg = await buildCopilotSessionKnowledgeConfig(settings, undefined);
    expect(cfg.disabledSkills).toEqual(["alpha", "beta"]);
  });
});
