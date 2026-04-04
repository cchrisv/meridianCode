# Feature Research Phase 02 – ADO Discovery

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Business Research Coordinator
Mission: Gather all ADO work item context and wiki documentation related to the Salesforce feature area.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md` · `#file:platforms/crm/knowledge/share-salesforce.md`
Input: Context from `{{context_file}}` — `scope.sf_objects[]`, `scope.related_ado_items[]`, `scope.domain_keywords[]`

## Constraints

- **Read-only** – NO ADO/wiki modifications
- **CLI-only** – per util-base guardrails
- **Mission-focused** – every search query, relevance classification, and judgment must be filtered through the lens of `{{scope.feature_area}}`; discard noise that doesn't serve the research mission
- **Outputs to** `{{context_file}}.ado_research` + extends `.synthesis`
- **All streams mandatory** – parallel/batch when beneficial
- **Feedback loops** – max 3 iterations/stream
- **Comment mining** – use taxonomy from util-research-base

## After Each Stream (MANDATORY — do NOT batch)

**MUST write to disk before starting next stream.** This ensures resumability if context is lost.
Stream sections: Stream 1 → `ado_research.work_items` + `.comment_summaries` + `.related_context`, Stream 2 → `ado_research.wiki_pages`, Stream 3 → `ado_research.business_context` + `synthesis`

1. [IO] Write `{{context_file}}.ado_research.[stream_section]` → save to disk
2. [GEN] Update `{{context_file}}.synthesis` + `.synthesis.assumptions[]` with new evidence
3. [IO] Append to `{{context_file}}.run_state.completed_steps[]`
4. [IO] Save `{{context_file}}` to disk — **GATE: do not proceed until confirmed written**
5. On error: log to `run_state.errors[]`; save to disk; continue

## Context Paths

`{{research_root}}` = `{{paths.artifacts_root}}/sf-research/{{sanitized_name}}`
`{{context_file}}` = `{{research_root}}/research-context.json`

## Prerequisites [IO]

A1 [IO]: Load `{{context_file}}`; verify:

- `"initialize"` in `metadata.phases_completed`
- `scope.sf_objects` has ≥1 entry
- `scope.domain_keywords` is populated
  A2 [IO]: Load `scope.related_ado_items[]` and `scope.domain_keywords[]`
  A3: **STOP** if prerequisites missing. Log to `run_state.errors[]` and save.

## Mission Anchor [IO/GEN]

**Before any research begins, ground yourself in the mission.**

MA1 [IO]: From `{{context_file}}`, read and internalize:

- `scope.feature_area` — **what** we are researching
- `scope.research_purpose` — **why** we are researching it
- `scope.sf_objects[]` — the Salesforce objects in scope
- `scope.domain_keywords[]` — domain terms for relevance filtering
- `synthesis.unified_truth` — what has been learned so far (empty or minimal at this point)

MA2 [GEN]: State the mission in one sentence to yourself: _"I am researching **{{scope.feature_area}}** to gather all ADO work item context and wiki documentation that describes or influences the {{scope.sf_objects | join(", ")}} functionality. My purpose: {{scope.research_purpose}}"_

MA3: **Carry this mission context as your lens for EVERY decision in this phase.** When classifying search results as relevant/contextual/noise, when mining comments for decisions, when evaluating wiki pages — ask: _"Does this relate to {{scope.feature_area}} and the in-scope objects?"_

---

## ADO Research Schema

All outputs to `{{context_file}}.ado_research`:

- `work_items[]` — `{ id, title, type, state, description_summary, sf_references[], relevance }`
- `comment_summaries[]` — `{ work_item_id, classified_comments[], key_decisions[], open_questions[] }`
- `related_context` — `{ parents[], children[], siblings[] }`
- `wiki_pages[]` — `{ pageId, path, summary, sf_references[], architecture_notes[], business_rules[] }`
- `business_context` — `{ feature_purpose, business_rules[], stakeholders[], requirements[], decisions[] }`

---

## Stream 1 [CLI/GEN] – Work Item Discovery

**Goal:** Fetch and analyze all ADO work items related to **{{scope.feature_area}}** → `{{context_file}}.ado_research.work_items` + `.comment_summaries` + `.related_context`

### Primary Items

B1 [CLI]: For each ID in `scope.related_ado_items[]`:

- `{{cli.ado_get}} {{item_id}} --expand Relations --json`
- Extract: title, type, state, description, acceptance_criteria, tags, `{{field_paths.sf_components}}`, `{{field_paths.business_problem_and_value}}`, `{{field_paths.business_objectives_and_impact}}`
  B2 [CLI]: For each ID in `scope.related_ado_items[]`:
- `{{cli.ado_get}} {{item_id}} --comments --json`

### Comment Mining

B3 [GEN]: For each work item's comments, classify using util-research-base taxonomy:

- Scan for decision signals: "decided to", "agreed that", "approved", "going with"
- Scan for meeting/transcript signals: "meeting notes", "transcript", "action items"
- Scan for requirement changes: "changed to", "new requirement", "descoped", "added scope"
- Scan for blockers: "blocked by", "waiting on", "dependency on"
- Classify each as: `decision` | `meeting_transcript` | `requirement_change` | `blocker` | `question` | `status_update` | `general`
- Store → `ado_research.comment_summaries[]`
  B4 [GEN]: Synthesize key decisions, open questions, and action items across all comments → `ado_research.business_context.decisions[]`

### Additional Search

B5 [CLI]: For each keyword in `scope.domain_keywords[]` (max 5):

- `{{cli.ado_search}} --text "{{keyword}}" --type "Feature" --top 10 --json`
- `{{cli.ado_search}} --text "{{keyword}}" --type "User Story" --top 10 --json`
  B6 [GEN]: Deduplicate results against `scope.related_ado_items[]`; classify new items by relevance:
- **direct** – title or SF Components references scope objects
- **contextual** – description discusses the feature area
- **noise** – discard
  B7 [GEN]: Add direct + contextual items to `ado_research.work_items[]`; optionally add IDs to `scope.related_ado_items[]`

### Relation Traversal

B8 [LOGIC]: For each primary work item, extract relation IDs:

- Parent: `System.LinkTypes.Hierarchy-Reverse`
- Children: `System.LinkTypes.Hierarchy-Forward`
- Related: `System.LinkTypes.Related`
  B9 [CLI]: Per parent (max 3): `{{cli.ado_get}} {{parent_id}} --json`
  B10 [CLI]: Per child (max 10): `{{cli.ado_get}} {{child_id}} --json`
  B11 [CLI]: Per sibling via parent's children (max 5): `{{cli.ado_get}} {{sibling_id}} --json`
  B12 [GEN]: Summarize each related item → `ado_research.related_context`
- Parents: `{ id, title, type, state, description_summary, relevance_to_feature }`
- Children: `{ id, title, type, state, sf_references[], relevance_to_feature }`
- Siblings: `{ id, title, type, relevance (high/medium/low) }` based on title/tag overlap

---

## Stream 2 [CLI/GEN] – Wiki Research

**Goal:** Search ADO Wiki for existing documentation about **{{scope.feature_area}}** and related architecture → `{{context_file}}.ado_research.wiki_pages`

### Search

C1 [IO]: Load keywords from `scope.domain_keywords[]` + `scope.sf_objects[]`
C2 [CLI]: For each SF object name: `{{cli.wiki_search}} "{{object_name}}" --json`
C3 [CLI]: For each domain keyword (max 3, distinct from object names): `{{cli.wiki_search}} "{{keyword}}" --json`

### Relevance Classification

C4 [GEN]: Review ALL returned results; classify each:

- **relevant** – directly about the feature/object (architecture, design, implementation)
- **contextual** – related system/integration/process documentation
- **noise** – unrelated keyword match
  C5 [GEN]: Deduplicate across queries by page path

### Content Retrieval

C6 [CLI]: For each relevant page: `{{cli.wiki_get}} --path "{{page_path}}" --no-content --json` → capture page ID
C7 [CLI]: For top relevant pages (max 10): `{{cli.wiki_get}} --path "{{page_path}}" --json` → read full content
C8 [GEN]: From each page, extract:

- SF object/field references
- Architecture patterns and design decisions
- Business rules and process descriptions
- Integration points and external system references
- Data flow descriptions
  C9 [GEN]: Store each page as `{ pageId, path, summary, sf_references[], architecture_notes[], business_rules[] }` → `ado_research.wiki_pages[]`

### Analysis

C10 [GEN]: Cross-reference wiki findings with work item data from Stream 1
C11 [GEN]: Identify documentation gaps — SF objects in scope with no wiki coverage
C12 [GEN]: Extract additional SF object names discovered in wiki pages; if new objects found, note as candidates for scope expansion (do NOT auto-expand — flag for user)

---

## Stream 3 [GEN] – Synthesis

**Goal:** Consolidate all ADO research into a cohesive business narrative for **{{scope.feature_area}}** and update rolling synthesis.

D1 [GEN]: Build `ado_research.business_context`:

- `feature_purpose` — clear statement of what this feature area does, derived from work items + wiki
- `business_rules[]` — rules extracted from wiki pages + work item descriptions
- `stakeholders[]` — people/teams mentioned in comments, assignments, wiki ownership
- `requirements[]` — requirement statements extracted from acceptance criteria and descriptions, including technical or non-functional requirements when those are the actual requirement signal
- `decisions[]` — consolidated from comment mining (Stream 1)

D2 [GEN]: Update `synthesis.unified_truth`:

- `what_exists` — summary of the feature area as documented in ADO + wiki
- `business_purpose` — why this feature exists, who it serves
- `known_history` — key decisions, requirement changes, evolution over time
- `documentation_coverage` — summary of existing documentation found in ADO and wiki
- `scope_expansion_candidates[]` — additional SF objects found in wiki that may need investigation

D3 [GEN]: Update `synthesis.assumptions[]`:

- `{ id, assumption, category, confidence (high/medium/low), source (ado|wiki|inferred) }`

---

## Completion [IO]

Update `{{context_file}}`:

- `metadata.phases_completed` append `"ado_discovery"`
- `metadata.current_phase` = `"sf_schema"`
- `metadata.last_updated` = ISO timestamp
- Append `{"phase":"ado_discovery","step":"complete","completedAt":"<ISO>","artifact":"{{context_file}}"}` to `run_state.completed_steps[]`
- Save to disk

Tell user: **"ADO discovery for {{scope.feature_area}} complete. Found {{work_item_count}} work items, {{wiki_page_count}} wiki pages. Business context established: {{ado_research.business_context.feature_purpose | truncate(100)}}. Use `/feature-research-phase-03a` for Salesforce schema discovery."**

---

## Error Handling

| Scenario                      | Action                                                                |
| ----------------------------- | --------------------------------------------------------------------- |
| Context file missing          | **STOP** — "Run `/feature-research-phase-01` first"                   |
| No related ADO items in scope | Proceed with keyword search only; note limited ADO context            |
| ADO search returns 0 results  | Log; proceed with wiki research; note "no ADO history found"          |
| Wiki search returns 0 results | Log; proceed with synthesis; note "no wiki documentation found"       |
| Work item fetch fails         | Log to `run_state.errors[]`; continue with remaining items            |
| Too many related items (>50)  | Prioritize Features and active User Stories; note selective retrieval |
