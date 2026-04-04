import type { Dirent } from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import type { KnowledgeStructureSummary } from "@t3tools/contracts";

async function pathExists(p: string): Promise<boolean> {
  try {
    await fsp.access(p);
    return true;
  } catch {
    return false;
  }
}

async function countFilesRecursive(
  dir: string,
  predicate: (name: string, relDir: string) => boolean,
  relativeDir = "",
): Promise<number> {
  let count = 0;
  let entries: Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const ent of entries) {
    if (ent.name === ".git" || ent.name === "node_modules") continue;
    const rel = path.posix.join(relativeDir.replace(/\\/g, "/"), ent.name);
    if (ent.isDirectory()) {
      count += await countFilesRecursive(path.join(dir, ent.name), predicate, rel);
    } else if (ent.isFile() && predicate(ent.name, relativeDir.replace(/\\/g, "/"))) {
      count += 1;
    }
  }
  return count;
}

async function listTopLevelDirs(root: string, name: string): Promise<string[]> {
  const base = path.join(root, name);
  try {
    const entries = await fsp.readdir(base, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Scan a resolved Meridian root for wizard / status summaries.
 */
export async function scanKnowledgeStructure(rootReal: string): Promise<{
  structure: KnowledgeStructureSummary;
  issues: string[];
}> {
  const issues: string[] = [];
  const instructionsPath = path.join(rootReal, ".github", "copilot-instructions.md");
  const hasInstructions = await pathExists(instructionsPath);
  if (!hasInstructions) {
    issues.push("Missing .github/copilot-instructions.md");
  }

  const skillsRoot = path.join(rootReal, ".github", "skills");
  const skillCount = await countFilesRecursive(
    skillsRoot,
    (name) => name.toLowerCase() === "skill.md",
    "",
  );

  const agentsDir = path.join(rootReal, ".github", "agents");
  let agentCount = 0;
  try {
    const agents = await fsp.readdir(agentsDir, { withFileTypes: true });
    agentCount = agents.filter(
      (e) => e.isFile() && e.name.toLowerCase().endsWith(".agent.md"),
    ).length;
  } catch {
    // optional
  }

  const promptsRoot = path.join(rootReal, ".github", "prompts");
  const promptFileCount = await countFilesRecursive(
    promptsRoot,
    (name) => name.toLowerCase().endsWith(".prompt.md"),
    "",
  );

  const coreKnowledgeDir = path.join(rootReal, "core", "knowledge");
  let coreKnowledgeFileCount = 0;
  try {
    const files = await fsp.readdir(coreKnowledgeDir, { withFileTypes: true });
    coreKnowledgeFileCount = files.filter(
      (e) => e.isFile() && e.name.toLowerCase().endsWith(".md"),
    ).length;
  } catch {
    // optional
  }
  if (coreKnowledgeFileCount === 0) {
    issues.push("Add at least one core/knowledge/*.md file");
  }

  const platforms = await listTopLevelDirs(rootReal, path.join("platforms"));
  const sharedKnowledgeDir = path.join(rootReal, "shared", "knowledge");
  const hasSharedKnowledge = await pathExists(sharedKnowledgeDir);

  const structure: KnowledgeStructureSummary = {
    hasInstructions,
    skillCount,
    agentCount,
    promptFileCount,
    coreKnowledgeFileCount,
    platforms,
    hasSharedKnowledge,
  };

  if (!hasSharedKnowledge) {
    issues.push("Optional: shared/knowledge/ not found (team docs)");
  }

  return { structure, issues };
}

export async function countKnowledgeFiles(rootReal: string): Promise<{
  skills: number;
  agents: number;
  prompts: number;
  knowledge: number;
}> {
  const skillsRoot = path.join(rootReal, ".github", "skills");
  const skills = await countFilesRecursive(
    skillsRoot,
    (name) => name.toLowerCase() === "skill.md",
    "",
  );

  const agentsDir = path.join(rootReal, ".github", "agents");
  let agents = 0;
  try {
    const files = await fsp.readdir(agentsDir, { withFileTypes: true });
    agents = files.filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".agent.md")).length;
  } catch {
    agents = 0;
  }

  const promptsRoot = path.join(rootReal, ".github", "prompts");
  const prompts = await countFilesRecursive(
    promptsRoot,
    (name) => name.toLowerCase().endsWith(".prompt.md"),
    "",
  );

  let knowledge = 0;
  const roots = [
    path.join(rootReal, "core", "knowledge"),
    path.join(rootReal, "shared", "knowledge"),
  ];
  for (const kr of roots) {
    knowledge += await countFilesRecursive(kr, (name) => name.toLowerCase().endsWith(".md"), "");
  }

  return { skills, agents, prompts, knowledge };
}
