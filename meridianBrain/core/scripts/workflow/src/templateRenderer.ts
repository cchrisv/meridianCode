/**
 * Template Renderer
 * Nunjucks environment setup and slot-to-context transformation for template rendering.
 */

import nunjucks from "nunjucks";
import { resolve } from "path";
import { loadSharedConfig, getProjectRoot } from "./lib/configLoader.js";
import type { FillSlot, TemplateVariable } from "./types/templateTypes.js";

// ---------------------------------------------------------------------------
// Nunjucks Environment
// ---------------------------------------------------------------------------

let _envCache: nunjucks.Environment | null = null;

/** Get the configured Nunjucks environment (cached) */
export function getNunjucksEnv(): nunjucks.Environment {
  if (_envCache) return _envCache;

  const config = loadSharedConfig();
  const projectRoot = getProjectRoot();
  const templateDir = resolve(projectRoot, config.paths.templates);
  const partialsDir = resolve(templateDir, "partials");

  _envCache = new nunjucks.Environment(
    new nunjucks.FileSystemLoader([templateDir, partialsDir], {
      noCache: process.env["NODE_ENV"] === "test",
    }),
    {
      autoescape: true,
      trimBlocks: true,
      lstripBlocks: true,
      throwOnUndefined: false,
    },
  );

  return _envCache;
}

/** Clear cached environment (for testing) */
export function clearEnvCache(): void {
  _envCache = null;
}

// ---------------------------------------------------------------------------
// HTML Entity Decoding
// ---------------------------------------------------------------------------

/**
 * Decode HTML entities in a string so Nunjucks can re-encode them correctly.
 *
 * Slot data extracted from existing ADO HTML fields may contain pre-encoded
 * entities (e.g. `&amp;`, `&lt;`). Since Nunjucks `autoescape: true` will
 * re-encode `&` → `&amp;`, feeding it pre-encoded text produces double-
 * encoded output like `&amp;amp;` which renders as literal `&amp;` on screen.
 *
 * This function decodes the five standard HTML entities back to their raw
 * characters. Nunjucks will then re-encode them properly during rendering.
 */
const HTML_ENTITY_MAP: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&apos;": "'",
};

const HTML_ENTITY_RE = /&(?:amp|lt|gt|quot|#39|#x27|apos);/gi;

function decodeHtmlEntities(text: string): string {
  return text.replace(HTML_ENTITY_RE, (match) => HTML_ENTITY_MAP[match.toLowerCase()] ?? match);
}

const ADO_ASCII_FALLBACK_MAP: Record<string, string> = {
  "\u00A0": " ",
  "\u00B1": "+/-",
  "\u2013": "-",
  "\u2014": "-",
  "\u2018": "'",
  "\u2019": "'",
  "\u201C": '"',
  "\u201D": '"',
  "\u2022": "-",
  "\u2026": "...",
};

const ADO_ASCII_FALLBACK_RE = /[\u00A0\u00B1\u2013\u2014\u2018\u2019\u201C\u201D\u2022\u2026]/g;

function normalizeUnicodeForAdo(text: string): string {
  return text.replace(ADO_ASCII_FALLBACK_RE, (match) => ADO_ASCII_FALLBACK_MAP[match] ?? match);
}

/** Decode HTML entities in all string values of a plain object (shallow). */
function decodeObjectValues(obj: Record<string, unknown>): Record<string, unknown> {
  const decoded: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    decoded[key] =
      typeof value === "string" ? normalizeUnicodeForAdo(decodeHtmlEntities(value)) : value;
  }
  return decoded;
}

// ---------------------------------------------------------------------------
// Non-ASCII → HTML Entity Encoding
// ---------------------------------------------------------------------------

/**
 * Convert non-ASCII characters (emojis, symbols) to numeric HTML entities.
 *
 * ADO's HTML sanitizer can corrupt multi-byte UTF-8 characters (especially
 * emojis) when they pass through macro arguments or the REST API transport.
 * Converting them to decimal entity form (e.g. &#128203;) before sending
 * ensures ADO stores safe ASCII-only markup that renders identically.
 * Decimal entities are used because ADO reliably preserves them, whereas
 * hex entities (&#xNNNN;) are sometimes decoded and re-corrupted.
 */
const NON_ASCII_RE = /[^\x00-\x7F]/gu;

export function encodeNonAsciiToEntities(html: string): string {
  return html.replace(NON_ASCII_RE, (ch) => {
    const cp = ch.codePointAt(0);
    return cp !== undefined ? `&#${cp};` : ch;
  });
}

// ---------------------------------------------------------------------------
// Slot-to-Context Transformation
// ---------------------------------------------------------------------------

/**
 * Transform FillSlot map into a flat context object for Nunjucks rendering.
 *
 * - text slots → decoded string values (Nunjucks auto-escapes)
 * - html slots → nunjucks.runtime.SafeString (bypasses auto-escape)
 * - list slots → decoded string arrays
 * - table / repeatable_block slots → object arrays with decoded string values
 *
 * All non-html string values are run through `decodeHtmlEntities()` to prevent
 * double-encoding when Nunjucks applies its own escaping.
 */
export function transformSlotsToContext(
  filledSlots: Record<string, FillSlot>,
  variables: Record<string, TemplateVariable>,
): Record<string, unknown> {
  const context: Record<string, unknown> = {};

  for (const [varName, varDef] of Object.entries(variables)) {
    const slot = filledSlots[varName];
    if (!slot) continue;

    switch (varDef.type) {
      case "text": {
        if (slot.value !== null && slot.value !== "") {
          context[varName] = normalizeUnicodeForAdo(decodeHtmlEntities(slot.value));
        }
        break;
      }

      case "html": {
        if (slot.value !== null && slot.value !== "") {
          // Mark as safe so Nunjucks does not double-escape pre-sanitized HTML
          context[varName] = new nunjucks.runtime.SafeString(slot.value);
        }
        break;
      }

      case "list": {
        if (slot.items && slot.items.length > 0) {
          context[varName] = slot.items.map((item) =>
            typeof item === "string" ? normalizeUnicodeForAdo(decodeHtmlEntities(item)) : item,
          );
        }
        break;
      }

      case "table": {
        if (slot.rows && slot.rows.length > 0) {
          context[varName] = slot.rows.map((row) => decodeObjectValues(row));
        }
        break;
      }

      case "repeatable_block": {
        const blocks = slot.blocks ?? [];
        if (blocks.length > 0) {
          context[varName] = blocks.map((block) => decodeObjectValues(block));
        }
        break;
      }
    }
  }

  return context;
}
