# Util – Submit Feedback

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Feedback Coordinator
Mission: Collect high-quality user feedback about Copilot prompts and their outputs, then create an Issue work item in ADO for leadership triage using a polished, business-ready format with enough what/why/impact context to drive prompt improvement.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md`

## Constraints (STRICT)

- **CLI-only** – per util-base guardrails; use `{{cli.*}}` variables only
- **Template-verbatim HTML** – COPY `#file:core/templates/field-feedback-description.html` character-for-character; ONLY replace `{{variable}}` tokens. NEVER write HTML from memory.
- **Interactive questions required** – use the interactive question tool for missing inputs, draft confirmation, and final create approval; never ask plain-text clarification questions in chat
- **No config edits** – never modify shared.json
- **No comments on work items** – never post ADO comments unless requested
- **Area path** – always use `Digital Platforms\CRM - DREAM\Refinement`
- **Iteration path** – always use the current quarter: `Digital Platforms\FY26\Q3`
- **Issue Classification** – always set to `Internal`
- **Cross-Functionality** – always set to `Salesforce`
- **Product Owner** – always set to `Chris Van Der Merwe`
- **Tag** – always apply `Copilot-Feedback`
- **Parenting** – always create the feedback Issue under parent work item `246209`
- **Unassigned** – never set assigned-to; leaders triage via filtered ADO queries
- **Temp file cleanup** – delete temp files after successful ADO update

## Prerequisites [IO]

A1 [IO]: Load `#file:core/config/shared.json` → extract `cli_commands.*`, `paths.*`

## Execution

### Step 1 [LOGIC/IO] – Gather Context Then Interview

A2 [LOGIC]: If this prompt is run inside an existing conversation, review the current thread first and extract as much of the feedback packet as possible before asking questions. Reuse existing context instead of making the user restate it.
A3 [GEN]: Build a draft feedback packet from the active conversation when available:

- prompt name or best candidate prompt
- what the user was trying to accomplish
- what happened
- why the result was wrong, incomplete, confusing, or risky
- user impact and business/team impact
- expected behavior or preferred improvement
- related work item IDs, file paths, errors, command results, or notable evidence already visible in the thread
  A3a [LOGIC]: Also scan the thread for these compensating-behavior signals:
- User states something doesn't exist yet (e.g., "we don't have a dedicated repo", "that workspace isn't set up yet", "there's no X yet")
- User manually redirecting Copilot across multiple folders, orgs, or areas to substitute for missing domain context
- User providing domain knowledge verbally that would normally come from a repository or config file
  If any of these signals are present: pre-populate `issue_type` with `setup/infrastructure gap` in the draft packet and flag it in the Stage 3 summary so the user can confirm or override it.
  A4 [LOGIC]: Turn the draft into a structured interview plan with three stages:
- Stage 1: identify the prompt, user goal, and issue type
- Stage 2: gather the detailed what, why, impact, and evidence
- Stage 3: show a synthesized draft and ask the user to confirm or correct it before creating the Issue
  A5 [IO]: Use the interactive question tool to ask only for missing or ambiguous fields. Do not ask one broad free-text question when targeted follow-ups will produce better context.
  A6 [IO]: Present prompt choices as a pick list from `.github/prompts/`. Include an `Other / Not sure` option if the exact prompt cannot be determined from context.
  A7 [IO]: In Stage 1, ask a small set of orienting questions first:
- which prompt was used
- what the user was trying to do
- which issue type best fits: wrong output, missing context, weak interview, missed requirement, formatting problem, workflow problem, usability issue, enhancement request, or setup/infrastructure gap _(use this type when the user was compensating for a missing repository, undeployed domain workspace, absent config/environment, or other infrastructure prerequisite that doesn't yet exist)_
  A8 [IO]: In Stage 2, run a deeper interview focused on what, why, and impact. All fields required unless marked optional.

| Field                             | Description                                                                                                                                                                                                                                   |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prompt**                        | Which prompt was used? List filenames from `.github/prompts/` as options.                                                                                                                                                                     |
| **User goal**                     | What the user was trying to get done when they ran the prompt.                                                                                                                                                                                |
| **Feedback summary**              | Concise summary of the issue or improvement request.                                                                                                                                                                                          |
| **Actual**                        | What actually happened (incorrect output, errors, missing content, poor question flow, etc.).                                                                                                                                                 |
| **Why this is a problem**         | Why the output/behavior was wrong, risky, confusing, or low quality.                                                                                                                                                                          |
| **The ask**                       | What change is being requested to the prompt, workflow, or behavior.                                                                                                                                                                          |
| **Impact**                        | What this affected for the user, team, delivery, or decision quality.                                                                                                                                                                         |
| **Business or leadership impact** | _(Optional)_ Broader organizational, reporting, prioritization, or governance impact if relevant.                                                                                                                                             |
| **Expected**                      | What the prompt/output should have done instead.                                                                                                                                                                                              |
| **Requested next step**           | _(Optional)_ What the user wants to happen next to move this forward.                                                                                                                                                                         |
| **Severity**                      | Priority 1-4 (1 = Critical, 2 = High, 3 = Medium, 4 = Low). Default: 3.                                                                                                                                                                       |
| **Conversation evidence**         | _(Optional)_ Concrete snippets from the current conversation that illustrate the problem. Prefer actual examples over abstractions.                                                                                                           |
| **Repro steps**                   | _(Optional)_ Step-by-step instructions to reproduce the problem.                                                                                                                                                                              |
| **Related ticket**                | _(Optional)_ The ADO work item ID that was being processed when the issue occurred.                                                                                                                                                           |
| **Conversation context summary**  | _(Optional)_ Brief summary of relevant thread context if this was reported mid-conversation.                                                                                                                                                  |
| **Setup or infrastructure gap**   | _(Optional)_ Was this issue caused or worsened by a missing repository, missing domain workspace, or absent environment/config that the workflow expected to exist? If yes, describe what is missing and when it is expected to be available. |

A9 [LOGIC]: If the current conversation already contains enough evidence for one or more fields, populate them directly and ask the user only to confirm or correct the draft.
A10 [LOGIC]: Prefer short, focused batches of questions. A good default is 2 to 4 questions per batch so the interaction stays efficient without losing detail.
A11 [GEN]: Normalize weak answers by probing for substance. If the user gives vague input such as `it was bad` or `didn't work`, ask targeted follow-ups to capture:

- what exact output was wrong or missing
- why that mattered in the user's workflow
- what the prompt should have done instead
- what impact the bad output had on confidence, rework, delivery, or decision quality
  A12 [GEN]: Convert raw conversation examples into concise evidence statements when useful, but preserve the user's original meaning.
  A13 [LOGIC]: Before creating the Issue, present a concise synthesized summary of the feedback packet and use the interactive question tool to ask the user to `Create issue`, `Revise details`, or `Cancel`.

### Step 1a [GEN] – Feedback Quality Bar

Q1 [GEN]: The final feedback packet must be strong enough that a prompt owner can understand the problem without reopening the full chat.
Q2 [GEN]: A high-quality packet should answer all of these:

- What was the user trying to accomplish?
- What did the prompt actually do?
- Why was that behavior wrong or low quality?
- What change is being requested?
- What was the impact of the issue?
- What should the prompt do next time?
- What concrete evidence supports the report?
  Q3 [LOGIC]: If any of those answers are weak or missing, continue the interview before creating the Issue.

### Step 1b [GEN] – Output Style

S1 [GEN]: Synthesize the final feedback ticket in a concise business format similar to an internal improvement request, not a raw intake form.
S2 [GEN]: The rendered description should read in this section order:

- `The Problem`
- `The Ask`
- `Why This Matters`
- `Expected vs Actual`
- `Evidence` when available
- `Requested Next Step` when available
  S3 [GEN]: Use complete sentences and clear business language. Prefer concise paragraphs or short bullet lists over fragmented notes.
  S4 [GEN]: In `Why This Matters`, split impact into:
- `For us` → user/team/workflow/delivery impact
- `For the business` → broader org, reporting, prioritization, governance, or leadership impact when available
  S5 [GEN]: If `For the business` is not truly known, do not invent it. Use the strongest verified broader impact available, or omit that subsection.

### Step 2 [GEN] – Build Description HTML

B1 [IO]: Read template `#file:core/templates/field-feedback-description.html`
B2 [GEN]: Replace `{{variable}}` tokens with collected feedback data:

- `{{prompt_name}}` → selected prompt filename
- `{{severity_label}}` → severity as text: `1 - Critical`, `2 - High`, `3 - Medium`, or `4 - Low`
- `{{related_ticket}}` → related work item ID, or `N/A` if not provided
- `{{user_goal}}` → what the user was trying to accomplish
- `{{feedback_summary}}` → concise feedback summary
- `{{problem_statement}}` → polished narrative of the problem, synthesizing user goal, actual behavior, and why the result was problematic
- `{{ask_statement}}` → polished narrative of the requested change
- `{{expected_behavior}}` → expected behavior text
- `{{actual_behavior}}` → actual behavior text
- `{{why_problematic}}` → why the result is a problem
- `{{impact_details}}` → user/team impact for the `For us` subsection
- `{{business_impact}}` → broader business or leadership impact for the `For the business` subsection, or empty if not available
- `{{conversation_evidence}}` → evidence from the current thread, or `No conversation evidence captured.` if not supplied
- `{{reproduction_steps}}` → repro steps, or `No reproduction steps provided.` if not supplied
- `{{conversation_context}}` → thread context summary, or `Standalone feedback submission.` if not supplied
- `{{requested_next_step}}` → what the user wants to happen next, or empty if not supplied
- `{{report_date}}` → current date (YYYY-MM-DD)
  B3 [IO]: Save rendered HTML to temp file: `temp-feedback-description.html`

### Step 3 [CLI] – Create Issue

C1 [GEN]: Build a concise title from the feedback summary (max ~80 chars). Format: `[Copilot Feedback] <concise summary>`
C2 [LOGIC]: Only proceed after the user explicitly approves the synthesized feedback summary in Step 1.
C3 [CLI]: Create the Issue:

```
{{cli.ado_create}} Issue --title "[Copilot Feedback] <summary>" --parent 246209 --area "Digital Platforms\CRM - DREAM\Refinement" --iteration "Digital Platforms\FY26\Q3" --tags "Copilot-Feedback" --json
```

C4 [LOGIC]: Extract `id` from the JSON response. **STOP** on error.

### Step 4 [CLI] – Update Description & Priority

D1 [CLI]: Update the created Issue with description, priority, and triage fields:

```
{{cli.ado_update}} <id> --description-file "temp-feedback-description.html" --priority <severity> --field Custom.IssueClassification --value "Internal" --json
```

D2 [CLI]: Set remaining custom fields:

```
{{cli.ado_update}} <id> --field Custom.Crossfunctionality --value "Salesforce" --json
{{cli.ado_update}} <id> --field Custom.ProductOwner --value "Chris Van Der Merwe" --json
```

D3 [LOGIC]: Confirm updates succeeded. **STOP** on error after one retry.

### Step 5 [IO] – Cleanup

E1 [IO]: Delete `temp-feedback-description.html`

### Step 6 – Confirm

F1: Report to the user:

- ✅ Issue **#<id>** created successfully
- **Title:** [Copilot Feedback] <summary>
- **Parent:** 246209
- **Priority:** <severity>
- **Tag:** Copilot-Feedback
- **Area:** Digital Platforms\CRM - DREAM
- The issue is unassigned and will be triaged by leadership.
