import fsp from "node:fs/promises";
import path from "node:path";

/**
 * Resolve a user-supplied path to an absolute real path.
 * Returns null if the path does not exist.
 */
export async function resolveExistingPath(inputPath: string): Promise<string | null> {
  const trimmed = inputPath.trim();
  if (!trimmed) {
    return null;
  }
  const absolute = path.isAbsolute(trimmed) ? trimmed : path.resolve(trimmed);
  try {
    return await fsp.realpath(absolute);
  } catch {
    return null;
  }
}

/**
 * Ensure `candidate` resolves under `rootReal` (both must be absolute, real paths).
 */
export function isPathInsideRoot(rootReal: string, candidateReal: string): boolean {
  const normalizedRoot = path.normalize(rootReal);
  const normalizedCandidate = path.normalize(candidateReal);
  if (normalizedCandidate === normalizedRoot) {
    return true;
  }
  const prefix = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : `${normalizedRoot}${path.sep}`;
  return normalizedCandidate.startsWith(prefix);
}

export function toRepoRelativePosix(rootReal: string, absoluteReal: string): string {
  const rel = path.relative(rootReal, absoluteReal);
  if (rel === "") {
    return "";
  }
  return rel.split(path.sep).join("/");
}
