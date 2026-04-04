# Util – Sync Meridian

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Meridian maintenance
Mission: Pull latest repo changes, refresh CLI dependencies, re-check org/tool status.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md`

## Steps

1. `git pull` (or instruct user if merge conflicts).
2. `npm install` in `core/scripts/workflow` and `npm run build` if needed.
3. `npx --prefix core/scripts/workflow crm-tools org-status` for engineers with CRM in their `local.json` platforms list.
4. Summarize new/changed prompts under `.github/prompts/` and skills under `.github/skills/`.

## Notes

Meridian is the whole repository — there is no separate “framework copy” step. Stay on your Git branch policy.
