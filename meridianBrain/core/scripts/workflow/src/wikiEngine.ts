/**
 * Wiki Block Engine
 * Block-based composition engine for Azure DevOps Wiki pages.
 * Fully separate from the template engine — shares only the Nunjucks environment.
 */

import chroma from "chroma-js";
import juice from "juice";
import sanitizeHtml from "sanitize-html";
import nunjucks from "nunjucks";
import { getNunjucksEnv } from "./templateRenderer.js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { getProjectRoot } from "./lib/configLoader.js";
import type {
  WikiColorName,
  WikiColorScheme,
  WikiBlock,
  WikiSection,
  WikiPageSpec,
  WikiRenderResult,
  WikiValidationResult,
  BlockMenuEntry,
  BlockParamSchema,
} from "./types/wikiBlockTypes.js";

// ---------------------------------------------------------------------------
// Color System (chroma-js powered)
// ---------------------------------------------------------------------------

/** Generate a full color scheme from a single primary color */
export function generateColorScheme(primary: string): WikiColorScheme {
  const c = chroma(primary);
  return {
    primary,
    dark: c.darken(0.8).hex(),
    light: c.brighten(1.2).hex(),
    tint: c.luminance(0.94).hex(),
  };
}

/** Pre-generated color schemes keyed by semantic name */
const WIKI_COLORS: Record<WikiColorName, WikiColorScheme> = {
  green: generateColorScheme("#2e7d32"),
  blue: generateColorScheme("#1565c0"),
  purple: generateColorScheme("#7b1fa2"),
  indigo: generateColorScheme("#303f9f"),
  teal: generateColorScheme("#00796b"),
  red: generateColorScheme("#c62828"),
  orange: generateColorScheme("#e65100"),
  brown: generateColorScheme("#5d4037"),
};

const VALID_COLOR_NAMES = new Set<string>(Object.keys(WIKI_COLORS));

/** Look up a color scheme by semantic name */
export function getColorScheme(name: WikiColorName): WikiColorScheme {
  const scheme = WIKI_COLORS[name];
  return scheme;
}

/** Get all available color names */
export function getColorNames(): WikiColorName[] {
  return Object.keys(WIKI_COLORS) as WikiColorName[];
}

// ---------------------------------------------------------------------------
// HTML Sanitization
// ---------------------------------------------------------------------------

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "strong",
    "em",
    "b",
    "i",
    "u",
    "span",
    "div",
    "br",
    "ul",
    "ol",
    "li",
    "table",
    "tr",
    "td",
    "th",
    "thead",
    "tbody",
    "a",
    "code",
    "pre",
    "hr",
    "img",
  ],
  allowedAttributes: {
    "*": ["style", "class"],
    a: ["href"],
    img: ["src", "alt"],
  },
};

/** Sanitize HTML content before rendering into blocks */
export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

// ---------------------------------------------------------------------------
// Inline Style Conversion (juice)
// ---------------------------------------------------------------------------

/** Load the CSS style block from _wiki-blocks.html for juice inlining */
let _cachedStyleBlock: string | null = null;
function getStyleBlock(): string {
  if (_cachedStyleBlock === null) {
    const projectRoot = getProjectRoot();
    const blocksPath = resolve(projectRoot, "core", "templates", "partials", "_wiki-blocks.html");
    const content = readFileSync(blocksPath, "utf-8");
    const match = content.match(/<style>([\s\S]*?)<\/style>/);
    _cachedStyleBlock = match ? `<style>${match[1]}</style>` : "";
  }
  return _cachedStyleBlock;
}

/** Convert CSS classes to inline styles for ADO Wiki compatibility */
function inlineStyles(html: string): string {
  // Prepend the style block so juice can resolve class references
  const withStyles = getStyleBlock() + html;
  return juice(withStyles, {
    removeStyleTags: true,
    preserveMediaQueries: false,
    preserveFontFaces: false,
  });
}

// ---------------------------------------------------------------------------
// Block Rendering
// ---------------------------------------------------------------------------

/**
 * Render a single block to an HTML string.
 * For HTML blocks: uses Nunjucks renderString with macro imports.
 * For markdown blocks (code, mermaid): returns raw markdown.
 */
export function renderBlock(
  env: nunjucks.Environment,
  block: WikiBlock,
  colors: WikiColorScheme,
  indent: boolean,
): string {
  switch (block.type) {
    case "narrative":
      return renderMacroBlock(env, "wikiNarrative", {
        content: new nunjucks.runtime.SafeString(sanitizeContent(block.content)),
        colors,
        indent,
      });

    case "data-table":
      return renderMacroBlock(env, "wikiDataTable", {
        headers: block.headers,
        rows: block.rows.map((row) =>
          row.map((cell) => new nunjucks.runtime.SafeString(sanitizeContent(cell))),
        ),
        colors,
        indent,
        caption: block.caption ?? "",
      });

    case "bullet-list":
      return renderMacroBlock(env, "wikiBulletList", {
        items: block.items.map((i) => new nunjucks.runtime.SafeString(sanitizeContent(i))),
        colors,
        indent,
        title: block.title ?? "",
      });

    case "numbered-list":
      return renderMacroBlock(env, "wikiNumberedList", {
        items: block.items.map((i) => new nunjucks.runtime.SafeString(sanitizeContent(i))),
        colors,
        indent,
        title: block.title ?? "",
        start: block.start ?? 1,
      });

    case "callout":
      return renderMacroBlock(env, "wikiCalloutBlock", {
        variant: block.variant,
        title: block.title,
        content: new nunjucks.runtime.SafeString(sanitizeContent(block.content)),
        indent,
      });

    case "key-value-pairs":
      return renderMacroBlock(env, "wikiKeyValuePairs", {
        pairs: block.pairs.map((p) => ({
          label: p.label,
          value: new nunjucks.runtime.SafeString(sanitizeContent(p.value)),
        })),
        colors,
        indent,
        title: block.title ?? "",
      });

    case "link-list":
      return renderMacroBlock(env, "wikiLinkList", {
        links: block.links,
        colors,
        indent,
        title: block.title ?? "",
      });

    case "code-block":
      // Raw markdown — not rendered through Nunjucks
      return `\`\`\`${block.language}\n${block.code}\n\`\`\``;

    case "mermaid-diagram":
      // Raw markdown — not rendered through Nunjucks
      return `::: mermaid\n${block.chart}\n:::`;

    case "placeholder":
      return renderMacroBlock(env, "wikiPlaceholder", {
        message: block.message,
        colors,
        indent,
      });
  }
}

/** Render a Nunjucks macro from _wiki-blocks.html */
function renderMacroBlock(
  env: nunjucks.Environment,
  macroName: string,
  context: Record<string, unknown>,
): string {
  // Build parameter list from context keys
  const paramNames = Object.keys(context);
  const paramList = paramNames.join(", ");

  const tmpl = `{% from "partials/_wiki-blocks.html" import ${macroName} %}{{ ${macroName}(${paramList}) }}`;
  return env.renderString(tmpl, context);
}

// ---------------------------------------------------------------------------
// Section Rendering
// ---------------------------------------------------------------------------

/** Render a section heading as raw markdown ## + gradient accent bar */
function renderSectionHeading(emoji: string, heading: string, colors: WikiColorScheme): string {
  const emojiPart = emoji ? `${emoji} ` : "";
  const mdHeading = `## ${emojiPart}${heading}`;
  const accentBar = `<div style="height: 6px; background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.dark} 100%); border-radius: 3px; margin: 0 0 10px 0;"></div>`;
  return `${mdHeading}\n${accentBar}`;
}

/** Render a subsection heading as raw markdown ### + gradient accent bar */
function renderSubsectionHeading(emoji: string, heading: string, colors: WikiColorScheme): string {
  const emojiPart = emoji ? `${emoji} ` : "";
  const mdHeading = `### ${emojiPart}${heading}`;
  const accentBar = `<div style="height: 4px; background: linear-gradient(135deg, ${colors.light} 0%, ${colors.primary} 100%); border-radius: 2px; margin: 0 0 8px 0;"></div>`;
  return `${mdHeading}\n${accentBar}`;
}

/** Render a complete section (heading + blocks + subsections) */
function renderSection(
  env: nunjucks.Environment,
  section: WikiSection,
): { parts: string[]; blockCount: number; warnings: string[] } {
  const colors = getColorScheme(section.color);
  const parts: string[] = [];
  const warnings: string[] = [];
  let blockCount = 0;

  // Section heading (markdown — not processed by juice)
  parts.push(renderSectionHeading(section.emoji, section.heading, colors));

  // Section-level blocks
  for (const block of section.blocks) {
    try {
      parts.push(renderBlock(env, block, colors, false));
      blockCount++;
    } catch (err) {
      warnings.push(
        `Failed to render ${block.type} block in "${section.heading}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Subsections
  if (section.subsections) {
    for (const sub of section.subsections) {
      parts.push(renderSubsectionHeading(sub.emoji, sub.heading, colors));

      for (const block of sub.blocks) {
        try {
          parts.push(renderBlock(env, block, colors, true));
          blockCount++;
        } catch (err) {
          warnings.push(
            `Failed to render ${block.type} block in "${sub.heading}": ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }
  }

  return { parts, blockCount, warnings };
}

// ---------------------------------------------------------------------------
// Page Assembly
// ---------------------------------------------------------------------------

/** Render the page header (gradient bar + TOC) */
function renderHeader(env: nunjucks.Environment, id: string, title: string): string {
  const tmpl = `{% from "partials/_wiki-blocks.html" import wikiHeader %}{{ wikiHeader(id, title) }}`;
  const headerHtml = env.renderString(tmpl, { id, title });
  return `${headerHtml}\n\n[[_TOC_]]`;
}

/** Render the page footer */
function renderFooter(env: nunjucks.Environment, timestamp: string, note?: string): string {
  const tmpl = `{% from "partials/_wiki-blocks.html" import wikiFooter %}{{ wikiFooter(timestamp, note) }}`;
  return env.renderString(tmpl, { timestamp, note: note ?? "" });
}

/** Render a status banner */
function renderStatusBanner(content: string): string {
  const sanitized = sanitizeContent(content);
  return `<div style="background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-family: 'Segoe UI', sans-serif; font-size: 13px; color: #666; text-align: center;">${sanitized}</div>`;
}

/**
 * Render a complete wiki page from a WikiPageSpec.
 * This is the main public API.
 */
export function renderWikiPage(spec: WikiPageSpec): WikiRenderResult {
  const validation = validateWikiSpec(spec);
  if (!validation.valid) {
    return {
      success: false,
      html: "",
      html_length: 0,
      sections_rendered: 0,
      blocks_rendered: 0,
      warnings: validation.errors,
    };
  }

  const env = getNunjucksEnv();
  const allWarnings: string[] = [];
  let totalBlocks = 0;

  // Separate markdown parts (headings) from HTML parts (blocks).
  // We collect everything as an ordered list of parts, each tagged as
  // 'markdown' (must not be processed by juice) or 'html' (must be juiced).
  const pageParts: Array<{ content: string; kind: "markdown" | "html" }> = [];

  // Header
  pageParts.push({ content: renderHeader(env, spec.id, spec.title), kind: "html" });

  // Status banner
  if (spec.status_banner) {
    pageParts.push({ content: renderStatusBanner(spec.status_banner), kind: "html" });
  }

  // Sections
  for (const section of spec.sections) {
    const { parts, blockCount, warnings } = renderSection(env, section);
    allWarnings.push(...warnings);
    totalBlocks += blockCount;

    for (const part of parts) {
      // Markdown headings start with ## or ###
      const isMarkdown = part.startsWith("## ") || part.startsWith("### ");
      // Code blocks and mermaid diagrams are also markdown
      const isCodeOrMermaid = part.startsWith("```") || part.startsWith("::: mermaid");

      if (isMarkdown || isCodeOrMermaid) {
        pageParts.push({ content: part, kind: "markdown" });
      } else {
        pageParts.push({ content: part, kind: "html" });
      }
    }
  }

  // Footer
  pageParts.push({ content: renderFooter(env, spec.timestamp, spec.footer_note), kind: "html" });

  // Process HTML parts through juice (CSS classes → inline styles),
  // then reassemble the page with markdown parts untouched.
  const processedParts = pageParts.map((p) => {
    if (p.kind === "html") {
      return inlineStyles(p.content);
    }
    return p.content;
  });

  const html = processedParts.join("\n\n");

  return {
    success: true,
    html,
    html_length: html.length,
    sections_rendered: spec.sections.length,
    blocks_rendered: totalBlocks,
    warnings: allWarnings,
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Validate a WikiPageSpec before rendering */
export function validateWikiSpec(spec: WikiPageSpec): WikiValidationResult {
  const errors: string[] = [];

  if (!spec.title || spec.title.trim().length === 0) {
    errors.push("Page title is required");
  }
  if (!spec.id || spec.id.trim().length === 0) {
    errors.push("Page id is required");
  }
  if (!spec.timestamp || spec.timestamp.trim().length === 0) {
    errors.push("Timestamp is required");
  }
  if (!spec.sections || spec.sections.length === 0) {
    errors.push("At least one section is required");
  }

  for (const [i, section] of spec.sections.entries()) {
    const sIdx = `Section ${i + 1}`;

    if (!section.heading || section.heading.trim().length === 0) {
      errors.push(`${sIdx}: heading is required`);
    }
    if (!VALID_COLOR_NAMES.has(section.color)) {
      errors.push(
        `${sIdx}: invalid color "${section.color}". Valid: ${[...VALID_COLOR_NAMES].join(", ")}`,
      );
    }
    if (section.blocks.length === 0 && (!section.subsections || section.subsections.length === 0)) {
      errors.push(`${sIdx} ("${section.heading}"): must have at least one block or subsection`);
    }

    if (section.subsections) {
      for (const [j, sub] of section.subsections.entries()) {
        const subIdx = `${sIdx} → Subsection ${j + 1}`;
        if (!sub.heading || sub.heading.trim().length === 0) {
          errors.push(`${subIdx}: heading is required`);
        }
        if (sub.blocks.length === 0) {
          errors.push(`${subIdx} ("${sub.heading}"): must have at least one block`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Block Menu (for AI prompt injection)
// ---------------------------------------------------------------------------

/** Return the catalog of all available block types with schemas and examples */
export function getBlockMenu(): BlockMenuEntry[] {
  return [
    {
      type: "narrative",
      description:
        "Prose paragraphs in a styled card. Use for explanations, context, and narrative content.",
      params: [p("content", "string", true, "HTML content — paragraphs, inline formatting")],
      example: {
        type: "narrative",
        content: "<p>This feature enables automated data synchronization between systems.</p>",
      },
    },
    {
      type: "data-table",
      description:
        "Styled HTML table with colored header row. Use for structured data, comparisons, inventories.",
      params: [
        p("headers", "string[]", true, "Column header labels"),
        p(
          "rows",
          "string[][]",
          true,
          "Array of rows, each an array of cell values (HTML supported)",
        ),
        p("caption", "string", false, "Optional table caption/title"),
      ],
      example: {
        type: "data-table",
        headers: ["Component", "Type", "Status"],
        rows: [
          ["Auth Service", "Apex Class", "Existing"],
          ["Data Sync", "Flow", "New"],
        ],
        caption: "Component Inventory",
      },
    },
    {
      type: "bullet-list",
      description: "Unordered list in a styled card. Use for requirements, features, pain points.",
      params: [
        p("items", "string[]", true, "List items (HTML supported in each item)"),
        p("title", "string", false, "Optional list heading"),
      ],
      example: {
        type: "bullet-list",
        items: ["Automated validation", "Real-time sync", "Audit logging"],
        title: "Key Capabilities",
      },
    },
    {
      type: "numbered-list",
      description: "Ordered list in a styled card. Use for steps, sequences, priorities.",
      params: [
        p("items", "string[]", true, "List items (HTML supported in each item)"),
        p("title", "string", false, "Optional list heading"),
        p("start", "number", false, "Starting number (default: 1)"),
      ],
      example: {
        type: "numbered-list",
        items: ["Configure connection", "Map fields", "Enable sync"],
        title: "Setup Steps",
      },
    },
    {
      type: "callout",
      description:
        "Colored accent card for key information. Variants: info (blue), warning (orange), success (green), critical (red).",
      params: [
        p("variant", '"info" | "warning" | "success" | "critical"', true, "Semantic color variant"),
        p("title", "string", true, "Callout heading"),
        p("content", "string", true, "Callout body (HTML supported)"),
      ],
      example: {
        type: "callout",
        variant: "warning",
        title: "Assumption",
        content: "This assumes the API rate limit will not be exceeded during peak hours.",
      },
    },
    {
      type: "key-value-pairs",
      description:
        "Label-value pairs in a styled card. Use for metadata, status summaries, configuration.",
      params: [
        p("pairs", "Array<{label, value}>", true, "Array of {label, value} objects"),
        p("title", "string", false, "Optional heading"),
      ],
      example: {
        type: "key-value-pairs",
        pairs: [
          { label: "Owner", value: "Platform Team" },
          { label: "Status", value: "In Progress" },
        ],
        title: "Metadata",
      },
    },
    {
      type: "link-list",
      description: "List of links to other wiki pages or external resources.",
      params: [
        p("links", "Array<{text, url, description?}>", true, "Array of link objects"),
        p("title", "string", false, "Optional heading"),
      ],
      example: {
        type: "link-list",
        links: [
          {
            text: "#12345 — User Auth",
            url: "/wiki/12345-user-auth",
            description: "Authentication story",
          },
        ],
        title: "Related Pages",
      },
    },
    {
      type: "code-block",
      description:
        "Code snippet with syntax highlighting. Rendered as raw markdown (ADO Wiki styles it).",
      params: [
        p("language", "string", true, "Programming language (apex, javascript, json, sql, etc.)"),
        p("code", "string", true, "The code content"),
      ],
      example: {
        type: "code-block",
        language: "apex",
        code: "public class MyService {\n    public void execute() { }\n}",
      },
    },
    {
      type: "mermaid-diagram",
      description: "Mermaid diagram. Always use graph TD for flowcharts.",
      params: [p("chart", "string", true, "Raw mermaid syntax")],
      example: {
        type: "mermaid-diagram",
        chart: "graph TD\n  A[Start] --> B[Process]\n  B --> C[End]",
      },
    },
    {
      type: "placeholder",
      description: "Empty state card for content not yet available.",
      params: [p("message", "string", true, "Placeholder message")],
      example: {
        type: "placeholder",
        message: "This section will be populated during solutioning.",
      },
    },
  ];
}

/** Helper to build a BlockParamSchema */
function p(name: string, type: string, required: boolean, description: string): BlockParamSchema {
  return { name, type, required, description };
}

/** Format the block menu as markdown for AI prompt injection */
export function getBlockMenuMarkdown(): string {
  const menu = getBlockMenu();
  const lines: string[] = [
    "# Wiki Block Menu",
    "",
    "Available building blocks for wiki page composition. Each block is a self-contained visual component.",
    "",
    "## Color Palette (semantic)",
    "",
    "Assign a color to each `##` section. Subsections inherit the parent color.",
    "",
    "| Name | Use For |",
    "|------|---------|",
    "| `green` | Summary, Overview, Goals, Value |",
    "| `blue` | Architecture, Design, Current State |",
    "| `purple` | Analysis, Research, Discovery, Requirements |",
    "| `indigo` | Solution, Implementation, Technical |",
    "| `teal` | Testing, Quality, Validation |",
    "| `red` | Critical, Risks, Security, Blockers |",
    "| `orange` | Issues, Warnings, Recommendations |",
    "| `brown` | Appendix, References, Changelog |",
    "",
    "Rotation (no semantic match): green → blue → purple → orange → indigo → teal → brown → red.",
    "",
    "## Available Blocks",
    "",
  ];

  for (const entry of menu) {
    lines.push(`### \`${entry.type}\``);
    lines.push(`${entry.description}`);
    lines.push("");
    lines.push("**Parameters:**");
    for (const param of entry.params) {
      const req = param.required ? "(required)" : "(optional)";
      lines.push(`- \`${param.name}\`: \`${param.type}\` ${req} — ${param.description}`);
    }
    lines.push("");
    lines.push("**Example:**");
    lines.push("```json");
    lines.push(JSON.stringify(entry.example, null, 2));
    lines.push("```");
    lines.push("");
  }

  lines.push("## Page Structure");
  lines.push("");
  lines.push("```json");
  lines.push(
    JSON.stringify(
      {
        title: "Page Title",
        id: "12345",
        timestamp: "2026-03-16",
        sections: [
          {
            heading: "Section Name",
            emoji: "🎯",
            color: "green",
            blocks: [{ type: "narrative", content: "<p>Section-level content.</p>" }],
            subsections: [
              {
                heading: "Subsection Name",
                emoji: "📋",
                blocks: [{ type: "bullet-list", items: ["Item 1", "Item 2"] }],
              },
            ],
          },
        ],
      },
      null,
      2,
    ),
  );
  lines.push("```");

  return lines.join("\n");
}
