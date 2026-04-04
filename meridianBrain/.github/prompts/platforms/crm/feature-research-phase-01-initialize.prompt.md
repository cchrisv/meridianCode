# Feature Research Phase 01 – Initialize

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Research Coordinator
Mission: Resolve flexible input (SF object names, ADO work item ID, or both), validate auth, establish research scope.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md`
Input: `{{sf_entry}}` (SF object API names or feature area) and/or `{{work_item_id}}` (ADO Feature/Epic ID)

## Constraints

- **Read-only** – NO ADO/wiki modifications
- **CLI-only** – per util-base guardrails
- **At least one input required** – `{{sf_entry}}` or `{{work_item_id}}`; **ASK** if neither provided
- **Idempotent** – if `{{context_file}}` exists, load and report status; continue only with `--force`
- **Mission-first** – the scope you establish here is the mission anchor for ALL subsequent phases; make `feature_area` and `domain_keywords` descriptive enough that a new agent session can immediately understand what is being researched and why

## Context Paths

`{{research_root}}` = `{{paths.artifacts_root}}/sf-research/{{sanitized_name}}`
`{{context_file}}` = `{{research_root}}/research-context.json` (SINGLE SOURCE OF TRUTH)

`{{sanitized_name}}` = lowercase, hyphenated version of the feature area or primary object name (e.g., `journey-pipeline`, `case-management`)

## Context Structure

```json
{
  "metadata": {
    "research_name": "",
    "sf_entry": "",
    "work_item_id": null,
    "created_at": "",
    "last_updated": "",
    "current_phase": "initialize",
    "phases_completed": [],
    "version": "1.0"
  },
  "run_state": { "completed_steps": [], "errors": [] },
  "scope": {
    "sf_objects": [],
    "feature_area": "",
    "research_purpose": "",
    "related_ado_items": [],
    "domain_keywords": []
  },
  "ado_research": {},
  "sf_schema": {},
  "sf_automation": {},
  "sf_architecture": {},
  "sf_platform": {},
  "synthesis": { "unified_truth": {}, "assumptions": [], "conflict_log": [] },
  "documentation": { "wiki_path": "", "published_at": "" }
}
```

**Valid `current_phase` values:** `initialize` · `ado_discovery` · `sf_schema` · `sf_automation` · `sf_architecture` · `sf_platform` · `documentation` · `complete`

---

## Execution

### Step 1 [LOGIC] – Parse Input

A1 [LOGIC]: Determine input mode:

- **Mode A** – `{{sf_entry}}` only (SF object names or feature area)
- **Mode B** – `{{work_item_id}}` only (ADO Feature/Epic ID)
- **Mode C** – both provided (maximum cross-referencing)
- **No input** → **ASK** user for at least one input. **STOP**.

### Step 2 [CLI] – Validate Auth & Org Resolution

B1 [CLI]: Verify ADO auth: `{{cli.ado_search}} --text "test" --top 1 --json`

- Failure → **STOP**: "Run `az login` first."
  B2 [LOGIC]: **Salesforce Org Resolution** — orgs are resolved automatically from `config/sf-orgs.json` (configured via `crm-tools org-setup`).
  Each crm-tools command uses `--role <role>` to target the correct org:
- SOQL queries → `--role modernData`
- Metadata/describe → `--role modernMetadata`
- General/unspecified → `--role primary` (or omit for default)
  Resolution chain: explicit `--org` > role config > designation fallback > primary > SF CLI default.
  If config missing or connection fails → ask user which org, suggest running `npx --prefix scripts/workflow crm-tools org-setup`.
  B3 [CLI]: Verify SF auth: `{{cli.sf_query}} "SELECT Id FROM Organization LIMIT 1" --role primary --json`
- Failure → **STOP**: "Run `sf org login web` first."

### Step 3 [CLI/GEN] – Resolve Scope (by input mode)

#### Mode A – SF Entry Only

C1 [CLI]: For each object name in `{{sf_entry}}`:

- `{{cli.sf_describe}} {{object}} --fields-only --role modernMetadata --json` → validate object exists
- On failure: log to errors, continue with remaining objects
  C2 [CLI]: `{{cli.ado_search}} --text "{{sf_entry}}" --top 20 --json` → find related ADO work items
  C3 [CLI]: `{{cli.ado_search}} --tags "{{sf_entry}}" --top 10 --json` → tag-based search
  C4 [GEN]: From search results, extract Feature/Epic/User Story IDs with relevance classification:
- **direct** – title or SF Components field references the object
- **contextual** – description mentions the feature area
- **tangential** – loose keyword match only
- Keep direct + contextual; discard tangential
  C5 [GEN]: Build `scope.sf_objects[]` from validated objects; `scope.related_ado_items[]` from C4; extract `scope.domain_keywords[]` from object names + search result titles

#### Mode B – ADO Work Item Only

D1 [CLI]: `{{cli.ado_get}} {{work_item_id}} --expand Relations --json`

- Validate type is Feature or Epic; warn (do not stop) if other type
  D2 [GEN]: Extract SF object references from:
- `{{field_paths.sf_components}}` field (primary source)
- `{{field_paths.description}}` (scan for `__c` patterns, object API names)
- `{{field_paths.technical_notes}}` (scan for SF references)
- `System.Tags` (scan for SF object names)
  D3 [CLI]: For each extracted object name:
- `{{cli.sf_describe}} {{object}} --fields-only --role modernMetadata --json` → validate object exists in org
- On failure: log as potential reference, continue
  D4 [CLI]: `{{cli.wiki_search}} "{{title_from_D1}}" --json` → find related wiki pages for additional SF references (use title extracted from D1 result)
  D5 [GEN]: Extract additional SF object names from wiki search result highlights
  D6 [GEN]: Build `scope.sf_objects[]` from validated objects; `scope.related_ado_items[]` starting with input ID + child IDs from relations; extract `scope.domain_keywords[]` from title + description + object names

#### Mode C – Both Provided

E1: Execute Mode A steps (C1–C5) for SF validation
E2: Execute Mode B steps (D1–D6) for ADO context
E3 [GEN]: Merge and deduplicate scope from both modes; cross-validate SF objects found in ADO match those validated against the org

### Step 4 [GEN] – Finalize Scope (Mission Anchor)

This step establishes the **mission anchor** — the grounding context that all subsequent phases will load to stay focused on what is being researched.

F1 [GEN]: Generate `scope.feature_area` — a clear, human-readable name for this research (e.g., "Journey Pipeline", "Case Management"). This name will appear in every phase's mission recall.
F2 [GEN]: Generate `scope.research_purpose` — a 1–2 sentence statement explaining **what** we are documenting and **why** (e.g., "Document the Journey Pipeline feature's current implementation, data model, automation, and integrations"). This becomes the north star for all phases.
F3 [GEN]: Deduplicate `scope.sf_objects[]`, `scope.related_ado_items[]`, `scope.domain_keywords[]`
F4 [GEN]: Ensure `scope.domain_keywords[]` includes both technical terms (API names) and business terms (feature labels, business process names) — later phases use these for relevance filtering
F5 [LOGIC]: Validate scope is non-empty:

- `scope.sf_objects` must have ≥1 entry → if empty, **STOP**: "No valid SF objects found. Verify object names or provide an ADO work item with SF component references."

### Step 5 [IO] – Create Context File

G1 [IO]: Create directory `{{research_root}}`
G2 [IO]: Write `{{context_file}}` with:

- `metadata`: research_name, sf_entry, work_item_id, created_at = ISO now, current_phase = "initialize", phases_completed = []
- `scope`: from Step 4
- All other sections: empty objects
  G3 [IO]: Save to disk — **GATE: confirm written**

### Step 6 [IO] – Complete Phase

H1 [IO]: Update `{{context_file}}`:

- `metadata.phases_completed` append `"initialize"`
- `metadata.current_phase` = `"ado_discovery"`
- `metadata.last_updated` = ISO timestamp
- Append `{"phase":"initialize","step":"complete","completedAt":"<ISO>","artifact":"{{context_file}}"}` to `run_state.completed_steps[]`
  H2 [IO]: Save to disk — **GATE: confirm written**

### Step 7 [GEN] – Report

Present to user:

```
## Feature Research Initialized

**Research:** {{scope.feature_area}}
**SF Objects:** {{scope.sf_objects | join(", ")}}
**Related ADO Items:** {{count}} items found
**Domain Keywords:** {{scope.domain_keywords | join(", ")}}
**Context File:** {{context_file}}

**Scope established. Use `/feature-research-phase-02` for ADO discovery.**
```

---

## Error Handling

| Scenario                             | Action                                                    |
| ------------------------------------ | --------------------------------------------------------- |
| No input provided                    | **ASK** for `{{sf_entry}}` or `{{work_item_id}}`          |
| ADO auth failure                     | **STOP** — "Run `az login` first"                         |
| SF auth failure                      | **STOP** — "Run `sf org login web` first"                 |
| SF object not found                  | Log warning; continue with remaining objects              |
| No valid SF objects after resolution | **STOP** — inform user, suggest checking object API names |
| ADO work item not found              | **STOP** — inform user, verify work item ID               |
| Context file already exists          | Report existing scope; **STOP** unless `--force`          |
