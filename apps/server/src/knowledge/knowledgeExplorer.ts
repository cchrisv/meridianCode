import fsp from "node:fs/promises";
import path from "node:path";

import type { Dirent, Stats } from "node:fs";

import type { KnowledgeTreeEntry } from "@t3tools/contracts";

import { categorizeKnowledgePath } from "./knowledgeCategory.ts";
import {
  isPathInsideRoot,
  resolveExistingPath,
  toRepoRelativePosix,
} from "./resolveKnowledgePath.ts";

const MAX_TREE_NODES = 8000;
const MAX_READ_BYTES = 2 * 1024 * 1024;

const SKIP_DIR_NAMES = new Set([".git", "node_modules", ".cache"]);

function sortEntries(a: KnowledgeTreeEntry, b: KnowledgeTreeEntry): number {
  if (a.type !== b.type) {
    return a.type === "dir" ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

async function buildTreeRecursive(input: {
  absoluteDir: string;
  rootReal: string;
  relativePosix: string;
  nodeBudget: { remaining: number };
}): Promise<KnowledgeTreeEntry[]> {
  if (input.nodeBudget.remaining <= 0) {
    return [];
  }
  let dirents: Dirent[];
  try {
    dirents = await fsp.readdir(input.absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const entries: KnowledgeTreeEntry[] = [];
  for (const ent of dirents) {
    if (input.nodeBudget.remaining <= 0) break;
    if (SKIP_DIR_NAMES.has(ent.name)) continue;

    const absoluteChild = path.join(input.absoluteDir, ent.name);
    let childReal: string;
    try {
      childReal = await fsp.realpath(absoluteChild);
    } catch {
      continue;
    }
    if (!isPathInsideRoot(input.rootReal, childReal)) {
      continue;
    }

    const relPosix =
      input.relativePosix === ""
        ? ent.name
        : `${input.relativePosix.replace(/\/$/, "")}/${ent.name}`;

    if (ent.isDirectory()) {
      input.nodeBudget.remaining -= 1;
      const children = await buildTreeRecursive({
        absoluteDir: childReal,
        rootReal: input.rootReal,
        relativePosix: relPosix,
        nodeBudget: input.nodeBudget,
      });
      entries.push({
        path: relPosix,
        name: ent.name,
        type: "dir",
        ...(children.length > 0 ? { children } : {}),
      });
    } else if (ent.isFile()) {
      input.nodeBudget.remaining -= 1;
      let size = 0;
      try {
        const st = await fsp.stat(childReal);
        size = st.size;
      } catch {
        size = 0;
      }
      entries.push({
        path: relPosix,
        name: ent.name,
        type: "file",
        size,
        category: categorizeKnowledgePath(relPosix),
      });
    }
  }

  return entries.toSorted(sortEntries);
}

export async function listKnowledgeTree(rootRaw: string): Promise<{
  root: string;
  truncated: boolean;
  entries: KnowledgeTreeEntry[];
}> {
  const rootReal = await resolveExistingPath(rootRaw.trim());
  if (!rootReal) {
    return { root: "", truncated: false, entries: [] };
  }
  const nodeBudget = { remaining: MAX_TREE_NODES };
  const entries = await buildTreeRecursive({
    absoluteDir: rootReal,
    rootReal,
    relativePosix: "",
    nodeBudget,
  });
  return {
    root: rootReal,
    truncated: nodeBudget.remaining <= 0,
    entries,
  };
}

function splitMarkdownFrontmatter(body: string): { frontmatter: string | null; content: string } {
  if (!body.startsWith("---\n") && !body.startsWith("---\r\n")) {
    return { frontmatter: null, content: body };
  }
  const nl = body.startsWith("---\r\n") ? "\r\n" : "\n";
  const rest = body.slice(4);
  const end = rest.indexOf(`${nl}---${nl}`);
  if (end === -1) {
    return { frontmatter: null, content: body };
  }
  const fm = rest.slice(0, end);
  const content = rest.slice(end + nl.length + 4);
  return { frontmatter: fm.trim().length > 0 ? fm : null, content };
}

export async function readKnowledgeFileUnderRoot(
  rootRaw: string,
  absolutePath: string,
): Promise<
  | {
      path: string;
      content: string;
      size: number;
      category: ReturnType<typeof categorizeKnowledgePath>;
      frontmatter: string | null;
    }
  | { error: string }
> {
  const rootReal = await resolveExistingPath(rootRaw.trim());
  if (!rootReal) {
    return { error: "Knowledge root is not configured or missing." };
  }
  let fileReal: string;
  try {
    fileReal = await fsp.realpath(absolutePath.trim());
  } catch {
    return { error: "File not found." };
  }
  if (!isPathInsideRoot(rootReal, fileReal)) {
    return { error: "Path escapes knowledge root." };
  }
  let st: Stats;
  try {
    st = await fsp.stat(fileReal);
  } catch {
    return { error: "File not found." };
  }
  if (!st.isFile()) {
    return { error: "Not a file." };
  }
  if (st.size > MAX_READ_BYTES) {
    return { error: `File too large (>${MAX_READ_BYTES} bytes). Open in an editor instead.` };
  }
  const raw = await fsp.readFile(fileReal, "utf8");
  const rel = toRepoRelativePosix(rootReal, fileReal);
  const category = categorizeKnowledgePath(rel);
  const lower = fileReal.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".mdc")) {
    const { frontmatter, content } = splitMarkdownFrontmatter(raw);
    return {
      path: fileReal,
      content,
      size: Buffer.byteLength(content, "utf8"),
      category,
      frontmatter,
    };
  }
  return {
    path: fileReal,
    content: raw,
    size: Buffer.byteLength(raw, "utf8"),
    category,
    frontmatter: null,
  };
}
