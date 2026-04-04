# Feature Research Phase 03b – Salesforce Automation Discovery

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Salesforce Automation Architect
Mission: Discover ALL automation and UI components related to in-scope objects — triggers, flows, Apex classes, LWC, Aura, validation rules — then filter for feature relevance and build a dependency graph.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md` · `#file:platforms/crm/knowledge/share-salesforce.md` · `#file:platforms/crm/knowledge/share-salesforce-research.md`
Input: Scope from `{{context_file}}.scope.sf_objects[]`, schema context from `{{context_file}}.sf_schema`

## Constraints

- **Read-only** – NO ADO/wiki/SF modifications
- **CLI-only** – per util-base guardrails (SF operations use `{{cli.*}}` commands only)
- **Mission-focused** – you are cataloging automation for **{{scope.feature_area}}**; use the two-pass approach (broad discovery → relevance filtering) to ensure nothing is missed while keeping the results focused
- **Two-pass methodology** – Pass 1: cast a WIDE net to find all candidates; Pass 2: explore each candidate to classify relevance to the feature. Only candidates classified as `direct` or `supporting` proceed to deep analysis
- **Outputs to** `{{context_file}}.sf_automation`
- **Rolling synthesis** – extend `synthesis` with automation findings
- **All streams mandatory** – batch SF operations when beneficial
- **Feedback loops** – max 3 iterations/stream

## After Each Stream (MANDATORY — do NOT batch)

**MUST write to disk before starting next stream.** This ensures resumability if context is lost.
Stream sections: Stream 1 → `sf_automation.discovery_pool`, Stream 2 → `.relevance_filter`, Stream 3 → `.triggers`, Stream 4 → `.flows`, Stream 5 → `.apex_classes`, Stream 6 → `.lwc_components` + `.aura_components`, Stream 7 → `.validation_rules`, Stream 8 → `.dependency_graph`

1. [IO] Write `{{context_file}}.sf_automation.[stream_section]` → save to disk
2. [GEN] Extend `{{context_file}}.synthesis` + `.synthesis.assumptions[]` with new evidence
3. [IO] Append to `{{context_file}}.run_state.completed_steps[]`
4. [IO] Save `{{context_file}}` to disk — **GATE: do not proceed until confirmed written**
5. On batch failure: log failed objects to `run_state.errors[]`; save to disk; continue with successes

## Context Paths

`{{research_root}}` = `{{paths.artifacts_root}}/sf-research/{{sanitized_name}}`
`{{context_file}}` = `{{research_root}}/research-context.json`

## Prerequisites [IO]

A1 [IO]: Load `{{context_file}}`; verify:

- `"sf_schema"` in `metadata.phases_completed`
- `sf_schema.objects` is populated (at least 1 object described)
  A2 [IO]: Load `scope.sf_objects[]` and `sf_schema.objects[]` for reference
  A2.5 [LOGIC]: **Salesforce Org Resolution** — orgs are resolved automatically from `config/sf-orgs.json` (configured via `crm-tools org-setup`).
  Each crm-tools command uses `--role <role>` to target the correct org:
- SOQL queries (Tooling API included) → `--role modernData`
- Metadata/describe/discover → `--role modernMetadata`
- General/unspecified → `--role primary` (or omit for default)
  Resolution chain: explicit `--org` > role config > designation fallback > primary > SF CLI default.
  If config missing or connection fails → ask user which org, suggest running `npx --prefix scripts/workflow crm-tools org-setup`.
  A3: **STOP** if any prerequisite missing. Log to `run_state.errors[]` and save.

**NOTE:** Pass `--role modernMetadata` (for describe/discover/apex/triggers/flows/validation) or `--role modernData` (for SOQL/Tooling queries) to crm-tools commands in this phase.

## Mission Anchor [IO/GEN]

**Before any research begins, ground yourself in the mission.**

MA1 [IO]: From `{{context_file}}`, read and internalize:

- `scope.feature_area` — **what** we are researching
- `scope.research_purpose` — **why** we are researching it
- `scope.sf_objects[]` — the Salesforce objects whose automation we are cataloging
- `scope.domain_keywords[]` — terms for broader discovery
- `ado_research.business_context` — business rules, decisions, and requirements that the automation should implement
- `sf_schema.objects[]` — object model context (field counts, relationships) from Phase 03a
- `sf_schema.relationships[]` — related objects that may have automation affecting in-scope objects
- `synthesis.unified_truth` — cumulative understanding from prior phases

MA2 [GEN]: State the mission: _"I am discovering ALL automation and UI components for **{{scope.feature_area}}** — first casting a broad net to find every trigger, flow, Apex class, LWC, and Aura component that touches {{scope.sf_objects | join(", ")}}, then exploring each to determine if it's truly part of this feature. Business context: {{ado_research.business_context.feature_purpose | truncate(100)}}. I must not miss components with non-obvious names — the broad search + relevance filter approach ensures comprehensive coverage."_

MA3: **Carry this context through every stream.** The broad discovery (Stream 1) should err on the side of inclusion. The relevance filter uses business context from Phase 02 and schema context from Phase 03a to make informed judgments. Deep analysis streams focus only on confirmed-relevant components.

---

## Automation Output Structure

All outputs to `{{context_file}}.sf_automation`:

- `discovery_pool` — `{ triggers[], flows[], apex_classes[], lwc_components[], aura_components[], total_candidates, search_strategies_used[] }`
- `relevance_filter` — `{ classified[], stats: { direct, supporting, peripheral, noise, total } }`
- `triggers[]` — `{ object, name, events[], is_active, handler_class, handler_chain[], trigger_pattern, relevance }`
- `flows[]` — `{ object, name, type, process_type, description, is_active, dml_operations[], subflow_calls[], apex_actions[], error_handling, relevance }`
- `apex_classes[]` — `{ name, category, referenced_objects[], soql_queries[], dml_statements[], callout_references[], event_publishes[], aura_enabled_methods[], test_class, lines_of_code, relevance }`
- `lwc_components[]` — `{ name, label, description, api_version, targets[], object_filters[], wire_adapters[], apex_imports[], object_references[], message_channels[], relevance }`
- `aura_components[]` — `{ name, description, controller_class, helper_references[], object_references[], event_references[], relevance }`
- `validation_rules[]` — `{ object, name, is_active, formula, error_message, error_field, cross_object_refs[] }`
- `dependency_graph` — `{ nodes[], edges[], circular_dependencies[], stats }`

---

## Stream 1 [CLI/GEN] – Broad Discovery

**Goal:** Cast a wide net to find ALL components that might relate to **{{scope.feature_area}}** — err on the side of inclusion → `{{context_file}}.sf_automation.discovery_pool`

### Strategy A — Object-Direct Discovery (highest confidence)

B1 [CLI]: **Triggers** — for each in-scope object:

- `{{cli.sf_apex_triggers}} --object {{object}} --json`
  B2 [CLI]: **Object-triggered flows** — for each in-scope object:
- `{{cli.sf_flows}} --object {{object}} --json`
  B3 [CLI]: **Apex by name** — for each in-scope object:
- `{{cli.sf_apex}} --pattern "%{{object}}%" --json`
  B4 [CLI]: **Validation rules** — batch:
- `{{cli.sf_validation}} {{obj1}},{{obj2}},{{objN}} --batch --json`

### Strategy B — Dependency & Reference Search (catches non-obvious names)

B5 [CLI]: **Apex dependency search** — for each in-scope object, find ALL components that reference it via MetadataComponentDependency:

- `{{cli.sf_query}} "SELECT MetadataComponentName, MetadataComponentType FROM MetadataComponentDependency WHERE RefMetadataComponentName = '{{object}}' AND MetadataComponentType = 'ApexClass'" --tooling --json`
- This catches Apex classes that reference in-scope objects in their code but DON'T have the object name in their class name (e.g., a `DataSyncService` that queries `Journey__c`)
- **Note:** MetadataComponentDependency is Beta — if the query fails, fall back to expanded name-pattern searches in Strategy C (add more keyword variations)
  B5b [CLI]: **Flow dependency search** — find flows referencing in-scope objects:
- `{{cli.sf_query}} "SELECT MetadataComponentName, MetadataComponentType FROM MetadataComponentDependency WHERE RefMetadataComponentName = '{{object}}' AND MetadataComponentType IN ('Flow', 'FlowDefinition')" --tooling --json`
- Catches scheduled, autolaunched, and platform event flows that touch in-scope objects but aren't object-triggered
  B6 [CLI]: **Global flow scan** — find ALL active flows, then filter:
- `{{cli.sf_flows}} --all --json`
  B7 [GEN]: From B6 results, identify flows that reference in-scope objects but are NOT object-triggered:
- Scheduled flows, autolaunched flows, platform event flows
- Match by: description mentions scope objects/keywords, DeveloperName contains domain terms
- Also flag flows called as subflows by already-discovered flows (traced later in Stream 3)

### Strategy C — Keyword & Domain Search (catches feature-named components)

B8 [CLI]: **Apex by domain keywords** — for each keyword in `scope.domain_keywords[]` (max 5, skip if same as object names):

- `{{cli.sf_apex}} --pattern "%{{keyword}}%" --json`
- Deduplicate against B3 results
  B9 [CLI]: **LWC discovery** — search by object names and domain keywords:
- `{{cli.sf_query}} "SELECT Id, DeveloperName, MasterLabel, Description, TargetConfigs FROM LightningComponentBundle WHERE DeveloperName LIKE '%{{keyword}}%' AND NamespacePrefix = null" --tooling --json`
- Run for each in-scope object name (simplified, e.g., `Journey` from `Journey__c`) and each domain keyword
  B10 [CLI]: **Aura discovery** — search by object names and domain keywords:
- `{{cli.sf_query}} "SELECT Id, DeveloperName, MasterLabel, Description FROM AuraDefinitionBundle WHERE DeveloperName LIKE '%{{keyword}}%' AND NamespacePrefix = null" --tooling --json`
- Run for each simplified object name and domain keyword

### Strategy D — Dependency Chain Discovery (follows references)

B11 [CLI]: For each trigger found in B1, extract handler class from trigger body:

- If handler identified: `{{cli.sf_apex}} --pattern "%{{handler_class}}%" --json`
  B12 [GEN]: From B11 handler classes, extract service/selector class references from their bodies (if available from B5 results)
- Follow the chain: trigger → handler → service → selector/domain
- Add each discovered class to the candidate pool

### Strategy E — Related Object Discovery (catches cross-object automation)

B13 [IO]: Load `sf_schema.relationships[]` — identify objects with master-detail relationships to in-scope objects
B14 [CLI]: For master-detail parent/child objects NOT in scope (max 3):

- `{{cli.sf_apex_triggers}} --object {{related_object}} --json`
- `{{cli.sf_flows}} --object {{related_object}} --json`
- These may cascade into in-scope object logic

### Pool Assembly

B15 [GEN]: Deduplicate ALL results from Strategies A–E into a single candidate pool:

- **Triggers**: merge B1 + B14 trigger results
- **Flows**: merge B2 + B5b + B6/B7 + B14 flow results
- **Apex classes**: merge B3 + B5 + B8 + B11 + B12 results (B5 = dependency search, B8 = keyword search)
- **LWC components**: from B9
- **Aura components**: from B10
- Tag each candidate with `discovery_strategy` (which strategy found it)
- Record `search_strategies_used[]` for traceability
  B16 [GEN]: Store → `sf_automation.discovery_pool`

---

## Stream 2 [GEN] – Relevance Filtering

**Goal:** Explore each candidate to determine if it's truly part of **{{scope.feature_area}}** — classify relevance before committing to deep analysis → `{{context_file}}.sf_automation.relevance_filter`

### Relevance Classification Criteria

C1 [GEN]: For each candidate in `discovery_pool`, classify using these criteria:

**`direct`** — component directly operates on in-scope objects for this feature:

- Trigger fires on in-scope object
- Flow is triggered by in-scope object
- Apex class has SOQL/DML targeting in-scope objects as primary purpose
- LWC/Aura component is built for in-scope object record pages
- Validation rule is on in-scope object
- Name clearly references the feature area

**`supporting`** — component is called by or supports `direct` components:

- Handler/service class invoked by a `direct` trigger
- Subflow called by a `direct` flow
- Apex utility class used by `direct` classes (selector, domain, helper)
- LWC child component embedded in a `direct` LWC
- Shared service that processes in-scope objects among other objects

**`peripheral`** — component touches in-scope objects but primary purpose is elsewhere:

- Generic utility class that happens to reference an in-scope object (e.g., a logging class that logs for all objects)
- Flow on a related object that has a minor lookup update to in-scope object
- Cross-object component where in-scope object is a secondary concern
- LWC/Aura that shows a related list but isn't purpose-built for the feature

**`noise`** — false positive from keyword matching:

- Name contains a keyword but component is unrelated (e.g., keyword "case" matching a switch-case utility)
- Managed package component (`NamespacePrefix` is non-null)
- Component references the object only in a comment or inactive code path

### Classification Process

C2 [GEN]: For each **trigger** candidate:

- If fires on in-scope object → `direct`
- If fires on related object with cascade logic → `supporting`
- If fires on unrelated object → `noise`

C3 [GEN]: For each **flow** candidate:

- If triggered by in-scope object → `direct`
- If called as subflow by a `direct` flow → `supporting`
- If global/scheduled but description or name clearly relates to feature → explore further, likely `direct` or `supporting`
- If global with only tangential object reference → `peripheral`

C4 [GEN]: For each **Apex** candidate:

- Check the `discovery_strategy` tag — was it found by object-direct (A), body search (B), keyword (C), or dependency chain (D)?
- **Strategy A/D hits**: likely `direct` or `supporting` — verify by checking referenced_objects
- **Strategy B hits**: examine context — is the in-scope object central to the class or a minor reference?
- **Strategy C hits**: higher chance of noise — verify the class actually processes in-scope objects
- Use class name patterns: `{{ObjectName}}Handler`, `{{ObjectName}}Service`, `{{FeatureArea}}Batch` → strong `direct` signal
- Use body references: class with 5+ SOQL/DML on in-scope objects → `direct`; class with 1 minor reference → `peripheral`

C5 [GEN]: For each **LWC/Aura** candidate:

- If `TargetConfigs` references in-scope object record pages → `direct`
- If name contains feature area or object name → likely `direct`, verify
- If it imports Apex methods from `direct` Apex classes → `supporting`
- If keyword match only with no clear object reference → `noise`

### Relevance Decision

C6 [GEN]: Components classified as `direct` or `supporting` → **proceed to deep analysis** (Streams 3–6)
C7 [GEN]: Components classified as `peripheral` → **log but do NOT deep-analyze**; note in synthesis as "peripheral components that touch in-scope objects"
C8 [GEN]: Components classified as `noise` → **discard**; log count for traceability

### Output

C9 [GEN]: Store classification results:
`relevance_filter.classified[]` — `{ name, type (trigger|flow|apex|lwc|aura), relevance (direct|supporting|peripheral|noise), discovery_strategy, reason }`
`relevance_filter.stats` — `{ direct: N, supporting: N, peripheral: N, noise: N, total: N }`
C10 [GEN]: Report to synthesis: "Broad discovery found {{total}} candidates; {{direct + supporting}} are feature-relevant, {{peripheral}} are peripheral, {{noise}} were noise."

---

## Stream 3 [CLI/GEN] – Trigger Deep Analysis

**Goal:** Analyze all `direct` and `supporting` triggers for **{{scope.feature_area}}** — trace handler chains and document trigger patterns → `{{context_file}}.sf_automation.triggers`

**Input:** Triggers from `relevance_filter.classified[]` where `type = "trigger"` AND `relevance IN ("direct", "supporting")`

### Handler Chain Tracing

D1 [GEN]: For each trigger, extract body and identify handler invocation pattern:

- **Metadata-driven (TAF)** — look for `TriggerActionFlowBypass`, `MetadataTriggerHandler`, or custom metadata references
- **Direct handler** — look for `new {{ClassName}}().run()` or similar patterns
- **Inline logic** — trigger body contains direct SOQL/DML without delegating to a handler
  D2 [CLI]: For each identified handler class (if not already in candidate pool):
- `{{cli.sf_apex}} --pattern "%{{handler_class}}%" --json`
  D3 [GEN]: Trace the full chain: trigger → handler → service class → selector/domain layer
- Extract class names at each layer
- Note if handler delegates to service classes or contains logic directly
  D4 [GEN]: Identify the trigger pattern in use:
- `trigger_pattern` = `metadata_driven` if TAF / MetadataTriggerHandler / custom metadata references
- `trigger_pattern` = `direct_handler` if trigger invokes a handler class directly (e.g., `new ClassName().run()`)
- `trigger_pattern` = `inline_logic` if trigger body contains direct SOQL/DML without delegating to a handler

### Output

D5 [GEN]: Store each trigger:
`{ object, name, events[], is_active, handler_class, handler_chain[], trigger_pattern, relevance }`
→ `sf_automation.triggers[]`

---

## Stream 4 [CLI/GEN] – Flow Deep Analysis

**Goal:** Analyze all `direct` and `supporting` flows for **{{scope.feature_area}}** — document what they do → `{{context_file}}.sf_automation.flows`

**Input:** Flows from `relevance_filter.classified[]` where `type = "flow"` AND `relevance IN ("direct", "supporting")`

### Flow Type Classification

E1 [GEN]: For each flow, categorize by ProcessType + TriggerType:

- **Record-Triggered Before** — AutoLaunchedFlow + RecordBeforeSave
- **Record-Triggered After** — AutoLaunchedFlow + RecordAfterSave
- **Record-Triggered Delete** — AutoLaunchedFlow + RecordBeforeDelete
- **Screen Flow** — Flow
- **Autolaunched** — AutoLaunchedFlow (no trigger)
- **Scheduled** — AutoLaunchedFlow + Scheduled
- **Platform Event-Triggered** — AutoLaunchedFlow + PlatformEvent

### Flow Detail Analysis

E2 [GEN]: For each flow, analyze available metadata:

- `dml_operations[]` — Record Create, Record Update, Record Delete elements (target objects)
- `subflow_calls[]` — Subflow elements with referenced flow names
- `apex_actions[]` — Apex Action elements with class/method names
- `error_handling` — presence of Fault connectors (true/false)

### Subflow Chain Tracing

E3 [GEN]: For flows with `subflow_calls[]`:

- Check if called subflows are already in the candidate pool
- If a subflow is NOT in the pool but is called by a `direct` flow → add it as `supporting` and note for analysis
- Trace up to 3 levels of subflow nesting to map the full execution path

### Output

E4 [GEN]: Store each flow:
`{ object, name, type, process_type, description, is_active, dml_operations[], subflow_calls[], apex_actions[], error_handling, relevance }`
→ `sf_automation.flows[]`

---

## Stream 5 [CLI/GEN] – Apex Deep Analysis

**Goal:** Classify and analyze all `direct` and `supporting` Apex classes for **{{scope.feature_area}}** → `{{context_file}}.sf_automation.apex_classes`

**Input:** Apex classes from `relevance_filter.classified[]` where `type = "apex"` AND `relevance IN ("direct", "supporting")`

### Classification

F1 [GEN]: Categorize each class based on naming patterns, annotations, and content:

- **Trigger Handler** — name ends with `TriggerHandler`, `Handler`; implements trigger handler interface
- **Service** — name ends with `Service`; contains business logic methods
- **Selector** — name ends with `Selector`; contains SOQL queries
- **Domain** — name ends with `Domain`; extends SObjectDomain or similar
- **Batch** — implements `Database.Batchable`; has `start()`, `execute()`, `finish()`
- **Schedulable** — implements `Schedulable`; has `execute(SchedulableContext)`
- **Queueable** — implements `Queueable`; has `execute(QueueableContext)`
- **Invocable** — has `@InvocableMethod` annotation
- **REST Endpoint** — has `@RestResource` annotation
- **SOAP Endpoint** — has `webservice` keyword
- **Test Class** — has `@IsTest` or `@isTest` annotation
- **LWC Controller** — has `@AuraEnabled` methods (serves LWC/Aura components)
- **Utility** — helper/utility patterns not matching above
- **Controller** — Visualforce or Aura controller patterns

### Content Analysis

F2 [GEN]: For each non-test class, extract:

- `referenced_objects[]` — SF objects referenced in SOQL/DML
- `soql_queries[]` — SOQL query patterns (SELECT fields FROM object WHERE...)
- `dml_statements[]` — insert/update/upsert/delete/undelete operations
- `callout_references[]` — HttpRequest, Http.send, WebServiceCallout patterns
- `event_publishes[]` — EventBus.publish references
- `aura_enabled_methods[]` — methods with `@AuraEnabled` (exposed to LWC/Aura)
- `lines_of_code` — approximate LOC
  F3 [GEN]: Identify batch chains — classes where `finish()` method enqueues another batch/queueable
  F4 [GEN]: Identify test classes that correspond to each production class (by naming convention `{{ClassName}}Test` or `{{ClassName}}_Test`)

### Output

F5 [GEN]: Store each class:
`{ name, category, referenced_objects[], soql_queries[], dml_statements[], callout_references[], event_publishes[], aura_enabled_methods[], test_class, lines_of_code, relevance }`
→ `sf_automation.apex_classes[]`

---

## Stream 6 [CLI/GEN] – LWC & Aura Deep Analysis

**Goal:** Analyze all `direct` and `supporting` Lightning components for **{{scope.feature_area}}** — understand the UI layer → `{{context_file}}.sf_automation.lwc_components` + `.aura_components`

**Input:** LWC and Aura components from `relevance_filter.classified[]` where `type IN ("lwc", "aura")` AND `relevance IN ("direct", "supporting")`

### LWC Analysis

G1 [CLI]: For each LWC component, retrieve detailed metadata:

- `{{cli.sf_query}} "SELECT Id, DeveloperName, MasterLabel, Description, ApiVersion, TargetConfigs FROM LightningComponentBundle WHERE DeveloperName = '{{component_name}}'" --tooling --json`
  G2 [CLI]: Retrieve component source files to analyze imports and wire adapters:
- `{{cli.sf_query}} "SELECT Id, FilePath, Source FROM LightningComponentResource WHERE LightningComponentBundleId = '{{bundle_id}}' AND FilePath LIKE '%.js'" --tooling --json`
  G3 [GEN]: From JS source, extract:
- `wire_adapters[]` — `@wire` decorator usage: `getRecord`, `getRelatedListRecords`, custom Apex wire adapters
- `apex_imports[]` — imported Apex methods (e.g., `import getRecords from '@salesforce/apex/MyController.getRecords'`)
- `object_references[]` — `@salesforce/schema/` imports (object and field references)
- `navigation_references[]` — NavigationMixin usage, record page navigation
- `message_channel_usage[]` — Lightning Message Service (LMS) publish/subscribe
  G4 [GEN]: From `TargetConfigs`, extract:
- `targets[]` — where the component can be placed: `lightning__RecordPage`, `lightning__AppPage`, `lightning__HomePage`, `lightning__FlowScreen`, etc.
- `object_filters[]` — if targets are restricted to specific objects (e.g., only on `Journey__c` record pages)

### Aura Analysis

G5 [CLI]: For each Aura component, retrieve metadata:

- `{{cli.sf_query}} "SELECT Id, DeveloperName, MasterLabel, Description FROM AuraDefinitionBundle WHERE DeveloperName = '{{component_name}}'" --tooling --json`
  G6 [CLI]: Retrieve Aura component source:
- `{{cli.sf_query}} "SELECT Id, DefType, Source FROM AuraDefinition WHERE AuraDefinitionBundleId = '{{bundle_id}}' AND DefType IN ('CONTROLLER', 'HELPER', 'COMPONENT')" --tooling --json`
  G7 [GEN]: From Aura source, extract:
- `controller_class` — server-side Apex controller (from `controller="..."` attribute)
- `helper_references[]` — Apex method calls from helper
- `object_references[]` — `force:recordData`, `force:recordView`, `aura:iteration` over records
- `event_references[]` — Aura application/component events fired or handled

### Cross-Reference

G8 [GEN]: Cross-reference LWC/Aura with Apex:

- LWC `apex_imports[]` → match to `apex_classes[]` from Stream 5
- Aura `controller_class` → match to `apex_classes[]` from Stream 5
- Flag any Apex classes NOT already in the pool that are imported by `direct` LWC/Aura components → add as `supporting`

### Output

G9 [GEN]: Store each LWC:
`{ name, label, description, api_version, targets[], object_filters[], wire_adapters[], apex_imports[], object_references[], message_channels[], relevance }`
→ `sf_automation.lwc_components[]`
G10 [GEN]: Store each Aura component:
`{ name, description, controller_class, helper_references[], object_references[], event_references[], relevance }`
→ `sf_automation.aura_components[]`

---

## Stream 7 [CLI/GEN] – Validation Rules

**Goal:** Analyze all validation rules that enforce data integrity for **{{scope.feature_area}}** objects → `{{context_file}}.sf_automation.validation_rules`

Note: Validation rules are always object-bound and were already collected in Stream 1 (Strategy A). This stream performs deep analysis.

### Analysis

H1 [GEN]: For each validation rule from the discovery pool, extract:

- `name` (DeveloperName), `object`, `is_active` (Active)
- `formula` (ErrorConditionFormula) — the validation formula
- `error_message` (ErrorMessage), `error_field` (ErrorDisplayField — field-level or page-level)
  H2 [GEN]: Analyze formula for cross-references:
- Fields from related objects (e.g., `Account.Industry`, `Parent.Name`)
- Custom metadata references (`$CustomMetadata.Type.Record.Field__c`)
- Custom label references (`$Label.CustomLabel`)
- Custom setting references (`$Setup.Setting__c.Field__c`)
  H3 [GEN]: Store `cross_object_refs[]` for each rule

### Output

H4 [GEN]: Store each rule:
`{ object, name, is_active, formula, error_message, error_field, cross_object_refs[] }`
→ `sf_automation.validation_rules[]`

---

## Stream 8 [GEN/CLI] – Dependency Graph

**Goal:** Build the full automation dependency graph for **{{scope.feature_area}}** — document how all component types interconnect → `{{context_file}}.sf_automation.dependency_graph`

### Graph Construction

I1 [CLI]: For key Apex classes (handlers, services, LWC controllers, batch — max 15):

- `{{cli.sf_discover}} --type ApexClass --name {{class}} --depth 3 --json`
  I2 [GEN]: Build graph nodes from ALL confirmed-relevant components:
- Triggers, Flows, Apex Classes, LWC Components, Aura Components, Validation Rules, Platform Events
- Each node: `{ id, name, type, object, relevance }`
  I3 [GEN]: Build graph edges from traced relationships:
- Trigger → Handler (from Stream 3 handler_chain)
- Handler → Service → Selector (from Stream 3 chain tracing)
- Flow → Subflow (from Stream 4 subflow_calls)
- Flow → Apex Action (from Stream 4 apex_actions)
- Apex → Apex (from service calls, batch chains in Stream 5)
- Apex → External (from callout_references in Stream 5)
- **LWC → Apex** (from wire adapters and apex_imports in Stream 6)
- **Aura → Apex** (from controller_class and helper references in Stream 6)
- **LWC ↔ LWC** (from message channel communication in Stream 6)
- Each edge: `{ from, to, relationship_type }`

### Circular Dependency Detection

I4 [GEN]: Walk the graph to identify cycles:

- Trigger A → Handler → Service → DML on Object B → Trigger B → Handler → DML on Object A
- Flow recursion chains (subflow calls that eventually circle back)
- Store cycles → `dependency_graph.circular_dependencies[]`

### Output

I5 [GEN]: Store graph: `{ nodes[], edges[], circular_dependencies[], stats: { total_nodes, total_edges, max_depth, component_counts_by_type } }`
→ `sf_automation.dependency_graph`

---

## Completion [IO/GEN]

Update `{{context_file}}`:

- `metadata.phases_completed` append `"sf_automation"`
- `metadata.current_phase` = `"sf_architecture"`
- `metadata.last_updated` = ISO timestamp
- Extend `synthesis.unified_truth` with:
  - `automation_summary` — total triggers, flows, Apex classes, LWC, Aura, validation rules; active vs inactive counts
  - `discovery_coverage` — candidates found: {{total}}, feature-relevant: {{direct + supporting}}, peripheral: {{peripheral}}, noise discarded: {{noise}}
  - `trigger_patterns` — count of triggers by pattern (metadata_driven, direct_handler, inline_logic)
  - `ui_layer` — LWC count, Aura count, Apex controllers shared between automation and UI
  - `dependency_graph_stats` — total nodes, total edges, circular dependency count
- Append `{"phase":"sf_automation","step":"complete","completedAt":"<ISO>","artifact":"{{context_file}}"}` to `run_state.completed_steps[]`
- Save to disk

Tell user: **"Automation discovery for {{scope.feature_area}} complete. Broad search found {{total_candidates}} candidates; {{relevant_count}} confirmed feature-relevant ({{direct_count}} direct, {{supporting_count}} supporting). Cataloged: {{trigger_count}} triggers, {{flow_count}} flows, {{apex_count}} Apex classes, {{lwc_count}} LWC, {{aura_count}} Aura, {{vr_count}} validation rules. Use `/feature-research-phase-03c` for execution model mapping."**

---

## Error Handling

| Scenario                                       | Action                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Context file missing                           | **STOP** — "Run `/feature-research-phase-01` first"                                                                                                                                   |
| Phase 03a not completed                        | **STOP** — "Run `/feature-research-phase-03a` first"                                                                                                                                  |
| sf_apex_triggers returns 0 for an object       | Log; object may not have triggers; continue                                                                                                                                           |
| sf_flows returns 0 for an object               | Log; object may not have flows; continue                                                                                                                                              |
| sf_apex returns 0 for an object                | Log; note no Apex references; continue                                                                                                                                                |
| MetadataComponentDependency query fails (Beta) | Fall back to expanded name-pattern searches in Strategy C (add object name variations: full API name, base name without `__c`, abbreviated forms); note limited coverage in synthesis |
| LWC query returns 0                            | Log; feature may not have UI components; continue                                                                                                                                     |
| Aura query returns 0                           | Log; feature may not use legacy Aura; continue                                                                                                                                        |
| LightningComponentResource query fails         | Log; analyze LWC by metadata only (name, targets); skip source analysis                                                                                                               |
| sf_validation fails for batch                  | Retry individually per object; log failures                                                                                                                                           |
| sf_discover fails for a class                  | Log error; build partial graph from other streams                                                                                                                                     |
| Handler class not found in apex search         | Log; may be in managed package or deleted; note in synthesis                                                                                                                          |
| Very large candidate pool (200+ candidates)    | Run relevance filter immediately; prioritize direct + supporting; note if pool was trimmed                                                                                            |
| Dependency search returns 100+ Apex classes    | Batch into groups; apply relevance filter aggressively; this indicates a shared/core object                                                                                           |
