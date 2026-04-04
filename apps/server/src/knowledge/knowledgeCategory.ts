import path from "node:path";

import type { KnowledgeFileCategory } from "@t3tools/contracts";

/** Classify a repo-relative POSIX path for explorer badges. */
export function categorizeKnowledgePath(relPosix: string): KnowledgeFileCategory {
  const normalized = relPosix.replace(/\\/g, "/").toLowerCase();
  const base = path.posix.basename(normalized);

  if (base === "copilot-instructions.md") {
    return "instructions";
  }
  if (normalized.includes("/.github/skills/") && base === "skill.md") {
    return "skill";
  }
  if (normalized.includes("/.github/agents/") && base.endsWith(".agent.md")) {
    return "agent";
  }
  if (normalized.includes("/.github/prompts/") && base.endsWith(".prompt.md")) {
    return "prompt";
  }
  if (normalized.includes("/knowledge/")) {
    return "knowledge";
  }
  if (normalized.includes("/standards/")) {
    return "standard";
  }
  if (normalized.includes("/config/")) {
    return "config";
  }
  return "file";
}
