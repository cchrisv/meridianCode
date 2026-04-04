import type { MCPServerConfig } from "@github/copilot-sdk";
import fsp from "node:fs/promises";
import path from "node:path";

import type { ServerSettings } from "@t3tools/contracts";

import { loadGlobalKnowledgeText } from "../../knowledge/globalKnowledgeLoader.ts";

export type CopilotSessionKnowledgeConfig = {
  mcpServers?: Record<string, MCPServerConfig>;
  skillDirectories?: string[];
  disabledSkills?: string[];
  systemMessage?: { mode: "append"; content: string };
};

export async function resolveCopilotSkillDirectories(settings: ServerSettings): Promise<string[]> {
  const configured = settings.providers.copilot.skillDirectories;
  if (configured.length > 0) {
    const resolved: string[] = [];
    for (const p of configured) {
      try {
        resolved.push(await fsp.realpath(path.resolve(p)));
      } catch {
        resolved.push(path.resolve(p));
      }
    }
    return resolved;
  }
  const root = settings.globalKnowledgeRoot.trim();
  if (!root) return [];
  try {
    const rootReal = await fsp.realpath(path.resolve(root));
    const skillsPath = path.join(rootReal, ".github", "skills");
    const st = await fsp.stat(skillsPath);
    if (st.isDirectory()) {
      return [await fsp.realpath(skillsPath)];
    }
  } catch {
    // optional
  }
  return [];
}

export async function buildCopilotSessionKnowledgeConfig(
  settings: ServerSettings,
  mcpServers: Record<string, MCPServerConfig> | undefined,
): Promise<CopilotSessionKnowledgeConfig> {
  const skillDirectories = await resolveCopilotSkillDirectories(settings);
  const disabledSkills = [...settings.providers.copilot.disabledSkills];
  const knowledgeText = await loadGlobalKnowledgeText(settings.globalKnowledgeRoot);
  const systemMessage =
    knowledgeText.trim().length > 0
      ? { mode: "append" as const, content: knowledgeText }
      : undefined;

  return {
    ...(mcpServers ? { mcpServers } : {}),
    ...(skillDirectories.length > 0 ? { skillDirectories } : {}),
    ...(disabledSkills.length > 0 ? { disabledSkills } : {}),
    ...(systemMessage ? { systemMessage } : {}),
  };
}
