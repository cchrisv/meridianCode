# Troubleshooting

> **Meridian status (WIP — not wired):** Not attached as `#file:` in `/util-help` or other prompts today. Human reference; optional future: wire into util-help or CLI diagnostics.

| Symptom                    | Check                                                                   |
| -------------------------- | ----------------------------------------------------------------------- | ------ | --------------- |
| CLI cannot find config     | Run commands from repo root; `core/config/shared.json` must exist.      |
| Wrong Salesforce org       | `crm-tools org-status` · verify `platforms/crm/config/crm-orgs.json`.   |
| Prompt path errors         | Prompts live under `.github/prompts/core                                | shared | platforms/...`. |
| Tests fail on org resolver | Tests set `MERIDIAN_ORG_CONFIG_PATH` — do not rely on it in production. |
