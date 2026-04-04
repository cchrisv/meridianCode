/**
 * File Utilities
 * Safe file-reading helpers used by CLI tools for content that may contain
 * emojis, BOM markers, or other Unicode characters.
 */

import { readFileSync, existsSync } from "fs";

/** UTF-8 BOM character (U+FEFF) — invisible prefix some Windows editors add */
const UTF8_BOM = "\uFEFF";

/**
 * Read a content file safely:
 *  1. Validates the file exists (user-friendly error if not)
 *  2. Reads as UTF-8
 *  3. Strips UTF-8 BOM if present
 *
 * Use for any CLI option that reads user-supplied HTML/text from a file
 * (--description-file, --ac-file, --value-file, etc.)
 */
export function readContentFile(filePath: string, optionName?: string): string {
  if (!existsSync(filePath)) {
    const label = optionName ? `${optionName} ` : "";
    throw new Error(`File not found: ${label}"${filePath}"`);
  }

  let content = readFileSync(filePath, "utf-8");

  // Strip UTF-8 BOM — invisible character that corrupts HTML rendering in ADO
  if (content.startsWith(UTF8_BOM)) {
    content = content.slice(1);
  }

  return content;
}

/**
 * Map an ADO field reference path to the corresponding ticket-context key name.
 * Falls back to a lower-cased, dot-to-underscore conversion for unmapped fields.
 */
export function adoFieldToContextKey(adoField: string): string {
  const mapping: Record<string, string> = {
    "System.Description": "description",
    "Microsoft.VSTS.Common.AcceptanceCriteria": "acceptance_criteria",
    "System.Title": "title",
    "Microsoft.VSTS.TCM.ReproSteps": "repro_steps",
    "Microsoft.VSTS.TCM.SystemInfo": "system_info",
    "Custom.DevelopmentSummary": "development_summary",
    "Custom.BusinessProblemandValueStatement": "business_value",
    "Custom.BusinessObjectivesandImpact": "objectives",
    "Custom.ReleaseNotes": "release_notes",
    "Custom.RootCauseDetail": "root_cause_detail",
    "Custom.Blockers": "blockers",
    "Custom.Progress": "progress",
    "Custom.PlannedWork": "planned_work",
  };
  return mapping[adoField] ?? adoField.replace(/\./g, "_").toLowerCase();
}
