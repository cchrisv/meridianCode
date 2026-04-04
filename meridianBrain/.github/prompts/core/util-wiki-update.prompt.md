# Util – Wiki Update (Block Engine)

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: Reformat/update an existing wiki page using the block-based wiki engine, preserving all content.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-wiki.md`
Input: `{{wiki_page_id}}` — wiki page ID required.

## Constraints (STRICT)

- **CLI-only** – per util-base guardrails
- **Block-engine only** – all rendering goes through the wiki engine block pipeline (`block_menu` → `validate` → `render`). NEVER generate raw HTML manually.
- **Content preservation** – preserve all meaning, facts, data. Never add or remove content.
- **Full overwrite** – the entire page is replaced with freshly rendered output. Do NOT patch, merge, or preserve existing formatting — only the extracted data is kept.
- **Completeness checks** – every step that produces output is verified against the original content inventory. If any count is LOWER, STOP and fix before proceeding.
- **Light copy-editing only** – fix typos, grammar, punctuation during extraction. Never rewrite substance.

## Color Palette (Wiki — semantic)

| Color  | ## gradient       | ### gradient      | Sections                            |
| ------ | ----------------- | ----------------- | ----------------------------------- |
| Green  | `#2e7d32→#1b5e20` | `#43a047→#2e7d32` | Summary, Overview, Goals            |
| Blue   | `#1565c0→#0d47a1` | `#42a5f5→#1565c0` | Architecture, Design, Current State |
| Purple | `#7b1fa2→#4a148c` | `#ab47bc→#7b1fa2` | Analysis, Research, Discovery       |
| Orange | `#e65100→#bf360c` | `#ef6c00→#e65100` | Issues, Warnings, Recommendations   |
| Red    | `#c62828→#b71c1c` | `#ef5350→#c62828` | Critical, Risks, Security, Blockers |
| Indigo | `#303f9f→#1a237e` | `#5c6bc0→#303f9f` | Solution, Implementation, Technical |
| Teal   | `#00796b→#004d40` | `#26a69a→#00796b` | Testing, Quality, Validation        |
| Brown  | `#5d4037→#3e2723` | `#795548→#5d4037` | Appendix, References, Changelog     |

Rotation (no semantic match): Green, Blue, Purple, Orange, Indigo, Teal, Brown, Red.

**Color assignment rules:**

1. Match section heading text to the semantic column first.
2. If no semantic match, assign colors in rotation order, skipping colors already used.
3. Never use the same color for two adjacent `##` sections.

---

## Execution

### Step 1 [IO/CLI] – Load & Fetch

A1 [IO]: Load `#file:core/config/shared.json` → extract `paths.*`, `cli_commands.*`
A2 [CLI]: `{{cli.wiki_get_by_id}} {{wiki_page_id}} --json` → extract path, id, content. **STOP** if page not found.

### Step 2 [IO] – Backup

B1 [IO]: Save the full page content (raw markdown/HTML body) to `.temp/wiki-{{wiki_page_id}}-backup.md`. This is the recovery source if content is lost.

### Step 3 [LOGIC] – Content Inventory

C1 [LOGIC]: Count structural elements in the original page:

- Number of `##` headings
- Number of `###` headings
- Number of paragraphs (non-empty text blocks)
- Number of list items (`-`, `*`, `1.`, `<li>`)
- Number of table rows (data rows, not headers — `<tr>` or `|...|` markdown rows)
- Number of code blocks (fenced or `<pre>`)
- Number of Mermaid diagrams
- Total character count of text content (stripped of HTML/markdown formatting)
  C2 [IO]: Log the inventory: `"Original: X ## headings, Y ### headings, Z paragraphs, W list items, V table rows, U code blocks, T mermaid diagrams, S total chars"`

### Step 4 [CLI] – Get Block Menu

D1 [CLI]: `{{cli.wiki_engine_block_menu}} --markdown` → retrieve available block types and their specs.

### Step 5 [GEN] – Extract Content & Compose WikiPageSpec

E1 [GEN]: Extract all content from the existing page — strip all HTML/markdown formatting to get raw text and data.
E2 [GEN]: Fix typos, grammar, punctuation during extraction — never rewrite substance.
E3 [GEN]: Compose a `WikiPageSpec` JSON object:

- Select sections, colors, and block types that best represent the existing content structure.
- Assign colors using the Color Palette rules above (semantic match first, then rotation).
- Map extracted content into the appropriate block fields.
- Preserve all data: headings, paragraphs, list items, table rows, code blocks, Mermaid diagrams.
- Same item count — never add or remove items, rows, scenarios, or sections.
- Preserve `[[_TOC_]]` directives.
- Preserve Mermaid diagram content (the graph definitions, not the surrounding formatting).
  E4 [IO]: Save spec to `.temp/wiki-{{wiki_page_id}}-spec.json`

### Step 6 [CLI] – Validate Spec

F1 [CLI]: `{{cli.wiki_engine_validate}} --spec .temp/wiki-{{wiki_page_id}}-spec.json --json`
F2 [LOGIC]: If validation fails → review spec, fix errors, re-validate. **STOP** after 2 failures.

### Step 7 [CLI] – Render

G1 [CLI]: `{{cli.wiki_engine_render}} --spec .temp/wiki-{{wiki_page_id}}-spec.json --output .temp/wiki-{{wiki_page_id}}-rendered.md --json`
G2 [LOGIC]: If render fails → review spec, fix errors, re-render. **STOP** after 2 failures.

### Step 8 [LOGIC] – Completeness Check

H1 [LOGIC]: Count structural elements in the rendered output (same categories as Step 3).
H2 [LOGIC]: Compare rebuilt vs original inventory:

- `##` headings: must be >= original count
- `###` headings: must be >= original count
- Paragraphs: must be >= original count
- List items: must be >= original count
- Table rows: must be >= original count
- Code blocks: must equal original count
- Mermaid diagrams: must equal original count
- Total text character count: must be within 90–110% of original
  H3 [LOGIC]: **If any count is LOWER than the original, STOP.** Re-read the backup file (`.temp/wiki-{{wiki_page_id}}-backup.md`), identify the missing content, fix the spec, re-validate, re-render, and re-check. Do NOT proceed with a page that has less content than the original.
  H4 [IO]: Log comparison: `"Original: X ## headings, Y ### headings, ... → Rebuilt: ..."`

### Step 9 [CLI] – Push

I1 [CLI]: `{{cli.wiki_update_by_id}} {{wiki_page_id}} --content .temp/wiki-{{wiki_page_id}}-rendered.md --comment "Reformat: wiki engine rebuild" --json`

On error: log error; retry once; **STOP** on second failure.

### Step 10 [CLI] – Verify

J1 [CLI]: `{{cli.wiki_get_by_id}} {{wiki_page_id}} --no-content --json` — confirm page exists and was updated successfully.

## Completion [GEN]

Tell user: **"Wiki page {{wiki_page_id}} reformatted via block engine. Backup saved to `.temp/wiki-{{wiki_page_id}}-backup.md`."**
