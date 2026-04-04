# Create Wiki Page (Block Engine)

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: Generate a new wiki page from provided content or context using the block-based wiki engine. Content is composed into a WikiPageSpec, validated, rendered, and pushed — never raw HTML.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-wiki.md`
Input: Content source (`{{work_item_id}}`, topic description, or raw content) + `{{wiki_path}}` (target wiki path) — both required.

## Constraints (STRICT)

- **CLI-only** – per util-base guardrails
- **Block-engine only** – NEVER generate raw HTML. All page content is composed via WikiPageSpec JSON → validate → render pipeline.
- **AI-driven composition** – the AI selects sections, colors, and blocks from the block menu to best represent the source content.
- **No metadata changes** – never modify existing wiki page metadata, titles, or paths outside the target page.
- **Source fidelity** – preserve all meaning, facts, and data from the source content. Fix typos, grammar, punctuation — never rewrite substance.
- **Never invent content** – only use data present in the source. Do not add sections, items, or details that do not exist in the input.

## Color Palette (Section Assignment — Semantic)

| Color  | Sections                                    |
| ------ | ------------------------------------------- |
| Green  | Summary, Overview, Goals, Value             |
| Blue   | Architecture, Design, Current State         |
| Purple | Analysis, Research, Discovery, Requirements |
| Indigo | Solution, Implementation, Technical         |
| Teal   | Testing, Quality, Validation                |
| Red    | Critical, Risks, Security, Blockers         |
| Orange | Issues, Warnings, Recommendations           |
| Brown  | Appendix, References, Changelog             |

Rotation (no semantic match): Green, Blue, Purple, Orange, Indigo, Teal, Brown, Red.

---

## Execution

### Step 1 [IO/CLI] – Load Config & Gather Content

A1 [IO]: Load `#file:core/config/shared.json` → extract `paths.*`, `cli_commands.*`
A2 [LOGIC]: Determine content source type:

- **Work item ID** → proceed to A3
- **Topic description** → use the description directly as source content; skip A3
- **Raw content** → use provided content directly as source content; skip A3
  A3 [CLI]: If work item ID provided:
  `{{cli.ado_get}} {{work_item_id}} --expand All --json`
  → extract title, description, acceptance criteria, and all relevant field content as source material
  A4 [IO]: Gather any additional context — existing docs, related wiki pages, or supplementary material provided by the user.

### Step 2 [CLI] – Get Block Menu

B1 [CLI]: `{{cli.wiki_engine_block_menu}} --markdown`
→ retrieve the full list of available blocks, their parameters, and usage. This is the palette for composing the page.
B2 [IO]: Review the block menu output — understand available block types, required fields, and optional parameters before composing.

### Step 3 [GEN] – Compose WikiPageSpec JSON

The AI composes a complete WikiPageSpec JSON by selecting sections, assigning colors, and choosing blocks that best represent the source content.

C1 [LOGIC]: Plan the page structure:

- Determine logical sections from the source content (e.g., Summary, Details, Requirements, Risks)
- Assign a color to each section using the semantic palette above
- Select appropriate blocks for each section's content (paragraphs, tables, lists, callouts, etc.)
  C2 [GEN]: Build the WikiPageSpec JSON:
- Page title derived from source (work item title, topic, or first heading)
- Sections ordered logically with semantic color assignments
- Blocks chosen to best represent each piece of content:
  - Prose → paragraph/content blocks
  - Structured data → table blocks
  - Key points → list blocks
  - Important notes → callout blocks
  - Status/labels → badge blocks
  - Metrics → progress or data blocks
- Preserve all source data — never drop content
  C3 [LOGIC]: **Content inventory check** — verify all source content is represented in the spec:
- Count substantive elements in the source (paragraphs, list items, table rows, key facts)
- Count corresponding elements in the spec
- If the spec contains **fewer items** than the source, **STOP** — re-examine and fill missing data
- Log: `"Source: X paragraphs, Y list items, Z table rows → Spec: A blocks, B list items, C table rows"`

### Step 4 [IO/CLI] – Save & Validate Spec

D1 [IO]: Save the WikiPageSpec JSON to a temp file (e.g., `.temp/wiki-spec-<name>.json`)
D2 [CLI]: `{{cli.wiki_engine_validate}} --spec <file> --json`
→ confirm spec is structurally valid, all required fields present, block types recognized
D3 [LOGIC]: If validation fails → review errors, fix the spec, re-save, re-validate. **STOP** after 2 failures.

### Step 5 [CLI] – Render

E1 [CLI]: `{{cli.wiki_engine_render}} --spec <file> --output <rendered_file> --json`
→ produce the final rendered wiki page content from the validated spec
E2 [LOGIC]: If render fails → review errors, fix the spec, re-validate, re-render. **STOP** after 2 failures.

### Step 6 [CLI] – Push to Wiki

F1 [CLI]: `{{cli.wiki_create}} --path {{wiki_path}} --content <rendered_file> --json`
→ create the new wiki page at the specified path

On error: log error; retry once; **STOP** on second failure.

### Step 7 [CLI] – Verify

G1 [CLI]: `{{cli.wiki_get}} --path {{wiki_path}} --no-content --json`
→ confirm the page was created successfully at the target path
G2 [LOGIC]: Verify the page exists and report the page ID and path.
