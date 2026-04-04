/**
 * Template Engine Types
 * Defines the structure for the template registry, fill specs, and rendering.
 */

/** Variable types that drive rendering logic */
export type SlotType = "text" | "html" | "list" | "table" | "repeatable_block";

/** A single variable definition in the template registry */
export interface TemplateVariable {
  /** Rendering strategy */
  type: SlotType;
  /** Whether the slot must be filled */
  required: boolean;
  /** Human-readable hint for the AI */
  description: string;
  /** For list type: minimum items required */
  min_items?: number;
  /** For table type: column definitions */
  columns?: TableColumn[];
  /** For repeatable_block type: variables within each repeated block */
  block_variables?: Record<string, TemplateVariable>;
  /** For array-style types: schema describing each item's shape (used in FillSpec generation for AI) */
  item_schema?: Record<string, TemplateVariable>;
}

/** Column definition for table-type slots */
export interface TableColumn {
  key: string;
  header: string;
  required: boolean;
}

/** A section marker in the HTML template */
export interface TemplateSection {
  /** Section identifier (from HTML comment or heading) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Whether section is required or optional */
  required: boolean;
  /** CSS gradient signature for structural validation */
  gradient_signature?: string;
}

/** Single template entry in the registry */
export interface TemplateRegistryEntry {
  /** Template HTML file name (in config/platform-ado/templates/) */
  file: string;
  /** Which workflow phase uses this template */
  phase: string;
  /** Which work item types this template applies to */
  work_item_types: string[];
  /** Optional requirement-type routing for shared work item types (e.g. functional vs technical User Story) */
  requirement_types?: string[];
  /** ADO field path this template renders to (null for wiki/markdown templates) */
  ado_field: string | null;
  /** Human-readable description */
  description: string;
  /** Variable definitions — keys match {{variable}} tokens in the HTML */
  variables: Record<string, TemplateVariable>;
  /** Structural sections for validation */
  sections: TemplateSection[];
}

/** The full template registry */
export interface TemplateRegistry {
  version: string;
  templates: Record<string, TemplateRegistryEntry>;
}

// --- Fill Spec Types (output of scaffold, input for AI) ---

/** A single slot the AI must fill */
export interface FillSlot {
  /** Variable name (matches {{variable}} in template) */
  variable: string;
  /** Rendering strategy */
  type: SlotType;
  /** Whether this slot must be filled */
  required: boolean;
  /** Human-readable hint */
  hint: string;
  /** Pre-filled value (from context or defaults) */
  value: string | null;
  /** For list type: array of items to fill */
  items: string[];
  /** For table type: array of row objects */
  rows: Record<string, string>[];
  /** For table type: column definitions */
  columns?: TableColumn[];
  /** For repeatable_block: array of block data */
  blocks?: Record<string, string | null>[];
  /** For repeatable_block: variable definitions per block */
  block_variables?: Record<string, TemplateVariable>;
}

/** Fill spec for a single template */
export interface FillSpec {
  /** Template registry key */
  template: string;
  /** ADO field this maps to */
  ado_field: string | null;
  /** Phase this belongs to */
  phase: string;
  /** All slots the AI must fill */
  slots: Record<string, FillSlot>;
}

/** Fill spec for an entire phase (multiple templates) */
export interface PhaseFillSpec {
  /** Phase name */
  phase: string;
  /** Work item type */
  work_item_type: string;
  /** Optional requirement type used for template routing */
  requirement_type?: string;
  /** Work item ID */
  work_item_id: string;
  /** Fill specs for each template in this phase */
  templates: Record<string, FillSpec>;
}

// --- Render/Validate Types ---

/** Result of rendering a template */
export interface RenderResult {
  success: boolean;
  /** Template registry key */
  template: string;
  /** ADO field this maps to */
  ado_field: string | null;
  /** Rendered HTML */
  html: string;
  /** Character count of rendered HTML */
  html_length: number;
  /** Number of slots filled */
  slots_filled: number;
  /** Number of required slots still missing */
  slots_missing: number;
  /** List of missing required slot names */
  missing_slots: string[];
  /** Warnings (non-fatal) */
  warnings: string[];
}

/** A single validation issue */
export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  /** Which section/slot the issue relates to */
  location?: string;
}

/** Result of validating rendered HTML */
export interface ValidationResult {
  valid: boolean;
  /** Template registry key */
  template: string;
  issues: ValidationIssue[];
  /** Structural checks performed */
  checks: {
    sections_present: boolean;
    no_unfilled_tokens: boolean;
    gradients_intact: boolean;
    table_headers_match: boolean;
    no_extra_sections: boolean;
  };
}

/** Result of phase-level rendering (multiple templates) */
export interface PhaseRenderResult {
  success: boolean;
  phase: string;
  work_item_id: string;
  templates: Record<string, RenderResult>;
  /** Combined validation across all templates */
  all_valid: boolean;
  /** Total issues across all templates */
  total_issues: number;
}
