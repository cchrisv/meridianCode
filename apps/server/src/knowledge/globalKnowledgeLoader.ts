import fsp from "node:fs/promises";
import path from "node:path";

import { resolveExistingPath } from "./resolveKnowledgePath.ts";

const TOTAL_BYTE_BUDGET = 64 * 1024;
const PER_FILE_BYTE_CAP = 48 * 1024;

export const MERIDIAN_INSTRUCTIONS_REL = path.posix.join(".github", "copilot-instructions.md");
const CORE_KNOWLEDGE_GLOB_DIR = path.posix.join("core", "knowledge");

interface CacheEntry {
  readonly signature: string;
  readonly text: string;
}

const cacheByRoot = new Map<string, CacheEntry>();

async function statMtimeMs(p: string): Promise<number | null> {
  try {
    const st = await fsp.stat(p);
    return st.mtimeMs;
  } catch {
    return null;
  }
}

async function collectSignature(rootReal: string): Promise<string> {
  const parts: string[] = [];
  const instr = path.join(rootReal, ".github", "copilot-instructions.md");
  parts.push(`instr:${(await statMtimeMs(instr)) ?? "m"}`);

  const knowDir = path.join(rootReal, "core", "knowledge");
  try {
    const names = await fsp.readdir(knowDir);
    const mdFiles = names.filter((n) => n.toLowerCase().endsWith(".md")).toSorted();
    for (const name of mdFiles) {
      const fp = path.join(knowDir, name);
      parts.push(`${name}:${(await statMtimeMs(fp)) ?? "m"}`);
    }
  } catch {
    parts.push("coreKnow:noop");
  }
  return parts.join("|");
}

function appendSection(
  buffer: string[],
  title: string,
  body: string,
  budgetRemaining: { bytes: number },
): void {
  const header = `\n\n## ${title}\n\n`;
  const chunk = header + body;
  if (chunk.length <= budgetRemaining.bytes) {
    buffer.push(chunk);
    budgetRemaining.bytes -= chunk.length;
    return;
  }
  const allowance = Math.max(0, budgetRemaining.bytes - header.length);
  if (allowance > 0) {
    buffer.push(`${header}${body.slice(0, allowance)}\n\n[truncated]\n`);
  }
  budgetRemaining.bytes = 0;
}

/**
 * Load the bounded Meridian text slice used for Codex/Claude prepend and Copilot systemMessage append.
 */
export async function loadGlobalKnowledgeText(rawRoot: string): Promise<string> {
  const trimmed = rawRoot.trim();
  if (!trimmed) {
    return "";
  }

  const rootReal = await resolveExistingPath(trimmed);
  if (!rootReal) {
    return "";
  }

  const signature = await collectSignature(rootReal);
  const cached = cacheByRoot.get(rootReal);
  if (cached && cached.signature === signature) {
    return cached.text;
  }

  const buffer: string[] = [];
  const budgetRemaining = { bytes: TOTAL_BYTE_BUDGET };

  const instructionsPath = path.join(rootReal, ".github", "copilot-instructions.md");
  try {
    const raw = await fsp.readFile(instructionsPath, "utf8");
    const clipped = raw.slice(0, PER_FILE_BYTE_CAP);
    appendSection(buffer, "Meridian — copilot-instructions", clipped, budgetRemaining);
  } catch {
    // optional at load time; validation may still warn
  }

  const knowDir = path.join(rootReal, CORE_KNOWLEDGE_GLOB_DIR.split("/").join(path.sep));
  try {
    const names = await fsp.readdir(knowDir);
    const mdFiles = names.filter((n) => n.toLowerCase().endsWith(".md")).toSorted();
    for (const name of mdFiles) {
      if (budgetRemaining.bytes <= 0) break;
      const fp = path.join(knowDir, name);
      try {
        const st = await fsp.stat(fp);
        if (!st.isFile()) continue;
        const raw = await fsp.readFile(fp, "utf8");
        const clipped = raw.slice(0, PER_FILE_BYTE_CAP);
        appendSection(buffer, `Meridian — core/knowledge/${name}`, clipped, budgetRemaining);
      } catch {
        // skip unreadable
      }
    }
  } catch {
    // directory may be absent
  }

  const text = buffer.join("").trim();
  cacheByRoot.set(rootReal, { signature, text });
  return text;
}

export function invalidateGlobalKnowledgeCache(rootReal?: string): void {
  if (rootReal === undefined) {
    cacheByRoot.clear();
    return;
  }
  cacheByRoot.delete(path.normalize(rootReal));
}
