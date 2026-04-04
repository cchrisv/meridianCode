# Meridian setup (hard cutover layout)

> **Meridian status (WIP — not wired):** Summary for humans only. **Not** read by CLI as a single doc; **not** in prompt `Config:` lists. `/util-setup` and `shared.json` are the live paths.

- **Config:** `core/config/shared.json` (committed), `core/config/local.json` (optional, gitignored).
- **CRM orgs:** `platforms/crm/config/crm-orgs.json` (gitignored) — template: `crm-orgs.example.json`.
- **CLI:** `core/scripts/workflow` — build with `npm run build`.
- **Safeguards:** `core/safeguards.json`.
