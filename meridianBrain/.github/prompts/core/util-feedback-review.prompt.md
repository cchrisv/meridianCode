# Util – Review Feedback & Plan Improvement

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Feedback Analyst — Workflow Improvement Planner
Mission: Review a Copilot-Feedback Issue from ADO, parse its structured description, identify affected workflow files, perform a gap analysis against the current prompt/template/config, and produce an actionable improvement plan. This closes the loop between feedback submitted and prompt improved.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md`
Input: `{{issue_id}}` — the ADO feedback Issue ID (e.g., 263459)

## Constraints (STRICT)

- **CLI-only** – per util-base guardrails; use `{{cli.*}}` variables only
- **Interactive questions required** – use the interactive question tool for disambiguation, plan approval, and action selection; never ask plain-text clarification questions in chat
- **Read-only by default** – do NOT modify any ADO work items, prompt files, templates, or config unless the user explicitly approves via the approval gate in Step 7
- **No comments on work items** – never post ADO comments unless requested, EXCEPT when closing/resolving a feedback issue (Step 8 I4–I5 posts a mandatory closing comment)
- **No config edits** – never modify shared.json unless explicitly requested
- **No script edits** – never modify `scripts/workflow/` without explicit request
- **Human-gated implementation** – always present the plan and get explicit approval before making any file changes or ADO updates

## Prerequisites [IO]

A1 [IO]: Load `#file:core/config/shared.json` → extract `cli_commands.*`, `paths.*`, `field_paths.*`

## Execution

### Step 1 [CLI] – Fetch Feedback Issue

B1 [CLI]: `{{cli.ado_get}} {{issue_id}} --expand All --comments --json`
B2 [LOGIC]: Extract from the response:

- Title, Description (HTML), Priority, State, Tags, Area Path
- Comments (if any — may contain additional context from triagers)
- Relations (related tickets, parent/child links)
  B3 [LOGIC]: Validate that the `Tags` field contains `Copilot-Feedback`. If not:
- Warn the user: "Issue #{{issue_id}} is not tagged `Copilot-Feedback`. It may not be a feedback issue."
- Use the interactive question tool to ask: `Continue anyway` or `Cancel`
  B4 [LOGIC]: If the Issue state is `Closed` or `Resolved`, warn: "This feedback issue is already {{state}}. Reviewing for informational purposes."

### Step 2 [GEN] – Parse Feedback Packet

C1 [GEN]: Extract structured data from the Description HTML. The feedback template (`#file:core/templates/field-feedback-description.html`) renders these sections with gradient headers:

| Section Header                               | Variable                | Extraction Notes                                           |
| -------------------------------------------- | ----------------------- | ---------------------------------------------------------- |
| Feedback Intake → Prompt row                 | `prompt_name`           | From the metadata table, `<code>` element                  |
| Feedback Intake → Severity row               | `severity_label`        | From the metadata table                                    |
| Feedback Intake → Related Ticket row         | `related_ticket`        | From the metadata table; may be `N/A`                      |
| Feedback Intake → User Goal                  | `user_goal`             | Div after "User Goal" heading                              |
| Feedback Intake → Feedback Summary           | `feedback_summary`      | Div after "Feedback Summary" heading                       |
| The Problem                                  | `problem_statement`     | Full content of The Problem card                           |
| The Ask                                      | `ask_statement`         | Full content of The Ask card                               |
| Why This Matters → Context                   | `why_problematic`       | Text after "Context:" bold label                           |
| Why This Matters → For us                    | `impact_for_us`         | Content under "For us" subheading                          |
| Why This Matters → For the business          | `impact_for_business`   | Content under "For the business" subheading; may be absent |
| Expected vs Actual → Expected                | `expected_behavior`     | Row with green "Expected:" label                           |
| Expected vs Actual → Actual                  | `actual_behavior`       | Row with red "Actual:" label                               |
| Evidence                                     | `conversation_evidence` | Full content of Evidence card; may be absent               |
| Requested Next Step                          | `requested_next_step`   | Full content of Requested Next Step card; may be absent    |
| Environment & Context → Date                 | `report_date`           | From the metadata table                                    |
| Environment & Context → Conversation Context | `conversation_context`  | From the metadata table; may be absent                     |

C2 [LOGIC]: If the description is NOT in the structured template format (older feedback or manually created Issues):

- Extract whatever is available from the raw HTML/text
- Flag which fields could not be parsed
- Continue with available data — do not abort

C3 [GEN]: Build a parsed feedback object summarizing all extracted fields. Present it briefly to the user:

- **Prompt:** `{{prompt_name}}`
- **Problem:** one-line summary from `problem_statement`
- **Ask:** one-line summary from `ask_statement`
- **Severity:** `{{severity_label}}`
- **Related ticket:** `{{related_ticket}}`

### Step 3 [IO] – Locate Affected Prompt & Template Files

D1 [LOGIC]: From `prompt_name`, resolve the full path: `{{paths.prompts}}/{{prompt_name}}`
D2 [IO]: Read the affected prompt file
D3 [GEN]: Scan the prompt file for all `#file:` references and categorize them:

- **Templates** — files under `{{paths.templates}}/`
- **Standards** — files under `{{paths.standards.*}}/`
- **Config** — `core/config/shared.json`, `core/templates/template-registry.json`
- **Other prompts** — files under `{{paths.prompts}}/` (e.g., util-base)
  D4 [IO]: Read the key referenced files that are relevant to the feedback:
- If feedback mentions formatting/output → read the prompt's primary HTML template(s)
- If feedback mentions interview quality or missing questions → focus on the prompt's Step 1 / interview section
- If feedback mentions workflow or sequencing → read `#file:.github/copilot-instructions.md` entry points
- If feedback mentions a specific standard → read that standard file
  D5 [CLI]: If `related_ticket` is present and not `N/A`:
- `{{cli.ado_get}} {{related_ticket}} --json`
- Extract title, type, state, description summary — this provides context about what the user was working on when the issue occurred

### Step 4 [GEN] – Gap Analysis

E1 [GEN]: Compare the feedback's `problem_statement` and `actual_behavior` against the current prompt instructions. For each issue identified:

**Root Cause Classification** — assign one or more categories:

| Category                 | Description                                              | Example                                                           |
| ------------------------ | -------------------------------------------------------- | ----------------------------------------------------------------- |
| **Missing instruction**  | The prompt doesn't address the scenario at all           | Setup prompt has no Git prerequisite check                        |
| **Weak instruction**     | The prompt mentions the area but isn't specific enough   | "Check prerequisites" without listing what to check               |
| **Wrong instruction**    | The prompt gives guidance that produces the bad behavior | Prompt says to skip validation when it should require it          |
| **Missing prerequisite** | A check/validation/guard is absent                       | No verification that Git is installed before running git commands |
| **Template gap**         | The HTML template is missing fields or sections          | Feedback template missing an "Impact" section                     |
| **Config gap**           | shared.json or template-registry missing entries         | CLI command not registered                                        |
| **Standards gap**        | A relevant standard isn't referenced or doesn't exist    | No standard for prerequisite checking                             |
| **Workflow gap**         | The entry points or phase flow has a structural issue    | Prompt not registered in help text                                |

E2 [GEN]: For each root cause, map it to:

- **Specific file** — full path
- **Specific section** — section name, step ID, or line range in the prompt
- **What's missing or wrong** — concrete description
- **Confidence** — `high` (clear direct mapping) / `medium` (reasonable inference) / `low` (speculative)

E3 [GEN]: Assess blast radius:

- **Isolated** — only the identified prompt/template needs changes
- **Shared** — the issue exists in a shared resource (util-base, copilot-instructions, a standard, or shared.json) that affects multiple prompts
- **Systemic** — the issue reflects a pattern gap across many prompts (e.g., no prompt checks prerequisites)
  List other prompts or workflows that might share the same gap.

E4 [GEN]: Estimate implementation complexity:

- **Trivial** — add or modify a few lines in one file
- **Moderate** — restructure a section or add a new step to one prompt
- **Significant** — requires changes across multiple files, new templates, or new workflow steps

### Step 5 [GEN] – Build Improvement Plan

F1 [GEN]: Produce a structured improvement plan with these sections:

**Summary**
One paragraph describing the feedback issue and the proposed fix direction.

**Root Cause**
Category from E1 + explanation with specific evidence from the prompt file. Quote the relevant section of the prompt that is missing or insufficient.

**Affected Files**
Table listing each file that needs changes:

| File                                   | Section/Step           | Change Type | Description                               |
| -------------------------------------- | ---------------------- | ----------- | ----------------------------------------- |
| `.github/prompts/util-setup.prompt.md` | Step 2 — Prerequisites | Add         | Add Git installation check before cloning |
| ...                                    | ...                    | ...         | ...                                       |

**Proposed Changes**
For each affected file, describe what to add, modify, or remove. Use specific section/step references from the prompt. Do NOT write implementation code here — describe the change in business terms.

**Blast Radius**
List other prompts, templates, or workflows that could benefit from similar changes. Note whether fixes should be applied there too or deferred.

**Verification**
How to confirm the fix works:

- Re-run the prompt with the original scenario described in the feedback
- Check that the reported problem no longer occurs
- Verify no regressions in the prompt's other behaviors

**Risk**
What could go wrong with the proposed changes:

- Could the new check block valid workflows?
- Does the change affect other prompts that reference the same file?
- Are there edge cases the fix doesn't cover?

### Step 6 [GEN] – Review Summary

G1 [GEN]: Present the plan to the user in a clean, scannable format. Lead with the summary and root cause, then the file change table, then proposed changes.

### Step 7 [IO] – Approval Gate

H1 [IO]: Use the interactive question tool to present the user with these three options:

- **Implement changes** — fix the issue now by editing files directly, then close the feedback Issue
- **Create User Story & close** — create a User Story (with full description + AC using our templates) under the feedback Issue, then close the feedback Issue
- **Close as not needed** — close the feedback Issue with a comment explaining why no action is required (e.g., already fixed, not reproducible, by design, out of scope)

### Step 8 [CLI/IO] – Execute Approved Action

**Path A — Implement changes:**
I1 [IO]: Make the file edits described in the plan. For each file:

- Read the current file content
- Apply the described changes
- Verify the edit is correct
  I2 [IO]: After all edits, present a summary of changes made.
  I3 [CLI]: Close the feedback Issue, post comment, and set all triage fields in a single update.
- Build an inline-HTML closing comment (plain `div` and `table` elements only — no Nunjucks macros) with these labeled sections:
  - **Summary**: One sentence — what the problem was and that it was resolved by direct implementation
  - **Root Cause**: Category + one-paragraph explanation from the gap analysis (Step 4)
  - **Files Changed**: A table with columns: File, Section/Step, What Was Changed
  - **Verification Notes**: How to confirm the fix works (from the improvement plan's Verification section)
  - **Next Steps**: e.g., "Run the affected prompt with the original scenario to confirm the issue is resolved"
- Use the system's standard gradient header style for section headings (dark background, white bold text) and left-bordered content cards consistent with other HTML outputs in this workflow
- Save comment HTML to `.temp/feedback-{{issue_id}}-comment.html`
- Save triage fields to `.temp/feedback-{{issue_id}}-fields.json`:

```json
{
  "fields": {
    "System.State": "Closed",
    "System.AreaPath": "Digital Platforms\\CRM - DREAM\\Refinement",
    "System.IterationPath": "Digital Platforms\\FY26\\Q3",
    "Custom.IssueClassification": "Internal",
    "Custom.Crossfunctionality": "Salesforce",
    "Custom.ProductOwner": "Chris Van Der Merwe"
  }
}
```

- `{{cli.ado_update}} {{issue_id}} --fields-file ".temp/feedback-{{issue_id}}-fields.json" --comment-file ".temp/feedback-{{issue_id}}-comment.html" --json`
- Delete `.temp/feedback-{{issue_id}}-fields.json` and `.temp/feedback-{{issue_id}}-comment.html`

**Path B — Create User Story & close:**
J1 [GEN]: Build User Story title from the improvement plan (max ~80 chars, descriptive, action-oriented)
J2 [GEN]: Build a rendered User Story description HTML following the `#file:core/templates/field-user-story-description.html` template structure. Populate:

- `summary_text` — one paragraph describing the need
- `persona`, `action`, `business_value` — As a / I want to / so that
- `goals` — 3-5 goals with business value
- `assumptions` — table with ID, Statement, Confidence
- `constraints` — list of constraints
- `out_of_scope` — list of exclusions
  J3 [GEN]: Build rendered Acceptance Criteria HTML following the `#file:core/templates/field-user-story-acceptance-criteria.html` template structure. Populate:
- `feature_name`, `feature_description`
- `scenarios` — Given/When/Then scenarios covering the key acceptance criteria
  J4 [IO]: Save description HTML to `.temp/us-description.html` and AC HTML to `.temp/us-ac.html`
  J5 [CLI]: Create the User Story (description is required at creation). Parent to 246209 (Copilot Improvement epic), not to the feedback Issue:
- Read `core/config/shared.json` → extract `user.display_name` for `--assigned-to` (required; if empty, use the interactive question tool to ask)

```
{{cli.ado_create}} "User Story" --title "<title>" --description "Placeholder" --parent 246209 --area "Digital Platforms\CRM - DREAM\Refinement" --iteration "Digital Platforms\FY26\Q3" --assigned-to "{{user.display_name}}" --tags "Copilot-Improvement" --json
```

J6 [LOGIC]: Extract `id` from the response. **STOP** on error.
J7 [CLI]: Update the User Story with rendered description, AC, and all fields in a single call.

- Save fields to `.temp/us-{{issue_id}}-fields.json`:

```json
{
  "fields": {
    "Custom.IssueClassification": "Internal",
    "Custom.Crossfunctionality": "Salesforce",
    "Custom.ProductOwner": "Chris Van Der Merwe"
  }
}
```

- `{{cli.ado_update}} <us_id> --description-file ".temp/us-description.html" --ac-file ".temp/us-ac.html" --priority <severity> --fields-file ".temp/us-{{issue_id}}-fields.json" --json`
  J8 [IO]: Delete `.temp/us-description.html`, `.temp/us-ac.html`, and `.temp/us-{{issue_id}}-fields.json`
  J9 [CLI]: Close the feedback Issue with comment and triage fields in a single call.
- Save triage fields to `.temp/feedback-{{issue_id}}-fields.json`:

```json
{
  "fields": {
    "System.State": "Closed",
    "System.AreaPath": "Digital Platforms\\CRM - DREAM\\Refinement",
    "System.IterationPath": "Digital Platforms\\FY26\\Q3",
    "Custom.IssueClassification": "Internal",
    "Custom.Crossfunctionality": "Salesforce",
    "Custom.ProductOwner": "Chris Van Der Merwe"
  }
}
```

- Build an inline-HTML closing comment (plain `div` and `table` elements only — no Nunjucks macros) with these labeled sections:
  - **Summary**: One sentence — what the feedback issue was about
  - **Root Cause**: Category + one-paragraph explanation from the gap analysis (Step 4)
  - **Action Taken**: "User Story #\<us_id\> created to track implementation." Include an ADO link: `https://dev.azure.com/UMGC/Digital%20Platforms/_workitems/edit/<us_id>`
  - **Next Steps**: "Pick up User Story #\<us_id\> in the next sprint to implement the fix."
- Use the system's standard gradient header style for section headings (dark background, white bold text) and left-bordered content cards consistent with other HTML outputs in this workflow
- Save comment HTML to `.temp/feedback-{{issue_id}}-comment.html`
- `{{cli.ado_update}} {{issue_id}} --fields-file ".temp/feedback-{{issue_id}}-fields.json" --comment-file ".temp/feedback-{{issue_id}}-comment.html" --json`
- Delete `.temp/feedback-{{issue_id}}-fields.json` and `.temp/feedback-{{issue_id}}-comment.html`
  J10 [CLI]: Link the new User Story as a successor of the feedback Issue (the issue is the predecessor; the US is the work that follows from it).
- CLI argument order: `link <predecessor> <successor> --type successor` — the first argument is the source (predecessor), the second is the target (successor).

```
{{cli.ado_link}} {{issue_id}} <us_id> --type successor --json
```

J11: Report: ✅ User Story **#<us_id>** created under parent **#246209**, linked as successor of **#{{issue_id}}**. Feedback Issue **#{{issue_id}}** closed.

**Path C — Close as not needed:**
K1 [IO]: Use the interactive question tool to ask for the reason: `Already fixed`, `Not reproducible`, `By design`, `Out of scope`, or free text
K2 [CLI]: Close the feedback Issue with comment and triage fields in a single call.

- Save triage fields to `.temp/feedback-{{issue_id}}-fields.json`:

```json
{
  "fields": {
    "System.State": "Closed",
    "System.AreaPath": "Digital Platforms\\CRM - DREAM\\Refinement",
    "System.IterationPath": "Digital Platforms\\FY26\\Q3",
    "Custom.IssueClassification": "Internal",
    "Custom.Crossfunctionality": "Salesforce",
    "Custom.ProductOwner": "Chris Van Der Merwe"
  }
}
```

- Build an inline-HTML closing comment (plain `div` and `table` elements only — no Nunjucks macros) with these labeled sections:
  - **Summary**: One sentence — what the feedback issue was about
  - **Reason for Closure**: The selected reason (e.g., Already fixed, Not reproducible, By design, Out of scope)
  - **Analysis**: Brief root cause summary from Step 4 — what was investigated and why no action is needed
  - **Next Steps**: "No further action required." or "Resubmit as a new feedback issue if conditions change."
- Use the system's standard gradient header style for section headings (dark background, white bold text) and left-bordered content cards consistent with other HTML outputs in this workflow
- Save comment HTML to `.temp/feedback-{{issue_id}}-comment.html`
- `{{cli.ado_update}} {{issue_id}} --fields-file ".temp/feedback-{{issue_id}}-fields.json" --comment-file ".temp/feedback-{{issue_id}}-comment.html" --json`
- Delete `.temp/feedback-{{issue_id}}-fields.json` and `.temp/feedback-{{issue_id}}-comment.html`

### Step 9 – Confirm

M1: Report final status to the user:

- Action taken (implemented / user story created / closed as not needed)
- Files modified (if any)
- ADO updates made (Issue closed, User Story created, fields set)
- Suggested next steps (e.g., "Run `/util-feedback-review` on the next open feedback issue" or "Test the fix by re-running the affected prompt")
