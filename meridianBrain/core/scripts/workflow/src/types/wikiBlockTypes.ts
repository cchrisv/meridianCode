/**
 * Wiki Block Engine Types
 * Type definitions for the block-based wiki page composition engine.
 * Separate from adoWikiTypes.ts (ADO API types) and templateTypes.ts (slot-fill engine).
 */

// ---------------------------------------------------------------------------
// Color System
// ---------------------------------------------------------------------------

/** Semantic color name — the AI picks from this constrained vocabulary */
export type WikiColorName =
  | "green"
  | "blue"
  | "purple"
  | "indigo"
  | "teal"
  | "red"
  | "orange"
  | "brown";

/** Derived color scheme — only `primary` is defined; dark/light/tint are auto-generated via chroma-js */
export interface WikiColorScheme {
  /** Section identity color — left borders, gradient start */
  primary: string;
  /** Darker variant — gradient end, header text on tinted backgrounds */
  dark: string;
  /** Lighter variant — subsection accents */
  light: string;
  /** Very light pastel — card background tint (~94% luminance) */
  tint: string;
}

// ---------------------------------------------------------------------------
// Block Types (discriminated union on `type`)
// ---------------------------------------------------------------------------

/** All available content block types */
export type WikiBlockType =
  | "narrative"
  | "data-table"
  | "bullet-list"
  | "numbered-list"
  | "callout"
  | "key-value-pairs"
  | "link-list"
  | "code-block"
  | "mermaid-diagram"
  | "placeholder";

/** Callout semantic variant */
export type CalloutVariant = "info" | "warning" | "success" | "critical";

// --- Individual block interfaces ---

/** Prose paragraphs in a styled card */
export interface NarrativeBlock {
  type: "narrative";
  content: string;
}

/** Styled HTML table with header row */
export interface DataTableBlock {
  type: "data-table";
  headers: string[];
  rows: string[][];
  caption?: string;
}

/** Unordered list in a styled card */
export interface BulletListBlock {
  type: "bullet-list";
  items: string[];
  title?: string;
}

/** Ordered list in a styled card */
export interface NumberedListBlock {
  type: "numbered-list";
  items: string[];
  title?: string;
  start?: number;
}

/** Colored accent callout card */
export interface CalloutBlock {
  type: "callout";
  variant: CalloutVariant;
  title: string;
  content: string;
}

/** Label-value pairs display */
export interface KeyValuePairsBlock {
  type: "key-value-pairs";
  pairs: Array<{ label: string; value: string }>;
  title?: string;
}

/** Links to other wiki pages or ADO items */
export interface LinkListBlock {
  type: "link-list";
  links: Array<{ text: string; url: string; description?: string }>;
  title?: string;
}

/** Code with language tag — rendered as raw markdown */
export interface CodeBlockBlock {
  type: "code-block";
  language: string;
  code: string;
}

/** Mermaid diagram — rendered as raw markdown */
export interface MermaidDiagramBlock {
  type: "mermaid-diagram";
  chart: string;
}

/** Placeholder for content not yet available */
export interface PlaceholderBlock {
  type: "placeholder";
  message: string;
}

/** Union of all block types */
export type WikiBlock =
  | NarrativeBlock
  | DataTableBlock
  | BulletListBlock
  | NumberedListBlock
  | CalloutBlock
  | KeyValuePairsBlock
  | LinkListBlock
  | CodeBlockBlock
  | MermaidDiagramBlock
  | PlaceholderBlock;

// ---------------------------------------------------------------------------
// Page Structure
// ---------------------------------------------------------------------------

/** A subsection within a section (### level) */
export interface WikiSubsection {
  heading: string;
  emoji: string;
  blocks: WikiBlock[];
}

/** A top-level section (## level) */
export interface WikiSection {
  heading: string;
  emoji: string;
  color: WikiColorName;
  blocks: WikiBlock[];
  subsections?: WikiSubsection[];
}

/** Complete page specification — this is what the AI composes and returns */
export interface WikiPageSpec {
  title: string;
  id: string;
  timestamp: string;
  status_banner?: string;
  sections: WikiSection[];
  footer_note?: string;
}

// ---------------------------------------------------------------------------
// Render Result
// ---------------------------------------------------------------------------

export interface WikiRenderResult {
  success: boolean;
  html: string;
  html_length: number;
  sections_rendered: number;
  blocks_rendered: number;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Block Menu (for AI prompt injection)
// ---------------------------------------------------------------------------

/** Schema for a single block parameter */
export interface BlockParamSchema {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

/** Menu entry describing one available block type */
export interface BlockMenuEntry {
  type: WikiBlockType;
  description: string;
  params: BlockParamSchema[];
  example: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface WikiValidationResult {
  valid: boolean;
  errors: string[];
}
