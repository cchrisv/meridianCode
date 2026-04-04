# Share – ADO Wiki

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado-wiki.md` (wiki create/update).

Wiki engine operations — block composition, rendering, content preservation.
References: `#file:config/platform-ado/share-ado.md` → `#file:config/core/share-core.md`
NEVER references Salesforce.

## Wiki Engine Workflow

1. `[CLI]` Get block menu → `{{cli.wiki_engine_block_menu}} --markdown`
2. `[GEN]` Compose WikiPageSpec JSON — select sections, colors, blocks
3. `[IO]` Save spec to temp file
4. `[CLI]` Validate → `{{cli.wiki_engine_validate}} --spec <file> --json`
5. `[CLI]` Render → `{{cli.wiki_engine_render}} --spec <file> --output <file> --json`
6. `[CLI]` Push → `{{cli.wiki_create}}` or `{{cli.wiki_update_by_id}}`

On validation/render failure: review errors, fix spec, retry. STOP after 2 failures.

## Color Palette (Semantic)

| Color  | Gradient (##)     | Gradient (###)    | Sections                                    |
| ------ | ----------------- | ----------------- | ------------------------------------------- |
| Green  | `#2e7d32→#1b5e20` | `#43a047→#2e7d32` | Summary, Overview, Goals, Value             |
| Blue   | `#1565c0→#0d47a1` | `#42a5f5→#1565c0` | Architecture, Design, Current State         |
| Purple | `#7b1fa2→#4a148c` | `#ab47bc→#7b1fa2` | Analysis, Research, Discovery, Requirements |
| Orange | `#e65100→#bf360c` | `#ef6c00→#e65100` | Issues, Warnings, Recommendations           |
| Red    | `#c62828→#b71c1c` | `#ef5350→#c62828` | Critical, Risks, Security, Blockers         |
| Indigo | `#303f9f→#1a237e` | `#5c6bc0→#303f9f` | Solution, Implementation, Technical         |
| Teal   | `#00796b→#004d40` | `#26a69a→#00796b` | Testing, Quality, Validation                |
| Brown  | `#5d4037→#3e2723` | `#795548→#5d4037` | Appendix, References, Changelog             |

**Rotation (no semantic match):** Green → Blue → Purple → Orange → Indigo → Teal → Brown → Red.

**Color assignment rules:**

1. Match section heading text to the semantic column first.
2. If no semantic match, assign colors in rotation order, skipping colors already used.
3. Never use the same color for two adjacent `##` sections.

## Content Inventory Pattern

Before and after rendering, count structural elements to verify no data loss:

- Number of `##` headings
- Number of `###` headings
- Number of paragraphs (non-empty text blocks)
- Number of list items (`-`, `*`, `1.`, `<li>`)
- Number of table rows (data rows, not headers)
- Number of code blocks (fenced or `<pre>`)
- Number of Mermaid diagrams
- Total character count of text content (stripped of formatting)

**Completeness check:** rebuilt counts must be >= original. Character count must be within 90–110% of original. If any count is LOWER → STOP. Re-read source, fix spec, re-validate, re-render.

## Wiki CLI Quick Reference

| Action             | Command                                                                   |
| ------------------ | ------------------------------------------------------------------------- |
| Get page (by path) | `{{cli.wiki_get}} --path "{{pagePath}}" --json`                           |
| Get page (by ID)   | `{{cli.wiki_get_by_id}} {{pageId}} --json`                                |
| Update (by path)   | `{{cli.wiki_update}} --path "{{pagePath}}" --content "{{file}}" --json`   |
| Update (by ID)     | `{{cli.wiki_update_by_id}} {{pageId}} --content "{{file}}" --json`        |
| Create page        | `{{cli.wiki_create}} --path "{{pagePath}}" --content "{{file}}" --json`   |
| Search wiki        | `{{cli.wiki_search}} "{{query}}" --json`                                  |
| List pages         | `{{cli.wiki_list}} [--path {{basePath}}] --json`                          |
| Delete page        | `{{cli.wiki_delete}} --path "{{pagePath}}" --force`                       |
| Block menu         | `{{cli.wiki_engine_block_menu}} [--markdown] [--json]`                    |
| Render spec        | `{{cli.wiki_engine_render}} --spec {{file}} [--output {{file}}] [--json]` |
| Validate spec      | `{{cli.wiki_engine_validate}} --spec {{file}} [--json]`                   |
| Get colors         | `{{cli.wiki_engine_colors}} [--json]`                                     |
