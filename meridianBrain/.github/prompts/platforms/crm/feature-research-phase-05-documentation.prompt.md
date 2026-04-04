# Feature Research Phase 05 – Documentation

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Technical Writer / Documentation Architect
Mission: Generate a factual current-state reference document from all prior discovery phases and publish to ADO Wiki + local artifact.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md`
Input: Full context from `{{context_file}}`

## Constraints

- **CLI-only** – per util-base guardrails
- **Mission-focused** – this report is the definitive artifact for **{{scope.feature_area}}**; write it as if the reader has never heard of this feature and needs to understand it completely from this document alone
- **Markdown output** – generate wiki-compatible markdown (ADO Wiki flavor)
- **No raw HTML in report** – use markdown tables, headings, mermaid diagrams
- **Mermaid diagrams** – use `graph TD` for relationships, `erDiagram` for object model; no spaces in node IDs
- **Factual only** – document what exists and how it works; do NOT include opinions, quality assessments, risk ratings, compliance scores, or recommendations
- **ADO Wiki compatible** – use `[[_TOC_]]` for table of contents; standard markdown formatting
- **Narrative coherence** – the report should tell a factual story: what {{scope.feature_area}} is and how it is currently built

## Context Paths

`{{research_root}}` = `{{paths.artifacts_root}}/sf-research/{{sanitized_name}}`
`{{context_file}}` = `{{research_root}}/research-context.json`
`{{report_file}}` = `{{research_root}}/research-report.md`

## Prerequisites [IO]

A1 [IO]: Load `{{context_file}}`; verify:

- `"sf_platform"` in `metadata.phases_completed`
- `sf_schema`, `sf_automation`, `sf_architecture`, `sf_platform` sections populated
  A2: **STOP** if any prerequisite missing. Log to `run_state.errors[]` and save.

## Mission Anchor [IO/GEN]

**Before writing anything, deeply understand what you are documenting.**

MA1 [IO]: From `{{context_file}}`, read and internalize the full research context:

- `scope.feature_area` — the feature name (used throughout the report)
- `scope.research_purpose` — why this research was conducted
- `ado_research.business_context.feature_purpose` — what the business says this feature does
- `synthesis.unified_truth` — the accumulated knowledge from ALL prior phases
- `synthesis.assumptions[]` — open questions and unresolved items

MA2 [GEN]: Before writing Section 1, compose a **mental model** of {{scope.feature_area}}:
_"{{scope.feature_area}} is a Salesforce feature that {{ado_research.business_context.feature_purpose}}. It is built on {{sf_schema.objects | length}} objects with {{sf_automation.dependency_graph.stats.total_nodes}} automation components. The report I write must help someone who has never seen this feature understand how it currently works — factually and completely."_

MA3: **Thread the mission through every section.** Add narrative context that connects sections: "Now that we've seen the object model, let's look at the automation that operates on it..." Keep all content factual — describe what exists and how it works, not how good or bad it is.

---

## Step 1 [IO] – Load All Context

B1 [IO]: Load complete `{{context_file}}`
B2 [IO]: Extract key data sets:

- `scope` — feature area name, SF objects, related ADO items
- `ado_research` — business context, wiki pages, decisions
- `sf_schema` — objects, fields, relationships, record types, PII
- `sf_automation` — triggers, flows, Apex classes, LWC, Aura, validation rules, dependency graph
- `sf_architecture` — order of operations, execution chains, cross-object cascades, component layer map, narrative
- `sf_platform` — security, integrations, data landscape
- `synthesis` — unified truth, assumptions

---

## Step 2 [GEN] – Generate Report Sections

### Section 1: Title and TOC

```
# {{scope.feature_area}} — Salesforce Feature Research Report
**Generated:** {{metadata.last_updated}}
**Scope:** {{scope.sf_objects | join(", ")}}
**ADO References:** {{scope.related_ado_items | count}} work items

[[_TOC_]]
```

### Section 2: Executive Summary

C1 [GEN]: Generate from discovery phase data:

- **Purpose** — 2–3 sentences: what this feature area does (from `synthesis.unified_truth`)
- **Scope** — objects researched, automation components discovered, integrations found
- **Key Statistics** — table compiled from all discovery phases:

| Metric                          | Count        |
| ------------------------------- | ------------ |
| Custom Objects                  | N            |
| Total Fields                    | N (N custom) |
| Relationships                   | N            |
| Triggers (active/total)         | N/N          |
| Flows (active/total)            | N/N          |
| Apex Classes                    | N            |
| LWC Components                  | N            |
| Aura Components                 | N            |
| Validation Rules (active/total) | N/N          |
| Integrations                    | N            |
| Total Records                   | N            |
| PII Fields                      | N            |

### Section 3: Business Context

C2 [GEN]: Generate from `ado_research`:

- **Feature Purpose** — narrative from `ado_research.business_context.feature_purpose`
- **Related Work Items** — table:

| ID  | Title | Type | State | SF References |
| --- | ----- | ---- | ----- | ------------- |

- Each ID linked: `[#{{id}}](https://dev.azure.com/{{ado_defaults.organization_name}}/{{ado_defaults.project}}/_workitems/edit/{{id}})`
- **Key Decisions** — bullet list from `ado_research.business_context.decisions[]`
- **Wiki References** — list of related wiki pages with paths

### Section 4: Object Model

C3 [GEN]: Generate from `sf_schema`:

- **Entity Relationship Diagram** — mermaid `erDiagram` from `sf_schema.relationships[]`:
  - Show all in-scope objects with key fields
  - Show relationship types (master-detail as `||--o{`, lookup as `}o--o{`)
  - Include junction objects if any
- **Object Inventory Table** — from `sf_schema.objects[]`:

| Object | Label | Custom | Fields | Record Types | Child Relationships |
| ------ | ----- | ------ | ------ | ------------ | ------------------- |

- **Field Inventory** — per object, collapsible section:
  - Table: API Name, Label, Type, Required, Category (custom/formula/lookup/etc.)
  - Highlight formula fields and cross-object references
- **Record Type Matrix** — from `sf_schema.record_types[]`:

| Object | Record Type | Active | Default | Description |
| ------ | ----------- | ------ | ------- | ----------- |

- **PII/Sensitive Fields** — from `sf_schema.pii_fields[]`:

| Object | Field | Type | Sensitivity |
| ------ | ----- | ---- | ----------- |

### Section 5: Automation Inventory

C4 [GEN]: Generate from `sf_automation`:

- **Discovery Summary** — brief note: "Broad discovery found {{discovery_pool.total_candidates}} candidates; {{relevance_filter.stats.direct + relevance_filter.stats.supporting}} confirmed feature-relevant."
- **Automation Summary** — mermaid `graph TD` showing trigger → handler → service chains, flow → subflow dependencies, and LWC → Apex controller connections
- **Triggers** — table from `sf_automation.triggers[]`:

| Object | Trigger | Events | Handler | Trigger Pattern | Relevance |
| ------ | ------- | ------ | ------- | --------------- | --------- |

- **Flows** — table from `sf_automation.flows[]`:

| Object | Flow Name | Type | Active | DML Operations | Error Handling | Relevance |
| ------ | --------- | ---- | ------ | -------------- | -------------- | --------- |

- **Apex Classes** — table from `sf_automation.apex_classes[]`:

| Class | Category | Referenced Objects | Callouts | Test Class | Relevance |
| ----- | -------- | ------------------ | -------- | ---------- | --------- |

- **Lightning Components** — table from `sf_automation.lwc_components[]` + `sf_automation.aura_components[]`:

| Component | Type (LWC/Aura) | Targets | Apex Imports | Object References |
| --------- | --------------- | ------- | ------------ | ----------------- |

- **Validation Rules** — table from `sf_automation.validation_rules[]`:

| Object | Rule | Active | Error Field | Cross-Object Refs |
| ------ | ---- | ------ | ----------- | ----------------- |

- **Dependency Graph** — mermaid `graph TD` from `sf_automation.dependency_graph`:
  - Nodes colored by type (trigger, flow, Apex, LWC, Aura, validation)
  - Highlight circular dependencies with dashed lines
  - Show LWC → Apex and Aura → Apex connections
  - Show component counts in graph stats

### Section 6: Execution Model

C5 [GEN]: Generate from `sf_architecture`:

- **System Overview** — narrative from `sf_architecture.narrative.system_overview` (plain-language description of how the feature works as a system)
- **Order of Operations** — for each primary object, generate a visual execution timeline:

| Slot | Phase             | Components                      | Notes              |
| ---- | ----------------- | ------------------------------- | ------------------ |
| 2    | Before-Save Flows | Flow_Name_1                     | Sets defaults      |
| 3    | Before Triggers   | TriggerName → Handler → Service | Field validation   |
| 5    | Validation Rules  | VR_Name_1, VR_Name_2            | Cross-object ref   |
| 7    | After Triggers    | TriggerName → Handler → Service | DML on ChildObj    |
| 11   | After-Save Flows  | Flow_Name_2                     | Publishes event    |
| 16   | Async             | QueueableName                   | Email notification |

- **Cross-Object Cascade Diagram** — mermaid `graph TD` from `sf_architecture.cross_object_cascades[]`:
  - Show each object as a node
  - Directed edges for each cascade DML (labeled with component name)
  - Mark re-entrant cascades with dashed lines
  - Show async boundaries with dotted lines
- **Transaction Summary** — table:

| Chain | Objects Touched | Sync DML | Sync SOQL | Cascade Depth |
| ----- | --------------- | -------- | --------- | ------------- |

- **Component Layer Map** — diagram from `sf_architecture.component_layer_map` showing UI → Controller → Service → Domain → Selector → Data layers with actual component names mapped to each layer

### Section 7: Integration Map

C6 [GEN]: Generate from `sf_platform.integrations`:

- **Integration Diagram** — mermaid `graph LR` showing:
  - In-scope objects → Platform Events → Subscribers
  - Apex Classes → Named Credentials → External Endpoints
  - CDC subscriptions
- **Platform Events** — table:

| Event | Label | Publishers | Subscribers |
| ----- | ----- | ---------- | ----------- |

- **Named Credentials** — table:

| Credential | Endpoint | Referenced By |
| ---------- | -------- | ------------- |

- **Callout Patterns** — table:

| Apex Class | Type | Named Credential | Direction |
| ---------- | ---- | ---------------- | --------- |

### Section 8: Security Model

C7 [GEN]: Generate from `sf_platform.security`:

- **Organization-Wide Defaults** — table:

| Object | Internal OWD | External OWD |
| ------ | ------------ | ------------ |

- **Profile/Permission Set Access Matrix** — table showing CRUD per profile for each object
- **PII Field Access** — table showing which profiles/permission sets can read and edit each PII field
- **Sharing Rules** — summary of any identified sharing rules

### Section 9: Data Landscape

C8 [GEN]: Generate from `sf_platform.data_landscape`:

- **Record Volumes** — table:

| Object | Record Count | Last Modified | Last Created |
| ------ | ------------ | ------------- | ------------ |

- **Record Type Distribution** — per object with record types:

| Object | Record Type | Count | %   |
| ------ | ----------- | ----- | --- |

- **Field Population Rates** — table of population rates for queried fields
- **Deployment History** — recent changes summary from SetupAuditTrail

### Section 10: Appendix

C9 [GEN]: Generate supporting detail:

- **Full Dependency Graph** — expanded mermaid diagram with all nodes/edges
- **Assumptions** — from `synthesis.assumptions[]`:

| ID  | Assumption | Confidence | Source |
| --- | ---------- | ---------- | ------ |

- **Research Metadata** — phases completed, timestamps, error log summary

---

## Step 3 [IO] – Save Local Artifact

D1 [IO]: Concatenate all sections into single markdown document
D2 [IO]: Write to `{{report_file}}`
D3 [IO]: Verify file saved — **GATE: confirm written**

---

## Step 4 [CLI] – Publish to Wiki

E1 [LOGIC]: Wiki path = `{{ado_defaults.wiki_copilot_root}}/{{sanitized_name}}`
E1a [CLI]: Get block menu: `{{cli.wiki_engine_block_menu}} --markdown`
E1b [GEN]: Compose a `WikiPageSpec` JSON from the research report content, selecting appropriate sections, colors, and blocks from the block menu
E1c [IO]: Save WikiPageSpec JSON → temp file (e.g., `{{research_root}}/wiki-spec.json`)
E1d [CLI]: Validate: `{{cli.wiki_engine_validate}} --spec "<spec_file>" --json`
E1e [CLI]: Render: `{{cli.wiki_engine_render}} --spec "<spec_file>" --output "<rendered_file>" --json`
E2 [CLI]: Check existing: `{{cli.wiki_get}} --path "{{wiki_path}}" --no-content --json`
E3 [LOGIC]: Route:

- **New page** → `{{cli.wiki_create}} --path "{{wiki_path}}" --content "<rendered_file>" --comment "Feature research: {{scope.feature_area}}" --json`
- **Existing page** → `{{cli.wiki_update}} --path "{{wiki_path}}" --content "<rendered_file>" --comment "Feature research update: {{scope.feature_area}}" --json`
  E4 [CLI]: Verify publication: `{{cli.wiki_get}} --path "{{wiki_path}}" --no-content --json` → confirm page exists with updated timestamp
  E5 [IO]: Update `{{context_file}}.documentation`:
- `wiki_path` = `{{wiki_path}}`
- `published_at` = ISO timestamp

---

## Step 5 [IO/GEN] – Completion

Update `{{context_file}}`:

- `metadata.phases_completed` append `"documentation"`
- `metadata.current_phase` = `"complete"`
- `metadata.last_updated` = ISO timestamp
- Append `{"phase":"documentation","step":"complete","completedAt":"<ISO>","artifact":"{{context_file}}"}` to `run_state.completed_steps[]`
- Save to disk

Tell user:

```
## Feature Research Complete

**Feature Area:** {{scope.feature_area}}
**Objects Researched:** {{scope.sf_objects | join(", ")}}

### Deliverables
- **Local Report:** {{report_file}}
- **Wiki Page:** [{{wiki_path}}](https://dev.azure.com/{{ado_defaults.organization_name}}/{{ado_defaults.project}}/_wiki/wikis/{{ado_defaults.wiki}}?pagePath={{ado_defaults.wiki_copilot_root}}/{{sanitized_name}})

### Summary
- **Objects:** {{object_count}}
- **Total Fields:** {{field_count}}
- **Automation Components:** {{total_component_count}} (triggers, flows, Apex, LWC, Aura, validation rules)
- **Integrations:** {{integration_count}}
- **Total Records:** {{total_records}}

All research data saved to {{context_file}} for future reference.
```

---

## Error Handling

| Scenario                                 | Action                                                                            |
| ---------------------------------------- | --------------------------------------------------------------------------------- |
| Context file missing                     | **STOP** — "Run `/feature-research-phase-01` first"                               |
| Phase 03d not completed                  | **STOP** — "Run `/feature-research-phase-03d` first"                              |
| Wiki create fails                        | Save local report; warn user; report local path as primary deliverable            |
| Wiki update fails (conflict)             | Retry once; if still fails, save local report and inform user                     |
| Report generation incomplete             | Save partial report; note incomplete sections; continue with wiki publish         |
| Mermaid diagram too complex (100+ nodes) | Simplify to top-level components; include full graph in appendix as text          |
| Very large report (>50KB)                | Split appendix into sub-pages if wiki supports it; otherwise truncate field lists |
