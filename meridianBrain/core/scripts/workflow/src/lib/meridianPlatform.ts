/**
 * Meridian platform detection from ADO work item fields and platforms/{id}/platform.json manifests.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { resolve } from "path";
import { getProjectRoot } from "./configLoader.js";
import type { WorkItem } from "../types/adoWorkItemTypes.js";

export interface PlatformManifest {
  id: string;
  name: string;
  detection: {
    adoAreaPaths?: string[];
    adoTags?: string[];
    adoCustomFields?: Record<string, string>;
  };
}

let manifestCache: PlatformManifest[] | null = null;

export function loadPlatformManifests(): PlatformManifest[] {
  if (manifestCache) return manifestCache;
  const root = resolve(getProjectRoot(), "platforms");
  if (!existsSync(root)) {
    manifestCache = [];
    return manifestCache;
  }
  const dirs = readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  const out: PlatformManifest[] = [];
  for (const dir of dirs) {
    const path = resolve(root, dir, "platform.json");
    if (!existsSync(path)) continue;
    try {
      const raw = JSON.parse(readFileSync(path, "utf-8")) as PlatformManifest;
      out.push(raw);
    } catch {
      /* skip invalid */
    }
  }
  manifestCache = out;
  return manifestCache;
}

export function clearPlatformManifestCache(): void {
  manifestCache = null;
}

function normAreaPath(s: string): string {
  return s.replace(/\//g, "\\").toLowerCase();
}

function workItemAreaPath(fields: Record<string, unknown>): string {
  const v = fields["System.AreaPath"];
  return typeof v === "string" ? v : "";
}

function workItemTags(fields: Record<string, unknown>): string[] {
  const v = fields["System.Tags"];
  if (typeof v !== "string" || !v.trim()) return [];
  return v
    .split(/[;,]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Pick first platform whose detection rules match the work item.
 */
export function detectPlatformFromWorkItem(workItem: WorkItem): string | null {
  const fields = workItem.fields as Record<string, unknown>;
  const area = normAreaPath(workItemAreaPath(fields));
  const tags = workItemTags(fields);
  const manifests = loadPlatformManifests();

  for (const m of manifests) {
    const paths = m.detection?.adoAreaPaths ?? [];
    for (const p of paths) {
      if (area && normAreaPath(p) && area.includes(normAreaPath(p))) {
        return m.id;
      }
    }
    const wanted = (m.detection?.adoTags ?? []).map((t) => t.toLowerCase());
    if (wanted.length && wanted.some((t) => tags.includes(t))) {
      return m.id;
    }
  }

  return manifests[0]?.id ?? null;
}
