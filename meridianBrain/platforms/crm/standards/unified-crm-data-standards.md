# Unified CRM Data Standards

> **Meridian:** Active — Copilot `#file:platforms/crm/standards/unified-crm-data-standards.md` on grooming (Data Cloud / intake).

Data Cloud is the strategic enterprise data layer. It is the default platform for external data ingestion, unified data modeling, identity resolution, transformations, calculated insights, field enrichments, and activation. **Core Salesforce and SFMC are downstream systems of execution and engagement** that consume trusted data products from Data Cloud rather than building separate inbound integrations or duplicating transformation logic.

## Multi-Org Architecture

Data Cloud is implemented in the **Ed Cloud org**, which may differ from the CRM org being queried during research. Data Cloud One makes the same DLOs and DMOs available across both orgs. When evaluating solutions:

- Data Cloud DMO discovery requires querying the **Ed Cloud org**
- DLOs/DMOs created in Ed Cloud are accessible from both orgs via Data Cloud One
- The SF org used for Data Cloud queries may need to be selected separately from the CRM research org

## First Decision Question

Ask this first during intake and solutioning:

> _Is the request fundamentally about enterprise data unification, enrichment, and activation — or is it about operational execution inside Salesforce?_

- **Unification, enrichment, identity, transformation, or activation** → start with Data Cloud
- **Transactional workflow, UI, approvals, routing, or record lifecycle** → start with core Salesforce
- **Both** → Data Cloud produces the intelligence; core Salesforce or SFMC operationalizes it

## Architecture Principles

### 1. Data Cloud is the entry point for external data

All new external data integrations should land in Data Cloud first, not directly into core CRM or SFMC. This includes data from ERP, SIS, Workday, finance, telephony, web, event, marketing, service, third-party platforms, partner/vendor systems, and batch/streaming/API-based inbound feeds.

**Rule:** No new point-to-point integrations directly into core Salesforce or SFMC unless there is an approved exception.

### 2. Data Cloud owns the unified enterprise data model

If a capability requires enterprise-wide understanding of a person, organization, interaction, relationship, or lifecycle state, that model should be established in Data Cloud. Canonical entities and reusable enterprise attributes belong in Data Cloud, not scattered across CRM custom objects or SFMC contact model extensions.

### 3. Data Cloud owns enterprise transformation logic

Transformations, standardization, harmonization, matching, and derived attributes should be built in Data Cloud whenever they support cross-domain reuse. Examples: standardized contactability flags, unified engagement indicators, lifecycle stage derivation, eligibility/propensity signals, normalized interaction summaries.

**Rule:** Do not duplicate enterprise transformation logic in Flow, Apex, CRM formulas, or SFMC SQL if it should be centrally governed in Data Cloud.

### 4. Data Cloud owns calculated insights and enrichments

Calculated insights, enriched fields, and profile augmentation should be generated in Data Cloud when intended to power multiple downstream processes. Examples: engagement score, risk indicator, next best audience, service propensity, household summary, channel preference, contactability enrichment.

**Rule:** If a field is derived from multiple systems, historical data, or enterprise rules, Data Cloud should be the source.

### 5. Data Cloud drives activation

Segmentation and activation should originate from Data Cloud wherever possible. Examples: activating audiences into SFMC, triggering downstream action in Salesforce based on segment membership or insight thresholds, supporting targeted journeys and prioritization from unified profile intelligence.

**Rule:** Determine who qualifies, who belongs, or who should be targeted in Data Cloud. Let downstream platforms execute the operational or engagement action.

### 6. Core Salesforce consumes, operationalizes, and displays

Core Salesforce remains the execution layer for transactional workflows, record management, case/service processes, guided user experiences, page layouts/Lightning pages, approvals, validations, and object lifecycle automation.

Core Salesforce should consume Data Cloud outputs through: mapped profile attributes, related lists sourced from Data Cloud, Data Cloud-triggered or Data Cloud-informed automation, activation outputs used in CRM processes.

### 7. SFMC consumes activated data — it should not become a parallel data hub

SFMC should receive audiences, attributes, and activation-ready data from Data Cloud rather than independently replicating enterprise integration and transformation patterns. SFMC is for campaign orchestration and engagement execution, not for rebuilding a separate customer data platform.

## Target Architecture Pattern

```
External Systems → Data Cloud ingestion → identity resolution / transformation / enrichment / calculated insights / activation → Core Salesforce and SFMC consumption
```

- New external data lands in Data Cloud
- Unified and enriched profile data is produced in Data Cloud
- Data Cloud related lists expose cross-source context into CRM experiences
- Core Salesforce uses that intelligence for workflow and execution
- SFMC uses Data Cloud activations for audiences and engagement

## Architecture Layers

| Layer                                 | Purpose                                             | Examples                                                                                 | Naming                            |
| ------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------- |
| **Foundation/Identity**               | Person resolution across source systems             | Individual, Unified Individual, Party ID, Contact Points                                 | Standard DMOs (`ssot__*__dlm`)    |
| **Reference**                         | Shared lookup dimensions                            | Academic Terms, Courses, Programs, Funds, Campaigns                                      | `<Prefix>_Ref_<Entity>Dim__dlm`   |
| **Layer 1 — Atomic Truth**            | Row-level facts (one event/record per row)          | Lead Details, Application Details, Term Enrollment, Engagement Events, Gift Transactions | `<Prefix>_<Domain>_<Entity>__dlm` |
| **Layer 2 — Calculated Intelligence** | Person-level summaries via Calculated Insights      | Lead Summary, Enrollment Summary, Giving Summary, Term Perspectives                      | `CI_Person_<Domain>_Summary`      |
| **Layer 3 — Activation**              | Curated views feeding journeys, segments, analytics | Person Current View                                                                      | Activation targets                |

## Grain Principles

- **Grain First** — every DMO has exactly one grain (one row = one fact/event)
- **Atomic Truth + Derived Summaries** — store raw facts in Layer 1; derive Latest/Count/Sum via Calculated Insights, NEVER via formula fields or Apex
- **Domain Separation** — cross-domain joins only at Individual/Unified Individual level
- **Standard DMOs before custom** — use Identity, Consent, Engagement standard DMOs when they fit the grain and semantics
- **Never activate raw facts** — always go through Calculated Insight or Person Current View layer before journeys, segments, or reports

## Standard Key Fields

Every custom DMO MUST include:

| Field                 | Type     | Purpose                                           |
| --------------------- | -------- | ------------------------------------------------- |
| `PersonId`            | String   | Link to Individual (source profile)               |
| `UnifiedIndividualId` | String   | Link to Unified Individual (cross-source queries) |
| `SourceSystem`        | String   | Originating system identifier                     |
| `SourceRecordId`      | String   | Primary key in source system                      |
| `CreatedDT`           | DateTime | Event/record creation timestamp                   |

Additional for time-bounded records: `EffectiveStartDT` / `EffectiveEndDT`

## When Data Cloud Should Be the Default Choice

Choose Data Cloud first when one or more are true:

| Signal                                    | Description                                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- |
| **Cross-system data required**            | Requirement depends on information from multiple systems or domains                          |
| **Identity resolution needed**            | Matching across multiple identifiers, source systems, or profiles                            |
| **Enterprise transformations needed**     | Data harmonization, normalization, business-rule-based derivation, canonical modeling        |
| **Field enrichments needed**              | Enriched attributes reusable across channels, apps, or business units                        |
| **Calculated insights needed**            | Scores, summaries, flags, rollups, eligibility indicators, analytical metrics                |
| **Activation needed**                     | Segmentation, audience creation, or downstream activation into CRM, SFMC, or other platforms |
| **External integration in scope**         | New external data must be introduced — it enters through Data Cloud                          |
| **Reuse across teams/workflows expected** | Data or logic should be leveraged by more than one process                                   |

## When Core Salesforce Should Be the Default Choice

Choose core Salesforce first when most of these are true:

| Signal                                     | Description                                                                                                     |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **Primarily user workflow**                | Lightning pages, screen flows, approvals, routing, tasking, case handling, guided interactions                  |
| **Transactional and object-centric logic** | When a Case is created assign it; when a Lead is updated validate it; when a form is submitted create follow-up |
| **Data local to a bounded process**        | Only needed for a specific CRM transaction with no broader enterprise reuse                                     |
| **UI or process execution improvement**    | Value comes from helping users work better in Salesforce, not from enterprise data harmonization                |

## Data Cloud Related Lists

Use Data Cloud related lists when a Salesforce user needs visibility into unified or external-context information that should not be recreated as native CRM records just to support the page experience:

- The user needs contextual visibility into cross-system interactions or attributes
- The data is mastered or aggregated in Data Cloud
- Duplicating the data into CRM objects would create unnecessary replication or storage overhead
- The page should show unified profile context without redesigning the CRM data model

Do not force all contextual data into core CRM objects if Data Cloud related lists can serve the use case.

## DMO Naming Conventions

Naming conventions for DMOs, DLOs, calculated insights, segments, activations, and related Data Cloud assets are defined in `metadata-naming-conventions.md`.
| Term Perspectives | `CI_Person_<Qualifier>_Term` | `CI_Person_First_Term` |

**Domain names:** Lead, Application, Enrollment, Engagement, Consent, Assignment, Scoring, Advancement, Alumni

## Anti-Patterns

| Anti-Pattern                                           | Correct Approach                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| Direct external integration into core Salesforce       | All new external inbound data lands in Data Cloud first                                |
| Direct external integration into SFMC                  | SFMC receives activated data from Data Cloud, not raw integrations                     |
| `Latest_Application_Date__c` formula field on Contact  | `CI_Person_Application_Summary` with `LastApplicationSubmittedDT` metric               |
| Apex batch job to count enrollments per person nightly | `CI_Person_Enrollment_Summary` with `TotalTermsEnrolled` metric                        |
| Flow calculating "total engagement score" on Lead      | `CI_Person_Engagement_Summary` with engagement score metric                            |
| Rebuilding enrichment logic in CRM (Apex/Flow/formula) | Enterprise enrichment belongs in Data Cloud                                            |
| Duplicating identity resolution outside Data Cloud     | Enterprise matching belongs in Data Cloud, not scattered object logic                  |
| Custom object `Person_Summary__c` with rollup fields   | Layer 2 Calculated Insight — single source of truth                                    |
| Copying large volumes of contextual data into CRM      | Use Data Cloud related lists instead of creating CRM objects for display               |
| Process Builder triggering journey on CRM field change | Activation from Person Current View via Data Cloud segmentation                        |
| Direct joins between Enrollment DMO and Giving DMO     | Join only at Individual/Unified Individual level in CI                                 |
| Activating raw Layer 1 fact table to Journey Builder   | Route through Layer 2 CI or Layer 3 Person Current first                               |
| Using core Salesforce because it is faster short-term  | Faster is not the same as architecturally correct — evaluate target architecture first |

## What Data Cloud Does NOT Replace

- **Transactional CRM automation** — before-save triggers, field validation, record-triggered flows on single records
- **Real-time synchronous processing** — Data Cloud is eventually consistent; sub-second UI responses stay in CRM
- **Screen Flows and guided processes** — UI-driven interactions remain CRM-native
- **Record-level security** — OWD, sharing rules, FLS enforcement stays in CRM
- **Standard CRM operational objects** — Opportunity pipeline, Case management, standard object workflows

## Evaluation Questions for Refinement and Solutioning

### Integration and source

- Does this request require new inbound data from an external system? → Data Cloud
- If yes, can that integration land in Data Cloud first?
- Would direct integration into CRM or SFMC violate the target architecture?

### Data and modeling

- Is this data part of the unified enterprise profile or interaction model? → Data Cloud
- Should this attribute or entity be reusable beyond one process?
- Does this belong in the canonical model?

### Enrichment and insight

- Does the request require derived fields, enrichments, scores, or calculated insights? → Data Cloud
- Should those outputs be reusable by multiple teams, channels, or platforms?
- Is historical or cross-channel context required?

### Activation

- Does this feature need segmentation or audience-based activation? → Data Cloud
- Should Data Cloud determine qualification, membership, or targeting?
- Should SFMC or Salesforce simply execute based on Data Cloud output?

### CRM execution

- Is the primary problem a UI, workflow, routing, approval, or case management need? → CRM
- Is the logic tied to a specific Salesforce object lifecycle?
- Is this operational execution rather than enterprise data intelligence?

### Experience

- Could Data Cloud related lists provide the needed unified context in the Salesforce UI?
- Would replicating this data into CRM create unnecessary duplication?

### Governance

- Would implementing this directly in CRM or SFMC create duplicate logic?
- Would it weaken the target architecture?
- Are we introducing technical debt by bypassing Data Cloud?

## Intake Checklist

| Question                                     | Answer                  |
| -------------------------------------------- | ----------------------- |
| External source data required?               | Yes/No                  |
| New external integration required?           | Yes/No                  |
| Should inbound data land in Data Cloud?      | Yes/No                  |
| Unified model impact?                        | Yes/No                  |
| Identity resolution required?                | Yes/No                  |
| Transformation or harmonization required?    | Yes/No                  |
| Field enrichment required?                   | Yes/No                  |
| Calculated insight required?                 | Yes/No                  |
| Activation or segmentation required?         | Yes/No                  |
| Data Cloud related list opportunity?         | Yes/No                  |
| Primarily transactional CRM workflow?        | Yes/No                  |
| Primarily SFMC execution need?               | Yes/No                  |
| **Recommended system of intelligence**       | Data Cloud / CRM / Both |
| **Recommended system of execution**          | CRM / SFMC / Both       |
| Exception required from target architecture? | Yes/No                  |

## Decision Rule

**Put it in Data Cloud first if:** The request's value comes from external data ingestion, unification, identity resolution, transformation, enrichment, calculated insight, or activation.

**Put it in core Salesforce first if:** The request's value comes from transaction execution, UI behavior, case or record workflow, or operational process support.

**Use both if:** The request needs Data Cloud to produce the data product or insight, and Salesforce or SFMC to operationalize it.
