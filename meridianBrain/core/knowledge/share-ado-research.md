# Share – ADO Research

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado-research.md` on grooming and research flows.

Patterns for researching and reading ADO work items — comment mining, prerequisite validation, relation traversal.
References: `#file:config/platform-ado/share-ado.md` → `#file:config/core/share-core.md`
NEVER references Salesforce, template engine, slot filling.

## Prerequisite Gate Protocol

Before a phase begins, validate that required prior phases are complete and required context keys exist.

1. `[IO]` Load `{{context_file}}` → read `metadata.phases_completed` and `metadata.current_phase`
2. `[LOGIC]` For each required phase: check if it appears in `phases_completed`
3. `[LOGIC]` For each required context key: check if the path exists and is non-empty
4. Classify each missing item:
   - **Hard blocker** (prior phase not complete) → STOP. Instruct user to run the prerequisite phase first.
   - **Soft miss** (optional data missing, but phase can proceed with reduced depth) → Log to `run_state.errors[]`, note degraded analysis, continue.
5. Log all missing keys to `run_state.errors[]` and save before presenting the question.
6. If hard blockers exist, use the interactive question tool to present options: `Run prerequisite phase` · `Override and continue (reduced depth)` · `Cancel`

## Comment Mining Taxonomy

When processing work item comments, classify each by `context_type`:

| Type                 | Signal Patterns                                                            | Priority    |
| -------------------- | -------------------------------------------------------------------------- | ----------- |
| `decision`           | "decided to", "agreed that", "approved", "going with", "final answer"      | 1 (highest) |
| `meeting_transcript` | "meeting notes", "transcript", "discussed in", "action items", "attendees" | 2           |
| `requirement_change` | "changed to", "new requirement", "descoped", "added scope", "revised"      | 3           |
| `blocker`            | "blocked by", "waiting on", "dependency on", "cannot proceed"              | 4           |
| `question`           | "question:", "asking about", "need clarification", "does anyone know"      | 5           |
| `status_update`      | "completed", "in progress", "started", "finished", "deployed"              | 6           |
| `general`            | (none of the above)                                                        | 7 (lowest)  |

**Priority:** decisions > transcripts > requirement changes > blockers > questions > status updates > general.
When summarizing, always lead with decisions and transcripts.

## Comment Processing Patterns

### Pattern A: Fresh Mining (no prior comments)

1. `[CLI]` Fetch work item with `--comments`
2. `[GEN]` Classify each comment by `context_type` using the taxonomy above
3. `[GEN]` Extract key facts, decisions, and action items
4. `[IO]` Store classified comments in the context section

### Pattern B: Incremental Diff (compare against existing)

1. `[CLI]` Fetch work item with `--comments`
2. `[LOGIC]` Compare comment IDs against previously stored comments
3. `[GEN]` Classify only NEW comments
4. `[IO]` Append new classified comments; update synthesis with new signals

### Pattern C: Multi-Item Mining (parent + children)

1. `[CLI]` Fetch parent with `--comments`
2. `[CLI]` Fetch each child with `--comments`
3. `[GEN]` Classify all comments, tracking source work item ID
4. `[GEN]` Cross-reference: decisions on parent that affect children, blockers that cascade
5. `[IO]` Store with source attribution

## Research Output Schema

All research outputs go to `{{context_file}}.research.*`:

- `organization_dictionary` — domain terms and definitions
- `ado_workitem` — scope_context, domain_keywords
- `similar_workitems` — related work items found via search
- `wiki_search` — relevant wiki pages
- `business_context` — business rules, stakeholder impact
- `solutioning_investigation` — assumptions_to_validate, questions_for_solutioning, unknowns, scope_risks
- `synthesis` — what_requested, why_it_matters, who_affected, scope_boundaries, open_questions, unified_truth, conflict_log
- `salesforce_metadata` — SF metadata discovery results (solutioning research phase)
- `dependency_discovery` — extends synthesis with technical dependencies

## Relation Traversal

- **Parent:** extract from `Hierarchy-Reverse` relation
- **Children:** extract from `Hierarchy-Forward` relation
- **Siblings:** discover via parent's children (fetch parent → fetch parent's children)
- **Predecessors/Successors:** use `--type predecessor,successor` on `ado_relations`

## ADO Search Patterns

- **Keyword search:** `{{cli.ado_search}} --text "{{keywords}}" --json`
- **Tag search:** `{{cli.ado_search}} --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.Tags] CONTAINS '{{tag}}'" --json`
- **Domain-tag filtering:** exclude lifecycle tags (Copilot-Refined, Groomed, Solutioned, Dev-Complete) when searching for domain relevance

## Wiki Search Integration

1. `[CLI]` `{{cli.wiki_search}} "{{keywords}}" --json`
2. `[LOGIC]` Classify results: **relevant** (directly about the topic) · **contextual** (related background) · **noise** (irrelevant)
3. `[CLI]` Retrieve full content of relevant pages: `{{cli.wiki_get}} --path "{{page_path}}" --json`

## Flow Health Assessment

Interpret `flow_health.*` thresholds from `shared.json`:

- Items active > `warning_days` without progress → `⚠️` warning
- Items active > `critical_days` without progress → `🔴` critical
- Items active > `escalation_days` without progress → `🚨` escalation
- Items reassigned > `churn_reassignments` times within `churn_window_days` → churn flag
- Items with no comments/updates > `silent_days` → silent flag
- Parent with < `cascade_complete_percent`% of children complete → cascade incomplete

## Truncation Handling

When CLI output is truncated (large PRs, long backlogs, extensive query results):

1. Detect truncation: check for "truncated" warning in CLI output or if result count == requested limit.
2. Warn user: "Results truncated at <limit>. Run with higher limit to see all."
3. For analysis: explicitly note which items were NOT analyzed due to truncation.
4. Never present truncated analysis as complete.
