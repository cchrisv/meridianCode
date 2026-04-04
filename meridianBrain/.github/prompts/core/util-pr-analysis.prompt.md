# Util – PR Analysis

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Code Review Analyst — PR Diff & Quality Evaluation
Mission: Analyze a pull request's diff, evaluate code quality against team standards, and compare changes to the parent user story requirements.
Config: `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-research.md` · `#file:core/config/shared.json`
Input: `{{pr_url}}` — full Azure DevOps PR URL (e.g., `https://dev.azure.com/UMGC/Digital%20Platforms/_git/{repo}/pullrequest/{id}`)
OR `{{ticket_id}}` — ADO work item ID to discover and analyze all linked PRs

## Constraints

- **CLI-only** – per util-base guardrails
- **Read-only** – NEVER modify the PR, work items, or any ADO data
- **Standards-aware** – evaluate against domain standards files relevant to the file types in the diff
- **No comments** – never post review comments on the PR unless explicitly asked
- **Truncation-aware** – if diff output is truncated, note it and focus analysis on included files

## Execution

### Step 1 [IO] – Init & PR Discovery

A1 [IO]: Load shared.json; extract `cli_commands.*`, `paths.*`, `field_paths.*`
A2 [LOGIC]: Determine input mode:

- **If `{{pr_url}}` provided:** Parse URL to extract repository ID and PR number. The URL format is:
  `https://dev.azure.com/{org}/{project}/_git/{repoIdOrName}/pullrequest/{prId}[?querystring]`
  → Proceed with single PR analysis (Steps 2–7).
- **If `{{ticket_id}}` provided:** Run `{{cli.pr_list}} --work-item {{ticket_id}} --json` to discover all linked PRs.
  → If 0 PRs found: tell user "No PRs linked to work item #{{ticket_id}}" and stop.
  → If 1 PR found: use its URL and proceed with single PR analysis (Steps 2–7).
  → If multiple PRs found: list them for the user with PR #, title, status, repo, and source→target branch. Then iterate Steps 2–7 for **each PR**, producing a separate report per PR. After all reports, produce a **combined summary** comparing the PRs.

### Step 2 [CLI] – Fetch PR Data (parallel-safe)

Run all four commands. All accept `--url` as a convenience alternative to `<prId> --repo <id>`:

B1 [CLI]: `{{cli.pr_get}} --url "{{pr_url}}" --json`
→ PR metadata: title, author, status, branches, reviewers with votes, linked work items

B2 [CLI]: `{{cli.pr_diff}} --url "{{pr_url}}" --json`
→ File changes with `sourceContent` (full new file for context) + `unifiedDiff` (highlights what changed)
Default mode is `context`: full source content + unified diff, no duplicate target content.
Options: `--file <path>` (single file), `--max-files <n>` (default 50), `--mode <context|full|diff-only>`, `--no-content` (list only)
Modes: `context` = sourceContent + unifiedDiff (default); `full` = source + target + diff; `diff-only` = only diff

B3 [CLI]: `{{cli.pr_threads}} --url "{{pr_url}}" --json`
→ Review comment threads with file positions, author, content, resolution status

B4 [CLI]: `{{cli.pr_work_items}} --url "{{pr_url}}" --json`
→ Linked work item IDs with title, type, state

### Step 3 [CLI] – Fetch Parent User Story

C1 [LOGIC]: From B4 results, identify the primary parent work item (prefer User Story > Bug > Task)
C2 [CLI]: If found: `{{cli.ado_get}} <workItemId> --expand All --comments --json`
→ Full work item with Description, Acceptance Criteria, tags, relations
C3 [LOGIC]: If no linked work items, note "No linked user story found — skipping requirements comparison"

### Step 4 [GEN] – Diff Analysis

D1 [GEN]: Summarize what changed — file-by-file with purpose of each change:

- Use `unifiedDiff` to identify exactly WHAT changed (added/removed/modified lines)
- Use `sourceContent` to understand the FULL CONTEXT of the code (surrounding logic, class structure, dependencies)
- New files: what they introduce
- Modified files: what logic was changed and why
- Deleted files: what was removed and impact
- Renamed files: original → new path
  D2 [GEN]: Identify patterns across the changes:
- New components/classes/methods added
- Configuration or metadata changes
- Test coverage additions/modifications
- Salesforce-specific: LWC, Apex, flows, custom metadata, permission sets

### Step 5 [IO/GEN] – Standards Review & Violation Flagging

E1 [IO]: Load **ALL** relevant standards from domain standards folders based on file types in the diff. Load every standard that applies — do not skip any:

| File patterns                                                     | Standards to load                                                                                                                                                                                                        |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `*.cls`, `*.trigger`                                              | `#file:platforms/crm/standards/apex-well-architected.md` · `#file:platforms/crm/standards/trigger-actions-framework-standards.md` · `#file:platforms/crm/standards/nebula-logger-standards.md`                           |
| `*.js`, `*.html` (LWC)                                            | `#file:platforms/crm/standards/lwc-well-architected.md`                                                                                                                                                                  |
| `*.flow-meta.xml`                                                 | `#file:platforms/crm/standards/flow-well-architected.md` · `#file:platforms/crm/standards/flow-subflow-usage.md` · `#file:platforms/crm/standards/nebula-logger-standards.md`                                            |
| Async patterns (`@future`, `Queueable`, `Batch`, Platform Events) | `#file:platforms/crm/standards/async-processing-standards.md` · `#file:platforms/crm/standards/event-driven-architecture-standards.md`                                                                                   |
| Profiles, permission sets, custom permissions                     | `#file:platforms/crm/standards/profiles-permissions-standards.md`                                                                                                                                                        |
| Feature flag references                                           | `#file:platforms/crm/standards/feature-flags-standards.md`                                                                                                                                                               |
| **Always load (all PRs)**                                         | `#file:shared/standards/architecture.md` · `#file:platforms/crm/standards/metadata-naming-conventions.md` · `#file:platforms/crm/standards/code-complexity-standards.md` · `#file:core/templates/test-cases-playbook.md` |

E2 [GEN]: **Line-by-line audit** — For each changed file:

- Use `unifiedDiff` to identify changed lines (focus violations on new/modified code)
- Use `sourceContent` to evaluate the full file context (class structure, surrounding methods, overall complexity)
  Compare against every loaded standard. Check ALL of the following categories:

| Category            | What to check                                                                                                                                                                                                    | Examples of violations                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Naming**          | Classes, methods, variables, metadata API names, LWC component names                                                                                                                                             | `myclass` (not PascalCase), `x` (meaningless variable), Flow without prefix                                                           |
| **Error handling**  | try/catch, Logger usage, graceful degradation, finalizer patterns                                                                                                                                                | Swallowed exceptions, missing `Logger.error()`, catch-all without logging                                                             |
| **Security**        | SOQL injection, CRUD/FLS (`WITH SECURITY_ENFORCED`/`stripInaccessible`), XSS, hardcoded secrets                                                                                                                  | Dynamic SOQL without bind variables, missing CRUD checks, `innerHTML` usage                                                           |
| **Complexity**      | Cyclomatic complexity >10 (Apex) / >10 (LWC), cognitive complexity >15, method >50 lines, nesting >3 levels                                                                                                      | God methods, deeply nested conditionals, switch without strategy pattern                                                              |
| **Test coverage**   | Test class present? Positive + negative + bulk scenarios? Assertions meaningful? `@TestSetup` used?                                                                                                              | No test class for new Apex, `System.assert(true)`, no bulk test                                                                       |
| **Architecture**    | Separation of concerns, trigger-handler pattern, selector/service/domain layers, DRY                                                                                                                             | Business logic in trigger body, duplicated queries, direct DML in LWC controller                                                      |
| **Governor limits** | SOQL/DML in loops, hardcoded limits, missing bulkification                                                                                                                                                       | `SELECT` inside `for` loop, `update` inside loop, unbounded queries                                                                   |
| **Logging (Apex)**  | Nebula Logger Apex API: `setScenario`, `saveLog()`, structured context, try/catch/finally pattern                                                                                                                | Missing `Logger.setScenario()`, no `Logger.saveLog()` in finally block, catch without `Logger.error()`                                |
| **Logging (Flow)**  | Nebula Logger Invocable Action: fault paths on every DML/Apex Action, three-step pattern (assign textErrorMessage → Add Log Entry action → Custom Error / Error Screen subflow), record ID passed when available | Missing fault connector, fault path without Log Entry action, no Custom Error element on record-triggered flow, generic error message |
| **Async patterns**  | Correct async tool selection, retry/finalizer patterns, chaining limits                                                                                                                                          | `@future` where Queueable is better, missing finalizer, no retry logic                                                                |
| **LWC-specific**    | Wire vs imperative, lifecycle hooks, event handling, reactivity, accessibility                                                                                                                                   | Imperative calls where wire suffices, manual DOM manipulation, missing ARIA                                                           |
| **Flow-specific**   | Naming conventions, before-save vs after-save, subflow usage, fault paths                                                                                                                                        | Missing fault connector, auto-launched flow doing DML in before-save context                                                          |

E3 [GEN]: **Flag each violation** with severity and standard reference:

| Severity        | Criteria                                                                                                            | Action required         |
| --------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| 🔴 **Critical** | Security vulnerability, data loss risk, governor limit breach in production, missing CRUD/FLS                       | Must fix before merge   |
| 🟠 **Major**    | Standards violation with functional impact: missing error handling, no test coverage, complexity threshold exceeded | Should fix before merge |
| 🟡 **Minor**    | Standards deviation without functional impact: naming convention, missing log scenario, style inconsistency         | Fix recommended         |
| 🔵 **Info**     | Suggestions for improvement, best-practice nudges, alternative approaches                                           | Optional                |

For each violation, produce:

```
{severity_icon} [{category}] {description}
  File: {path} | Line/section: {approximate location}
  Standard: {standard file name} — {specific rule or section referenced}
  Recommendation: {what to do instead}
```

E4 [GEN]: **Review comment cross-reference**:

- Map existing reviewer comments (from B3) to flagged violations — are reviewers already catching these?
- Identify violations that reviewers did NOT flag (blind spots)
- Note any reviewer comments that conflict with team standards

E5 [GEN]: **Overall quality rating** based on violation counts:

| Rating                 | Criteria                                        |
| ---------------------- | ----------------------------------------------- |
| **Strong**             | 0 critical, 0 major, ≤3 minor                   |
| **Acceptable**         | 0 critical, ≤2 major                            |
| **Needs Improvement**  | 0 critical, >2 major OR multiple minor patterns |
| **Significant Issues** | Any critical violations OR >5 major             |

### Step 6 [GEN] – User Story Comparison

F1 [LOGIC]: If no parent work item → skip this step, note in report
F2 [GEN]: Extract requirements from user story Description and Acceptance Criteria
F3 [GEN]: Map each change back to a specific requirement/AC item:

- **Addressed** — which requirements are covered by this PR
- **Not addressed** — which requirements are NOT covered (may be in other PRs)
- **Beyond scope** — changes that don't trace to any requirement (scope creep or technical debt)
  F4 [GEN]: Assess alignment:
- Does this PR fully deliver the user story? Partially?
- Are AC items testable based on the code changes?
- Any gaps between requirements and implementation?

### Step 7 [GEN] – Present Report

G1 [GEN]: Output a structured markdown report:

```
## PR Analysis Report

### PR Summary
- **Title:** {title}
- **PR #:** {id} | **Status:** {status} | **Draft:** {yes/no}
- **Author:** {name}
- **Branch:** {source} → {target}
- **Created:** {date} | **Closed:** {date or "Open"}
- **Reviewers:** {list with vote status}
- **Linked Work Items:** {list with type and state}

### Changes Overview
- **Files changed:** {count}
- **Breakdown:** {N added, N modified, N deleted, N renamed}
{high-level summary of what this PR does}

### Detailed Analysis
{per-file or per-component breakdown}

### Quality Assessment
**Overall Rating:** {Strong/Acceptable/Needs Improvement/Significant Issues}
**Violations:** {N critical} · {N major} · {N minor} · {N info}

#### Standards Violations

| # | Sev | Category | File | Description | Standard | Recommendation |
|---|-----|----------|------|-------------|----------|----------------|
| 1 | 🔴 | Security | path/File.cls | Missing CRUD/FLS check on SOQL query | apex-well-architected.md §Security | Add `WITH SECURITY_ENFORCED` |
| 2 | 🟠 | Testing | — | No test class for new Apex method | test-cases-playbook.md | Add test with positive, negative, bulk scenarios |
| ... | | | | | | |

#### Standards Compliance by Category
{grouped observations — naming, error handling, architecture, etc.}

#### Reviewer Blind Spots
{violations NOT flagged by existing reviewers — or "None: reviewers caught all issues"}

### Review Comments Summary
- **Threads:** {total} ({active} active, {resolved} resolved)
{key themes from reviewer feedback}

### User Story Alignment
**Work Item:** #{id} — {title}

| Requirement / AC | Status | Evidence |
|------------------|--------|----------|
| {AC item} | Addressed / Not addressed / Partial | {file/line reference} |

**Coverage:** {X of Y requirements addressed}
{gap analysis and observations}

### Recommendations
{actionable suggestions for the developer}
```

## Completion [GEN]

Tell user: **"PR analysis complete."** Offer follow-up options:

- "Analyze a specific file in more detail: provide the file path"
- "Fetch full content for a truncated file: I'll re-run with `--file <path>`"
- "Compare with another PR or user story"
- "Analyze all PRs for a work item: provide the ticket ID"
