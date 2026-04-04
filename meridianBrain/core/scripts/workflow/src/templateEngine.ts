/**
 * Template Engine
 * Core library for scaffold generation, rendering, and validation of HTML templates.
 * Separates structure (deterministic, template-driven) from content (AI-generated).
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { loadSharedConfig, getProjectRoot } from "./lib/configLoader.js";
import {
  getNunjucksEnv,
  transformSlotsToContext,
  encodeNonAsciiToEntities,
} from "./templateRenderer.js";
import type {
  TemplateRegistry,
  TemplateRegistryEntry,
  FillSpec,
  FillSlot,
  PhaseFillSpec,
  RenderResult,
  ValidationResult,
  ValidationIssue,
  PhaseRenderResult,
} from "./types/templateTypes.js";

// ---------------------------------------------------------------------------
// Registry Loading
// ---------------------------------------------------------------------------

let _registryCache: TemplateRegistry | null = null;

/** Load the template registry from config/platform-ado/templates/template-registry.json */
function loadRegistry(): TemplateRegistry {
  if (_registryCache) return _registryCache;
  const config = loadSharedConfig();
  const projectRoot = getProjectRoot();
  const registryPath = resolve(projectRoot, config.paths.templates, "template-registry.json");
  const raw = readFileSync(registryPath, "utf-8");
  _registryCache = JSON.parse(raw) as TemplateRegistry;
  return _registryCache;
}

/** Clear cached registry (for testing) */
export function clearRegistryCache(): void {
  _registryCache = null;
}

/** Get a single template entry by key */
export function getTemplateEntry(templateKey: string): TemplateRegistryEntry {
  const registry = loadRegistry();
  const entry = registry.templates[templateKey];
  if (!entry) {
    const available = Object.keys(registry.templates).join(", ");
    throw new Error(`Template "${templateKey}" not found in registry. Available: ${available}`);
  }
  return entry;
}

/** Load the raw HTML content for a template */
export function loadTemplateHtml(entry: TemplateRegistryEntry): string {
  const config = loadSharedConfig();
  const projectRoot = getProjectRoot();
  const templatePath = resolve(projectRoot, config.paths.templates, entry.file);
  return readFileSync(templatePath, "utf-8");
}

function resolveRequirementType(
  phase?: string,
  workItemType?: string,
  requirementType?: string,
): string | undefined {
  if (requirementType) return requirementType;
  if (phase === "grooming" && workItemType === "User Story") return "functional";
  return undefined;
}

/** List templates matching a phase and/or work item type */
export function listTemplates(options: {
  phase?: string;
  workItemType?: string;
  requirementType?: string;
}): Record<string, TemplateRegistryEntry> {
  const registry = loadRegistry();
  const result: Record<string, TemplateRegistryEntry> = {};
  const effectiveRequirementType = resolveRequirementType(
    options.phase,
    options.workItemType,
    options.requirementType,
  );

  for (const [key, entry] of Object.entries(registry.templates)) {
    if (options.phase && entry.phase !== options.phase) continue;
    if (options.workItemType && !entry.work_item_types.includes(options.workItemType)) continue;
    if (
      effectiveRequirementType &&
      entry.requirement_types &&
      entry.requirement_types.length > 0 &&
      !entry.requirement_types.includes(effectiveRequirementType)
    ) {
      continue;
    }
    result[key] = entry;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Variable Extraction (from raw HTML)
// ---------------------------------------------------------------------------

/**
 * Extract all {{variable}} data tokens from HTML.
 * Filters out Nunjucks expressions (function calls, dot access, filters, loops).
 */
export function extractVariables(html: string): string[] {
  const pattern = /\{\{([^}]+)\}\}/g;
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const captured = match[1]?.trim();
    if (!captured) continue;
    // Skip Nunjucks expressions: function calls, dot access, filters, keywords
    if (
      captured.includes("(") ||
      captured.includes(".") ||
      captured.includes("|") ||
      captured.startsWith("loop") ||
      captured.startsWith("caller")
    )
      continue;
    vars.add(captured);
  }
  return Array.from(vars);
}

// ---------------------------------------------------------------------------
// Fill Spec Generation (scaffold)
// ---------------------------------------------------------------------------

/** Generate a fill spec for a single template */
export function generateFillSpec(templateKey: string, prefill?: Record<string, unknown>): FillSpec {
  const entry = getTemplateEntry(templateKey);

  const slots: Record<string, FillSlot> = {};

  for (const [varName, varDef] of Object.entries(entry.variables)) {
    const prefillValue = prefill?.[varName];

    const slot: FillSlot = {
      variable: varName,
      type: varDef.type,
      required: varDef.required,
      hint: varDef.description,
      value: null,
      items: [],
      rows: [],
    };

    // Attach column defs for table type
    if (varDef.type === "table" && varDef.columns) {
      slot.columns = varDef.columns;
    }

    // Attach block variable defs for repeatable_block type
    if (varDef.type === "repeatable_block" && varDef.block_variables) {
      slot.block_variables = varDef.block_variables;
      slot.blocks = [];
    }

    // Apply prefill values
    if (prefillValue !== undefined && prefillValue !== null) {
      if (varDef.type === "text" || varDef.type === "html") {
        slot.value = String(prefillValue);
      } else if (varDef.type === "list" && Array.isArray(prefillValue)) {
        slot.items = prefillValue.map(String);
      } else if (varDef.type === "table" && Array.isArray(prefillValue)) {
        slot.rows = prefillValue as Record<string, string>[];
      } else if (varDef.type === "repeatable_block" && Array.isArray(prefillValue)) {
        slot.blocks = prefillValue as Record<string, string | null>[];
      }
    }

    slots[varName] = slot;
  }

  return {
    template: templateKey,
    ado_field: entry.ado_field,
    phase: entry.phase,
    slots,
  };
}

/** Generate fill specs for all templates in a phase for a work item type */
export function generatePhaseFillSpec(
  phase: string,
  workItemType: string,
  workItemId: string,
  prefill?: Record<string, Record<string, unknown>>,
  requirementType?: string,
): PhaseFillSpec {
  const effectiveRequirementType = resolveRequirementType(phase, workItemType, requirementType);
  const templates = listTemplates({
    phase,
    workItemType,
    requirementType: effectiveRequirementType,
  });
  const templateSpecs: Record<string, FillSpec> = {};

  for (const [key, _entry] of Object.entries(templates)) {
    templateSpecs[key] = generateFillSpec(key, prefill?.[key]);
  }

  return {
    phase,
    work_item_type: workItemType,
    requirement_type: effectiveRequirementType,
    work_item_id: workItemId,
    templates: templateSpecs,
  };
}

// ---------------------------------------------------------------------------
// Rendering (Nunjucks-based)
// ---------------------------------------------------------------------------

/** Render a single template from filled slots using Nunjucks */
export function renderTemplate(
  templateKey: string,
  filledSlots: Record<string, FillSlot>,
): RenderResult {
  const entry = getTemplateEntry(templateKey);
  const env = getNunjucksEnv();

  const warnings: string[] = [];
  const missingSlots: string[] = [];
  let slotsFilled = 0;

  // Check for missing required slots before rendering
  for (const [varName, varDef] of Object.entries(entry.variables)) {
    const slot = filledSlots[varName];
    if (!slot) {
      if (varDef.required) missingSlots.push(varName);
      continue;
    }

    const hasValue =
      varDef.type === "text" || varDef.type === "html"
        ? slot.value !== null && slot.value !== ""
        : varDef.type === "list"
          ? slot.items && slot.items.length > 0
          : varDef.type === "table"
            ? slot.rows && slot.rows.length > 0
            : varDef.type === "repeatable_block"
              ? slot.blocks && slot.blocks.length > 0
              : false;

    if (hasValue) {
      slotsFilled++;
    } else if (varDef.required) {
      missingSlots.push(varName);
    }
  }

  // Transform FillSlot map → flat context object for Nunjucks
  const context = transformSlotsToContext(filledSlots, entry.variables);

  // Render through Nunjucks
  let html: string;
  try {
    html = encodeNonAsciiToEntities(env.render(entry.file, context));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    warnings.push(`Nunjucks render error: ${message}`);
    return {
      success: false,
      template: templateKey,
      ado_field: entry.ado_field,
      html: "",
      html_length: 0,
      slots_filled: slotsFilled,
      slots_missing: missingSlots.length,
      missing_slots: missingSlots,
      warnings,
    };
  }

  // Post-render safety check: warn if any unfilled {{ }} tokens remain
  // (Nunjucks leaves undefined vars as empty strings, but check for leftover
  //  mustache-style {{var}} in case of mixed syntax during migration)
  const remainingTokens = extractVariables(html);
  if (remainingTokens.length > 0) {
    for (const token of remainingTokens) {
      warnings.push(`Token {{${token}}} remains after rendering`);
    }
  }

  return {
    success: missingSlots.length === 0 && remainingTokens.length === 0,
    template: templateKey,
    ado_field: entry.ado_field,
    html: html.trim(),
    html_length: html.trim().length,
    slots_filled: slotsFilled,
    slots_missing: missingSlots.length,
    missing_slots: missingSlots,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Phase-Level Rendering
// ---------------------------------------------------------------------------

/** Render all templates for a phase from filled slots */
export function renderPhaseTemplates(
  phase: string,
  workItemId: string,
  filledSlots: Record<string, Record<string, FillSlot>>,
): PhaseRenderResult {
  const results: Record<string, RenderResult> = {};
  let allValid = true;
  let totalIssues = 0;

  for (const [templateKey, slots] of Object.entries(filledSlots)) {
    const result = renderTemplate(templateKey, slots);
    results[templateKey] = result;
    if (!result.success) allValid = false;
    totalIssues += result.missing_slots.length;
  }

  return {
    success: allValid,
    phase,
    work_item_id: workItemId,
    templates: results,
    all_valid: allValid,
    total_issues: totalIssues,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate rendered HTML against its template registry entry */
export function validateRendered(templateKey: string, renderedHtml: string): ValidationResult {
  const entry = getTemplateEntry(templateKey);
  const issues: ValidationIssue[] = [];

  // Check 1: No unfilled {{...}} tokens
  const unfilledTokens = extractVariables(renderedHtml);
  const noUnfilledTokens = unfilledTokens.length === 0;
  if (!noUnfilledTokens) {
    for (const token of unfilledTokens) {
      issues.push({
        severity: "error",
        code: "UNFILLED_TOKEN",
        message: `Unfilled token found: {{${token}}}`,
        location: token,
      });
    }
  }

  // Check 2: Required sections present
  let sectionsPresent = true;
  for (const section of entry.sections) {
    if (!section.required) continue;
    let found = false;
    if (section.gradient_signature) found = renderedHtml.includes(section.gradient_signature);
    if (!found && section.name) found = renderedHtml.includes(section.name);
    if (!found) {
      sectionsPresent = false;
      issues.push({
        severity: "error",
        code: "MISSING_SECTION",
        message: `Required section "${section.name}" not found in rendered HTML`,
        location: section.id,
      });
    }
  }

  // Check 3: CSS gradients intact
  const gradientsIntact = renderedHtml.includes("linear-gradient");
  if (!gradientsIntact && entry.sections.some((s) => s.gradient_signature)) {
    issues.push({
      severity: "error",
      code: "GRADIENTS_MISSING",
      message: "CSS gradient styles are missing — template structure may have been altered",
    });
  }

  // Check 4: Table headers match
  let tableHeadersMatch = true;
  for (const varDef of Object.values(entry.variables)) {
    if (varDef.type === "table" && varDef.columns) {
      for (const col of varDef.columns) {
        if (!renderedHtml.includes(col.header)) {
          tableHeadersMatch = false;
          issues.push({
            severity: "warning",
            code: "TABLE_HEADER_MISSING",
            message: `Table header "${col.header}" not found`,
            location: col.key,
          });
        }
      }
    }
  }

  // Check 5: No extra sections (heuristic)
  // Count both inline linear-gradient and macro calls that generate gradients
  const originalHtml = loadTemplateHtml(entry);
  const inlineGradientCount = (originalHtml.match(/linear-gradient/g) ?? []).length;
  const macroGradientCount =
    (originalHtml.match(/gradientHeader\s*\(/g) ?? []).length +
    (originalHtml.match(/progressBar\s*\(/g) ?? []).length +
    (originalHtml.match(/sectionHeading\s*\(/g) ?? []).length +
    (originalHtml.match(/subSectionHeading\s*\(/g) ?? []).length;
  const expectedGradientCount = inlineGradientCount + macroGradientCount;
  const renderedGradientCount = (renderedHtml.match(/linear-gradient/g) ?? []).length;
  const noExtraSections = renderedGradientCount <= expectedGradientCount + 2;
  if (!noExtraSections) {
    issues.push({
      severity: "warning",
      code: "EXTRA_SECTIONS",
      message: `Rendered HTML has ${renderedGradientCount} gradient sections vs ${expectedGradientCount} expected from template`,
    });
  }

  return {
    valid: issues.filter((i) => i.severity === "error").length === 0,
    template: templateKey,
    issues,
    checks: {
      sections_present: sectionsPresent,
      no_unfilled_tokens: noUnfilledTokens,
      gradients_intact: gradientsIntact,
      table_headers_match: tableHeadersMatch,
      no_extra_sections: noExtraSections,
    },
  };
}
