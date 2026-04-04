# Meridian — GitHub Copilot Instructions

> **Meridian:** Active — root Copilot instructions file (GitHub discovers `/.github/copilot-instructions.md`).

## What this repo is

**Meridian** is the Platform Engineering operating system as a **GitHub repository**. Copilot reads from `.github/`; configuration, scripts, and knowledge live in **`core/`**, **`shared/`**, and **`platforms/<name>/`**.

## Two layers

| Layer             | Path                                                                                            | Purpose                                             |
| ----------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Copilot interface | `.github/copilot-instructions.md`, `.github/prompts/**`, `.github/agents/`, `.github/skills/**` | Primitives GitHub discovers                         |
| Content pillars   | `core/`, `shared/`, `platforms/`                                                                | Config, CLI source, templates, standards, knowledge |

**Agents** must be **flat** under `.github/agents/` (no subfolders). Use name prefixes: `crm-`, `marketing-automation-`, etc.

## CLI invocation

```text
npx --prefix core/scripts/workflow <tool-suite> <command> [options] --json
```

Use `{{cli.*}}` and `paths.*` from `#file:core/config/shared.json`. Do not hardcode old `scripts/workflow` or `sf-tools` — the Salesforce suite is **`crm-tools`**.

## Platform detection

For each ticket, read **`platforms/<id>/platform.json`** (see `detection.adoAreaPaths` and `adoTags`). The active platform drives which tools, knowledge, and prompts apply. **`workflow-tools prepare`** writes `platform`, `detectedIntegrations`, and `crossPlatformImpacts` into `core/.ai-artifacts/<id>/ticket-context.json`.

## Knowledge

- **System docs:** `core/knowledge/`
- **Org graph:** `shared/knowledge/` (including `integrations/`)
- **Platform depth:** `platforms/<name>/knowledge/`

Search: `npx --prefix core/scripts/workflow knowledge-tools search "<term>" --json`

## Safeguards

Read and respect `#file:core/safeguards.json` before suggesting risky operations.

## Workflow registry

Default workflow ids are in `#file:core/config/workflow-registry.json`. Do not assume the five-phase ticket flow is the only workflow forever — new workflows extend this registry. That file is **declarative only today** — `workflow-tools` does not read it yet; see `meridian_meta` inside the JSON.

## Meridian file status markers

Many Markdown files start with a `> **Meridian:** …` callout, and many JSON files include `meridian_meta`. Rough meanings:

| Marker                          | Meaning                                                                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Active**                      | Copilot `#file:` on at least one prompt **and/or** `shared.json` `template_files` **and/or** CLI reads the path (e.g. `platform.json`, `safeguards.json`). |
| **Active stub**                 | `#file:` or manifest is wired but content is intentionally thin (e.g. `core-competencies.md`, non-CRM `platform.json`).                                    |
| **Canonical**                   | Product/architecture authority (`meridian-prd.md`, `meridian-solution-design.md`); linked from README; not on every prompt’s `Config:` line.               |
| **WIP / not wired**             | Not default CLI or Copilot context — human docs, archives, or future integration.                                                                          |
| **`lifecycle": "wip"`** in JSON | Declarative placeholder (e.g. `workflow-registry.json` until `workflow-tools` reads it).                                                                   |

**Copilot surfaces:** Custom prompts under `.github/prompts/**`, agents, and skills usually include their own **`Meridian:** Active\*\* line after the title so every file states how GitHub discovers it.

**Skipped (IDE/tooling):** `.vscode/`, `.obsidian/`, `node_modules/`, `core/scripts/workflow/package.json` / `tsconfig` / ESLint — do not add `meridian_meta` there to avoid breaking tools.

## Share blocks (prompt config lines)

| Block                  | Path                                                 |
| ---------------------- | ---------------------------------------------------- |
| Core share             | `#file:shared/standards/share-core.md`               |
| ADO / wiki / reporting | `#file:core/knowledge/share-ado*.md`                 |
| CRM                    | `#file:platforms/crm/knowledge/share-salesforce*.md` |

## Prompts layout

- `.github/prompts/core/` — ticket grooming, utilities, setup, help, sync
- `.github/prompts/shared/` — cross-platform utilities
- `.github/prompts/platforms/<platform>/` — platform-specific prompts

## First-time setup

`/util-setup` · **Help:** `/util-help` · **Sync:** `/util-sync`

Local engineer profile (optional): copy `core/config/local.json.example` to `core/config/local.json` for platform-scoped onboarding (Section 12).
