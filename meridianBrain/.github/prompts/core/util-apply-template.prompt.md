# Apply Template (Full Replacement)

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: Extract content from ADO work item fields and render it through the template engine, fully replacing the existing HTML. The current field content is treated as a **data source only** — all formatting is discarded and rebuilt from scratch via the template.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-update.md` · `#file:shared/standards/refinement-standards.md`
Input: `{{work_item_id}}` — required. (For wiki pages, use `/util-wiki-create` or `/util-wiki-update` instead.)

## Constraints (STRICT)

- **Full overwrite** – every field is completely replaced with freshly rendered template output. Do NOT patch, merge, or preserve any existing HTML/formatting — only the extracted data is kept.
- **Content preservation** – preserve all meaning, facts, data. Never invent new content.
- **Light copy-editing only** – fix typos, grammar, punctuation during extraction. Never rewrite substance.
- **No metadata changes** – never modify Title, Tags, State, WorkClassType.
- **Empty = skip** – if field/section has no substantive content, skip it entirely (do not render an empty template).
- **Never add** AC, goals, assumptions, scope items that don't exist in the current content.
- **CLI-only** – per util-base guardrails
- **Template-engine only** – NEVER generate raw HTML for ADO fields. Use `template-tools scaffold` → fill JSON slots → `template-tools render` → `template-tools validate` pipeline.
- **Requirement-type aware** – for `User Story`, select functional vs technical templates before scaffolding. Never force a technical ticket into functional templates or vice versa.
- **Ambiguity = preserve** – if a `User Story` cannot be confidently classified as functional or technical from stored context or current field structure, skip template conversion for Description and AC rather than risking a semantic rewrite.

## Prerequisites [IO]

A1 [IO]: Load `#file:core/config/shared.json` → extract `paths.*`, `cli_commands.*`, `template_files.*`, `field_paths.*`, `requirement_types`

## Work Item Field Templates

Template keys for `template-tools scaffold` (registered in `{{paths.templates}}/template-registry.json`):

| Type                      | Fields → Template Keys                                                                                                                                                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| User Story (`functional`) | Description → `{{template_files.field_user_story_description}}` · AC → `{{template_files.field_user_story_acceptance_criteria}}`                                                                                                                 |
| User Story (`technical`)  | Description → `{{template_files.field_technical_description}}` · AC → `{{template_files.field_technical_acceptance_criteria}}`                                                                                                                   |
| Bug/Defect                | Description → `{{template_files.field_bug_description}}` · Repro → `{{template_files.field_bug_repro_steps}}` · SysInfo → `{{template_files.field_bug_system_info}}` · AC → `{{template_files.field_bug_acceptance_criteria}}`                   |
| Feature                   | Description → `{{template_files.field_feature_description}}` · BV → `{{template_files.field_feature_business_value}}` · Objectives → `{{template_files.field_feature_objectives}}` · AC → `{{template_files.field_feature_acceptance_criteria}}` |
| All types                 | DevelopmentSummary → `{{template_files.field_solution_design}}` · ReleaseNotes → `{{template_files.field_release_notes}}`                                                                                                                        |

## Requirement Type Detection (User Story Only)

Determine `requirement_type` before choosing templates:

1. **Preferred source** — if workflow context exists and `grooming.classification.requirement_type` is present, use it.
2. **Fallback: current Description/AC structure**
   - `functional` signals:
     - Modern: sections **What / Why / Unknowns** (or plain-language equivalents) and **Done When** bullet-style assertions
     - Legacy: User Story `As a / I want / so that`, or Summary / Goals / Assumptions tables
     - Assertions or Then-style outcomes describe user-visible behavior, messages, records, pages, or navigation
   - `technical` signals:
     - Modern: **What / Why / Unknowns** with system-scoped WHAT; **Done When** with measurable outcomes
     - Legacy: Summary, Business Justification, Goals & Success Criteria, Constraints & Dependencies
     - Assertions describe thresholds, response codes, log outcomes, compatibility, batch behavior, retries, or data states
3. **Do not infer aggressively** — if signals are mixed or weak, preserve the current content and skip conversion for User Story Description and AC. Log the ambiguity instead of re-templating the ticket incorrectly.

---

## Execution

### Step 1 [IO/CLI] – Fetch, Backup & Detect

A1 [IO]: Load `#file:core/config/shared.json`
A2 [CLI]: `{{cli.workflow_status}} -w {{work_item_id}} --json`
A3 [IO]: If workflow context exists, load it and read `grooming.classification.requirement_type` when present.
A4 [CLI]: `{{cli.ado_get}} {{work_item_id}} --expand All --json`
A5 [IO]: **BACKUP** — save the raw JSON response (or at minimum, all field values being re-templated) to `.temp/{{work_item_id}}-backup.json`. This is the recovery source if content is lost.
A6 [LOGIC]: Extract `System.WorkItemType` → select template set from table above → **STOP** if unsupported type. Note: ADO returns `"Defect"` for defect work items — this maps to the **Bug/Defect** row in the template table above.
A7 [LOGIC]: Extract current content for each mapped field (Description, AC, DevelopmentSummary, etc.)
A8 [LOGIC]: If `System.WorkItemType = User Story`, determine `requirement_type` using the detection rules above.
A9 [LOGIC]: Determine which template keys apply for the detected type (from table above) and, for `User Story`, the detected `requirement_type`. Templates are rendered by the CLI — do NOT read or modify template files directly.

### Step 2 [CLI/GEN] – Scaffold & Fill

The goal is to extract all data from the current field content (regardless of its current formatting) and pack it into template slots. The existing HTML structure is irrelevant — only the data matters. The template engine will produce entirely new HTML.

Per field with existing content:
B1 [CLI]: `{{cli.template_scaffold}} --template <template_key> --json` → get fill spec with slot shapes
B2 [GEN]: Strip away all HTML formatting and extract the raw text/data from the current field content. Map it into the fill spec JSON slots:

- Fix typos, grammar, punctuation during extraction — never rewrite substance
- Preserve all data (IDs, error messages, GWT clauses, steps, numbers, names)
- Same item count — never add/remove items, rows, or scenarios
- **Preserve hyperlinks** — when extracting to `text` slots, convert `<a href="url">label</a>` to Markdown `[label](url)` so the URL is not lost; for `html` slots, retain the `<a>` tag as-is
- Fill `text` slots with plain text (no HTML, except Markdown hyperlinks as noted above); `html` slots with pre-sanitized HTML content
- Fill `list` items, `table` rows, `repeatable_block` blocks matching current content
- For functional and technical User Story **AC** templates (`field-user-story-acceptance-criteria` / `field-technical-acceptance-criteria`), map into **`done_when_items.blocks[]`**: each assertion = one block with `assertion` text; use `group_label` when the source has subheadings (e.g. Expected behavior, Error handling, Boundaries). If the source is legacy GWT, convert each scenario into one or more plain assertions without losing meaning — preserve counts of distinct test ideas (inventory check). If the source already has Done When / bullet assertions, map 1:1.
- For technical User Story **Description**, map into `what_text`, `why_text`, optional `unknowns.items[]` (merge former constraints/dependencies/goals prose into WHY or DONE WHEN as appropriate without dropping facts).
- For functional User Story **Description**, map into `what_text`, `why_text`, optional `unknowns.items[]` (merge goals, assumptions, constraints, out-of-scope into WHAT/WHY/DONE WHEN per meaning — do not drop boundaries).
- For Feature Description (`field-feature-description`), map content to these slots:
  - `feature_summary` → the **full narrative paragraph** from the Summary section body (multi-sentence description of scope/purpose/context — this is NOT the work item title)
  - `persona` / `high_level_capability` / `strategic_business_outcome` → the three clauses from the User Story section ("As a… / I want to… / so that…")
  - `value_items` → repeatable blocks from the Goals & Business Value section, each with `category` (label before the colon) and `description` (text after the colon)
  - `business_assumptions` → list items from the Business Assumptions section
- For Feature Business Value (`field-feature-business-value`), map `value_items` blocks with `category` and `description` from the value statement content.
- For Feature Objectives (`field-feature-objectives`), map `objectives` blocks with `title` and `description` from each objective entry.
- For Feature AC (`field-feature-acceptance-criteria`), map `success_indicators` blocks with `title`, `given`, `when`, `then` from each GWT success indicator.
- **If the current content doesn't match the template structure** (e.g., plain text with no sections, or a completely different layout), still extract whatever data is present and map it to the closest matching slots. Empty slots are fine — the template handles them gracefully.
  B3 [LOGIC]: **Content inventory check** — before saving, verify no data was dropped:
- Count the substantive text elements in the original field (paragraphs, list items, table rows, GWT clauses, headings with content)
- Count the data items in the filled slots (non-empty text values, list items, table rows, block entries)
- If the filled slots contain **fewer items** than the original content, **STOP** — re-examine the original and fill the missing data. Do NOT proceed with a lossy fill.
- Log the inventory: `"Original: X paragraphs, Y list items, Z table rows → Filled: A text slots, B list items, C table rows"`
  B4 [IO]: Save filled spec to temp file (e.g., `.temp/{{work_item_id}}-<field>-filled.json`)

Skip fields with no substantive content (empty or whitespace-only).

### Step 3 [CLI] – Render, Validate & Overwrite

Per filled field:
C1 [CLI]: `{{cli.template_render}} --template <template_key> --data "<filled_spec_file>" --output "<rendered_file>" --json` → fresh rendered HTML from template engine
C2 [CLI]: `{{cli.template_validate}} --template <template_key> --rendered "<rendered_file>" --json` → confirm no unfilled tokens, gradients intact
C3 [LOGIC]: If validation fails → review fill spec, fix, re-render. **STOP** after 2 failures.

After all fields rendered and validated:
C4 [LOGIC]: **Completeness check** — for each rendered field, compare text content length against the original field content (from the backup in A5). If the rendered output has significantly less text content (below 80% of original character count, excluding HTML tags), **STOP** — the fill spec likely dropped data. Re-examine the backup and fix before proceeding.
C5 [IO]: Build JSON payload — `{ "<field_path>": "<rendered_html>", ... }` for each field

- Use `{{field_paths.*}}` for ADO field paths (e.g., `{{field_paths.description}}`, `{{field_paths.acceptance_criteria}}`)
- Each value is the **complete** rendered HTML — the ADO update replaces the entire field content
  C6 [IO]: Save payload to temp `.json` file
  C7 [CLI]: `{{cli.ado_update}} {{work_item_id}} --fields-file "<temp_file>" --json`
  C8 [LOGIC]: Extract `System.Rev` from the update response. Compare to the revision in the backup (A5). If `System.Rev` **did not increase**, STOP immediately — log: "ADO update did not persist (revision unchanged). The rendered content may be identical to the existing field, or the update failed silently."

On error: log error; retry once; **STOP** on second failure.

### Step 4 [CLI] – Verify

D1 [CLI]: `{{cli.ado_get}} {{work_item_id}} --fields "System.Description,Microsoft.VSTS.Common.AcceptanceCriteria" --json`
D2 [LOGIC]: Perform an explicit before-after verification — do NOT rely on visual inspection alone:

1. **Revision check** — Verify `System.Rev` from D1 is greater than the revision recorded in the backup (A5). If equal, STOP: "Fields do not appear to have been updated (revision unchanged after D1 re-fetch)."
2. **Template signature check** — For each re-templated field, confirm the CSS pattern `linear-gradient` is present in the fetched content. If absent for a field, flag it as not templated.
3. **Character count report** — For each field, report: `"[FieldName]: before=<chars from backup> → after=<chars from D1>"`. A significant increase is expected (template HTML is larger than unformatted content). If after ≤ before for a given field, flag it as suspicious.
4. If any field fails checks 1–3, STOP and report specifically which fields were not updated so the user can investigate.
