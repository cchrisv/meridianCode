# Feature Research Phase 03a – Salesforce Schema Discovery

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Salesforce Data Architect
Mission: Document the complete object model — schema, fields, relationships, record types — for all in-scope Salesforce objects.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md` · `#file:platforms/crm/knowledge/share-salesforce.md` · `#file:platforms/crm/knowledge/share-salesforce-research.md`
Input: Scope from `{{context_file}}.scope.sf_objects[]`

## Constraints

- **Read-only** – NO ADO/wiki/SF modifications
- **CLI-only** – per util-base guardrails (SF operations use `{{cli.*}}` commands only)
- **Mission-focused** – you are documenting the data model for **{{scope.feature_area}}**; every schema observation, relationship mapping, and field analysis should be interpreted through the lens of this feature's purpose
- **Outputs to** `{{context_file}}.sf_schema`
- **Rolling synthesis** – extend `synthesis` with schema findings
- **All streams mandatory** – batch SF operations when multiple objects
- **Feedback loops** – max 3 iterations/stream

## After Each Stream (MANDATORY — do NOT batch)

**MUST write to disk before starting next stream.** This ensures resumability if context is lost.
Stream sections: Stream 1 → `sf_schema.objects` + `.field_inventory` + `.record_types`, Stream 2 → `sf_schema.relationships`, Stream 3 → `sf_schema.pii_fields` + `.field_analysis`

1. [IO] Write `{{context_file}}.sf_schema.[stream_section]` → save to disk
2. [GEN] Extend `{{context_file}}.synthesis` + `.synthesis.assumptions[]` with new evidence
3. [IO] Append to `{{context_file}}.run_state.completed_steps[]`
4. [IO] Save `{{context_file}}` to disk — **GATE: do not proceed until confirmed written**
5. On batch failure: log failed objects to `run_state.errors[]`; save to disk; continue with successes

## Context Paths

`{{research_root}}` = `{{paths.artifacts_root}}/sf-research/{{sanitized_name}}`
`{{context_file}}` = `{{research_root}}/research-context.json`

## Prerequisites [IO]

A1 [IO]: Load `{{context_file}}`; verify:

- `"ado_discovery"` in `metadata.phases_completed`
- `scope.sf_objects` has ≥1 entry
  A2 [LOGIC]: **Salesforce Org Resolution** (see `util-research-base` § Salesforce Org Resolution):
  Orgs are resolved automatically from `config/sf-orgs.json` (configured via `crm-tools org-setup`).
  Each crm-tools command uses `--role <role>` to target the correct org:
- SOQL queries → `--role modernData`
- Metadata/describe → `--role modernMetadata`
- Data Cloud operations → `--role dataCloud`
- General/unspecified → `--role primary` (or omit for default)
  Resolution chain: explicit `--org` > role config > designation fallback > primary > SF CLI default.
  If config missing or connection fails → ask user which org, suggest running `npx --prefix scripts/workflow crm-tools org-setup`.
  A2.5 [CLI]: Verify SF auth: `{{cli.sf_query}} "SELECT Id FROM Organization LIMIT 1" --role primary --json`
  A3: **STOP** if any prerequisite missing. Log to `run_state.errors[]` and save.

**NOTE:** Pass `--role modernMetadata` (for describe/discover) or `--role modernData` (for SOQL queries) to crm-tools commands in this phase.

## Mission Anchor [IO/GEN]

**Before any research begins, ground yourself in the mission.**

MA1 [IO]: From `{{context_file}}`, read and internalize:

- `scope.feature_area` — **what** we are researching (e.g., "Journey Pipeline")
- `scope.research_purpose` — **why** we are researching it
- `scope.sf_objects[]` — the Salesforce objects to describe
- `scope.domain_keywords[]` — domain terms for contextual understanding
- `ado_research.business_context.feature_purpose` — what the business says this feature does
- `synthesis.unified_truth` — cumulative understanding from prior phases

MA2 [GEN]: State the mission: _"I am documenting the Salesforce object model for **{{scope.feature_area}}**. The objects in scope are: {{scope.sf_objects | join(", ")}}. The business context is: {{ado_research.business_context.feature_purpose | truncate(150)}}. My goal is to produce a complete schema inventory that an architect can use to understand how these objects support {{scope.feature_area}}."_

MA3: **Carry this context through every stream.** When analyzing fields, note which ones are central to the feature's business purpose. When mapping relationships, highlight those that form the backbone of {{scope.feature_area}}. When flagging PII, consider the feature's data sensitivity profile.

---

## Schema Output Structure

All outputs to `{{context_file}}.sf_schema`:

- `objects[]` — `{ api_name, label, description, is_custom, key_prefix, field_count, custom_field_count, formula_field_count, fields_with_description_count, fields_with_help_text_count, encrypted_field_count, record_type_count, child_relationships[] }`
- `field_inventory[]` — full field metadata (see Stream 1 Field Extraction for complete property list)
- `relationships[]` — `{ from_object, to_object, field_name, relationship_type, relationship_name, is_cascade_delete, is_restricted_delete, is_polymorphic, write_requires_master_read }`
- `record_types[]` — `{ object, api_name, label, description, is_active, is_default }`
- `pii_fields[]` — `{ object, field, type, sensitivity_reason, is_encrypted, has_field_level_security_note }`
- `field_analysis` — `{ by_category: {}, formula_dependencies[], cross_object_formulas[], field_population_rates[] }`

---

## Stream 1 [CLI/GEN] – Object Schema Discovery

**Goal:** Full field inventory and record types for all **{{scope.feature_area}}** objects → `{{context_file}}.sf_schema.objects` + `.field_inventory` + `.record_types`

### Describe Objects (batch when multiple)

B1 [CLI]: `{{cli.sf_describe}} {{obj1}},{{obj2}},{{objN}} --batch --role modernMetadata --json`

- If single object: `{{cli.sf_describe}} {{object}} --role modernMetadata --json`
- Extract per object: label, description, isCustom, keyPrefix, fields[], recordTypeInfos[], childRelationships[]

### Field Extraction

B2 [GEN]: For each object's fields[], extract the **full field descriptor**:

**Identity & Labels:**

- `api_name` (name), `label`, `type`, `custom` (boolean)
- `description` (field-level description — often empty but critical when present)
- `help_text` (inlineHelpText — user-facing guidance)

**Data Type Details:**

- `length` (for String/TextArea), `precision` and `scale` (for Number/Currency/Percent)
- `byte_length` (byteLength — actual storage size)
- `digits` (for Integer fields)
- `soap_type` (soapType — the underlying SOAP type, e.g., xsd:string, xsd:double)

**Formula & Calculated:**

- `formula` (calculatedFormula — the full formula text; null if not a formula field)
- `calculated` (boolean — true for formula fields)
- `formula_treat_blanks_as` (formulaTreatBlanksAs — "BlankAsZero" or "BlankAsBlank")
- `default_value` (defaultValue — static default)
- `default_value_formula` (defaultValueFormula — formula-based default)

**Constraints & Behavior:**

- `required` (nillable = false AND createable = true — truly required for user input)
- `unique` (boolean), `case_sensitive` (caseSensitive — for unique fields)
- `external_id` (externalId — boolean)
- `auto_number` (autoNumber — boolean, for auto-number fields)
- `name_field` (nameField — boolean, the record Name field)
- `id_lookup` (idLookup — can be used for upsert)
- `restricted_picklist` (restrictedPicklist — values cannot be added via API)
- `encrypted` (encrypted — Shield Platform Encryption)

**Access & Permissions:**

- `createable`, `updateable`, `nillable` (can be set to null)
- `filterable`, `sortable`, `groupable`
- `html_formatted` (htmlFormatted — rich text field)

**Relationship Details** (when type = "reference"):

- `reference_to[]` (referenceTo — target object(s); multiple = polymorphic)
- `relationship_name` (relationshipName — for SOQL relationship queries)
- `relationship_order` (relationshipOrder — 0 for master-detail primary, 1 for secondary)
- `cascade_delete` (cascadeDelete — master-detail cascade behavior)
- `restricted_delete` (restrictedDelete — prevent parent delete if children exist)
- `write_requires_master_read` (writeRequiresMasterRead — sharing inheritance)

**Picklist Details** (when type = "picklist" or "multipicklist"):

- `picklist_values[]` — `{ value, label, is_active, is_default }` for each entry
- `dependent_picklist` (dependentPicklist — boolean)
- `controller_name` (controllerName — controlling field for dependent picklists)

**Compound Fields:**

- `compound_field_name` (compoundFieldName — parent compound field, e.g., "BillingAddress" for BillingStreet)
- `name_pointing_to[]` (namePointing — for Name compound fields)

B3 [GEN]: Categorize each field into **primary category** (mutually exclusive):

- **auto_number** — autoNumber = true
- **formula** — calculated = true AND calculatedFormula is populated
- **rollup_summary** — type = "summary" (Rollup Summary fields via master-detail)
- **master_detail** — type = "reference" AND cascadeDelete = true
- **lookup** — type = "reference" AND cascadeDelete = false (or null)
- **external_lookup** — type = "externalLookup"
- **indirect_lookup** — type = "indirectLookup"
- **picklist** — type = "picklist" (single-select)
- **multipicklist** — type = "multipicklist"
- **rich_text** — htmlFormatted = true
- **encrypted** — encrypted = true (regardless of underlying type)
- **standard** — custom = false AND none of the above
- **custom** — custom = true AND none of the above

B3.5 [GEN]: Assign **secondary tags** (non-exclusive, a field can have multiple):

- `is_required` — required = true
- `is_unique` — unique = true
- `is_external_id` — externalId = true
- `is_indexed` — externalId = true OR unique = true OR idLookup = true
- `has_description` — description is non-empty
- `has_help_text` — help_text is non-empty
- `has_default` — defaultValue or defaultValueFormula is non-empty
- `is_dependent` — dependentPicklist = true
- `is_compound_child` — compoundFieldName is non-empty
- `is_name_field` — nameField = true
- `is_read_only` — createable = false AND updateable = false (system-managed)

B4 [GEN]: Store each field as a complete descriptor → `sf_schema.field_inventory[]`:

```json
{
  "object": "",
  "api_name": "",
  "label": "",
  "type": "",
  "custom": false,
  "description": "",
  "help_text": "",
  "length": null,
  "precision": null,
  "scale": null,
  "formula": null,
  "formula_treat_blanks_as": null,
  "default_value": null,
  "default_value_formula": null,
  "required": false,
  "unique": false,
  "case_sensitive": false,
  "external_id": false,
  "auto_number": false,
  "encrypted": false,
  "createable": false,
  "updateable": false,
  "nillable": false,
  "filterable": false,
  "sortable": false,
  "groupable": false,
  "reference_to": [],
  "relationship_name": null,
  "cascade_delete": false,
  "restricted_delete": false,
  "picklist_values": [],
  "dependent_picklist": false,
  "controller_name": null,
  "compound_field_name": null,
  "category": "",
  "tags": []
}
```

### Record Types

B5 [GEN]: For each object's recordTypeInfos[], extract:

- `api_name` (developerName), `label` (name), `description`, `isActive`, `isDefault`
- Skip Master record type unless it is the only one
  B6 [GEN]: Store → `sf_schema.record_types[]`

### Object Summary

B7 [GEN]: Per object, build summary:

- `api_name`, `label`, `description`, `is_custom`, `key_prefix`
- `field_count` (total fields), `custom_field_count`, `formula_field_count`
- `fields_with_description_count` (fields where description is non-empty)
- `fields_with_help_text_count` (fields where help_text is non-empty)
- `encrypted_field_count` (fields with Shield encryption)
- `record_type_count` (active record types)
- `child_relationships[]` from childRelationships (relationship name + child object)
  B8 [GEN]: Store → `sf_schema.objects[]`

---

## Stream 2 [CLI/GEN] – Relationship Mapping

**Goal:** Map all relationships between **{{scope.feature_area}}** objects and their connected objects — understanding how data flows through this feature → `{{context_file}}.sf_schema.relationships`

### Dependency Discovery

C1 [CLI]: For each in-scope object:

- `{{cli.sf_discover}} --type CustomObject --name {{object}} --depth 3 --role modernMetadata --json`
  C2 [GEN]: From describe results (Stream 1) + discover results, extract all relationships:
- **Master-Detail** — `referenceTo` where relationship is MasterDetail; note cascade delete behavior
- **Lookup** — `referenceTo` where relationship is Lookup
- **Hierarchical** — self-referencing lookup (same object in `referenceTo`)
- **External Lookup** — `type` = "externalLookup"
- **Indirect Lookup** — `type` = "indirectLookup"
  C3 [GEN]: Identify junction objects — objects with 2+ master-detail relationships to in-scope objects
  C4 [GEN]: Identify polymorphic lookups — fields with multiple `referenceTo` values (WhatId, WhoId patterns)
  C5 [GEN]: Build relationship entries:
- `{ from_object, to_object, field_name, relationship_type, relationship_name, is_cascade_delete, is_restricted_delete, is_polymorphic, write_requires_master_read }`
  C6 [GEN]: Store → `sf_schema.relationships[]`

### Scope Expansion Detection

C7 [GEN]: Identify objects outside initial scope that have significant relationships to in-scope objects:

- Objects with master-detail relationships (critical — cascade delete implications)
- Objects with ≥3 lookup references to in-scope objects
- Flag as `synthesis.assumptions[]` entry: "Object {{name}} may need investigation — {{reason}}"
- Do NOT auto-expand scope — flag for user review in completion report

---

## Stream 3 [GEN] – Field Analysis

**Goal:** Categorize **{{scope.feature_area}}** fields by purpose, flag PII, and trace formula dependencies that drive this feature's behavior → `{{context_file}}.sf_schema.pii_fields` + `.field_analysis`

### Field Categorization

D1 [GEN]: Categorize all fields in `field_inventory[]` by purpose:

- **identifiers** — Id, Name, external ID fields, unique fields
- **classification** — picklists, record type, status/stage fields
- **dates_timestamps** — Date, DateTime, CreatedDate, LastModifiedDate, custom date fields
- **metrics** — Number, Currency, Percent, formula-calculated values
- **text_rich_text** — String, TextArea, LongTextArea, Html
- **relationships** — Lookup, MasterDetail (from Stream 2)
- **system** — CreatedById, LastModifiedById, OwnerId, IsDeleted
  D2 [GEN]: Store category counts per object → `sf_schema.field_analysis.by_category`

### PII Detection

D3 [GEN]: Flag fields with PII/sensitivity indicators:

- **Name patterns** — field api_name contains: Email, Phone, SSN, Social, Address, Birth, DOB, Mobile, Fax, Tax, Passport, License, National, Gender
- **Type patterns** — type = "email", type = "phone"
- **Label patterns** — label contains: email, phone, social security, date of birth, address, personal, tax, passport, license, national id, gender
- **Description/Help patterns** — description or help_text mentions PII, personal, sensitive, confidential, HIPAA, GDPR, protected
- **Encryption** — any field with encrypted = true (Shield Platform Encryption)
- **Compound address fields** — compoundFieldName contains "Address"
  D4 [GEN]: Store → `sf_schema.pii_fields[]`:
- `{ object, field, type, sensitivity_reason, is_encrypted, has_field_level_security_note }`

### Formula Dependencies

D5 [GEN]: For each formula field in `field_inventory[]`:

- Parse formula text for field references (`ObjectName.FieldName` or `FieldName`)
- Identify cross-object formula references (fields from related objects via relationship)
  D6 [GEN]: Store → `sf_schema.field_analysis.formula_dependencies[]`:
- `{ object, formula_field, referenced_fields[], cross_object_references[] }`
  D7 [GEN]: Store cross-object formulas separately → `sf_schema.field_analysis.cross_object_formulas[]`:
- `{ object, formula_field, referenced_object, referenced_field, relationship_path }`

### Field Population Rates

D8 [CLI]: For objects with high field counts (>50 custom fields):

- `{{cli.sf_query}} "SELECT COUNT(Id) FROM {{object}} WHERE {{field}} != null" --role modernData --json` for custom fields (max 10 queries per object)
  D9 [GEN]: Record population rate for each queried field → `sf_schema.field_analysis.field_population_rates[]`:
- `{ object, field, population_rate }`

---

## Completion [IO/GEN]

Update `{{context_file}}`:

- `metadata.phases_completed` append `"sf_schema"`
- `metadata.current_phase` = `"sf_automation"`
- `metadata.last_updated` = ISO timestamp
- Extend `synthesis.unified_truth` with:
  - `object_model_summary` — count of objects, total fields, total custom fields, total formula fields, total relationships, record types
  - `documentation_coverage` — % of fields with descriptions, % with help text
  - `key_relationships` — master-detail relationships, polymorphic lookups, relationship counts per object
  - `data_sensitivity` — PII field count, encrypted field count, objects with sensitive data
- Append `{"phase":"sf_schema","step":"complete","completedAt":"<ISO>","artifact":"{{context_file}}"}` to `run_state.completed_steps[]`
- Save to disk

Tell user: **"Schema discovery for {{scope.feature_area}} complete. {{object_count}} objects, {{field_count}} fields, {{relationship_count}} relationships mapped. Key findings: {{synthesis.unified_truth.object_model_summary | brief}}. Use `/feature-research-phase-03b` for automation discovery."**

---

## Error Handling

| Scenario                        | Action                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Context file missing            | **STOP** — "Run `/feature-research-phase-01` first"                 |
| Phase 02 not completed          | **STOP** — "Run `/feature-research-phase-02` first"                 |
| SF auth failure                 | **STOP** — "Run `sf org login web` first"                           |
| sf_describe fails for an object | Log to `run_state.errors[]`; continue with remaining objects        |
| sf_discover fails               | Log error; rely on describe data for relationships; note limitation |
| Object has 0 fields returned    | Log warning; likely permissions issue; note in synthesis            |
| Very large object (500+ fields) | Process all fields; note field count in object summary              |
