# Organization Metadata Naming Conventions

> **Meridian:** Active — `util-pr-analysis` always-load `#file:`.

This is the team's single source of truth for naming metadata across Salesforce, Data Cloud, and Salesforce Marketing Cloud (SFMC). It serves two goals: provide a clear standard and teach the reasoning so you can make good decisions in new situations.

**Scope:** target-state metadata across Salesforce, Data Cloud, and SFMC; shared naming alignment for cross-platform capabilities, programs, integrations, and enterprise data constructs; naming exceptions and migration expectations for legacy assets.

**Out of scope:** deprecated technologies adopted only for legacy support; niche cloud-specific metadata families unless called out as future extensions.

---

## How to Use This Standard

This document is organized from foundational thinking to platform-specific patterns. If you are new to the team, read the first three sections in order — they build on each other and will save you from the most common naming mistakes. If you already know the principles, jump to the platform section that matches your work.

**Reading approach:**

- Start with "Why Naming Matters" — understand the real cost of bad names.
- Read "Core Principles" — internalize the small set of rules that drive every pattern in this document.
- Read "The Extension-First Mental Model" — this is the single most important concept. Most naming mistakes happen here.
- Jump to the platform section for the artifact you are naming.
- Use the review checklist at the end as a coaching tool during peer review, not as a gatekeeping exercise.

**How to use the examples:**

- Treat examples as defaults, not copy-paste fragments. Replace business terms with the real domain language for your work.
- When a scenario does not match an example exactly, follow the intent and rules for that section before inventing a new pattern.
- If a name feels shorter but less clear, prefer the clearer name. Future readers will encounter it without your project context.

---

## Why Naming Matters

Naming feels like a small decision, but it compounds. Every metadata name you create will be read by dozens of people in dozens of contexts — setup lists, deployment diffs, reports, formulas, error logs, integration mappings, support tickets, and code reviews. A name that makes sense to you today will be read by someone who has never seen your project, possibly years from now, possibly during a production incident at midnight.

**The real cost of bad names:**

| Scenario                                       | What happens                                                                       | Business impact                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| A field called `Status` exists on five objects | Report builders pick the wrong one; support analysts misread dashboards            | Incorrect executive reporting, wasted meeting time                              |
| A flow called `Case Updates` exists            | No one knows which updates, which cases, or when it fires                          | Developers avoid modifying it; bugs persist because the blast radius is unclear |
| A Data Cloud attribute called `Date` exists    | Downstream activations use it incorrectly; SFMC journeys trigger on the wrong date | Wrong students receive wrong communications at wrong times                      |
| A permission set called `Custom Access` exists | Admins duplicate it rather than risk changing it; permission sprawl grows          | Security audit failures, over-provisioned users                                 |
| An LWC called `dataTable` exists               | No one knows which app owns it or what data it shows                               | Developers build duplicates; maintenance cost doubles                           |

These are not hypothetical — they are patterns the team has encountered. The naming standard exists to prevent them.

**What good naming buys you:**

- **Searchability.** An admin searching setup for "Application" finds everything related to applications.
- **Auditability.** A security reviewer reading permission set names can tell who gets what and why.
- **Debuggability.** A developer reading error logs can trace the source without opening metadata.
- **Onboarding speed.** A new team member can navigate the org without a guided tour.
- **Deployment confidence.** A release manager reviewing a changeset can spot unrelated metadata immediately.

---

## Core Principles

These principles apply to every artifact in every platform. When a specific pattern section does not cover your exact scenario, fall back to these rules.

### Prefer business meaning over implementation detail

Name metadata after what it represents in the business, not how it is built. A field that stores whether an applicant qualifies for a fee waiver should be called `Application Fee Waiver Eligible`, not `FeeWaiverFlag` or `fwElig`. Implementation details change; business meaning is stable.

**Good:** `Application Decision` — describes the business concept.
**Bad:** `AppDec_Tbl` — describes a database artifact with abbreviations.

### Prefer clarity over brevity

If a name feels shorter but also less clear, choose the clearer name. The few extra characters cost nothing compared to the hours lost when someone misreads a truncated name in a report or formula.

**Good:** `ApplicationStatusLastChangeDate__c`
**Bad:** `AppStatLCD__c`

### Use platform-native casing and separators

Do not force one global syntax onto every artifact. Salesforce labels use spaces. API names use PascalCase or underscores depending on the metadata type. Apex uses camelCase for variables. LWC folder names use camelCase. SFMC data extension columns use PascalCase without spaces. Follow the platform convention so names feel natural in their environment.

### Do not encode transient information

Never put environments, ticket IDs, sprint numbers, dates, or personal names into permanent metadata. These create confusion for every reader who encounters the name after the ticket is closed or the sprint ends.

**Good:** `Application - Subflow - Build reviewer summary`
**Bad:** `US-12345 - Application reviewer flow - Chris v2 PROD`

### Keep names consistent across platforms

When Salesforce, Data Cloud, and SFMC all describe the same business concept, use the same domain term, entity term, and program name. If the Salesforce field is `Application Status`, the Data Cloud attribute should be `Application Status`, not `App_Stat` or `AppStatus`.

### Optimize for the reader, not the writer

Think about who will read the name and where they will read it:

- **Integration-facing artifacts** (events, credentials, APIs): optimize for clarity in logs, deployment diffs, and support workflows.
- **User-facing artifacts** (apps, tabs, labels, reports): optimize for readability and business recognition.
- **Developer-facing artifacts** (classes, components, variables): optimize for role clarity and source control navigation.

---

## The Extension-First Mental Model

This is the single most important concept in this document. Most naming mistakes happen because the team names the attribute and forgets to name the business concept it extends.

### What is an extension?

An "extension" is any metadata artifact that only has meaning because it depends on a parent business concept. A field called `Status` on the Application object is not a standalone concept — it is the Application's status. A child object called `Decision` under Application is not a universal concept — it is an Application Decision.

The problem occurs when names drop the parent concept. In isolation — in a report column, a formula reference, a deployment diff, or an error log — `Status` could belong to anything. `Application Status` can only belong to one thing.

### The core rule

1. Start with the parent business concept.
2. Add the extension noun.
3. Add qualifiers only after the full parent-plus-extension phrase is clear.
4. If the remaining words cannot stand alone without causing ambiguity, they are not ready to be used as the primary name.

### Where this applies

This rule applies across every metadata family in every platform:

- Salesforce custom objects, fields, value sets, labels, and automation artifacts
- Data Cloud DMOs, DLOs, calculated insights, mappings, and activation-facing fields
- SFMC data extensions, journey entry attributes, content metadata, and operational dates
- Analytics datasets, report fields, dashboard labels, and snapshot attributes
- Integration contracts, event payload fields, and middleware property names

### Good vs. bad examples

| Context                           | Bad name           | Good name                             | Why the bad name fails                                                                                                                                                            |
| --------------------------------- | ------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Field extending Application       | `Status`           | `Application Status`                  | `Status` alone could belong to any object. In a report or formula, the reader has no way to know which status this is.                                                            |
| Date about the Application Status | `Last Change Date` | `Application Status Last Change Date` | When this field appears in a report column header or integration payload, the reader needs to know what changed — the application status, the case status, the enrollment status? |
| Boolean about fee waivers         | `Eligible`         | `Application Fee Waiver Eligible`     | `Eligible` for what? The qualifier depends on the extended concept.                                                                                                               |
| Child object for decisions        | `Decision`         | `Application Decision`                | `Decision` alone is too generic. Decisions exist in many domains.                                                                                                                 |
| Data Cloud attribute              | `Status Date`      | `Application Status Effective Date`   | `Status Date` in a data model with dozens of status fields is ambiguous.                                                                                                          |
| SFMC DE column                    | `ChangeDate`       | `ApplicationStatusLastChangeDate`     | When this column appears in a SQL query across multiple data extensions, the reader needs the full context.                                                                       |
| Integration payload field         | `statusChangedAt`  | `applicationStatusChangedAt`          | Log entries with `statusChangedAt` give no business context during incident triage.                                                                                               |

### Date and time naming

Date, DateTime, and time attributes deserve special attention because they are almost always qualifiers of another business concept. They must never stand alone.

**Pattern:** `[Parent Concept] [Extension Concept] [Temporal Qualifier]`

| Platform             | Bad name           | Good name                             |
| -------------------- | ------------------ | ------------------------------------- |
| Salesforce field     | `Last Change Date` | `Application Status Last Change Date` |
| Data Cloud attribute | `Status Date`      | `Application Status Effective Date`   |
| SFMC DE column       | `ChangeDate`       | `ApplicationStatusLastChangeDate`     |
| Analytics field      | `Decision Date`    | `Application Decision Date`           |
| Integration payload  | `statusChangedAt`  | `applicationStatusChangedAt`          |

### Anti-patterns to avoid

- **Naming extension assets as if they are universal.** `Status__c` is not a business concept unless it truly represents a universal, enterprise-wide status (it almost never does).
- **Relying on context for meaning.** Do not rely on folder location, object context, tab grouping, or page placement to supply the missing parent concept. Names must be self-describing.
- **Shortening the parent away.** If removing the parent concept makes the extension read like a standalone asset, the name is broken.

---

## Quick Reference

### Where to find your naming pattern

| If you are naming...                                       | Go to section                             |
| ---------------------------------------------------------- | ----------------------------------------- |
| Custom objects, fields, record types, metadata types       | Salesforce Object Model and Configuration |
| Salesforce apps, pages, tabs, layouts                      | Salesforce Apps, Navigation, and UI       |
| Flows and subflows                                         | Flow Naming                               |
| Approval processes, matching rules, duplicate rules        | Approval and Rule-Based Automation        |
| Permission sets, queues, groups, roles, sharing rules      | Salesforce Security and Access            |
| Events, credentials, connected apps, integration contracts | Salesforce Integration and Events         |
| Reports, dashboards, report types, CRM Analytics           | Salesforce Analytics and Reporting        |
| Experience Cloud sites, CMS content                        | Salesforce Experience Cloud and CMS       |
| Apex classes, triggers, test suites                        | Apex                                      |
| LWC bundles                                                | Lightning Web Components (LWC)            |
| Aura, Visualforce, static resources                        | Aura, Visualforce, and Static Resources   |
| DMOs, DLOs, segments, activations, data streams            | Data Cloud                                |
| SFMC folders, DEs, journeys, automations, content, sends   | SFMC                                      |

### Approved abbreviations

The team maintains a shared dictionary of approved business vocabulary. The abbreviations below are permitted in metadata names because they are widely recognized and improve readability:

| Abbreviation | Meaning                                   | Why it's approved       |
| ------------ | ----------------------------------------- | ----------------------- |
| `API`        | Application Programming Interface         | Universal industry term |
| `CRM`        | Customer Relationship Management          | Core platform domain    |
| `LWC`        | Lightning Web Component                   | Salesforce-native term  |
| `SFMC`       | Salesforce Marketing Cloud                | Official platform name  |
| `PII`        | Personally Identifiable Information       | Compliance standard     |
| `PHI`        | Protected Health Information              | Compliance standard     |
| `FERPA`      | Family Educational Rights and Privacy Act | Compliance standard     |
| `PSG`        | Permission Set Group                      | Salesforce-native term  |
| `DMO`        | Data Model Object                         | Data Cloud-native term  |
| `DLO`        | Data Lake Object                          | Data Cloud-native term  |
| `CI`         | Calculated Insight                        | Data Cloud-native term  |
| `Id`         | Identifier                                | Universal convention    |

**Not approved — avoid these in metadata names:**

| Abbreviation | Problem                                         | Use instead                                                         |
| ------------ | ----------------------------------------------- | ------------------------------------------------------------------- |
| `AppStat`    | Ambiguous — application status? app statistics? | `ApplicationStatus`                                                 |
| `Cntct`      | Unrecognizable abbreviation                     | `Contact`                                                           |
| `OppDt`      | Unclear to anyone outside the builder's head    | `OpportunityDate` (though this probably needs a parent concept too) |
| `Perm`       | Permission? Permanent?                          | `Permission`                                                        |
| `Fld`        | Field? Folder?                                  | `Field`                                                             |
| `Cfg`        | Configuration? Too abbreviated to scan          | `Config` or full word                                               |

---

## Salesforce Platform Naming Conventions

This section covers every major metadata family in core Salesforce. Each subsection teaches the pattern, explains why it matters, and provides good and bad examples so you can recognize both in the wild.

### Salesforce Object Model and Configuration

The object model is the foundation of the org. Names chosen here ripple into every report, formula, integration, and support interaction. Getting object and field names right early prevents expensive renames later.

#### Custom Objects

Before creating a custom object, always evaluate whether a standard object already covers the need. Custom objects should represent genuine business concepts, not process steps, screen names, or implementation workarounds.

| Artifact               | Convention                             | Example                  |
| ---------------------- | -------------------------------------- | ------------------------ |
| Custom Object API      | `[BusinessConcept]__c`                 | `ApplicationDecision__c` |
| Custom Object Label    | Plain business name                    | `Application Decision`   |
| Extension Object API   | `[ParentConcept][ExtensionConcept]__c` | `ApplicationStatus__c`   |
| Extension Object Label | `[Parent Concept] [Extension Concept]` | `Application Status`     |

**Why this pattern?** Object names appear in SOQL queries, formulas, Apex code, deployment manifests, and admin setup lists. A name like `Decision__c` requires the reader to open the object to determine whether this is an application decision, a case decision, or an enrollment decision. `ApplicationDecision__c` answers that question immediately.

**Good vs. bad:**

| Bad               | Good                              | Problem with the bad name                |
| ----------------- | --------------------------------- | ---------------------------------------- |
| `Status__c`       | `ApplicationStatus__c`            | Too generic — could belong to any domain |
| `Details__c`      | `ApplicationReview__c`            | Meaningless without context              |
| `TempTracking__c` | `ApplicationFeeWaiverTracking__c` | Does not describe a business concept     |
| `OpDec__c`        | `OperationDecision__c`            | Abbreviated beyond recognition           |

**Rules:**

- Evaluate standard objects first — do not create a custom object for something Salesforce already models.
- Use business concepts, not process steps or screen names.
- If the object exists only to extend another concept, lead with the parent concept.
- Avoid object names that only make sense inside one sprint or project.

#### Custom Fields

Custom fields are the most frequently created metadata in any org, which means they are also the most frequently misnamed. A single poorly named field can generate confusion in every report, formula, and integration that references it.

| Artifact                      | Convention                                        | Example                               |
| ----------------------------- | ------------------------------------------------- | ------------------------------------- |
| Field API                     | `[BusinessMeaning]__c`                            | `ApplicationStatus__c`                |
| Extension Field API           | `[ParentConcept][ExtensionConcept]__c`            | `ApplicationStatus__c`                |
| Qualified Extension Field API | `[ParentConcept][ExtensionConcept][Qualifier]__c` | `ApplicationStatusLastChangeDate__c`  |
| Field Label                   | Plain user language                               | `Application Status Last Change Date` |

**Why this pattern?** Fields appear in reports, formulas, list views, exports, SOQL queries, and integration payloads. In all of these contexts, the field is read without its parent object context. A field called `Status` on the Application object looks fine in the object's field list, but in a report with columns from five objects, `Status` is meaningless. `Application Status` is always clear.

**Good vs. bad:**

| Bad                | Good                              | Problem with the bad name            |
| ------------------ | --------------------------------- | ------------------------------------ |
| `Status__c`        | `ApplicationStatus__c`            | In a report, which status?           |
| `Date1__c`         | `ApplicationDecisionDate__c`      | What date? Whose date?               |
| `Flag__c`          | `ApplicationFeeWaiverEligible__c` | Flag for what?                       |
| `Notes__c` on Case | `CaseResolutionNotes__c`          | Notes about what aspect of the case? |

**Rules:**

- Name the data, not the UI placement, source mapping, or implementation logic.
- Reuse the same noun phrase across objects when the business meaning is the same.
- If a field describes an extension of another concept, keep the full parent-plus-extension phrase together before adding the qualifier.
- Use enough words to preserve meaning when the field is read outside its object context.
- Avoid synonyms that split reporting vocabulary (e.g., don't use `Status` on one object and `State` on another for the same concept).

**Required metadata for each custom field:**

- Business description
- Owner or steward
- Domain
- Sensitivity and compliance tags when applicable
- Related system if integration-owned

#### Field Sets

Field sets group fields for reuse in Visualforce pages, LWC components, and managed package interfaces. Their names should make the grouping purpose clear to both developers and admins.

| Artifact        | Convention                  | Example                         |
| --------------- | --------------------------- | ------------------------------- |
| Field Set API   | `[Object][Purpose]FieldSet` | `ContactAdvisorProfileFieldSet` |
| Field Set Label | `[Object] - [Purpose]`      | `Contact - Advisor Profile`     |

#### Global Value Sets and Standard Value Extensions

Global value sets define picklist values that are shared across multiple objects. Consistency here is critical because picklist values drive reporting, dashboards, and process automation.

| Artifact               | Convention                              | Example                       |
| ---------------------- | --------------------------------------- | ----------------------------- |
| Global Value Set API   | `[DomainOrEntity][Purpose]Values`       | `ApplicationStatusValues`     |
| Global Value Set Label | `[Entity or Domain] - [Purpose] Values` | `Application - Status Values` |
| Picklist Value Label   | Plain business term                     | `Ready for Review`            |

**Why this matters:** When a picklist value is labeled "RFR" instead of "Ready for Review," every report dashboard and every formula that references it becomes harder to read. Picklist values are the most user-visible names in the org — they appear in record pages, list views, reports, and emails. Use the enterprise business vocabulary, not local shorthand.

**Rules:**

- Value labels must match the enterprise business vocabulary.
- Avoid local synonyms for enterprise states.

#### Record Types and Business Processes

Record types control which picklist values, page layouts, and business processes apply to a record. Their names should make the filtering intent obvious.

| Artifact          | Convention              | Example                            |
| ----------------- | ----------------------- | ---------------------------------- |
| Record Type API   | PascalCase `[TypeName]` | `GraduateApplicant`                |
| Record Type Label | `[Object] - [Type]`     | `Application - Graduate Applicant` |
| Business Process  | `[Object] - [Process]`  | `Case - Student Support`           |

#### Custom Metadata Types and Records

Custom metadata types store configuration data that is deployable and queryable. They are the preferred mechanism for feature flags, routing rules, and environment-specific configuration. Name the type after the configuration concept, not the Apex class that reads it.

| Artifact              | Convention                           | Example            |
| --------------------- | ------------------------------------ | ------------------ |
| Custom Metadata Type  | `[Domain][Purpose]__mdt`             | `FeatureFlag__mdt` |
| Custom Metadata Field | Follow custom field convention       | `SourceSystem__c`  |
| Record DeveloperName  | Stable PascalCase token              | `AdmissionsCore`   |
| Record Label          | Human-readable business/config label | `Admissions Core`  |

**Rules:**

- Type names describe the configuration concept, not the consumer class.
- Record developer names must remain stable — they are referenced in Apex, flows, and deployment scripts.

#### Custom Labels

Custom labels store user-facing text that may need translation or centralized management. The API name should make the label's purpose and domain obvious in source control.

| Artifact          | Convention                    | Example                         |
| ----------------- | ----------------------------- | ------------------------------- |
| API Name          | `[DomainOrApp][Purpose]Label` | `AdmissionsFeeWaiverLabel`      |
| Short Description | Sentence case summary         | `Admissions fee waiver message` |

**Allowed exceptions:** Shared platform-wide labels may use `Core` in the API prefix.

**Anti-patterns:**

| Bad                                                          | Why                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------- |
| `TempLabel`                                                  | Temporary labels become permanent. Name it properly from the start. |
| `ScreenText1`                                                | Numbered names provide no business context.                         |
| `AppStatus__c` for a field that means `ApplicationStatus__c` | Abbreviation creates ambiguity.                                     |

---

### Salesforce Apps, Navigation, and UI

These are the names people encounter first when they open Salesforce. App names, tab labels, page names, and layout names should read like intentional product language — not builder leftovers from a sprint demo.

**Why this matters:** When an admin opens the setup list and sees five pages named "Default," three tabs named "Cases," and a quick action called "New Action 2," they cannot manage the org with confidence. Good UI naming makes the org feel like a maintained product rather than an archaeology site.

**Default human-readable separator:** `-`

| Artifact           | Convention                                  | Example                                       |
| ------------------ | ------------------------------------------- | --------------------------------------------- |
| Custom Application | `[Department] - [Domain] - [Application]`   | `Student Services - Advising - Case Console`  |
| Custom Tab         | `[Department] - [Domain] - [Purpose]`       | `Student Services - Advising - Queue Monitor` |
| FlexiPage          | `[Object or App] - [Page Type] - [Purpose]` | `Case - Record Page - Advisor Workspace`      |
| Page Layout        | `[Object] - [Persona or Process]`           | `Contact - Admissions Counselor`              |
| Compact Layout     | `[Object] - Compact - [Purpose]`            | `Application - Compact - Reviewer`            |
| Quick Action       | `[Object] - Action - [Purpose]`             | `Case - Action - Escalate to Tier 2`          |
| List View          | `[Department] - [Persona] - [Description]`  | `Student Services - Advisor - Open Cases`     |

**Good vs. bad:**

| Bad              | Good                                     | Problem                                        |
| ---------------- | ---------------------------------------- | ---------------------------------------------- |
| `Default`        | `Contact - Admissions Counselor`         | Which default? For whom?                       |
| `New Layout`     | `Case - Record Page - Advisor Workspace` | Every layout was new at creation time          |
| `Advisor Page 2` | `Case - Record Page - Supervisor Review` | Numbered names signal absent naming discipline |

**Allowed exceptions:** Use the object name first when the platform enforces object scoping and the label is already grouped in setup.

**Migration guidance:** Rename opportunistically when touching pages, tabs, or layouts. Create backlog items for generic names like `Default`, `New Layout`, or `Advisor Page 2`.

---

### Flow Naming

Flows are one of the easiest places for naming quality to drift because builders optimize for speed. A flow name is the single most important piece of documentation the flow has — it is the first thing a developer, support analyst, or architect sees when triaging behavior, reviewing impact, or planning changes.

**Why this matters:** When a production issue occurs and someone searches setup for "Case" flows, they need to understand what each flow does without opening it. `Case Updates` tells you nothing. `Case - After - Publish resolution event to downstream systems` tells you everything.

**Rules:**

- Name flows from the business outcome and trigger context, not from the implementation or builder order.
- Prefer complete phrases a support analyst can understand without opening the flow.
- Organizing term comes first: object, event, utility domain, or reusable process family.
- Subflows are first-class assets. Their names must make reuse intent obvious.
- Flow labels stay natural-language and sentence-style. Do not force Title Case.

| Flow Type               | Convention                             | Example                                                        |
| ----------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Record-Triggered Before | `<Object> - Before - <Description>`    | `Account - Before - Update student segment flags`              |
| Record-Triggered After  | `<Object> - After - <Description>`     | `Account - After - Publish enrollment event`                   |
| Delete                  | `<Object> - Delete - <Description>`    | `Account - Delete - Check related consent records`             |
| Scheduled               | `<Object> - Scheduled - <Description>` | `Application - Scheduled - Close stale records`                |
| Subflow                 | `<Object> - Subflow - <Description>`   | `Application - Subflow - Build reviewer summary`               |
| Screen Flow             | `<Object> - Screen - <Description>`    | `Case - Screen - Route advising request`                       |
| Platform Event Flow     | `<Event> - After - <Description>`      | `Enrollment Status Change - After - Notify downstream systems` |
| Autolaunched            | `<Object> - <Description>`             | `Application - Normalize source values`                        |

**Good vs. bad:**

| Bad                | Good                                                    | Problem                                     |
| ------------------ | ------------------------------------------------------- | ------------------------------------------- |
| `Flow 1`           | `Case - After - Send advisor notification`              | No business context whatsoever              |
| `Case Updates`     | `Case - Before - Validate required fields on close`     | Which updates? When? Why?                   |
| `Helper Subflow`   | `Utility - Subflow - Error Screen`                      | "Helper" conveys no reuse intent            |
| `Assignment Logic` | `Case - After - Route to regional queue`                | "Logic" describes every flow ever built     |
| `Check stuff`      | `Application - Before - Validate document completeness` | Informal names become permanent liabilities |

#### Subflow Families

Subflows fall into distinct families based on their reuse scope. Naming the family correctly helps other builders discover and reuse them.

| Subflow Family           | Convention                               | Example                                                  | When to use                                           |
| ------------------------ | ---------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------- |
| Business-process subflow | `<Object> - Subflow - <Description>`     | `Application - Subflow - Build reviewer summary`         | Reusable domain logic tied to one business concept    |
| Utility subflow          | `Utility - Subflow - <Description>`      | `Utility - Subflow - Error Screen`                       | Reusable cross-domain helper behavior                 |
| Feature flag subflow     | `Feature Flag - Subflow - <Description>` | `Feature Flag - Subflow - Check for Active Feature Flag` | Centralized flag evaluation                           |
| Async service subflow    | `<Object> - Subflow - <Description>`     | `Case - Subflow - Run Case Assignment Rules`             | Reusable operations with platform/runtime constraints |

**Recommended utility subflow library names:**

- `Utility - Subflow - Error Screen`
- `Utility - Subflow - Navigate to Internal Page`
- `Utility - Subflow - Navigate to External Page`
- `Utility - Subflow - Get Record Types for Running User`
- `Utility - Subflow - Display Toast Message`
- `Utility - Subflow - Display Modal Message`

#### Flow Resources

Flow resources (variables, formulas, record collections) use camelCase. Good resource names make flows readable without clicking into every element.

**Why this matters:** When a builder opens a flow they did not write, the first thing they scan is the variable names. `var1` and `text1` force them to trace every assignment to understand what the variable holds. `currentApplication` and `applicationsToUpdate` let them read the flow like a story.

| Flow Artifact               | Convention                                               | Example                   |
| --------------------------- | -------------------------------------------------------- | ------------------------- |
| Variable                    | `shortDescription`                                       | `currentApplication`      |
| Record Collection           | `objectsShortDescription`                                | `applicationsToUpdate`    |
| Formula or Constant         | `shortDescription`                                       | `hasRequiredDocuments`    |
| Screen Component            | `screen#ShortDescription`                                | `screen1ProgramSelection` |
| Input record variable       | `record` (or domain-specific name when multiple records) | `record`                  |
| Prior-value record variable | `recordPrior`                                            | `recordPrior`             |
| Boolean result              | `isShortDescription`                                     | `isApplicationComplete`   |
| Error output                | `error`, `errorMessage`, `faultMessage`                  | `errorMessage`            |

**Good vs. bad resource names:**

| Bad                | Good                      | Problem                                |
| ------------------ | ------------------------- | -------------------------------------- |
| `var1`             | `currentApplication`      | No business meaning                    |
| `text1`            | `advisorDisplayName`      | Unnamed text fragments are untraceable |
| `recordCollection` | `applicationsToUpdate`    | Which records? What are they for?      |
| `outputFlag`       | `isApplicationComplete`   | What does the flag represent?          |
| `data`             | `enrollmentStatusPayload` | The most generic name possible         |

#### Flow Elements

Element labels should read like the step a reviewer would describe out loud. Decision labels should be phrased as business questions, not technical conditions.

| Element                  | Convention                                    | Example                                       |
| ------------------------ | --------------------------------------------- | --------------------------------------------- |
| Get/Create/Update/Delete | `<Action> <Object> <Description>`             | `Get active application records`              |
| Assignment               | `Set <variable> values <Description>`         | `Set application values for reviewer handoff` |
| Loop                     | `Loop through <Collection>`                   | `Loop through applicationsToUpdate`           |
| Decision                 | Yes/no question or short descriptive question | `Is the application complete?`                |

**Feature flag naming inside flows:**

- For record-triggered flows, keep entry criteria aligned to the canonical feature flag name.
- Set a `featureName` variable near flow start when the same flag is referenced in multiple places.
- Reusable subflows must evaluate their own flags when they can run independently of a parent flow.

#### Flow Definition Sidecars

| Artifact      | Convention                            | Example                                                 |
| ------------- | ------------------------------------- | ------------------------------------------------------- |
| Flow API Name | Stable token aligned to label meaning | `Account_Before_UpdateStudentSegmentFlags`              |
| Flow Test     | `[FlowApiName]Test[Scenario]`         | `Account_Before_UpdateStudentSegmentFlagsTestHappyPath` |
| Flow Category | `[Department] - [Domain] - [Purpose]` | `Student Services - Admissions - Reviewer Utilities`    |

---

### Approval and Rule-Based Automation

Approval processes, matching rules, and duplicate rules are often configured once and then left untouched for months. When someone finally needs to modify them, the name is the only clue they have about what the rule does and why it exists.

| Artifact           | Convention                             | Example                                             |
| ------------------ | -------------------------------------- | --------------------------------------------------- |
| Approval Process   | `[Object] - Approval - [Purpose]`      | `Application - Approval - Fee Waiver`               |
| Matching Rule      | `[Object]_[Purpose]`                   | `Contact_ApplicantEmailMatch`                       |
| Duplicate Rule     | `[Object]_[Purpose]`                   | `Contact_PreventDuplicateApplicant`                 |
| Assignment Rule    | `[Object] - Assignment - [Purpose]`    | `Lead - Assignment - Undergraduate Inquiry Routing` |
| Auto Response Rule | `[Object] - Auto Response - [Purpose]` | `Case - Auto Response - Advising Intake`            |
| Escalation Rule    | `[Object] - Escalation - [Purpose]`    | `Case - Escalation - Unworked Student Support`      |

**Cross-platform alignment note:** When a flow, event, and SFMC journey all implement one program, reuse the same canonical program name inside each artifact family.

---

### Salesforce Security and Access

Security naming deserves extra care because these names are read during audits, compliance reviews, and incident response. A well-named permission set should answer "who gets this and why?" without anyone opening a setup detail page.

**Why this matters:** When an auditor asks "why does this user have edit access to FERPA fields?" and the permission set is called `Custom Access 3`, the team has to reverse-engineer the answer. When it is called `Feature Access - Contact - FERPA Fields`, the answer is in the name.

**Default human-readable separator:** `-`

#### Permission Sets

The team uses a layered permission model: **Permission Set Groups (PSGs)** represent personas or stable bundles; **Permission Sets** represent individual capabilities that can be composed into PSGs. This separation is intentional — it allows fine-grained access control without permission sprawl.

| Type           | Label Pattern                             | API Pattern                          |
| -------------- | ----------------------------------------- | ------------------------------------ |
| Domain Access  | `Domain Access - [Domain] - [Capability]` | `DomainAccess_[Domain]_[Capability]` |
| Object Add-on  | `Object Access - [Object] - [Capability]` | `ObjAccess_[Object]_[Capability]`    |
| App Access     | `App Access - [App] - [Scope]`            | `AppAccess_[App]_[Scope]`            |
| Feature Access | `Feature Access - [Domain] - [Feature]`   | `FeatureAccess_[Domain]_[Feature]`   |

**Examples:**

- `Domain Access - Enrollment Services - Core`
- `Object Access - Case - Supervisor Edit`
- `Feature Access - Contact - FERPA Fields`

**Good vs. bad:**

| Bad             | Good                                         | Problem                                             |
| --------------- | -------------------------------------------- | --------------------------------------------------- |
| `Custom Access` | `Domain Access - Enrollment Services - Core` | What does "custom" mean?                            |
| `Admin Perms`   | `App Access - Admissions - Full`             | Which admin? What permissions?                      |
| `FERPA`         | `Feature Access - Contact - FERPA Fields`    | FERPA is a regulation, not a capability description |

#### Permission Set Groups and Muting

| Artifact   | Label Pattern                            | API Pattern                        |
| ---------- | ---------------------------------------- | ---------------------------------- |
| PSG        | `Access - [Domain] - [Persona]`          | `Access_[Domain]_[Persona]`        |
| Muting Set | `Access - [Domain] - [Persona] - Muting` | `Access_[Domain]_[Persona]_Muting` |

**Rules:**

- PSGs represent personas or stable bundles.
- Permission sets represent capabilities.
- Do not fork PSGs for minor variations when an add-on permission set is sufficient.

#### Custom Permissions

Custom permissions control feature-level access in Apex, flows, and validation rules. The name should read like a capability statement.

| Artifact | Convention                       | Example                            |
| -------- | -------------------------------- | ---------------------------------- |
| Label    | `Can [Verb] [Object or Feature]` | `Can Bypass Case Close Validation` |
| API      | `Can_[Verb]_[ObjectOrFeature]`   | `Can_Bypass_CaseCloseValidation`   |

#### Profiles, Roles, Groups, and Queues

| Artifact                    | Convention                                | Example                                              |
| --------------------------- | ----------------------------------------- | ---------------------------------------------------- |
| Profile                     | `[Department] - [Persona]`                | `Student Services - Advisor`                         |
| Role                        | `[Department] - [Domain] - [Description]` | `Student Services - Advising - Director`             |
| Public Group                | `[Department] - [Domain] - [Description]` | `Student Services - Advising - Escalation Reviewers` |
| Queue                       | `[Department] - [Domain] - [Description]` | `Student Services - Advising - Tier 1 Queue`         |
| Restriction or Sharing Rule | `[Object]_[AudienceOrPurpose]`            | `Case_AdvisorScoping`                                |

**Allowed exceptions:** Use platform-enforced object prefixes where the metadata type already groups by object.

---

### Salesforce Integration and Events

Integration artifacts are frequently read during incidents and deployments — often under time pressure. These names must expose system ownership, message purpose, and operational traceability. Clarity matters more than clever shorthand.

**Why this matters:** When a midnight integration failure fires an alert with "NamedCredential: NC_01 failed," no one knows what system was involved or what data was affected. When it says "NamedCredential: Workday_StudentSync failed," the on-call engineer immediately knows the scope.

**System or partner name comes first** for auth and integration assets.

| Artifact                      | Convention                    | Example                            |
| ----------------------------- | ----------------------------- | ---------------------------------- |
| Named Credential              | `[System]_[Purpose]`          | `Workday_StudentSync`              |
| External Credential           | `[System]_[AuthPurpose]`      | `Workday_OAuthClient`              |
| Auth Provider                 | `[System] - Auth - [Purpose]` | `Azure AD - Auth - Student Portal` |
| Connected App                 | `[System] - [Purpose]`        | `Slate - Applicant Sync`           |
| Remote Site or Trusted Site   | `[System]_[Purpose]`          | `MuleSoft_EventRelay`              |
| External Service Registration | `[System]_[Service]`          | `Workday_StudentService`           |

**Good vs. bad:**

| Bad              | Good                     | Problem                          |
| ---------------- | ------------------------ | -------------------------------- |
| `NC_01`          | `Workday_StudentSync`    | Meaningless in logs              |
| `MyConnectedApp` | `Slate - Applicant Sync` | Whose app? For what?             |
| `ExternalAPI`    | `Workday_StudentService` | Which external API among dozens? |

#### Events and Channels

Platform events and channels are the messaging backbone of the org. Their names should make it obvious what business event occurred and what systems care about it.

| Artifact                  | Convention                        | Example                          |
| ------------------------- | --------------------------------- | -------------------------------- |
| Platform Event            | `<Domain>_<Action>_<Version>__e`  | `Enrollment_StatusChanged_v2__e` |
| Event Channel             | `<Domain>_<Stream>_Channel`       | `Enrollment_Status_Channel`      |
| Channel Member            | `<Entity>_<Purpose>`              | `Application_StatusUpdates`      |
| Lightning Message Channel | `[Domain][Purpose]MessageChannel` | `AdmissionsSearchMessageChannel` |

**Rules:**

- Use version only for breaking changes — do not increment for additive changes.
- Use stable domain names from the approved business vocabulary.
- Keep required operational fields aligned across event families.

#### Feature Flags

| Artifact      | Convention                                      | Example                             |
| ------------- | ----------------------------------------------- | ----------------------------------- |
| Label         | Clear business feature name                     | `Application Fee Waiver Experience` |
| Token         | `[Domain]_[Feature]` or stable PascalCase token | `Admissions_ApplicationFeeWaiver`   |
| Flow Variable | `featureName`                                   | `featureName`                       |

---

### Salesforce Analytics and Reporting

Report and dashboard names are seen by the widest audience of any metadata — executives, analysts, advisors, support staff, and compliance reviewers all consume analytics. If a name creates ambiguity, the confusion spreads quickly into meetings, decisions, and downstream actions.

**Why this matters:** When a director sees two dashboards called "Application Pipeline" and "Applicant Dashboard" and cannot tell which one to trust, the team has failed at naming. When they see "Admissions - Counselor - Applicant pipeline" and "Admissions - Leadership - Application conversion trends," they know exactly which is for them.

**Default label pattern:** `Department - Persona - Description`

**Rules:**

- Report fields, dashboard labels, dataset fields, and snapshot attributes that describe extension concepts must keep the full parent-plus-extension phrase visible.
- Avoid labels such as `Decision Date`, `Status Date`, or `Change Date` when the reader needs the parent concept to understand the meaning.

| Artifact           | Convention                                       | Example                                            |
| ------------------ | ------------------------------------------------ | -------------------------------------------------- |
| Report             | `[Department] - [Persona] - [Description]`       | `Student Services - Advisor - Open advising cases` |
| Dashboard          | `[Department] - [Persona] - [Description]`       | `Admissions - Counselor - Applicant pipeline`      |
| Report Type        | `[Primary Object] - [Related Object or Purpose]` | `Application - Decision Outcome`                   |
| Folder             | `[Department] - [Domain] - [Asset Family]`       | `Admissions - Application Review - Dashboards`     |
| Reporting Snapshot | `[Department] - Snapshot - [Description]`        | `Admissions - Snapshot - Daily application aging`  |

**Good vs. bad:**

| Bad                    | Good                                              | Problem                                  |
| ---------------------- | ------------------------------------------------- | ---------------------------------------- |
| `My Report`            | `Admissions - Counselor - Applicant pipeline`     | Whose report? About what?                |
| `Dashboard 1`          | `Enrollment - Leadership - Persistence dashboard` | Numbered assets signal absent governance |
| `Application Pipeline` | `Admissions - Counselor - Applicant pipeline`     | No audience or department context        |

#### CRM Analytics / Wave

| Artifact         | Convention                                 | Example                                              |
| ---------------- | ------------------------------------------ | ---------------------------------------------------- |
| Wave Application | `[Department] - [Domain] - Analytics App`  | `Enrollment - Student Success - Analytics App`       |
| Dataset          | `[Domain]_[Entity]Dataset`                 | `Admissions_ApplicationDataset`                      |
| Dataflow         | `[Domain]_[Purpose]Dataflow`               | `Admissions_ApplicantRefreshDataflow`                |
| Recipe           | `[Domain]_[Purpose]Recipe`                 | `Admissions_ApplicantScoringRecipe`                  |
| Lens             | `[Department] - [Persona] - [Description]` | `Admissions - Analyst - Application conversion lens` |
| Wave Dashboard   | `[Department] - [Persona] - [Description]` | `Enrollment - Leadership - Persistence dashboard`    |

---

### Salesforce Experience Cloud and CMS

Experience Cloud sites are externally visible — their metadata names affect both the builder experience and operational clarity. Names should help implementation teams and content teams understand ownership, audience, and asset purpose.

| Artifact          | Convention                                 | Example                                                     |
| ----------------- | ------------------------------------------ | ----------------------------------------------------------- |
| Site / Network    | `[Department] - [Audience] - [Experience]` | `Student Services - Student - Support Portal`               |
| Experience Bundle | `[SiteToken]Bundle`                        | `StudentSupportPortalBundle`                                |
| Navigation Menu   | `[Site] - Navigation - [Purpose]`          | `Student Support Portal - Navigation - Primary`             |
| Audience          | `[Site] - Audience - [Purpose]`            | `Student Support Portal - Audience - Advisors`              |
| Branding Set      | `[Site] - Branding - [Purpose]`            | `Student Support Portal - Branding - Default`               |
| CMS Content Type  | `[Domain] - Content Type - [Entity]`       | `Admissions - Content Type - Program Spotlight`             |
| Managed Topic Set | `[Site] - Topic Set - [Purpose]`           | `Student Support Portal - Topic Set - Knowledge Navigation` |

---

### Salesforce Developer Artifacts

Developer-owned assets must expose responsibility, app ownership, and runtime behavior in source control and logs. The patterns here are designed to make code navigation, debugging, and peer review faster.

#### Apex

Apex class names should communicate the class's role in the architecture. A well-named class tells you what it does and where it fits before you read a single line of code.

| Artifact        | Convention                 | Example                          |
| --------------- | -------------------------- | -------------------------------- |
| Class           | PascalCase role-based noun | `ApplicationDecisionService`     |
| Interface       | PascalCase role            | `EnrollmentPublisher`            |
| Method          | camelCase                  | `publishEnrollmentEvent`         |
| Variable        | camelCase                  | `applicationsToUpdate`           |
| Constant        | UPPER_SNAKE_CASE           | `MAX_BATCH_SIZE`                 |
| Trigger         | `{Object}Trigger`          | `ApplicationTrigger`             |
| Test Class      | `{ClassName}Test`          | `ApplicationDecisionServiceTest` |
| Apex Test Suite | `[Domain]_[Purpose]Suite`  | `Admissions_RegressionSuite`     |

**Why role-based suffixes matter:** When a developer navigates a project with 200+ Apex classes, the suffix is the first signal about what a class does. `ApplicationDecisionHelper` could do anything. `ApplicationDecisionService` tells you it orchestrates business logic. `ApplicationDecisionSelector` tells you it queries data. `ApplicationDecisionPublisher` tells you it emits events.

**Good vs. bad:**

| Bad                  | Good                         | Problem                                                                    |
| -------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `ApplicationHelper`  | `ApplicationDecisionService` | "Helper" conveys no architectural role                                     |
| `Utils`              | `DateCalculationService`     | "Utils" becomes a dumping ground                                           |
| `ApplicationManager` | `ApplicationDecisionMapper`  | "Manager" is vague — does it manage lifecycle? Transform data? Route work? |
| `DoStuff`            | `publishEnrollmentEvent`     | Method names should describe the action and target                         |

**Rules:**

- Avoid vague suffixes like `Helper`, `Utils`, and `Manager` unless they are genuinely generic.
- Prefer pattern-reflective suffixes: `Service`, `Selector`, `Publisher`, `Mapper`, `Validator`, `Factory`, `Builder`, `Handler`.
- One trigger per object, one trigger handler per object.
- Test class names mirror the class they test with `Test` appended.

#### Trigger Actions Framework

The Trigger Actions Framework (TAF) uses a specific naming convention to bind trigger actions to metadata records. Following this convention precisely is essential because the framework resolves action classes by name.

| Artifact      | Convention                  | Example                           |
| ------------- | --------------------------- | --------------------------------- |
| Trigger       | `{SObject}Trigger`          | `AccountTrigger`                  |
| Action Class  | `TA_{SObject}_{Action}`     | `TA_Account_SetDefaultValues`     |
| Test Class    | `TA_{SObject}_{Action}Test` | `TA_Account_SetDefaultValuesTest` |
| TriggerRecord | `{SObject}TriggerRecord`    | `AccountTriggerRecord`            |

#### Lightning Web Components (LWC)

LWC naming uses a structured prefix system that encodes both app ownership and component complexity. This prevents namespace collisions across teams and makes the component library browsable.

**Why this pattern?** In a shared org with multiple apps, an LWC called `dataTable` or `searchPanel` tells you nothing about ownership or scope. `admissionsOrganismApplicationCard` immediately tells you: this belongs to the Admissions app, it is an organism-level component (composed of smaller pieces), and it displays an application card.

**Convention:** `{appPrefix}{AtomicLevel}{ComponentName}`

| Context       | Convention | Example                                    |
| ------------- | ---------- | ------------------------------------------ |
| Folder / file | camelCase  | `admissionsOrganismApplicationCard`        |
| HTML tag      | kebab-case | `<c-admissions-organism-application-card>` |
| Class         | PascalCase | `AdmissionsOrganismApplicationCard`        |

**Approved platform prefix table:**

| App             | Prefix           | Example                              |
| --------------- | ---------------- | ------------------------------------ |
| Shared          | `core`           | `coreAtomButton`                     |
| Admissions      | `admissions`     | `admissionsOrganismApplicationCard`  |
| Registration    | `registration`   | `registrationMoleculeCoursePicker`   |
| Journey Builder | `journeyBuilder` | `journeyBuilderPageJourneyDashboard` |
| Emplid Loader   | `emplidLoader`   | `emplidLoaderOrganismStudentSearch`  |

**Atomic levels explained:**

| Level      | Purpose                                                    | Example                              |
| ---------- | ---------------------------------------------------------- | ------------------------------------ |
| `Atom`     | Smallest reusable UI element (button, input, badge)        | `coreAtomButton`                     |
| `Molecule` | Small group of atoms working together (search bar, picker) | `registrationMoleculeCoursePicker`   |
| `Organism` | Complete functional section of a page (card, table, form)  | `admissionsOrganismApplicationCard`  |
| `Template` | Page structure without content                             | `coreTemplateThreeColumn`            |
| `Page`     | Full page component                                        | `journeyBuilderPageJourneyDashboard` |
| `Utility`  | Non-visual helper (service, adapter)                       | `coreUtilityToastService`            |
| `Flow`     | Component designed for use in screen flows                 | `admissionsFlowProgramSelector`      |

**Good vs. bad:**

| Bad           | Good                                | Problem                               |
| ------------- | ----------------------------------- | ------------------------------------- |
| `dataTable`   | `admissionsOrganismApplicationCard` | No app ownership, no complexity level |
| `searchPanel` | `emplidLoaderOrganismStudentSearch` | Could belong to any app               |
| `myComponent` | `coreAtomButton`                    | Informal, no structure                |

#### Aura, Visualforce, and Static Resources

These are legacy component technologies. Follow the same domain-first naming principle, but note that new development should prefer LWC.

| Artifact              | Convention                   | Example                     |
| --------------------- | ---------------------------- | --------------------------- |
| Aura Bundle           | `[domain][Purpose]`          | `admissionsSearchPanel`     |
| Visualforce Page      | `[Domain][Purpose]Page`      | `AdmissionsReviewPage`      |
| Visualforce Component | `[Domain][Purpose]Component` | `AdmissionsReviewComponent` |
| Static Resource       | `[domain]_[purpose]`         | `admissions_branding`       |

---

## Data Cloud Naming Conventions

Data Cloud sits between source systems and activation destinations. Its naming must serve two audiences: data engineers who build and maintain the model, and business analysts who consume segments and activations. The main objective is to preserve business meaning while making lineage and activation behavior easy to trace.

### Why Data Cloud naming is different

Data Cloud assets span the full data lifecycle — ingestion, modeling, identity resolution, segmentation, and activation. A poorly named DMO attribute can cause confusion that cascades from the data model through calculated insights, into segments, through activations, and into SFMC journey entry criteria. Because Data Cloud assets are often read by people who did not build them (analysts building segments, marketers configuring activations), names must be self-describing.

### Extension-first in Data Cloud

The same extension-first rule from the core principles applies here with even more urgency:

- When a DMO attribute, calculated insight, harmonized field, or activation-facing field extends another concept, include the full parent concept.
- Do not name attributes `Status`, `Date`, `Reason`, `Source`, or `Score` unless they are truly standalone enterprise concepts.
- Temporal attributes must say what happened and to what: `Application Status Effective Date`, not `Status Date`.

**Good vs. bad:**

| Bad      | Good                                  | Problem                                                             |
| -------- | ------------------------------------- | ------------------------------------------------------------------- |
| `Status` | `Application Status`                  | Which status? In a model with dozens of entities, this is ambiguous |
| `Score`  | `Enrollment Risk Score`               | Score of what?                                                      |
| `Date`   | `Application Decision Effective Date` | Meaningless without context                                         |
| `Source` | `Application Source System`           | Source of what?                                                     |

### Data Model Objects and Lake Objects

DMOs represent the business data model. DLOs represent raw ingested data. The naming distinction between them is intentional — DMOs should reveal business meaning, while DLOs should reveal source system lineage.

| Artifact      | Convention                                  | Example                       |
| ------------- | ------------------------------------------- | ----------------------------- |
| Custom DMO    | `<EnterprisePrefix>_<Domain>_<Entity>__dlm` | `UMGC_Enrollment_Status__dlm` |
| Reference DMO | `<EnterprisePrefix>_Ref_<Entity>Dim__dlm`   | `UMGC_Ref_TermDim__dlm`       |
| DLO           | `<SourceSystem>_<Entity>_DLO`               | `SFMC_Subscriber_DLO`         |

**Good vs. bad:**

| Bad                 | Good                          | Problem                                                          |
| ------------------- | ----------------------------- | ---------------------------------------------------------------- |
| `Student_Table_DLO` | `Workday_Student_DLO`         | No source system — where did this data come from?                |
| `Data__dlm`         | `UMGC_Enrollment_Status__dlm` | No business meaning whatsoever                                   |
| `Ref_Lookup__dlm`   | `UMGC_Ref_TermDim__dlm`       | "Lookup" is implementation; "Term Dimension" is business meaning |

**Rules:**

- Name DMOs by business grain and meaning, not by source table names.
- Preserve source lineage in DLO names — the source system must be immediately visible.
- Use `Ref` only for enterprise reference dimensions (e.g., terms, academic programs, geographic hierarchies).

### Relationships and Mappings

Relationships and mappings describe how data entities connect. Their names should make the connection direction and purpose clear without opening the configuration.

| Artifact           | Convention                                           | Example                                    |
| ------------------ | ---------------------------------------------------- | ------------------------------------------ |
| Relationship       | `<PrimaryEntity> - to - <RelatedEntity> - <Purpose>` | `Person - to - Term - Enrollment history`  |
| Mapping Set        | `<SourceSystem> - Mapping - <Entity or Purpose>`     | `Workday - Mapping - Student attributes`   |
| Harmonization Rule | `<Domain> - Harmonization - <Purpose>`               | `Person - Harmonization - Preferred email` |

### Calculated Insights

Calculated insights aggregate data for segmentation and activation. The `CI_` prefix is mandatory so these assets are instantly recognizable in metadata lists.

| Artifact                       | Convention                   | Example                        |
| ------------------------------ | ---------------------------- | ------------------------------ |
| Person-level summary CI        | `CI_Person_<Domain>_Summary` | `CI_Person_Enrollment_Summary` |
| Profile or term perspective CI | `CI_Person_<Qualifier>_Term` | `CI_Person_Current_Term`       |
| Non-person CI                  | `CI_<Entity>_<Purpose>`      | `CI_Course_CompletionTrend`    |

**Rules:**

- Use `CI_` consistently — it makes calculated insights immediately identifiable in deployment packages and setup.
- Prefer business outcome words over implementation math terms. `Enrollment_Summary` tells the consumer what they get; `Enrollment_Aggregation_v3` tells them how it was built.

### Segments

Segments define audiences for activation. Their names are often the first thing a marketer sees when selecting an audience, so clarity about the audience and purpose is critical.

| Segment Type      | Convention                                              | Example                                                           |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Standard Segment  | `[Domain] - Segment - [Audience] - [Purpose]`           | `Admissions - Segment - Applicants - Fee waiver eligible`         |
| Real-Time Segment | `[Domain] - Real-Time Segment - [Audience] - [Purpose]` | `Enrollment - Real-Time Segment - Students - Stop-out risk`       |
| Dynamic Segment   | `[Domain] - Dynamic Segment - [Audience] - [Purpose]`   | `Advancement - Dynamic Segment - Alumni - High propensity donors` |
| Waterfall Segment | `[Domain] - Waterfall Segment - [Program]`              | `Admissions - Waterfall Segment - Spring outreach prioritization` |

**Good vs. bad:**

| Bad               | Good                                                              | Problem                                                           |
| ----------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------- |
| `Test Segment`    | `Admissions - Segment - Applicants - Fee waiver eligible`         | "Test" segments become permanent; name it properly from the start |
| `Audience 1`      | `Enrollment - Real-Time Segment - Students - Stop-out risk`       | Numbered names convey zero business intent                        |
| `Spring Campaign` | `Admissions - Waterfall Segment - Spring outreach prioritization` | Too vague — which spring? Which campaign?                         |

### Activations

Activations push segments to destination systems. The destination must be the first word so marketers and engineers can quickly scan which systems are receiving data.

| Artifact                | Convention                                                       | Example                                          |
| ----------------------- | ---------------------------------------------------------------- | ------------------------------------------------ |
| Activation              | `[Destination] - Activation - [Segment or Audience] - [Purpose]` | `SFMC - Activation - Applicants - Journey entry` |
| Activation Target Alias | `[Destination]_[Purpose]`                                        | `SFMC_JourneyEntry`                              |

**Cross-platform alignment:** Activation names should reuse the same audience or program name used by the source segment and the target SFMC journey.

### Data Streams and Ingestion

Data streams are the pipelines that bring data into Data Cloud. Source system comes first because the most critical question about any data stream is "where does this data come from?"

| Artifact                | Convention                                         | Example                                         |
| ----------------------- | -------------------------------------------------- | ----------------------------------------------- |
| Data Stream             | `[SourceSystem] - [Entity] - [Purpose]`            | `Salesforce - Application - Daily ingest`       |
| Ingestion Definition    | `[SourceSystem] - [Entity] - [Cadence or Purpose]` | `Slate - Prospect - Near-real-time ingest`      |
| Transform or Prep Asset | `[SourceSystem] - Transform - [Purpose]`           | `Workday - Transform - Normalize academic term` |

### Identity Resolution and Unified Profile

Identity resolution is one of the most consequential Data Cloud configurations — it determines how person records are matched and merged across systems. Clear naming helps auditors and data stewards understand matching logic without tracing configuration details.

| Artifact                     | Convention                                   | Example                                             |
| ---------------------------- | -------------------------------------------- | --------------------------------------------------- |
| Identity Resolution Rule Set | `[Entity] - Identity Resolution - [Purpose]` | `Person - Identity Resolution - Enterprise profile` |
| Unified Profile Construct    | `[Entity] - Unified Profile - [Purpose]`     | `Person - Unified Profile - Marketing activation`   |
| Match Rule                   | `[Entity] - Match Rule - [Purpose]`          | `Person - Match Rule - Email and birthdate`         |

**Required metadata for all Data Cloud assets:**

- Business description
- Owner or steward
- Domain
- Related source or target systems
- Exception rationale when deviating from pattern

---

## SFMC Naming Conventions

SFMC assets are touched by marketing operations, content teams, developers, and technical admins. The best SFMC names are readable to non-developers while still aligning to the enterprise vocabulary used in Salesforce and Data Cloud.

### Why SFMC naming matters

SFMC is often the platform with the most naming drift because it has the widest range of non-technical users. When a marketer creates a data extension called `Test DE` or a journey called `Spring Campaign v2 FINAL`, those names persist in automation schedules, SQL queries, and reporting pipelines. The cost of renaming in SFMC is high because dependencies are implicit (SQL Activity references, journey entry sources, automation sequences). Getting the name right the first time is much cheaper.

### Folder Taxonomy

Folders are the only organizing structure in SFMC. Unlike Salesforce setup where metadata is categorized by type, SFMC puts everything in flat lists within folders. If the folder hierarchy is inconsistent, the entire Business Unit becomes difficult to navigate.

**Standard folder hierarchy:** `Department / Domain / Asset Family`

**Examples:**

- `Admissions / Applicant Nurture / Journeys`
- `Student Services / Advising / Emails`
- `Advancement / Alumni Giving / Data Extensions`

**Rules:**

- Standardize folder hierarchy by business unit and asset family.
- Do not create ad hoc parallel taxonomies for the same domain. If Admissions already has a folder structure, new Admissions assets go in the existing structure.

### Data Assets

Data extensions and shared data constructs are the backbone of SFMC personalization and segmentation. Their column names flow into SQL queries, AMPscript lookups, and journey decision splits. A bad column name can cause silent data mapping errors that are extremely hard to diagnose.

**Rules:**

- Data extension names, shared data construct names, and key attribute names must preserve parent-plus-extension meaning.
- DE column names should not use generic names like `StatusDate`, `ChangeDate`, `Reason`, or `Type` without the owning business concept.
- If a field is about application status, decision status, or enrollment state, include the full phrase before the qualifier.

| Artifact                                 | Convention                                    | Example                                     |
| ---------------------------------------- | --------------------------------------------- | ------------------------------------------- |
| Data Extension                           | `[Domain] - [Audience or Entity] - [Purpose]` | `Admissions - Applicants - Journey entry`   |
| Filter or Audience                       | `[Domain] - Audience - [Purpose]`             | `Admissions - Audience - Ready for nurture` |
| Attribute Group or Shared Data Construct | `[Domain] - Data - [Purpose]`                 | `Enrollment - Data - Student progression`   |

**Good vs. bad column names:**

| Bad          | Good                              | Problem                                                                    |
| ------------ | --------------------------------- | -------------------------------------------------------------------------- |
| `StatusDate` | `ApplicationStatusLastChangeDate` | Which status? When this column appears in a SQL join, the reader is lost   |
| `Reason`     | `ApplicationDecisionReason`       | Reason for what?                                                           |
| `Type`       | `EnrollmentProgramType`           | Every data extension has a "type" column; none of them are self-describing |

### Automation Studio Assets

Automation Studio automations run on schedules and are often the hardest SFMC assets to debug because they execute without user interaction. When an automation fails, the name is the first clue about what went wrong and what data is affected.

| Artifact         | Convention                          | Example                                               |
| ---------------- | ----------------------------------- | ----------------------------------------------------- |
| Automation       | `[Domain] - Automation - [Purpose]` | `Admissions - Automation - Applicant journey refresh` |
| Query Activity   | `[Domain] - SQL - [Purpose]`        | `Admissions - SQL - Refresh journey entry`            |
| Import Activity  | `[Domain] - Import - [Purpose]`     | `Enrollment - Import - Advising eligibility file`     |
| Extract Activity | `[Domain] - Extract - [Purpose]`    | `Advancement - Extract - Donor segment export`        |
| File Transfer    | `[Domain] - Transfer - [Purpose]`   | `Admissions - Transfer - Pull applicant feed`         |
| Script Activity  | `[Domain] - Script - [Purpose]`     | `Admissions - Script - Normalize source values`       |

**Good vs. bad:**

| Bad            | Good                                              | Problem                                        |
| -------------- | ------------------------------------------------- | ---------------------------------------------- |
| `Daily Import` | `Enrollment - Import - Advising eligibility file` | Daily import of what?                          |
| `SQL Query 1`  | `Admissions - SQL - Refresh journey entry`        | Numbered SQL queries are unmanageable at scale |
| `Export`       | `Advancement - Extract - Donor segment export`    | Export what, where, for whom?                  |

### Journey Builder Assets

Journey names are visible to marketers, analysts, and leadership stakeholders. They should describe the program and audience, not implementation details.

| Artifact          | Convention                                   | Example                                                                           |
| ----------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| Journey           | `[Domain] - Journey - [Program or Audience]` | `Admissions - Journey - Applicant nurture`                                        |
| Entry Source      | `[Journey Name] - Entry Source - [Purpose]`  | `Admissions - Journey - Applicant nurture - Entry Source - Fee waiver applicants` |
| Decision Split    | `[Journey Name] - Decision - [Purpose]`      | `Admissions - Journey - Applicant nurture - Decision - Has applied`               |
| Reusable Activity | `[Domain] - Activity - [Purpose]`            | `Admissions - Activity - Fee waiver reminder`                                     |

**Good vs. bad:**

| Bad                  | Good                                           | Problem                                                      |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------ |
| `Spring Campaign v2` | `Admissions - Journey - Applicant nurture`     | Versioned campaign names become stale; program names persist |
| `Test Journey`       | `Enrollment - Journey - Registration reminder` | "Test" journeys that go live with test names erode trust     |
| `Chris's Journey`    | `Advancement - Journey - Alumni giving appeal` | Personal names have no meaning after the builder moves on    |

### Content Assets

| Artifact           | Convention                                   | Example                                          |
| ------------------ | -------------------------------------------- | ------------------------------------------------ |
| Email              | `[Domain] - Message - [Purpose]`             | `Admissions - Message - Fee waiver reminder`     |
| Email Template     | `[Domain] - Template - [Purpose]`            | `Admissions - Template - Application reminder`   |
| Content Block      | `[Domain] - Content - [Channel] - [Purpose]` | `Admissions - Content - Email - Fee waiver hero` |
| Message Definition | `[Domain] - Message - [Purpose]`             | `Enrollment - Message - Registration reminder`   |

### Sends, Delivery, and CloudPages

| Artifact        | Convention                              | Example                                               |
| --------------- | --------------------------------------- | ----------------------------------------------------- |
| Send Definition | `[Domain] - Send - [Purpose]`           | `Admissions - Send - Applicant reminder`              |
| Triggered Send  | `[Domain] - Triggered Send - [Purpose]` | `Enrollment - Triggered Send - Add drop confirmation` |
| CloudPage       | `[Domain] - CloudPage - [Purpose]`      | `Advancement - CloudPage - Giving form confirmation`  |
| Form            | `[Domain] - Form - [Purpose]`           | `Student Services - Form - Advising request`          |

### Integrations and Packages

| Artifact          | Convention                       | Example                                             |
| ----------------- | -------------------------------- | --------------------------------------------------- |
| Installed Package | `[System] - Package - [Purpose]` | `Salesforce CRM - Package - Journey entry sync`     |
| API Integration   | `[System] - API - [Purpose]`     | `MuleSoft - API - Segment activation relay`         |
| Event Definition  | `[System] - Event - [Purpose]`   | `Salesforce CRM - Event - Enrollment status update` |

**Cross-platform alignment:** Reuse the same program name used by the source Data Cloud segment or Salesforce campaign. Reuse the same audience and entity terms across all three platforms.

---

## Cross-Platform Alignment

When the same business concept spans Salesforce, Data Cloud, and SFMC, the names must stay aligned. Inconsistent naming across platforms is one of the hardest problems to fix because each platform has its own admin audience and its own naming habits.

### The alignment rules

1. **Same domain term everywhere.** If the Salesforce team calls the business area "Enrollment Services," Data Cloud and SFMC must use "Enrollment" — not "Registration," "Enroll," or "Student Services - Enrollment."
2. **Same entity term everywhere.** If the Salesforce field is `Application Status`, the Data Cloud attribute is `Application Status`, and the SFMC DE column is `ApplicationStatus` (platform-native casing, but the same words).
3. **Same program name everywhere.** If a campaign is called "Spring Outreach" in Salesforce, the Data Cloud segment and SFMC journey should both include "Spring Outreach" in their names.
4. **Same feature name everywhere.** If a feature flag in Salesforce is called `Admissions_ApplicationFeeWaiver`, the corresponding SFMC journey, Data Cloud activation, and permission set should all reference "Application Fee Waiver."
5. **Same source system name everywhere.** For integrations, the system-of-record name must be consistent across events, data streams, activation targets, and middleware contracts.

### How to check alignment

When naming a new asset, search for the same concept across all three platforms:

- Does Salesforce already have a field, flow, or permission set using this domain/entity term?
- Does Data Cloud already have a DMO, segment, or activation using this term?
- Does SFMC already have a folder, DE, or journey using this term?

If any platform uses a different term for the same concept, escalate to the architecture team before creating the new asset. Do not create a new synonym.

---

## Migration and Legacy Names

Every org has legacy names that predate this standard. The goal is not to rename everything overnight — it is to steadily improve naming quality while avoiding disruption.

### When to rename

- **Always rename** when you are already modifying the asset for another reason (a bug fix, a feature change, a refactor). This is "opportunistic renaming" and is the lowest-risk approach.
- **Create a backlog item** for assets that are too risky to rename immediately (e.g., fields referenced in dozens of formulas, or API names consumed by external systems).
- **Never rename** just to satisfy the standard if the rename would break integrations, reports, or user workflows without a migration plan.

### How to handle exceptions

Every deliberate exception must document the rationale. The next person who encounters the non-standard name needs to know whether it was an intentional tradeoff or an oversight.

**Exception documentation pattern:**

- What the standard says
- Why the standard was not followed
- When (if ever) the exception will be resolved
- Who approved the exception

### Rules

- Do not create net-new artifacts that knowingly violate the standard. Legacy exceptions are for existing assets only.
- When reviewing legacy names, focus on reducing future confusion, not on assigning blame for historical choices.
- Prioritize renaming assets that cause the most confusion — usually fields in reports, flows that support analysts triage, and integration credentials that appear in error logs.

---

## Governance and Ownership

The naming standard is a living document maintained by multiple teams. Understanding who owns what prevents naming conflicts and ensures consistent vocabulary across the organization.

| Responsibility                                 | Owner                           |
| ---------------------------------------------- | ------------------------------- |
| Rule approval and conflict resolution          | Architecture team               |
| Business terminology and domain vocabulary     | Product owners                  |
| Enterprise data vocabulary                     | Data governance team            |
| Platform-specific prefix tables and exceptions | Platform leads (per cloud)      |
| SFMC folder taxonomy and asset naming          | Marketing operations governance |
| Standard updates and version control           | Architecture team               |

**How vocabulary is approved:**

- New business terms must be reviewed by the product owner and architecture team before use in metadata names.
- New platform-specific prefixes (e.g., a new LWC app prefix) must be approved by the platform lead and added to the prefix table.
- Disagreements about terminology are escalated to architecture for resolution.

---

## Future Extension Categories

The following categories are recognized future extensions but are not fully standardized in this version:

- AI and Agentforce metadata
- OmniStudio metadata

When these are added, they must follow the same governance model: platform-specific rules, approved vocabulary alignment, required examples and anti-patterns, and explicit exception handling.

### Required content for new sections

Every new major artifact family added to this document must include:

- Purpose explanation (why this naming matters for this artifact type)
- Pattern table with examples
- Good vs. bad comparison table
- Allowed exceptions
- Anti-patterns
- Migration guidance
- Cross-platform alignment notes when applicable

---

## Review Checklist

Use this checklist during peer review to catch naming issues before they reach production. The intent is coaching, not gatekeeping — help your teammate find a better name rather than rejecting their work.

**For every metadata artifact, verify:**

- [ ] Correct artifact family pattern used
- [ ] Approved domain term used (not a synonym or abbreviation)
- [ ] Approved entity term used
- [ ] Parent concept included when naming an extension concept, dependent attribute, or date-like field
- [ ] Readable user-facing label where applicable
- [ ] Stable API name or token where applicable
- [ ] Business description present
- [ ] Owner or steward identified
- [ ] Domain identified
- [ ] Sensitivity and compliance tags present when applicable
- [ ] Related system or source-target notes present for integration-facing assets
- [ ] Exception rationale documented if the standard was not followed exactly
- [ ] Cross-platform term alignment verified (same term used in SF, Data Cloud, and SFMC)
