/**
 * Meridian CLI audit trail (Section 14.1) — append-only JSON lines under core/.ai-artifacts/audit/
 */

import { appendFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";
import { getProjectRoot } from "./configLoader.js";
import { loadSharedConfig } from "./configLoader.js";

export interface AuditEntry {
  timestamp: string;
  engineerId?: string;
  platformDomain?: string;
  invoked?: string;
  commands?: string[];
  outcome: "completed" | "abandoned" | "error";
  detail?: string;
}

export function appendAuditEntry(entry: AuditEntry): void {
  try {
    const config = loadSharedConfig() as { paths?: { artifacts_root?: string } };
    const artifacts = config.paths?.artifacts_root ?? "core/.ai-artifacts";
    const dir = resolve(getProjectRoot(), artifacts, "audit");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const line = JSON.stringify(entry) + "\n";
    appendFileSync(resolve(dir, "audit.log"), line, "utf-8");
  } catch {
    /* never throw from audit */
  }
}
