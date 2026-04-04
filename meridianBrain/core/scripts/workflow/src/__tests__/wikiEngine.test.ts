/**
 * Wiki Engine Tests
 * Tests for the block-based wiki page composition engine.
 */

import { describe, it, expect } from "vitest";
import {
  generateColorScheme,
  getColorScheme,
  getColorNames,
  sanitizeContent,
  renderBlock,
  renderWikiPage,
  validateWikiSpec,
  getBlockMenu,
  getBlockMenuMarkdown,
} from "../wikiEngine.js";
import { getNunjucksEnv } from "../templateRenderer.js";
import type {
  WikiPageSpec,
  WikiColorScheme,
  WikiBlock,
  WikiSection,
} from "../types/wikiBlockTypes.js";

// ---------------------------------------------------------------------------
// Color System
// ---------------------------------------------------------------------------
describe("Color System", () => {
  it("should generate a full color scheme from a primary color", () => {
    const scheme = generateColorScheme("#2e7d32");
    expect(scheme.primary).toBe("#2e7d32");
    expect(scheme.dark).toBeDefined();
    expect(scheme.light).toBeDefined();
    expect(scheme.tint).toBeDefined();
    // Dark should be darker than primary
    expect(scheme.dark).not.toBe(scheme.primary);
    // Tint should be very light
    expect(scheme.tint).not.toBe(scheme.primary);
  });

  it("should return all 8 named color schemes", () => {
    const names = getColorNames();
    expect(names).toHaveLength(8);
    expect(names).toContain("green");
    expect(names).toContain("blue");
    expect(names).toContain("purple");
    expect(names).toContain("indigo");
    expect(names).toContain("teal");
    expect(names).toContain("red");
    expect(names).toContain("orange");
    expect(names).toContain("brown");
  });

  it("should return a valid scheme for each named color", () => {
    for (const name of getColorNames()) {
      const scheme = getColorScheme(name);
      expect(scheme.primary).toMatch(/^#[0-9a-f]{6}$/);
      expect(scheme.dark).toMatch(/^#[0-9a-f]{6}$/);
      expect(scheme.light).toMatch(/^#[0-9a-f]{6}$/);
      expect(scheme.tint).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

// ---------------------------------------------------------------------------
// HTML Sanitization
// ---------------------------------------------------------------------------
describe("Sanitization", () => {
  it("should allow safe HTML tags", () => {
    const input = "<p><strong>Bold</strong> and <em>italic</em></p>";
    expect(sanitizeContent(input)).toBe(input);
  });

  it("should strip script tags", () => {
    const input = '<p>Safe</p><script>alert("xss")</script>';
    const result = sanitizeContent(input);
    expect(result).not.toContain("<script>");
    expect(result).toContain("<p>Safe</p>");
  });

  it("should strip event handlers", () => {
    const input = '<div onclick="alert(1)">Click</div>';
    const result = sanitizeContent(input);
    expect(result).not.toContain("onclick");
  });

  it("should allow style and href attributes", () => {
    const input = '<a href="https://example.com" style="color: red;">Link</a>';
    const result = sanitizeContent(input);
    expect(result).toContain('href="https://example.com"');
    // sanitize-html normalizes CSS whitespace
    expect(result).toContain('style="color:red"');
  });
});

// ---------------------------------------------------------------------------
// Block Rendering
// ---------------------------------------------------------------------------
describe("Block Rendering", () => {
  const env = getNunjucksEnv();
  const colors: WikiColorScheme = {
    primary: "#2e7d32",
    dark: "#1b5e20",
    light: "#43a047",
    tint: "#f1f8e9",
  };

  it("should render a narrative block", () => {
    const block: WikiBlock = { type: "narrative", content: "<p>Test content</p>" };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Test content");
    expect(html).toContain("wb-section");
  });

  it("should render a narrative block with indent", () => {
    const block: WikiBlock = { type: "narrative", content: "<p>Indented</p>" };
    const html = renderBlock(env, block, colors, true);
    expect(html).toContain("Indented");
    expect(html).toContain("wb-subsection");
  });

  it("should render a bullet-list block", () => {
    const block: WikiBlock = {
      type: "bullet-list",
      items: ["Item A", "Item B"],
      title: "My List",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Item A");
    expect(html).toContain("Item B");
    expect(html).toContain("My List");
    expect(html).toContain("<ul");
  });

  it("should render a numbered-list block", () => {
    const block: WikiBlock = {
      type: "numbered-list",
      items: ["Step 1", "Step 2"],
      title: "Steps",
      start: 3,
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Step 1");
    expect(html).toContain('start="3"');
    expect(html).toContain("<ol");
  });

  it("should render a data-table block", () => {
    const block: WikiBlock = {
      type: "data-table",
      headers: ["Name", "Status"],
      rows: [
        ["Auth", "Done"],
        ["Sync", "Pending"],
      ],
      caption: "Components",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Name");
    expect(html).toContain("Auth");
    expect(html).toContain("Components");
    expect(html).toContain("<table");
  });

  it("should render a callout block", () => {
    const block: WikiBlock = {
      type: "callout",
      variant: "warning",
      title: "Watch Out",
      content: "<p>Be careful</p>",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Watch Out");
    expect(html).toContain("Be careful");
    expect(html).toContain("#ff9800"); // warning border color
  });

  it("should render a key-value-pairs block", () => {
    const block: WikiBlock = {
      type: "key-value-pairs",
      pairs: [
        { label: "Owner", value: "Platform Team" },
        { label: "Status", value: "<strong>Active</strong>" },
      ],
      title: "Metadata",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Owner");
    expect(html).toContain("Platform Team");
    expect(html).toContain("Metadata");
  });

  it("should render a link-list block", () => {
    const block: WikiBlock = {
      type: "link-list",
      links: [{ text: "Page 1", url: "/wiki/page1", description: "First page" }],
      title: "Links",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Page 1");
    expect(html).toContain("/wiki/page1");
    expect(html).toContain("First page");
  });

  it("should render a code-block as raw markdown", () => {
    const block: WikiBlock = {
      type: "code-block",
      language: "typescript",
      code: "const x = 1;",
    };
    const result = renderBlock(env, block, colors, false);
    expect(result).toBe("```typescript\nconst x = 1;\n```");
  });

  it("should render a mermaid-diagram as raw markdown", () => {
    const block: WikiBlock = {
      type: "mermaid-diagram",
      chart: "graph TD\n  A --> B",
    };
    const result = renderBlock(env, block, colors, false);
    expect(result).toBe("::: mermaid\ngraph TD\n  A --> B\n:::");
  });

  it("should render a placeholder block", () => {
    const block: WikiBlock = {
      type: "placeholder",
      message: "Coming soon",
    };
    const html = renderBlock(env, block, colors, false);
    expect(html).toContain("Coming soon");
    expect(html).toContain("wb-placeholder");
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe("Validation", () => {
  const validSpec: WikiPageSpec = {
    title: "Test Page",
    id: "12345",
    timestamp: "2026-03-16",
    sections: [
      {
        heading: "Overview",
        emoji: "📋",
        color: "green",
        blocks: [{ type: "narrative", content: "<p>Hello</p>" }],
      },
    ],
  };

  it("should pass validation for a valid spec", () => {
    const result = validateWikiSpec(validSpec);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("should fail if title is missing", () => {
    const result = validateWikiSpec({ ...validSpec, title: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Page title is required");
  });

  it("should fail if id is missing", () => {
    const result = validateWikiSpec({ ...validSpec, id: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Page id is required");
  });

  it("should fail if timestamp is missing", () => {
    const result = validateWikiSpec({ ...validSpec, timestamp: "" });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Timestamp is required");
  });

  it("should fail if no sections", () => {
    const result = validateWikiSpec({ ...validSpec, sections: [] });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("At least one section is required");
  });

  it("should fail for invalid color name", () => {
    const spec: WikiPageSpec = {
      ...validSpec,
      sections: [
        {
          heading: "Bad Color",
          emoji: "",
          color: "neon" as never,
          blocks: [{ type: "narrative", content: "x" }],
        },
      ],
    };
    const result = validateWikiSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("invalid color");
  });

  it("should fail for empty section with no blocks or subsections", () => {
    const spec: WikiPageSpec = {
      ...validSpec,
      sections: [
        {
          heading: "Empty",
          emoji: "",
          color: "blue",
          blocks: [],
        },
      ],
    };
    const result = validateWikiSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("must have at least one block");
  });

  it("should fail for subsection with no blocks", () => {
    const spec: WikiPageSpec = {
      ...validSpec,
      sections: [
        {
          heading: "Parent",
          emoji: "",
          color: "blue",
          blocks: [],
          subsections: [
            {
              heading: "Empty Sub",
              emoji: "",
              blocks: [],
            },
          ],
        },
      ],
    };
    const result = validateWikiSpec(spec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("Empty Sub"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Page Rendering
// ---------------------------------------------------------------------------
describe("Page Rendering", () => {
  const spec: WikiPageSpec = {
    title: "Feature Overview",
    id: "12345",
    timestamp: "2026-03-16",
    sections: [
      {
        heading: "Summary",
        emoji: "📋",
        color: "green",
        blocks: [{ type: "narrative", content: "<p>This is the summary.</p>" }],
        subsections: [
          {
            heading: "Details",
            emoji: "📝",
            blocks: [{ type: "bullet-list", items: ["Detail A", "Detail B"] }],
          },
        ],
      },
      {
        heading: "Architecture",
        emoji: "🏗️",
        color: "blue",
        blocks: [
          {
            type: "data-table",
            headers: ["Component", "Type"],
            rows: [["Service A", "Apex"]],
          },
          { type: "code-block", language: "apex", code: "public class Test {}" },
        ],
      },
    ],
    footer_note: "Auto-generated",
  };

  it("should render a complete page successfully", () => {
    const result = renderWikiPage(spec);
    expect(result.success).toBe(true);
    expect(result.sections_rendered).toBe(2);
    expect(result.blocks_rendered).toBeGreaterThanOrEqual(4);
    expect(result.html_length).toBeGreaterThan(0);
  });

  it("should include [[_TOC_]] in the output", () => {
    const result = renderWikiPage(spec);
    expect(result.html).toContain("[[_TOC_]]");
  });

  it("should include markdown headings outside HTML", () => {
    const result = renderWikiPage(spec);
    expect(result.html).toContain("## 📋 Summary");
    expect(result.html).toContain("### 📝 Details");
    expect(result.html).toContain("## 🏗️ Architecture");
  });

  it("should include code blocks as raw markdown", () => {
    const result = renderWikiPage(spec);
    expect(result.html).toContain("```apex");
    expect(result.html).toContain("public class Test {}");
    expect(result.html).toContain("```");
  });

  it("should include the footer", () => {
    const result = renderWikiPage(spec);
    expect(result.html).toContain("Last Updated");
    expect(result.html).toContain("2026-03-16");
    expect(result.html).toContain("Auto-generated");
  });

  it("should inline CSS styles (no class-only elements in HTML parts)", () => {
    const result = renderWikiPage(spec);
    // The <style> block should be removed by juice
    expect(result.html).not.toContain("<style>");
    // Inline styles from CSS classes should be present (e.g. wb-section → border-radius)
    expect(result.html).toContain("border-radius");
    // Table styles should be inlined
    expect(result.html).toContain("border-collapse: collapse");
  });

  it("should return failure for an invalid spec", () => {
    const badSpec: WikiPageSpec = {
      title: "",
      id: "",
      timestamp: "",
      sections: [],
    };
    const result = renderWikiPage(badSpec);
    expect(result.success).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("should render status banner when provided", () => {
    const withBanner: WikiPageSpec = {
      ...spec,
      status_banner: "Draft — under review",
    };
    const result = renderWikiPage(withBanner);
    expect(result.html).toContain("Draft — under review");
  });
});

// ---------------------------------------------------------------------------
// Block Menu
// ---------------------------------------------------------------------------
describe("Block Menu", () => {
  it("should return all 10 block types", () => {
    const menu = getBlockMenu();
    expect(menu).toHaveLength(10);
    const types = menu.map((e) => e.type);
    expect(types).toContain("narrative");
    expect(types).toContain("data-table");
    expect(types).toContain("bullet-list");
    expect(types).toContain("numbered-list");
    expect(types).toContain("callout");
    expect(types).toContain("key-value-pairs");
    expect(types).toContain("link-list");
    expect(types).toContain("code-block");
    expect(types).toContain("mermaid-diagram");
    expect(types).toContain("placeholder");
  });

  it("should have examples for every block type", () => {
    const menu = getBlockMenu();
    for (const entry of menu) {
      expect(entry.example).toBeDefined();
      expect(entry.example["type"]).toBe(entry.type);
    }
  });

  it("should generate markdown format", () => {
    const md = getBlockMenuMarkdown();
    expect(md).toContain("# Wiki Block Menu");
    expect(md).toContain("## Color Palette");
    expect(md).toContain("## Available Blocks");
    expect(md).toContain("## Page Structure");
    expect(md).toContain("`narrative`");
    expect(md).toContain("`data-table`");
  });
});
