# Share – Salesforce Research

> **Meridian:** Active — Copilot `#file:platforms/crm/knowledge/share-salesforce-research.md` on deep SF phases.

Patterns for investigating Salesforce metadata, dependencies, and data patterns.
References: `#file:config/platform-salesforce/share-salesforce.md` → `#file:config/core/share-core.md`
NEVER references ADO work items, template engine.

## Metadata Discovery Pattern

Standard sequence for any SF investigation:

1. **Describe objects** — `sf-tools describe` to understand fields, relationships, record types
2. **Discover dependencies** — `sf-tools discover` to map metadata dependencies (depth 3+)
3. **Query Tooling API** — `sf-tools query --tooling` for ApexClass, ApexTrigger, Flow metadata
4. **Analyze automation** — flows, triggers, apex classes, validation rules touching the objects

Order matters: describe first (understand the object), then discover (map dependencies), then analyze automation (understand behavior).

## Standards Comparison Protocol

After discovering component types, load the relevant standards and compare:

| Component Type        | Standard File                                                                 |
| --------------------- | ----------------------------------------------------------------------------- |
| Apex classes/triggers | `config/platform-salesforce/standards/apex-well-architected.md`               |
| Flows                 | `config/platform-salesforce/standards/flow-well-architected.md`               |
| Trigger framework     | `config/platform-salesforce/standards/trigger-actions-framework-standards.md` |
| Async processing      | `config/platform-salesforce/standards/async-processing-standards.md`          |
| Events                | `config/platform-salesforce/standards/event-driven-architecture-standards.md` |
| Data model            | `config/platform-salesforce/standards/unified-crm-data-standards.md`          |
| Naming                | `config/platform-salesforce/standards/metadata-naming-conventions.md`         |
| LWC                   | `config/platform-salesforce/standards/lwc-well-architected.md`                |
| Logging               | `config/platform-salesforce/standards/nebula-logger-standards.md`             |
| Feature flags         | `config/platform-salesforce/standards/feature-flags-standards.md`             |
| Profiles/permissions  | `config/platform-salesforce/standards/profiles-permissions-standards.md`      |

Compare discovered patterns vs standards; flag non-compliance with severity (info/warning/critical).

## Impact Assessment Framework

Count downstream dependencies per component:

- **Low:** <50 dependencies
- **Medium:** 50–100 dependencies
- **High:** 100–500 dependencies
- **Critical:** >500 dependencies

Categorize by type (field references, flow dependencies, apex references, validation rules, page layouts).
Identify circular dependencies. Assess cumulative compound risk when multiple components are affected.

## Data Cloud Evaluation

First-decision question: Is this requirement about **enterprise data unification** (Data Cloud) or **operational execution** (standard CRM)?

Intake checklist:

- Does it involve cross-cloud data harmonization?
- Does it require identity resolution across systems?
- Does it need calculated insights or segmentation?
- Is real-time streaming ingestion required?

If ≥2 answers are yes → evaluate Data Cloud architecture. Otherwise → standard CRM patterns.
Record architectural signals for solution design. Reference: `config/platform-salesforce/standards/unified-crm-data-standards.md`

## PII Detection Pattern

When analyzing objects/fields:

1. Identify encrypted fields (`isEncrypted: true`)
2. Check field-level security settings
3. Classify field sensitivity: Public / Internal / Confidential / Restricted
4. Flag fields with PII indicators (name, email, phone, SSN, address patterns)

## Business SOQL Patterns

For understanding data volumes and patterns (business data only — not Tooling API):

- **Record volume:** `SELECT COUNT() FROM {{object}}`
- **Data distribution:** `SELECT {{field}}, COUNT(Id) FROM {{object}} GROUP BY {{field}}`
- **Field population rates:** `SELECT COUNT(Id) FROM {{object}} WHERE {{field}} != null`
- **Date-scoped queries:** always include `WHERE CreatedDate >= {{date}}` to avoid scanning entire tables
