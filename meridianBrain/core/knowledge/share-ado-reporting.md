# Share – ADO Reporting

> **Meridian:** Active — Copilot `#file:core/knowledge/share-ado-reporting.md` (activity report/briefing).

Activity reporting patterns shared between report and briefing prompts.
References: `#file:config/platform-ado/share-ado.md` → `#file:config/core/share-core.md`
NEVER references Salesforce.

## Reporting Philosophy

Present evidence, share your reasoning, and make recommendations — but **never draw conclusions or assign ratings**. The manager reads the evidence, follows your thinking, and decides what matters. Every narrative should help the manager walk into a 1:1 informed and ready to support their team member — as a mentor, advocate, and blocker-remover.

## Tone

Warm, coaching, developmental. Write as if the team member might read this and feel _understood_, not surveilled. Assume good intent. When you notice something, explain what you saw and why it caught your attention — then let the reader decide.

## Reporting Constraints

- **No ratings or labels** – NEVER assign health ratings (🟢/🟡/🔴), labels ("Needs Attention", "At Risk"), or category names. Describe what happened with evidence, share your reasoning, suggest what might be worth exploring; the reader decides the severity.
- **No surveillance metrics** – never cite raw activity counts, login success/failure rates, or activity-per-day averages as standalone metrics. Focus on what the activity _means_.
- **No fabrication** – every claim must trace to a specific event in the digest. If you can't back it up, don't write it.
- **Evidence-cited** – every assertion must include an inline evidence citation. Format: `(#12345, Jan 15)` or `(PR #89, "comment excerpt")`. No unsupported generalizations.
- **Describe actions, not character** – state what happened, not who the person is. Write "Coordinated with 4 team members across 6 comment exchanges (#251078, Feb 4-10)" — not "showed strong collaboration skills."
- **Show your reasoning** – when you make a recommendation, explain what evidence led you there. The reader should follow your thinking and decide whether they agree.
- **No unanchored speculation** – "may indicate", "could signal", "might suggest" are permitted ONLY when immediately preceded by a specific, cited data point.
- **Posture** – assume good intent. If someone is slow, they may be blocked. If they handed off, they may have recognized a complexity boundary. Offer the generous interpretation first.

## Team Discovery Flow

When `{{people}}` not provided:

1. `[CLI]` Verify Azure CLI auth → STOP if unauthenticated
2. `[CLI]` `{{cli.team_discover}} --json` (discovers self, manager, peers, direct reports)
3. `[LOGIC]` Parse `result.members` array
4. `[GEN]` Present numbered pick-list grouped by relationship (You / Your Manager / Peers / Direct Reports)
5. `[IO]` ASK user to pick one or more (by number, name, or "all")
6. `[LOGIC]` Map selections to `"Name|email"` format
7. `[IO]` Cache team data for potential re-runs

## Auth Validation

Azure CLI auth required. STOP with "Run `az login` first" if unauthenticated.

## Period Resolution

Resolve `{{period}}` to `{{date_start}}` and `{{date_end}}` (YYYY-MM-DD). Use the current date to calculate.

The CLI supports two modes:

- **`-d <days>`** — lookback from today (open-ended, end = today)
- **`--start <YYYY-MM-DD> --end <YYYY-MM-DD>`** — explicit bounded date range

**Use `--start/--end` when the period has a fixed end date that is NOT today.**

| User says                          | `{{date_start}}`         | `{{date_end}}`             | CLI mode                 |
| ---------------------------------- | ------------------------ | -------------------------- | ------------------------ |
| `last week`                        | Monday of previous week  | Sunday of previous week    | `--start --end`          |
| `this week`                        | Monday of current week   | today                      | `-d` (days since Monday) |
| `last 2 weeks` / `past 2 weeks`    | today − 14               | today                      | `-d 14`                  |
| `last month`                       | 1st of previous month    | last day of previous month | `--start --end`          |
| `month of January` / `January`     | Jan 1 (most recent year) | Jan 31                     | `--start --end`          |
| `last 30 days` / `30 days`         | today − 30               | today                      | `-d 30`                  |
| `last quarter` / `Q4` / `Q4 2025`  | first day of quarter     | last day of quarter        | `--start --end`          |
| `since Jan 15` / `from January 15` | Jan 15                   | today                      | `--start` (no `--end`)   |
| `Jan 1 to Jan 31` / `January 1-31` | Jan 1                    | Jan 31                     | `--start --end`          |
| `7` / `14` / `30` (bare number)    | today − N                | today                      | `-d N`                   |

**Rule of thumb:** if `{{date_end}}` = today → use `-d`; if `{{date_end}}` < today → use `--start --end`.

Always state interpretation back to user for confirmation.

## Deep-Research Protocol

The digest is a baseline, not the whole picture. Before writing narratives, scan for gaps and fill them.

| Signal in Digest                        | Research Action                                                |
| --------------------------------------- | -------------------------------------------------------------- |
| Work item referenced but not in digest  | `{{cli.ado_get}} {id} --expand All --json`                     |
| Parent New/Active but tasks closed      | `{{cli.ado_get}} {parent_id} --expand Relations --json`        |
| "blocked" or "waiting" in comments      | Check linked items via `{{cli.ado_get}}`                       |
| Dev Summary mentions components, no PR  | `{{cli.ado_search}} --type pr --query "{component_name}"`      |
| SF metadata changes, no ADO correlation | `{{cli.sf_query}} "SELECT ... FROM SetupAuditTrail WHERE ..."` |
| Complex solution references             | `{{cli.wiki_search}} "{topic_keywords}"`                       |
| Items On Hold, no explanation           | `{{cli.ado_relations}} {id} --json`                            |

**Guidelines:**

- Be targeted — don't fetch everything, only what fills a narrative gap
- Budget: aim for 3-8 additional CLI calls total
- Stop when diminishing returns — note the gap instead of rabbit-holing
- Prioritize blocked items, bouncing states, and unexplained patterns

## Evidence Citation Rules

Inline format: `(#12345, Jan 15)` · `(PR #89, "comment excerpt")` · `(comment by Person, date: "excerpt")` · `(state: X → Y, date)`

Every assertion needs a citation. No citation → delete the claim.

## Narrative Depth Rule

Write at the decision/action grain, not summary grain. For each point: **What** happened + **Why** it caught your attention + **So-what** (recommendation or question). Describe behavior, never evaluate character.

## Error Handling

- `AADSTS` / `az account show` fails → re-run `az login`
- `At least one person must be specified` → check `--people` format
- `--days must be a number between 1 and 365` → fix `--days` value
- `Salesforce org '...' is not authenticated` → re-run `sf org login web -a <alias>`
