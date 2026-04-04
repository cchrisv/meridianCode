# CLI tool reference

> **Meridian status (WIP — not wired):** Human shortcut only. **Not** attached as `#file:` in Copilot prompts today and **not** read by CLI. May be folded into `/util-help` or automation later.

Invocation: `npx --prefix core/scripts/workflow <suite> <command> --json`

| Suite             | Role                                    |
| ----------------- | --------------------------------------- |
| workflow-tools    | prepare, status, reset                  |
| ado-tools         | work items, backlog, wiki-backed fields |
| crm-tools         | Salesforce query/metadata               |
| wiki-tools        | ADO wiki                                |
| template-tools    | HTML templates                          |
| knowledge-tools   | search knowledge roots                  |
| integration-tools | integration registry                    |

See `core/config/shared.json` → `cli_commands`.
