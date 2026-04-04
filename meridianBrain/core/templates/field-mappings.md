# Azure DevOps Field Mappings - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.field_mappings`. Referenced from grooming publish steps (e.g. WSJF tags).

This document provides authoritative field path references for all work item types in Azure DevOps. Use these exact field paths when updating work items via the workflow CLI: `{{cli.ado_update}}` (see core/config/shared.json). Prompts pass a fields JSON file: `{{cli.ado_update}} {{work_item_id}} --fields-file "{{path}}/payload.json" --json`.

## User Story Fields

| Field Path                                         | Purpose                                           | Format                     | Required           | Notes                                                                                                     |
| -------------------------------------------------- | ------------------------------------------------- | -------------------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| `/fields/System.Title`                             | Business-focused title                            | Plain text                 | Yes                | Enhanced during triage to remove technical jargon                                                         |
| `/fields/System.Description`                       | Meridian Modern Work Item — What / Why / Unknowns | HTML                       | Yes                | Rich template: `field-user-story-description` or `field-technical-description`                            |
| `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` | **Done When** — plain-English assertions          | HTML                       | Yes                | `field-user-story-acceptance-criteria` or `field-technical-acceptance-criteria`; typically ≥3 assertions  |
| `/fields/Custom.DevelopmentSummary`                | Technical solution design                         | HTML                       | Yes (Solutioning)  | Complete solution design document populated during Solutioning phase                                      |
| `/fields/Custom.WorkClassType`                     | Work classification                               | String                     | Yes                | Values: `Development`, `Critical/Escalation`, `Fixed Delivery`, `Maintenance/Recurring Tasks`, `Standard` |
| `/fields/Custom.RequiresQA`                        | QA requirement flag                               | String                     | Yes                | Values: `Yes` or `No`                                                                                     |
| `/fields/System.Tags`                              | Classification tags                               | Semicolon-delimited string | Yes                | Format: `Triaged;AI-Refined;[Solutioned];[WorkType];[Effort];[Risk]` (see core/config/shared.json `tags`) |
| `/fields/System.State`                             | Workflow state                                    | String                     | No                 | Do NOT update - leave at current state for human workflow control                                         |
| `/fields/System.AreaPath`                          | Team board classification                         | String                     | Yes                | Must match parent work item (Connect/FastTrack)                                                           |
| `/fields/System.IterationPath`                     | Sprint/iteration                                  | String                     | Yes                | Must match parent work item                                                                               |
| `/fields/Microsoft.VSTS.Scheduling.StoryPoints`    | Relative effort estimate (Job Duration)           | Number                     | Yes (Finalization) | Derived from WSJF Job Duration. Fibonacci: 1, 2, 3, 5, 8, 13                                              |

## Bug/Defect Fields

| Field Path                                         | Purpose                            | Format                     | Required          | Notes                                                                |
| -------------------------------------------------- | ---------------------------------- | -------------------------- | ----------------- | -------------------------------------------------------------------- |
| `/fields/System.Title`                             | Clear issue description            | Plain text                 | Yes               | Focus on actual vs expected behavior                                 |
| `/fields/System.Description`                       | Issue summary                      | HTML                       | Yes               | Single Summary section only                                          |
| `/fields/Microsoft.VSTS.TCM.ReproSteps`            | Reproduction steps                 | HTML                       | Yes               | Environment, preconditions, steps, expected/actual                   |
| `/fields/Microsoft.VSTS.TCM.SystemInfo`            | Test data & supporting information | HTML                       | Yes               | Screenshots, error messages, logs, test data                         |
| `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` | Fix validation criteria            | HTML                       | Yes               | Fix validation + regression testing (NOT step-by-step scenarios)     |
| `/fields/Custom.DevelopmentSummary`                | Technical solution design          | HTML                       | Yes (Solutioning) | Complete solution design document populated during Solutioning phase |
| `/fields/Custom.RootCauseDetail`                   | Root cause analysis                | HTML                       | No                | Process/context factors if known                                     |
| `/fields/Custom.WorkClassType`                     | Work classification                | String                     | Yes               | Same values as User Stories                                          |
| `/fields/Custom.RequiresQA`                        | QA requirement flag                | String                     | Yes               | Usually `Yes` for defects                                            |
| `/fields/System.Tags`                              | Classification tags                | Semicolon-delimited string | Yes               | Same format as User Stories                                          |
| `/fields/System.State`                             | Workflow state                     | String                     | No                | Do NOT update - leave at current state for human workflow control    |

## Task Fields

| Field Path                                        | Purpose                   | Format     | Required | Notes                                                   |
| ------------------------------------------------- | ------------------------- | ---------- | -------- | ------------------------------------------------------- |
| `/fields/System.Title`                            | Task title                | Plain text | Yes      | Format: `[Number] - [Type] - [Action] - [WORK_ITEM_ID]` |
| `/fields/Microsoft.VSTS.Common.Activity`          | Activity type             | String     | Yes      | Values: `Triage`, `Refinement`, `Design`, etc.          |
| `/fields/System.Description`                      | Task description          | HTML       | Yes      | Audit trail or task details                             |
| `/fields/Microsoft.VSTS.Scheduling.CompletedWork` | Time logged               | Number     | No       | Hours in decimal (e.g., 0.25, 1.50)                     |
| `/fields/System.State`                            | Task state                | String     | Yes      | `Active` when working, `Closed` when complete           |
| `/fields/System.AreaPath`                         | Team board classification | String     | Yes      | Must match parent work item                             |
| `/fields/System.IterationPath`                    | Sprint/iteration          | String     | Yes      | Must match parent work item                             |

## Critical Field Mapping Rules

### Acceptance Criteria Field Mapping

⚠️ **CRITICAL**: The Acceptance Criteria field mapping differs by work item type:

- **User Stories**: Apply AC to `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` only
- **Bugs/Defects**: Apply AC to `/fields/Microsoft.VSTS.Common.AcceptanceCriteria` AND also populate `/fields/Microsoft.VSTS.TCM.ReproSteps` with step-by-step reproduction instructions

**Do NOT confuse:**

- Repro Steps (`Microsoft.VSTS.TCM.ReproSteps`) = Step-by-step bug reproduction instructions
- Acceptance Criteria (`Microsoft.VSTS.Common.AcceptanceCriteria`) = **Done When** plain-English assertions for User Stories (Meridian Modern Work Item Standard), fix validation blocks for Bugs

### Tags Format

Tags are semicolon-delimited. Always include base tags first:

**Base Tags (values from core/config/shared.json `tags`):**

- `Triaged` - Always present
- `AI-Refined` - Added after AI Refinement phase (`tags.refined`)
- `Solutioned` - Added after Solutioning phase (optional) (`tags.solutioned`)
- `Groomed` - Added after Grooming phase (optional) (`tags.groomed`)

**Work Type (select ONE):**

- `Admin` OR `Dev` (never both)

**Effort Level (select ONE):**

- `Low-Effort`
- `Medium-Effort`
- `High-Effort`

**Risk Level (select ONE):**

- `Low-Risk`
- `Medium-Risk`
- `High-Risk`

**Examples:**

```
# After AI Refinement:
Triaged;AI-Refined;Dev;Medium-Effort;Medium-Risk

# After Solutioning:
Triaged;AI-Refined;Solutioned;Dev;Medium-Effort;Medium-Risk
```

**Optional Tags (add as needed):**

- `Assumption-LowConfidence` - If assumptions have low confidence
- `Template-Incomplete` - If template validation fails
- `Clarity-Review-Needed` - If clarity gate fails
- `Testability-Review-Needed` - If testability gate fails
- `Traceability-Review-Needed` - If traceability gate fails
- `Safety-Review-Needed` - If safety gate fails
- `INVEST-Review-Needed` - If INVEST validation fails

**WSJF Score Tags (added during Finalization — interim until custom fields exist):**

Each WSJF dimension score is encoded as a tag for ADO queryability. These replace themselves on re-scoring.

| Tag            | Format                        | Example      | Purpose                                       |
| -------------- | ----------------------------- | ------------ | --------------------------------------------- |
| `WSJF-BV:<n>`  | `WSJF-BV:` + Fibonacci (1-20) | `WSJF-BV:13` | Business Value score                          |
| `WSJF-TC:<n>`  | `WSJF-TC:` + Fibonacci (1-20) | `WSJF-TC:8`  | Time Criticality score                        |
| `WSJF-RR:<n>`  | `WSJF-RR:` + Fibonacci (1-13) | `WSJF-RR:5`  | Risk Reduction / Opportunity Enablement score |
| `WSJF-JD:<n>`  | `WSJF-JD:` + Fibonacci (1-13) | `WSJF-JD:3`  | Job Duration score (same as Story Points)     |
| `WSJF:<score>` | `WSJF:` + decimal (1 place)   | `WSJF:8.7`   | Composite WSJF score                          |

**Re-scoring strip rule:** Before appending new score tags, remove any existing tags matching `WSJF-BV:*`, `WSJF-TC:*`, `WSJF-RR:*`, `WSJF-JD:*`, `WSJF:*`. Do NOT strip `WSJF-Blocker`, `WSJF-LowConfidence`, `WSJF-HumanReview`, `WSJF-ExpediteCandidate` (these are priority flags, not scores).

**ADO query examples:**

- Find all items with BV ≥ 13: `Tags contains "WSJF-BV:13" or Tags contains "WSJF-BV:20"`
- Find all WSJF-scored items: `Tags contains "WSJF:"`

**WSJF Priority Tags (added during Finalization):**

These tags are automatically applied based on WSJF scoring in the Finalization phase:

| Tag                      | Condition                            | Description                                                       |
| ------------------------ | ------------------------------------ | ----------------------------------------------------------------- |
| `Expedite`               | WSJF-derived Priority ≤ 2            | Work item should skip normal backlog and be addressed immediately |
| `WSJF-Blocker`           | WSJF Score ≥ 15.0                    | Critical blocker requiring war room attention                     |
| `WSJF-LowConfidence`     | Overall WSJF Confidence = Low        | Scoring has significant uncertainty; human validation recommended |
| `WSJF-HumanReview`       | Human review required                | One or more review triggers activated (see below)                 |
| `WSJF-ExpediteCandidate` | Class of Service = ExpediteCandidate | WSJF ≥ 8.0 or Priority 1 indicators present                       |

**Human Review Triggers:**

- Overall Confidence = Low
- Class of Service = ExpediteCandidate
- WSJF score changed > 25% from previous scoring
- `Dispute` tag present on work item
- Job Duration = 1 with WSJF > 10 (size verification needed)

**Examples:**

```
# After Finalization — standard item:
Triaged;Copilot-Refined;Solutioned;Dev;Medium-Effort;Medium-Risk;WSJF-BV:8;WSJF-TC:5;WSJF-RR:3;WSJF-JD:3;WSJF:5.3

# High-priority defect:
Triaged;Copilot-Refined;Solutioned;Dev;Low-Effort;Low-Risk;WSJF-BV:13;WSJF-TC:8;WSJF-RR:5;WSJF-JD:2;WSJF:13.0;Expedite;WSJF-ExpediteCandidate

# Work item needing human review:
Triaged;Copilot-Refined;Solutioned;Dev;Medium-Effort;Medium-Risk;WSJF-BV:8;WSJF-TC:5;WSJF-RR:3;WSJF-JD:3;WSJF:5.3;WSJF-HumanReview;WSJF-LowConfidence

# Critical blocker:
Triaged;Copilot-Refined;Solutioned;Dev;Low-Effort;High-Risk;WSJF-BV:20;WSJF-TC:13;WSJF-RR:8;WSJF-JD:1;WSJF:41.0;Expedite;WSJF-Blocker
```

### Priority Field

The Priority field (`/fields/Microsoft.VSTS.Common.Priority`) is set during Finalization based on WSJF score:

| Priority | WSJF Range | Description                      |
| -------- | ---------- | -------------------------------- |
| 1        | ≥ 8.0      | Must fix - highest priority      |
| 2        | 4.0 – 7.9  | High priority - fix next sprint  |
| 3        | 1.5 – 3.9  | Medium priority - normal backlog |
| 4        | < 1.5      | Low priority - backlog or icebox |

**Note:** Priority is now set for ALL work item types (User Stories, Enhancements, Bugs, Defects), not just Bugs.

### Severity Field (Bugs/Defects Only)

The Severity field (`/fields/Microsoft.VSTS.Common.Severity`) is set during Finalization for Bug/Defect work items only:

| Severity | WSJF Range | Value          |
| -------- | ---------- | -------------- |
| 1        | ≥ 8.0      | `1 - Critical` |
| 2        | 4.0 – 7.9  | `2 - High`     |
| 3        | 1.5 – 3.9  | `3 - Medium`   |
| 4        | < 1.5      | `4 - Low`      |

### Story Points Field (Job Duration)

- Story Points are derived from the Job Duration dimension of WSJF scoring during Finalization.
- Job Duration is calculated from: Complexity (1-3) + Risk (0-3) + Uncertainty (0-3), mapped to Fibonacci.
- Values must align to Fibonacci numbers: 1, 2, 3, 5, 8, or 13.
- Full scoring rationale (including factor breakdown) is persisted to `wsjf-evidence.json` in the finalization artifacts folder.

## Field Path Usage (CLI)

Workflow prompts use `{{cli.ado_update}}` from core/config/shared.json. Prepare a JSON payload with field paths and values, then call:

```bash
{{cli.ado_update}} <work_item_id> --fields-file "<path>/payload.json" --json
```

Payload format (use `/fields/` prefix for paths; see artifact_files in shared.json for phase-specific payload files):

```json
{
  "fields": {
    "System.Description": "[HTML formatted content]",
    "Microsoft.VSTS.Common.AcceptanceCriteria": "[HTML formatted Done When / AC content]",
    "Custom.WorkClassType": "Development",
    "System.Tags": "Triaged;AI-Refined;Dev;Medium-Effort;Medium-Risk"
  }
}
```

## HTML Formatting Requirements

All HTML fields must use UTF-8 encoding and follow these structure rules:

- Use `<h2>` for main section headers (with emoji if applicable)
- Use `<h3>` for subsection headers
- Use `<p>` for paragraphs (NOT `<div>`)
- Use `<ul>` and `<li>` for unordered lists
- Use `<ol>` and `<li>` for ordered lists
- Use `<strong>` for emphasis (NOT `<b>`)
- Use `<br/>` for line breaks within paragraphs
- Use `<table>`, `<tr>`, `<th>`, `<td>` for structured data
- Use `<em>` for emphasis or italic text
- Use `<code>` for inline code references

**All HTML tags must be properly closed.** Azure DevOps will render malformed HTML incorrectly.

## Rich HTML Templates

All work item field templates use rich styling with gradients, cards, and color-coded sections:

| Template File                               | Target Field                                            |
| ------------------------------------------- | ------------------------------------------------------- |
| `field-user-story-description.html`         | `System.Description` (User Story)                       |
| `field-user-story-acceptance-criteria.html` | `Microsoft.VSTS.Common.AcceptanceCriteria` (User Story) |
| `field-bug-description.html`                | `System.Description` (Bug)                              |
| `field-bug-repro-steps.html`                | `Microsoft.VSTS.TCM.ReproSteps`                         |
| `field-bug-system-info.html`                | `Microsoft.VSTS.TCM.SystemInfo`                         |
| `field-bug-acceptance-criteria.html`        | `Microsoft.VSTS.Common.AcceptanceCriteria` (Bug)        |
| `field-feature-description.html`            | `System.Description` (Feature)                          |
| `field-feature-business-value.html`         | `Custom.BusinessProblemandValueStatement`               |
| `field-feature-objectives.html`             | `Custom.BusinessObjectivesandImpact`                    |
| `field-feature-acceptance-criteria.html`    | `Microsoft.VSTS.Common.AcceptanceCriteria` (Feature)    |
| `field-solution-design.html`                | `Custom.DevelopmentSummary`                             |
| `field-release-notes.html`                  | `Custom.ReleaseNotes`                                   |
| `field-bug-root-cause-detail.html`          | `Custom.RootCauseDetail`                                |

## Wiki Page HTML Templates

Wiki pages use a markdown-first design optimized for Azure DevOps Wiki rendering. These templates are applied via the `util-reformat-ticket` prompt using wiki page ID to update existing pages only.

| Template File                       | Wiki Page Type                          | Detection Heuristic                                                                    |
| ----------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------- |
| `wiki-page-template.html`           | Work Item Wiki (Autonomous Ticket Prep) | Header contains "Autonomous Ticket Preparation" or page title starts with work item ID |
| `feature-solution-design-wiki.html` | Feature Solution Design Wiki            | Header contains "Feature Solution Design" or work item type is Feature/Epic            |
| `wiki-general-template.html`        | General Wiki Page (content-agnostic)    | Fallback — any page not matching work item or feature design patterns                  |

### Wiki Template Design System

Wiki templates follow a strict visual hierarchy that balances rich styling with ADO Wiki's markdown rendering constraints:

| Element                      | Design Pattern                                 | Details                                                                                 |
| ---------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Page header**              | Gradient bar                                   | `border-radius: 8px; padding: 14px 16px;` — ticket # + title only, no links or metadata |
| **`##` section headers**     | Markdown heading + **6px** gradient accent bar | Provides TOC detection + color-coded section identity                                   |
| **`###` subsection headers** | Markdown heading + **4px** gradient accent bar | Lighter shade of parent section color for hierarchy                                     |
| **Content**                  | White bordered cards                           | `background: #fff; border: 1px solid #dee2e6; border-radius: 8px; padding: 20px;`       |
| **Callouts**                 | Colored left-border accent cards               | `border-left: 4px solid ACCENT; border-radius: 0 8px 8px 0; padding: 14px;`             |
| **Tables**                   | HTML styled (NOT markdown)                     | `#f8f9fa` header rows, `1px solid #dee2e6` borders, `padding: 10px`                     |
| **Status badges**            | Colored spans                                  | `padding: 2px 8px; border-radius: 3px; font-size: 11px;`                                |
| **Section sub-labels**       | Bold colored text                              | `font-weight: 600; color: COLOR; border-bottom: 1px solid #dee2e6;`                     |
| **Diagrams**                 | Mermaid `graph TD`                             | Always top-down, never left-to-right                                                    |

**Critical rules:**

- `[[_TOC_]]` MUST be on its own line outside any HTML block
- Section headers MUST use markdown `##` / `###` syntax for TOC detection
- HTML blocks must be separated by blank lines from markdown content
- NO `<details>/<summary>` collapsed sections — all content must be fully visible
- NO markdown tables — always use HTML styled tables
- Each HTML block is self-contained (no wrapping `<div>` around entire page)

### Wiki Page Update Commands

```bash
# Get wiki page by ID
{{cli.wiki_get_by_id}} <page_id> --json

# Update wiki page by ID (PATCH endpoint - update only, never creates)
{{cli.wiki_update_by_id}} <page_id> --content "<file_path>" --comment "Update comment" --json

# Update wiki page by path (PUT endpoint - create-or-update)
{{cli.wiki_update}} --path "<wiki_path>" --content "<file_path>" --json
```

**Important**: When reformatting wiki pages, always use `{{cli.wiki_update_by_id}}` with the page ID. This uses the PATCH API endpoint which only updates existing pages and will fail if the page does not exist, preventing accidental creation of duplicate pages.

## Notes

- Always use `/fields/` prefix in `mcp_ado_wit_update_work_item` calls
- Field paths are case-sensitive
- Custom fields use `Custom.` prefix (e.g., `Custom.WorkClassType`)
- System fields use `System.` prefix (e.g., `System.Title`)
- Microsoft fields use `Microsoft.VSTS.` prefix (e.g., `Microsoft.VSTS.Common.AcceptanceCriteria`)
- Tags are semicolon-delimited strings, not arrays
- HTML content must be properly escaped if using in JSON
