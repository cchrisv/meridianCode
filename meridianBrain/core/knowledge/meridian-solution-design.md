# MERIDIAN — Solution Design

> **Meridian:** Canonical repo & integration contract — linked from README and `architecture.md`. Not attached as `#file:` on every Copilot prompt by default.

## Upgrading to the Platform Engineering Company OS

|                        |                   |
| ---------------------- | ----------------- |
| **Version**            | 1.3               |
| **Date**               | April 2, 2026     |
| **Author**             | Chris V.          |
| **Status**             | Draft             |
| **Classification**     | Internal          |
| **Companion Document** | Meridian PRD v1.0 |

---

> **PRD Traceability:** Where a design decision traces back to a specific PRD requirement, you will see a reference like **(PRD: MP-1)**.

---

## 1. End-to-End Overview

Meridian is a GitHub repository. That is the most important sentence in this document.

It is not a web application, not a SaaS product, not a database. It is a structured repository hosted in GitHub Enterprise that engineers clone to their local machine and interact with through their IDE using GitHub Copilot Enterprise. Everything — prompts, agents, skills, CLI tools, configuration, knowledge, templates, standards — lives in this repo as files that Git tracks, GitHub hosts, and Copilot reads.

The repository has two organizing principles working together:

**GitHub Copilot requires certain files in certain places.** Prompts must live in `.github/prompts/`. Agents must live in `.github/agents/`. Skills must live in `.github/skills/`. Instructions must live at `.github/copilot-instructions.md`. These are non-negotiable — Copilot will not discover files anywhere else. The `.github/` directory is the **Copilot interface layer**.

**Everything else organizes around three pillars.** Content that Copilot doesn't directly discover — configuration, knowledge, standards, templates, CLI source code — lives in `core/`, `shared/`, and `platforms/`. These are the **content pillars**.

Within `.github/`, subdirectories mirror the three-pillar pattern: `core/`, `shared/`, and `platforms/` subfolders keep the same organizational logic, just inside the directory Copilot actually reads.

```
┌─────────────────────────────────────────────────────────────────┐
│                     ENGINEER'S IDE (VS Code)                    │
│                                                                 │
│  GitHub Copilot Enterprise                                      │
│       │                                                         │
│       ├── Instructions ◄── .github/copilot-instructions.md     │
│       ├── Prompts      ◄── .github/prompts/{core,shared,plat}  │
│       ├── Agents       ◄── .github/agents/ (flat, prefixed)    │
│       ├── Skills       ◄── .github/skills/{core,shared,plat}   │
│       └── CLI Tools    ◄── core/scripts/workflow/               │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                      MERIDIAN REPOSITORY                        │
│                                                                 │
│  .github/                 ── Copilot interface layer            │
│  core/                    ── engine (config, scripts, runtime)  │
│  shared/                  ── collective brain (knowledge, stds) │
│  platforms/crm/                ── Salesforce depth                │
│  platforms/marketing-automation/ ── SFMC depth                   │
│  platforms/contact-center/     ── Five9 depth                    │
│  platforms/portal/             ── Portal depth                   │
│  platforms/...                 ── (future platforms)             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                     EXTERNAL SYSTEMS                            │
│                                                                 │
│  Azure DevOps    ◄── ado-tools    GitHub    ◄── pr-tools       │
│  Salesforce      ◄── crm-tools   MS Graph   ◄── team-tools     │
│  SFMC            ◄── marketing-automation-tools                  │
│  Five9           ◄── contact-center-tools                        │
│  Portal          ◄── portal-tools                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The flow is straightforward. An engineer opens a prompt or invokes a skill in Copilot. Copilot reads it from `.github/` and follows the instructions. It invokes CLI tools for the relevant platform. The CLI tools talk to external systems and write structured context into `core/.ai-artifacts/`. As the engineer moves through workflow phases, context accumulates. When the ticket closes, the knowledge engine extracts durable knowledge into the appropriate `knowledge/` directory.

---

## 2. Repository Structure

### 2.1 Full Layout

```
meridian/
│
├── .github/                             # ═══ COPILOT INTERFACE LAYER ═══
│   │                                    # Everything Copilot discovers lives here.
│   │                                    # GitHub requires these exact paths.
│   │
│   ├── copilot-instructions.md          # Global AI behavior rules (required path)
│   │
│   ├── prompts/                         # All prompts (required path, subdirs OK)
│   │   ├── core/                        # Core workflow prompts
│   │   │   ├── workflow-initial-copilot-grooming.prompt.md  # unified ticket lifecycle
│   │   │   ├── util-repeat-phase.prompt.md
│   │   │   ├── util-backlog-view.prompt.md
│   │   │   ├── util-morning-checkin.prompt.md
│   │   │   ├── util-activity-report.prompt.md
│   │   │   ├── util-platform-onboard.prompt.md
│   │   │   ├── util-setup.prompt.md
│   │   │   ├── util-help.prompt.md
│   │   │   ├── util-sync.prompt.md
│   │   │   └── ...
│   │   ├── shared/                      # Cross-platform utility prompts
│   │   │   ├── util-integration-map.prompt.md
│   │   │   ├── util-impact-analysis.prompt.md
│   │   │   ├── util-knowledge-search.prompt.md
│   │   │   ├── util-knowledge-ingest.prompt.md
│   │   │   └── util-sop-to-skill.prompt.md
│   │   └── platforms/                   # Platform-specific prompts
│   │       ├── crm/
│   │       │   ├── feature-research-phase-01-initialize.prompt.md
│   │       │   ├── feature-research-phase-02-mapping.prompt.md
│   │       │   └── ...
│   │       ├── marketing-automation/
│   │       │   ├── journey-impact-analysis.prompt.md
│   │       │   └── data-extension-dependency-map.prompt.md
│   │       ├── contact-center/
│   │       │   └── ivr-flow-analysis.prompt.md
│   │       └── portal/
│   │           └── ...
│   │
│   ├── agents/                          # All agents (required path, FLAT — no subdirs)
│   │   ├── solution-architect.agent.md          # Generalized: cross-platform design
│   │   ├── product-owner.agent.md               # Generalized: requirements refinement
│   │   ├── integration-analyst.agent.md         # Generalized: dependency analysis
│   │   ├── crm-solution-architect.agent.md              # Salesforce (CRM) specialist
│   │   ├── crm-product-owner.agent.md                   # Salesforce (CRM) specialist
│   │   ├── marketing-automation-journey-architect.agent.md  # SFMC specialist
│   │   ├── contact-center-ivr-specialist.agent.md       # Five9 specialist
│   │   └── portal-specialist.agent.md                   # Portal specialist
│   │
│   ├── skills/                          # All skills (required path, subdirs OK)
│   │   ├── core/                        # Core workflow skills
│   │   │   ├── ticket-grooming/
│   │   │   │   └── SKILL.md
│   │   │   ├── knowledge-management/
│   │   │   │   └── SKILL.md
│   │   │   └── platform-onboarding/
│   │   │       └── SKILL.md
│   │   ├── shared/                      # Cross-platform skills
│   │   │   ├── integration-mapping/
│   │   │   │   └── SKILL.md
│   │   │   ├── impact-analysis/
│   │   │   │   └── SKILL.md
│   │   │   └── sop-to-skill/
│   │   │       └── SKILL.md
│   │   └── platforms/                   # Platform-specific skills
│   │       ├── crm/
│   │       │   ├── metadata-analysis/
│   │       │   │   └── SKILL.md
│   │       │   └── org-health-check/
│   │       │       └── SKILL.md
│   │       ├── marketing-automation/
│   │       │   └── journey-builder/
│   │       │       └── SKILL.md
│   │       ├── contact-center/
│   │       │   └── ivr-configuration/
│   │       │       └── SKILL.md
│   │       └── portal/
│   │           └── ...
│   │
│   └── instructions/                    # Path-specific instructions (optional)
│       └── ...
│
├── core/                                # ═══ THE ENGINE ═══
│   │                                    # What makes Meridian run.
│   │                                    # No platform team should modify these files.
│   │
│   ├── config/
│   │   ├── shared.json                  # Global settings (ADO, wiki, CLI prefixes, paths)
│   │   └── local.json.example           # Developer override template (gitignored when real)
│   ├── knowledge/                       # System knowledge: how Meridian works
│   │   ├── tool-reference.md
│   │   ├── onboarding-guide.md
│   │   ├── setup-guide.md
│   │   └── troubleshooting.md
│   ├── standards/                       # Workflow standards and conventions
│   │   ├── ticket-quality.md
│   │   ├── knowledge-authoring.md
│   │   └── ado-conventions.md
│   ├── templates/                       # Core ADO templates and partials
│   │   ├── partials/
│   │   └── template-registry.json
│   ├── scripts/                         # CLI tool source code (Node.js/TypeScript)
│   │   └── workflow/
│   │       ├── package.json
│   │       └── src/
│   │           ├── workflow-tools/
│   │           ├── ado-tools/
│   │           ├── wiki-tools/
│   │           ├── pr-tools/
│   │           ├── report-tools/
│   │           ├── template-tools/
│   │           ├── team-tools/
│   │           ├── knowledge-tools/
│   │           └── integration-tools/
│   ├── safeguards.json                  # Prohibited autonomous operations
│   └── .ai-artifacts/                   # Runtime ticket context (gitignored)
│       ├── <work-item-id>/
│       │   └── ticket-context.json
│       └── audit/
│
├── shared/                              # ═══ THE COLLECTIVE BRAIN ═══
│   │                                    # Cross-platform resources every team shares.
│   │
│   ├── config/
│   │   └── integration-defaults.json
│   ├── knowledge/                       # Organizational knowledge graph
│   │   │
│   │   │                                # ── Technical Knowledge ──
│   │   ├── integrations/                # Cross-platform integration registry
│   │   │   ├── marketing-automation-to-crm-contact-sync.md
│   │   │   ├── contact-center-to-crm-call-logging.md
│   │   │   └── integration-sis-to-crm-employee-sync.md
│   │   ├── processes/                   # SOPs, runbooks, playbooks
│   │   │   ├── production-incident-escalation.md
│   │   │   └── cross-platform-release-coordination.md
│   │   ├── decisions/                   # Architectural decision records
│   │   │   └── 2026-01-platform-extension-model.md
│   │   ├── patterns/                    # Reusable cross-platform patterns
│   │   │   ├── data-migration-large-volume.md
│   │   │   └── cross-platform-error-handling.md
│   │   │
│   │   │                                # ── Business Knowledge ──
│   │   ├── personas/                    # Who uses the platforms and why
│   │   │   ├── field-sales-rep.md
│   │   │   ├── call-center-agent.md
│   │   │   ├── marketing-ops-manager.md
│   │   │   └── hr-benefits-coordinator.md
│   │   ├── business-processes/          # End-to-end business workflows that span platforms
│   │   │   ├── lead-to-cash.md
│   │   │   ├── employee-onboarding.md
│   │   │   └── customer-support-escalation.md
│   │   └── business-rules/              # The "why" behind platform configurations
│   │       ├── contact-deduplication-policy.md
│   │       └── territory-assignment-logic.md
│   ├── standards/                       # Org-wide standards
│   │   ├── organization-dictionary.json
│   │   └── cross-platform-conventions.md
│   └── templates/                       # Shared ADO templates
│       └── partials/
│
├── platforms/                           # ═══ WHERE DEPTH LIVES ═══
│   │                                    # One directory per platform.
│   │                                    # Same subfolder pattern, different content.
│   │
│   ├── crm/                             # Salesforce
│   │   ├── platform.json                # Platform manifest
│   │   ├── config/
│   │   │   ├── crm-orgs.example.json
│   │   │   └── crm-orgs.json           # (gitignored)
│   │   ├── knowledge/                   # CRM-specific knowledge
│   │   │   ├── account-sharing-model.md
│   │   │   ├── contact-trigger-dependencies.md
│   │   │   ├── persona-sales-ops-admin.md
│   │   │   ├── business-rule-lead-routing.md
│   │   │   └── ...
│   │   ├── standards/
│   │   │   ├── naming-conventions.md
│   │   │   ├── architecture-patterns.md
│   │   │   └── deployment-practices.md
│   │   └── templates/
│   │       ├── partials/
│   │       └── template-registry.json
│   │
│   ├── marketing-automation/            # SFMC (same subfolder pattern)
│   │   ├── platform.json
│   │   ├── config/
│   │   ├── knowledge/
│   │   ├── standards/
│   │   └── templates/
│   │
│   ├── contact-center/                  # Five9 (same subfolder pattern)
│   ├── portal/                          # Portal (same subfolder pattern)
│   ├── ipaas/                           # MuleSoft (future)
│   ├── business-apps/                   # Microsoft/D365 (future)
│   ├── sis/                             # PeopleSoft (future)
│   └── hcm/                            # Workday (future)
│
├── .gitignore
└── README.md
```

### 2.2 Two Organizing Principles

This structure has two layers working together, and understanding the distinction is important.

**Layer 1: The Copilot interface (`.github/`).** GitHub Copilot Enterprise discovers prompts, agents, and skills by looking in specific directories under `.github/`. This is a hard constraint — if a `.prompt.md` file lives anywhere else, Copilot will not find it. The `.github/` directory is where Copilot _reads from_. Within it, we use `core/`, `shared/`, and `platforms/` subdirectories to maintain the three-pillar organization. (The one exception is agents — `.github/agents/` must be flat, so we use naming prefixes like `crm-` instead of subdirectories.)

**Layer 2: The content pillars (`core/`, `shared/`, `platforms/`).** Everything that is _not_ a Copilot primitive — configuration, knowledge, standards, templates, CLI source code, runtime artifacts — lives in the three content pillars. Prompts, agents, and skills in `.github/` _reference_ these files. A prompt tells Copilot to read standards from `platforms/crm/standards/`. A skill bundles instructions that invoke CLI tools from `core/scripts/`. The content pillars are the knowledge and configuration that powers the Copilot interface.

Think of it this way: `.github/` is the steering wheel. The three pillars are the engine, the fuel, and the tires.

### 2.3 Why Agents Are Flat

GitHub Copilot requires all agent files to live directly in `.github/agents/` with no subdirectories. Unlike prompts and skills, there is no way to organize agents into folders.

To maintain the conceptual separation between generalized and platform-specialized agents, we use **naming prefixes**:

| Prefix                  | Scope                                    | Examples                                                                                |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------- |
| (none)                  | Generalized — works across all platforms | `solution-architect.agent.md`, `product-owner.agent.md`, `integration-analyst.agent.md` |
| `crm-`                  | CRM (Salesforce) specialist              | `crm-solution-architect.agent.md`, `crm-product-owner.agent.md`                         |
| `marketing-automation-` | Marketing Automation (SFMC) specialist   | `marketing-automation-journey-architect.agent.md`                                       |
| `contact-center-`       | Contact Center (Five9) specialist        | `contact-center-ivr-specialist.agent.md`                                                |
| `portal-`               | Portal specialist                        | `portal-specialist.agent.md`                                                            |

Each agent's `.agent.md` file contains instructions that reference the appropriate platform's knowledge, standards, and tools from the content pillars.

### 2.4 What Goes Where: Decision Framework

| Question                                | Answer                                           | Location                         |
| --------------------------------------- | ------------------------------------------------ | -------------------------------- |
| Is it a prompt, agent, or skill?        | Yes                                              | `.github/` (Copilot requires it) |
| Does it make Meridian run?              | Config, scripts, safeguards, runtime             | `core/`                          |
| Is it useful across multiple platforms? | Knowledge, standards, templates                  | `shared/`                        |
| Does it belong to one platform?         | Platform config, knowledge, standards, templates | `platforms/<name>/`              |

### 2.5 Knowledge Across Pillars

Knowledge appears in all three content pillars with different scopes:

| Location                      | Scope                                   | Example Content                                                                  |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------------------------------- |
| `core/knowledge/`             | How to use Meridian itself              | Workflow phase guide, tool reference, onboarding                                 |
| `shared/knowledge/`           | Cross-platform organizational knowledge | Integration registry, cross-team SOPs, architecture decisions, reusable patterns |
| `platforms/<name>/knowledge/` | Deep platform-specific understanding    | Object models, trigger dependencies, sharing rules, configuration patterns       |

When Copilot searches for knowledge (via `knowledge-tools search`), it searches all three locations and presents results ranked by relevance.

---

## 3. GitHub Copilot Enterprise Integration

### 3.1 The Four Copilot Primitives

| Primitive        | Required Path                     | Lifetime           | Trigger                             |
| ---------------- | --------------------------------- | ------------------ | ----------------------------------- |
| **Instructions** | `.github/copilot-instructions.md` | Always active      | Automatic — every session           |
| **Prompts**      | `.github/prompts/**/*.prompt.md`  | One-time execution | Engineer selects from library       |
| **Agents**       | `.github/agents/*.agent.md`       | Session-persistent | Engineer invokes by name (`@agent`) |
| **Skills**       | `.github/skills/**/SKILL.md`      | Task-specific      | Auto-discovered or `/skill-name`    |

These build on each other. Instructions provide the always-on foundation. Prompts provide structured single-step actions. Agents provide persistent conversational personas. Skills provide bundled multi-step competencies that can auto-activate when relevant.

### 3.2 The Instructions File

`.github/copilot-instructions.md` is loaded into every Copilot interaction and is the most important file in the repository. It must contain:

**Identity and navigation.** Copilot needs to understand Meridian's two-layer structure: Copilot primitives live in `.github/`, content lives in `core/`, `shared/`, and `platforms/`.

**CLI tool invocation patterns.** Exact command syntax using template variables from `core/config/shared.json`.

**Platform detection logic.** How to identify a ticket's platform from ADO metadata and load the correct `platforms/<name>/platform.json`.

**Knowledge navigation.** When to read from `core/knowledge/` (system docs), `shared/knowledge/` (org-wide), and `platforms/<name>/knowledge/` (platform-specific).

**Safeguard enforcement.** Read `core/safeguards.json` and refuse prohibited operations.

**Skill and agent awareness.** What skills and agents exist, organized by `core/`, `shared/`, and `platforms/` subdirectories within `.github/`.

### 3.3 Prompts

Prompts in `.github/prompts/` are organized into three subdirectories:

**`.github/prompts/core/`** — The five-phase ticket workflow and core utilities (backlog, standup, activity reports, onboarding, setup, help, sync). These are the backbone of daily usage and work for any platform.

**`.github/prompts/shared/`** — Cross-platform utilities that span multiple platforms: integration mapping, impact analysis, knowledge search, knowledge ingestion, SOP-to-skill conversion.

**`.github/prompts/platforms/<name>/`** — Platform-specific supplementary prompts. CRM's Feature Research Pipeline, Marketing Automation's journey impact analysis, Contact Center's IVR flow analysis.

### 3.4 How a Prompt Becomes Multi-Platform

Today, the Phase 03 prompt contains hardcoded Salesforce instructions: "Query the Salesforce metadata API using crm-tools." That works for CRM. It is meaningless for Marketing Automation and actively confusing for Contact Center.

In the multi-platform system:

1. The prompt instructs Copilot to identify the platform from the work item's ADO metadata.
2. Based on the detected platform, Copilot reads `platforms/<name>/platform.json` to understand available tools and capabilities.
3. The prompt provides _generic_ instructions: "Query the platform's metadata to discover dependencies."
4. Copilot translates that into the correct platform-specific action using the manifest.

The prompt stays the same across all platforms. The platform extension provides the context that makes it specific **(PRD: MP-1, MP-2)**.

### 3.5 Agents

All agents live flat in `.github/agents/`. Generalized agents have no prefix; platform specialists use their domain prefix (`crm-`, `marketing-automation-`, `contact-center-`, `portal-`).

**Generalized agents:**

- `solution-architect.agent.md` — Cross-platform solution design. Loads platform context as needed. Hands off to a platform specialist when depth is required.
- `product-owner.agent.md` — Requirements refinement across the technology stack.
- `integration-analyst.agent.md` — Cross-platform dependency analysis. **(NEW)**

**Platform-specialized agents:**

- `crm-solution-architect.agent.md` — Deep Salesforce (CRM) architecture expertise.
- `marketing-automation-journey-architect.agent.md` — SFMC journey and automation design.
- `contact-center-ivr-specialist.agent.md` — Five9 IVR and contact center configuration.

Each agent's `.agent.md` file references the relevant content from the pillars. For example, `crm-solution-architect.agent.md` instructs Copilot to read from `platforms/crm/standards/`, `platforms/crm/knowledge/`, and `shared/knowledge/integrations/`.

### 3.6 Skills

Skills in `.github/skills/` are organized into three subdirectories, mirroring the pillar pattern:

**`.github/skills/core/`** — System workflow skills:

- `ticket-grooming/SKILL.md` — Orchestrates the full five-phase ticket lifecycle. Can auto-activate when Copilot detects a user is working a ticket.
- `knowledge-management/SKILL.md` — Knowledge extraction, validation, and search.
- `platform-onboarding/SKILL.md` — Guided wizard for adding a new platform to Meridian.

**`.github/skills/shared/`** — Cross-platform competencies:

- `integration-mapping/SKILL.md` — Guided documentation of cross-platform integrations.
- `impact-analysis/SKILL.md` — Cross-platform change impact tracing.
- `sop-to-skill/SKILL.md` — Converts runbooks into executable skills **(PRD: KC-3)**.

**`.github/skills/platforms/<name>/`** — Platform-specific competencies:

- `platforms/crm/metadata-analysis/SKILL.md` — Deep Salesforce metadata exploration.
- `platforms/marketing-automation/journey-builder/SKILL.md` — SFMC journey design assistance.
- etc.

#### Skill File Format

```markdown
---
name: integration-mapping
description: >
  Guide engineers through documenting cross-platform integrations.
  Invoke when an engineer needs to map data flows between platforms,
  document integration schedules, or trace dependencies across systems.
allowed-tools:
  - bash
metadata:
  author: Platform Engineering
  version: 1.0
---

# Integration Mapping Skill

## When to Use

This skill activates when an engineer:

- Discovers an undocumented integration during ticket research
- Needs to create or update an integration record
- Is conducting an SME knowledge capture session

## Process

1. Identify the source and target platforms...
2. Query both platforms using their `discover-integrations` command...
3. Generate a structured integration record in shared/knowledge/integrations/...
```

#### How Skills Differ from Prompts

|               | Prompt                    | Skill                                                 |
| ------------- | ------------------------- | ----------------------------------------------------- |
| **Discovery** | Engineer manually selects | Can auto-activate when relevant                       |
| **Resources** | Single `.prompt.md` file  | Directory with SKILL.md + supporting files            |
| **Tools**     | No pre-approval           | Can declare `allowed-tools` for streamlined execution |
| **Scope**     | One-shot action           | Multi-step competency                                 |

#### SOP-to-Skill Conversion

The `sop-to-skill` skill in `.github/skills/shared/` takes a static SOP from any `knowledge/processes/` directory and transforms it into an executable skill. The original SOP stays as documentation. The generated skill goes to the appropriate location:

- A Salesforce deployment runbook → `.github/skills/platforms/crm/crm-deployment/SKILL.md`
- A cross-platform incident response → `.github/skills/shared/incident-response/SKILL.md`

---

## 4. CLI Tools Architecture

CLI tools are Meridian's hands. They live in `core/scripts/workflow/` and are invoked by prompts, agents, and skills.

### 4.1 Invocation Pattern

```bash
npx --prefix core/scripts/workflow <tool-suite> <command> [options] --json
```

### 4.2 Core vs. Platform Tool Suites

**Core tool suites** (platform-agnostic):

| Tool Suite          | Purpose                                              | Multi-Platform Changes                                      |
| ------------------- | ---------------------------------------------------- | ----------------------------------------------------------- |
| `workflow-tools`    | Ticket context lifecycle                             | Add `platform` field to ticket-context.json                 |
| `ado-tools`         | Azure DevOps operations                              | None — shared infrastructure                                |
| `wiki-tools`        | ADO wiki operations                                  | None                                                        |
| `pr-tools`          | Pull request analysis                                | None                                                        |
| `report-tools`      | Activity reporting                                   | Add platform filter, cross-platform aggregation             |
| `template-tools`    | HTML template rendering                              | Search `core/`, `shared/`, and active platform `templates/` |
| `team-tools`        | Microsoft Graph org discovery                        | None                                                        |
| `knowledge-tools`   | **NEW.** Knowledge search, ingest, validate, extract | Searches all three `knowledge/` directories                 |
| `integration-tools` | **NEW.** Integration registry query, map, trace      | Operates on `shared/knowledge/integrations/`                |

**Platform tool suites** (one per platform):

| Tool Suite                   | Platform                       | Status     |
| ---------------------------- | ------------------------------ | ---------- |
| `crm-tools`                  | CRM (Salesforce)               | Existing   |
| `marketing-automation-tools` | Marketing Automation (SFMC)    | **NEW**    |
| `contact-center-tools`       | Contact Center (Five9)         | **NEW**    |
| `portal-tools`               | Portal                         | **NEW**    |
| `ipaas-tools`                | Integration (MuleSoft)         | **FUTURE** |
| `business-apps-tools`        | Business Apps (Microsoft/D365) | **FUTURE** |
| `sis-tools`                  | SIS (PeopleSoft)               | **FUTURE** |
| `hcm-tools`                  | HCM (Workday)                  | **FUTURE** |

### 4.3 The Platform Tool Interface

Every platform tool suite must implement these commands **(PRD: MP-2)**:

| Command                                | Purpose                         | Output Shape                                                  |
| -------------------------------------- | ------------------------------- | ------------------------------------------------------------- |
| `<tool> auth-status`                   | Check platform authentication   | `{ "authenticated": bool, "org": string, "user": string }`    |
| `<tool> describe <object>`             | Return metadata schema          | `{ "name": string, "fields": [...], "relationships": [...] }` |
| `<tool> query <expression>`            | Execute platform-native query   | `{ "records": [...], "totalCount": number }`                  |
| `<tool> discover-dependencies <scope>` | Find metadata dependencies      | `{ "dependencies": [...], "scope": string }`                  |
| `<tool> discover-integrations`         | Enumerate integration endpoints | `{ "integrations": [...] }`                                   |

### 4.4 Graceful Degradation

When `auth-status` returns `false`, prompts fall back to cached context, knowledge graph content, and platform-independent workflow. The workflow never stops **(PRD: AX-3)**.

---

## 5. The Platform Manifest

Each `platforms/<name>/platform.json` declares the platform's identity, detection rules, capabilities, and resource paths.

### 5.1 Manifest Structure

```json
{
  "id": "crm",
  "name": "CRM",
  "vendor": "Salesforce",
  "shortName": "CRM",
  "description": "Salesforce CRM and custom application platform",

  "detection": {
    "adoAreaPaths": ["Platform\\CRM"],
    "adoTags": ["crm", "salesforce", "sf"],
    "adoCustomFields": { "Custom.Platform": "CRM" }
  },

  "tools": {
    "suite": "crm-tools",
    "capabilities": [
      "describe",
      "query",
      "discover-dependencies",
      "discover-integrations",
      "list-automations",
      "get-code",
      "org-status",
      "org-setup"
    ],
    "authMethod": "sf-cli",
    "configFile": "platforms/crm/config/crm-orgs.json"
  },

  "copilot": {
    "agents": ["crm-solution-architect", "crm-product-owner"],
    "prompts": ".github/prompts/platforms/crm/",
    "skills": ".github/skills/platforms/crm/"
  },

  "content": {
    "knowledge": "platforms/crm/knowledge/",
    "standards": "platforms/crm/standards/",
    "templates": "platforms/crm/templates/",
    "config": "platforms/crm/config/"
  },

  "knowledgeDomains": {
    "technical": [
      "apex",
      "flows",
      "validation-rules",
      "custom-objects",
      "sharing-model",
      "data-model",
      "integrations",
      "deployment"
    ],
    "business": ["personas", "business-rules", "business-processes"]
  }
}
```

Note the manifest distinguishes between `copilot` paths (inside `.github/`) and `content` paths (inside `platforms/`). This reflects the two-layer architecture.

### 5.2 Adding a New Platform

Four steps. No `core/` or `shared/` files change **(PRD: MP-3)**.

1. Create `platforms/<name>/` with the standard subfolder pattern (config, knowledge, standards, templates).
2. Write `platform.json` with detection rules, tool capabilities, and path references.
3. Build the platform tool suite (minimum: `auth-status`, `describe`, `query`, `discover-dependencies`, `discover-integrations`).
4. Create the Copilot files: agent(s) in `.github/agents/`, prompts in `.github/prompts/platforms/<name>/`, skills in `.github/skills/platforms/<name>/`.

The `platform-onboarding` skill in `.github/skills/core/` validates that all required pieces are in place.

---

## 6. Knowledge Engine

### 6.1 Knowledge Across All Three Pillars

| Pillar                        | Scope                                                   | Examples                                                                                                                            |
| ----------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `core/knowledge/`             | How to use Meridian                                     | Workflow phases, tool reference, onboarding guide                                                                                   |
| `shared/knowledge/`           | Cross-platform org knowledge — technical _and_ business | Integration registry, SOPs, architecture decisions, reusable patterns, user personas, end-to-end business processes, business rules |
| `platforms/<name>/knowledge/` | Deep platform understanding — technical _and_ business  | Object models, trigger dependencies, sharing rules, platform-specific personas, platform-specific business rules                    |

Knowledge spans two dimensions: **technical** (how the systems work) and **business** (why they exist and who depends on them). Both dimensions appear in all three pillars. A CRM engineer working a ticket about the Account sharing model needs to know the technical configuration _and_ that the field sales team depends on territory-based visibility to close deals. Without the business context, technically correct changes can be business-incorrect disasters.

### 6.2 The Eight Knowledge Domains

Knowledge files belong to one of eight domains, organized into two categories **(PRD: KC-4)**:

**Technical domains** — how things work:

| Domain          | What It Captures                                    | Where It Lives                                                 | Example                                                                        |
| --------------- | --------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Platform**    | Deep technical understanding of a specific platform | `platforms/<name>/knowledge/`                                  | CRM Account sharing model, Contact Center IVR routing logic                    |
| **Integration** | How platforms connect to each other                 | `shared/knowledge/integrations/`                               | Marketing Automation → CRM contact sync schedule, error handling, data mapping |
| **Process**     | SOPs, runbooks, operational procedures              | `shared/knowledge/processes/` or `platforms/<name>/knowledge/` | Production incident escalation, deployment checklist                           |
| **Decision**    | Architecture decisions and their rationale          | `shared/knowledge/decisions/`                                  | Why we chose event-driven sync over batch for the employee feed                |
| **Pattern**     | Reusable solutions validated across platforms       | `shared/knowledge/patterns/`                                   | Large-volume data migration pattern, cross-platform error handling             |

**Business domains** — why things exist and who depends on them:

| Domain               | What It Captures                                                                          | Where It Lives                                                      | Example                                                                                                                                                                                          |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Persona**          | Who uses the platforms, their roles, goals, pain points, and workflows                    | `shared/knowledge/personas/` or `platforms/<name>/knowledge/`       | Field sales rep needs territory-based Account visibility to close deals; call center agent needs caller history within 2 seconds of pickup                                                       |
| **Business Process** | End-to-end business workflows that span platforms, from trigger event to business outcome | `shared/knowledge/business-processes/`                              | Lead-to-cash (CRM → iPaaS → Business Apps), employee onboarding (HCM → SIS → CRM), customer support escalation (Portal → Contact Center → CRM)                                                   |
| **Business Rule**    | The business logic behind platform configurations — the "why" that outlives the "how"     | `shared/knowledge/business-rules/` or `platforms/<name>/knowledge/` | Contact deduplication policy (marketing requires it for attribution), territory assignment logic (sales leadership mandates geographic split), IVR menu structure mirrors the support tier model |

The distinction matters in practice. When an engineer is modifying the Contact deduplication logic in CRM, Meridian surfaces the technical knowledge (how the matching rules work, which Apex triggers fire) _and_ the business knowledge (marketing depends on clean deduplication for campaign attribution, and breaking it will cause revenue reporting errors next quarter). The engineer makes a better decision because they see both dimensions.

### 6.3 Knowledge File Format

Consistent across all pillars and all eight domains — markdown with structured frontmatter:

**Technical knowledge example:**

```markdown
---
id: k-crm-account-sharing-model
domain: platform
platform: crm
tags: [sharing-model, account, data-access, security]
confidence: high
last_validated: 2026-03-15
created_from: ticket-42156
related_integrations: [marketing-automation-to-crm-contact-sync]
related_personas: [field-sales-rep]
related_business_rules: [territory-assignment-logic]
---

# Account Object Sharing Model

...
```

**Business knowledge example (persona):**

```markdown
---
id: p-field-sales-rep
domain: persona
platforms: [crm, business-apps]
tags: [sales, revenue, field-team, account-management]
confidence: high
last_validated: 2026-03-20
---

# Field Sales Rep

## Who They Are

Outside sales representatives responsible for enterprise account relationships.
Approximately 120 reps across 4 regions.

## What They Need from CRM

- Territory-based Account visibility (cannot see accounts outside their territory)
- Contact history and engagement timeline before client meetings
- Opportunity pipeline with accurate close dates for forecasting
- Mobile access — 60% of CRM usage happens on phones between meetings

## What They Need from Business Apps (D365)

- Quote-to-order status for active deals
- Invoice history for renewal conversations

## What Breaks Their Day

- Sharing model changes that hide Accounts they're actively working
- Contact deduplication that merges records they've carefully segmented
- Sync delays between CRM and Business Apps that show stale pricing

## Business Impact

Revenue-generating role. When their tools are disrupted, deals slip.
Average deal size: $180K. Average pipeline per rep: $2.1M.
```

- **`confidence`**: `high` → `medium` (90 days) → `low` (180 days). Decays without validation **(PRD: SI-2)**.
- **`created_from`**: Links to originating ticket for provenance.
- **`related_integrations`**: Cross-references to `shared/knowledge/integrations/` — enables automatic context surfacing **(PRD: CV-2)**.
- **`related_personas`**: Cross-references to persona files — surfaces who is impacted by a change.
- **`related_business_rules`**: Cross-references to business rule files — surfaces why a configuration exists.

### 6.4 Knowledge Capture

**From workflow:** Phase 05 extracts durable knowledge from ticket-context.json. Platform-specific knowledge goes to `platforms/<name>/knowledge/`. Cross-platform discoveries go to `shared/knowledge/`. Copilot proposes, engineer approves **(PRD: KC-1, SG-1)**. When a ticket reveals business context — "the sales team needs this field for forecasting" — Phase 05 captures that as persona or business rule knowledge, not just technical knowledge.

**From ingestion:** The `util-knowledge-ingest` prompt in `.github/prompts/shared/` imports SharePoint docs, wiki pages, and team documents into the knowledge graph format **(PRD: KC-2)**. Business knowledge is particularly rich in existing documentation — SOPs often contain user workflow descriptions, stakeholder requirements docs contain persona details, and configuration guides contain business rules buried in comments.

**From business stakeholders:** The Knowledge Capture Session workflow (see Section 14.2) is designed specifically for sitting down with business stakeholders — product owners, team leads, end users — and extracting the persona, business process, and business rule knowledge that engineers don't have. This is the highest-value knowledge capture path because it produces information that does not exist anywhere else.

**Direct authoring:** Engineers write knowledge files directly. The format is simple enough that it's no harder than writing a wiki page.

### 6.5 Knowledge Validation

The `util-morning-checkin` prompt surfaces 1-2 knowledge items due for validation daily. Lightweight confirmation, not quarterly ceremony **(PRD: SI-2)**.

### 6.6 Knowledge Search

`knowledge-tools search` searches all three `knowledge/` directories. The `util-knowledge-search` prompt wraps this conversationally. An engineer asks "How does employee data get from SIS into CRM?" and gets a synthesized answer from files across all pillars **(PRD: KC-5)**.

---

## 7. Integration Registry

Lives in `shared/knowledge/integrations/`. Documents how platforms connect to each other.

### 7.1 Integration Record Format

```markdown
---
id: int-ipaas-sis-to-crm-employee-sync
type: integration
source:
  platform: sis
  vendor: PeopleSoft
  system: HR Module
  objects: [PERSON, JOB, DEPARTMENT]
middleware:
  platform: ipaas
  vendor: MuleSoft
  api: employee-sync-api
  flow: sis-to-crm-employee-transform
target:
  platform: crm
  vendor: Salesforce
  objects: [Contact, Account]
  fields:
    Contact: [FirstName, LastName, Email, Employee_ID__c, Department__c]
schedule:
  type: batch
  frequency: "Daily at 2:00 AM EST"
error_handling:
  retry_policy: "3 retries with exponential backoff"
  dead_letter: "iPaaS DLQ → #platform-integrations Slack"
  known_failure_modes:
    - "SIS HR module unavailable Sunday 8pm-12am EST"
    - "CRM Contact duplicate detection rejects without Employee_ID__c"
volume:
  average_daily_records: 150
  peak: "~2,000 during annual enrollment (October)"
owner:
  team: Integration (iPaaS)
  primary_contact: "jane.smith@company.com"
  escalation: "#platform-integrations Slack"
confidence: high
last_validated: 2026-03-20
---

# SIS → CRM Employee Sync (via iPaaS)

...
```

### 7.2 How Records Get Created **(PRD: CV-4)**

**Automated:** `discover-integrations` queries platform APIs for endpoints.
**Guided:** Phase 01 Research prompts engineers when objects lack integration context.
**Curated:** The `integration-mapping` skill guides SME knowledge capture sessions.

### 7.3 Impact Tracing **(PRD: CV-3)**

The `impact-analysis` skill traces cross-platform dependency chains from a proposed change through the integration registry.

---

## 8. Ticket Context and Phased Workflow

### 8.1 Ticket Context

`core/.ai-artifacts/<work-item-id>/ticket-context.json` (gitignored) includes:

- `platform` — detected from ADO, determines which platform resources load
- `detectedIntegrations` — IDs from `shared/knowledge/integrations/`
- `crossPlatformImpacts` — populated during Phase 04
- `knowledgeExtraction` — candidates reviewed by engineer during Phase 05

### 8.2 Phase Walkthrough: Contact Center Ticket

"Update the inbound IVR script to add a new menu option for billing inquiries."

**Phase 01 — Research.** Copilot detects Contact Center (Five9) via `platforms/contact-center/platform.json`, loads contact center standards and knowledge, searches `shared/knowledge/integrations/` (finds: Contact Center → CRM case creation). Engineer discovers the integration impact without having to know it existed.

**Phase 02 — Grooming.** Refines requirements, flags integration impact, writes acceptance criteria accounting for both Contact Center and CRM impacts.

**Phase 03 — Solutioning Research.** Checks `contact-center-tools auth-status`, queries IVR configuration, reads the integration record. Falls back to `platforms/contact-center/knowledge/` if auth expired.

**Phase 04 — Solutioning.** Proposes IVR change, identifies cross-platform CRM impact, suggests linked ADO work item.

**Phase 05 — Finalization.** WSJF scoring, template formatting from `platforms/contact-center/templates/`, knowledge extraction. New integration detail committed to `shared/knowledge/integrations/`.

---

## 9. Self-Improvement and Feedback Loops

### 9.1 Feedback Capture **(PRD: SI-1)**

| Engineer Action   | Signal     | Meaning                              |
| ----------------- | ---------- | ------------------------------------ |
| Uses output as-is | `accepted` | Reinforce this pattern               |
| Edits before use  | `modified` | Right direction, correction captured |
| Discards          | `rejected` | Missed — replacement is the signal   |
| No engagement     | `ignored`  | Ambiguous, weak signal               |

Signals accumulate in `shared/knowledge/patterns/`.

### 9.2 Cross-Pollination **(PRD: SI-3)**

`shared/knowledge/patterns/` stores patterns by category, not platform. A pattern validated on CRM is flagged as a suggestion for similar HCM problems.

---

## 10. Safeguards

`core/safeguards.json` defines prohibited operations. The instructions file tells Copilot to check it before every action **(PRD: SG-1, SG-2)**.

```json
{
  "version": "1.0",
  "prohibitedOperations": [
    { "operation": "deploy", "scope": "production" },
    { "operation": "modify-data", "scope": "production" },
    { "operation": "modify-permissions", "scope": "all" },
    { "operation": "delete", "scope": "all" },
    { "operation": "external-communication", "scope": "all" }
  ],
  "auditRequirements": {
    "logAllAISuggestions": true,
    "logAllHumanDecisions": true,
    "logAllToolInvocations": true,
    "retentionDays": 365
  }
}
```

Audit logs write to `core/.ai-artifacts/audit/` (gitignored, exportable) **(PRD: SG-3)**.

---

## 11. Configuration Management

### 11.1 Hierarchy

| Tier     | Location                   | Scope                              | Git        |
| -------- | -------------------------- | ---------------------------------- | ---------- |
| Core     | `core/config/shared.json`  | Every engineer, every platform     | Committed  |
| Shared   | `shared/config/`           | Cross-platform settings            | Committed  |
| Platform | `platforms/<name>/config/` | Platform-wide + developer-specific | Mixed      |
| Local    | `core/config/local.json`   | One engineer's overrides           | Gitignored |

### 11.2 Template Variables

```json
{
  "cli": {
    "prefix": "npx --prefix core/scripts/workflow",
    "ado_get": "{{cli.prefix}} ado-tools get",
    "knowledge_search": "{{cli.prefix}} knowledge-tools search"
  },
  "cli_platform": {
    "crm": { "describe": "{{cli.prefix}} crm-tools describe" },
    "marketing-automation": { "describe": "{{cli.prefix}} marketing-automation-tools describe" },
    "contact-center": { "describe": "{{cli.prefix}} contact-center-tools describe" }
  },
  "paths": {
    "core": "core",
    "shared": "shared",
    "platforms": "platforms",
    "artifacts": "core/.ai-artifacts",
    "knowledge": {
      "core": "core/knowledge",
      "shared": "shared/knowledge",
      "integrations": "shared/knowledge/integrations"
    }
  }
}
```

---

## 12. Engineer Onboarding Experience

Getting an engineer productive in Meridian should take minutes, not days. The onboarding experience is built around three utility prompts — `util-setup`, `util-help`, and `util-sync` — and a fundamental principle: **engineers only authenticate to the platforms they actually work on.**

### 12.1 Platform-Scoped Authentication

A Contact Center engineer should never be asked to authenticate to Salesforce. A CRM engineer has no reason to set up SIS credentials. Meridian enforces this through **platform-scoped authentication**:

Each engineer's `core/config/local.json` (gitignored) declares which platform domains they belong to:

```json
{
  "engineer": {
    "name": "Jane Smith",
    "platforms": ["contact-center", "crm"]
  }
}
```

When `util-setup` runs, it reads this list and only walks the engineer through authentication for _their_ platforms. It skips everything else. If Jane later picks up a CRM ticket for cross-platform work, she's already authenticated. If she picks up a Marketing Automation ticket, Meridian falls back to knowledge graph content and cached context — the workflow continues, just without live API calls **(PRD: AX-3)**.

The platform manifest's `tools.authMethod` field tells `util-setup` how to authenticate each platform:

| Platform Domain      | Auth Method              | What Setup Does                              |
| -------------------- | ------------------------ | -------------------------------------------- |
| CRM                  | `sf-cli`                 | Runs `sf org login` for configured orgs      |
| Marketing Automation | `sfmc-api-key`           | Validates API credentials in platform config |
| Contact Center       | `five9-api`              | Validates Five9 API session                  |
| Portal               | `portal-oauth`           | OAuth flow for portal system                 |
| Business Apps        | `azure-ad`               | Azure AD service principal validation        |
| SIS                  | `peoplesoft-api`         | PeopleSoft API token validation              |
| HCM                  | `workday-api`            | Workday API credentials validation           |
| iPaaS                | `mulesoft-connected-app` | MuleSoft Connected App token validation      |

### 12.2 The Three Onboarding Utilities

**`util-setup.prompt.md`** — First-run setup wizard.

An engineer clones the repo, opens their IDE, and runs `/util-setup`. It:

1. Checks prerequisites (Node.js version, npm dependencies via `npm install`).
2. Creates `core/config/local.json` from the example template.
3. Asks which platform domain(s) the engineer belongs to.
4. Walks through authentication for _only_ those platforms, one at a time.
5. Validates each auth with `<platform>-tools auth-status`.
6. Runs a smoke test: pulls a recent ticket from ADO to confirm the full pipeline works.
7. Prints a summary of what's ready and what's optional.

If any platform auth fails, setup continues with the rest. The engineer gets a clear message: "Contact Center tools are ready. CRM auth failed — run `/util-setup crm` to retry later." No blocked onboarding over one flaky credential.

**`util-help.prompt.md`** — Contextual help and discovery.

Engineers don't read docs. They ask questions. `/util-help` is the interactive guide:

- `/util-help` (no args) — prints what's available: platforms the engineer is authenticated to, prompts they can run, agents they can invoke, skills that are active.
- `/util-help <topic>` — explains a specific concept. "What are phases?" "How does knowledge capture work?" "What agents exist for my platform?" Copilot reads from `core/knowledge/` and the engineer's platform `knowledge/` directories to give platform-relevant answers.
- `/util-help troubleshoot` — **target behavior:** walk through common issues (auth, ADO, config). **Today:** `troubleshooting.md` is a human stub (marked WIP / not wired as `#file:`); the prompt should still answer from that content when engineers ask.

**`util-sync.prompt.md`** — Keep everything current.

Meridian evolves. New prompts get added, knowledge files get updated, platform extensions get new capabilities. `/util-sync` handles the maintenance:

1. Runs `git pull` to get the latest repository changes.
2. Runs `npm install` in `core/scripts/workflow/` to update CLI tool dependencies.
3. Re-validates authentication for the engineer's configured platforms.
4. Surfaces any new prompts, agents, or skills added since the last sync.
5. Checks for knowledge items due for validation (ties into the morning check-in flow).
6. Reports what changed: "2 new shared prompts added. CRM tools updated to v2.3. Your Contact Center auth is still valid."

Engineers should run `/util-sync` at the start of each day — or the `util-morning-checkin` prompt can call it automatically as its first step.

### 12.3 Onboarding Flow by Role

| Scenario                                      | What Happens                                                                                                                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New engineer, single platform**             | Clones repo → `/util-setup` → authenticates one platform → starts working tickets in minutes                                                                                                                                                                |
| **Cross-platform engineer**                   | `/util-setup` → authenticates multiple platforms → sees integration context across all of them                                                                                                                                                              |
| **Engineer temporarily helping another team** | Already set up → picks up ticket on unfamiliar platform → Meridian detects platform from ADO, loads that platform's knowledge and standards, falls back gracefully if not authenticated → engineer still gets 80% of the value without any additional setup |
| **New platform team onboarding**              | Platform extension owner runs `platform-onboarding` skill → creates platform directory structure → team members run `/util-setup` → auth for new platform becomes available                                                                                 |

The key insight: **the bar to start is low, and the system gets more useful as you authenticate more platforms.** Nobody is forced to set up credentials they don't need, but the engineer who authenticates to three platforms sees integration context that the single-platform engineer misses. The value compounds without the friction compounding.

---

## 13. Migration Path

### 13.1 What Doesn't Change

- **ado-tools, wiki-tools, pr-tools, team-tools, report-tools**: Already platform-agnostic.
- **workflow-tools**: Adds `platform` field.
- **template-tools**: Searches all three `templates/` directories.
- **Existing Salesforce prompt content**: The instructions move to `.github/prompts/platforms/crm/`.

### 13.2 Migration Steps

**Step 1: Restructure the repository.**

```
# Before → After (Copilot layer)
.github/copilot-instructions.md       → stays (updated content)
.github/prompts/ (all SF)             → .github/prompts/core/ (generalized)
                                         .github/prompts/platforms/crm/ (CRM-specific)
.github/agents/crm-*                   → stays (flat, already prefixed)
.github/agents/ (generalized)          → stays

# Before → After (Content pillars)
scripts/workflow/                      → core/scripts/workflow/
config/shared.json                     → core/config/shared.json
config/platform-salesforce/            → platforms/crm/{standards,templates,config}/
config/platform-ado/templates/         → core/templates/ + shared/templates/
config/core/standards/                 → shared/standards/
safeguards.json                        → core/safeguards.json
.ai-artifacts/                         → core/.ai-artifacts/

# New
core/knowledge/                        (system docs)
shared/knowledge/                      (org knowledge graph)
shared/prompts/ → .github/prompts/shared/
shared/skills/ → .github/skills/shared/
platforms/marketing-automation/         (Marketing Automation extension)
platforms/contact-center/              (Contact Center extension)
platforms/portal/                      (Portal extension)
```

**Step 2: Create platform manifests** for CRM, Marketing Automation, Contact Center, Portal.

**Step 3: Generalize core prompts** — platform detection via `platform.json`. Test CRM tickets immediately.

**Step 4: Build Marketing Automation, Contact Center, and Portal extensions** — tool suites, manifests, standards, templates, knowledge, plus Copilot files (agents, prompts, skills in `.github/`).

**Step 5: Build knowledge-tools and integration-tools.** Seed from existing wiki content.

**Step 6: Build skills** — core (ticket-grooming, knowledge-management), shared (integration-mapping, impact-analysis, sop-to-skill), platform-specific.

**Step 7: Generalize agents.** Create generalized agents. Retain CRM specialists.

### 13.3 Validation Criteria

1. Full five-phase workflow works on CRM, Marketing Automation, Contact Center, and Portal tickets.
2. CRM ticket touching Marketing Automation integration auto-surfaces context in Phase 01.
3. Knowledge search returns results from all three `knowledge/` directories.
4. Skills auto-discover (invoke `/ticket-grooming` and it runs the core skill).
5. Agents resolve correctly (`@solution-architect` for generalized, `@crm-solution-architect` for platform).
6. `core/safeguards.json` enforced.
7. No regressions to existing CRM workflow.
8. `/util-setup` completes for a new engineer with only their platform(s) — no unnecessary auth prompts.
9. `/util-help` returns platform-relevant answers based on the engineer's configured domains.
10. `/util-sync` detects and reports changes since last run.

---

## 14. Phase 2 Horizon: From Workflow Tool to Operating System

The architecture described in Sections 1–13 delivers a multi-platform ticket workflow with a knowledge layer. That is necessary but not sufficient. A true operating system manages the whole environment — not just one job type. This section defines the capabilities that transform Meridian from "a very good ticket tool" into the operating system for Platform Engineering.

These are not aspirational ideas. They are architectural commitments that Phase 1 must not block. Every subsection below identifies what Phase 1 must leave room for and what Phase 2 builds.

### 14.1 Observability & Metrics

**The problem:** Phase 1 Meridian has no eyes. There is no way to answer "Is Meridian working?" beyond anecdotal feedback. Without metrics, you cannot prove value to leadership, identify underused capabilities, or measure whether self-improvement loops are actually improving anything.

**What Phase 2 builds:**

A `report-tools metrics` command and a `util-metrics-dashboard.prompt.md` that surface system health and adoption data. Metrics fall into four categories:

**Adoption metrics** — Which platforms are active? How many engineers ran a prompt this week? Which prompts and skills get used most? Which get ignored? Adoption by platform domain over time.

**Workflow metrics** — Tickets processed per platform per week. Average phase completion time. Drop-off rates (tickets that start Phase 01 but never reach Phase 05). Percentage of tickets with full context vs. partial context.

**Knowledge metrics** — Knowledge graph growth rate (new files per week). Confidence distribution (how much knowledge is high vs. medium vs. low confidence). Validation throughput (how many items get re-validated vs. how many are due). Integration registry coverage (documented vs. estimated total integrations).

**Intelligence metrics** — AI output acceptance rate by platform and prompt. Modification rate (accepted but edited — the most valuable signal). Cross-pollination hits (patterns from one platform suggested and accepted on another). Feedback signal volume.

**What Phase 1 must leave room for:** Every CLI tool invocation already writes to `core/.ai-artifacts/audit/`. Phase 1 must ensure audit log entries include: timestamp, engineer ID, platform domain, prompt/agent/skill invoked, tool commands executed, and outcome (completed/abandoned). This audit trail is the raw data that Phase 2 metrics consume. Getting the schema right now avoids a painful backfill later.

**Where it lives:**

```
core/scripts/workflow/src/report-tools/   → metrics commands
.github/prompts/core/util-metrics-dashboard.prompt.md
core/config/metrics-schema.json           → audit log schema definition
```

### 14.2 Workflow Types Beyond Tickets

**The problem:** Platform engineers don't just groom tickets. They respond to production incidents, write post-mortems, conduct architecture reviews, coordinate cross-team releases, onboard new hires to their platform, and hand off on-call rotations. Phase 1 Meridian only knows one workflow shape — the 5-phase ticket lifecycle. Everything else happens outside the system, which means everything else loses the benefits of context accumulation, knowledge capture, and cross-platform visibility.

**What Phase 2 builds:**

A **workflow registry** in `core/config/workflows.json` that defines multiple workflow types, each with their own phase structure, prompts, templates, and knowledge extraction rules. The ticket workflow becomes one entry in the registry, not the hardcoded default.

Candidate workflow types:

**Incident Response** — Detect → Triage → Investigate → Resolve → Post-Mortem. Automatically pulls integration context for the affected platform. Post-mortem phase extracts durable knowledge about failure modes into `shared/knowledge/patterns/`.

**Architecture Review** — Proposal → Impact Analysis → Cross-Platform Review → Decision Record. Produces an ADR (Architecture Decision Record) in `shared/knowledge/decisions/`. The impact analysis phase leverages the integration registry to identify downstream effects.

**Release Coordination** — Plan → Cross-Platform Dependency Check → Stage → Validate → Release Notes. For changes that touch multiple platforms simultaneously. Automatically identifies which platform teams need to be involved based on integration registry data.

**Platform Onboarding (People)** — not onboarding a platform to Meridian, but onboarding a new engineer to a platform. Guided tour of the platform's knowledge, standards, key integrations, common patterns, and active work items. Generates a personalized onboarding checklist based on the platform's knowledge graph depth.

**Knowledge Capture Session** — SME Interview → Structure → Validate → Publish. A dedicated workflow for sitting down with a subject matter expert and extracting undocumented knowledge into the knowledge graph. Particularly critical for platforms with limited API discoverability (SIS, legacy systems).

**What Phase 1 must leave room for:** The 5-phase ticket workflow must not be hardcoded into `copilot-instructions.md` or core prompts in a way that assumes it's the only workflow. Phase detection logic should read from a workflow registry, not from if/else branches. The `ticket-context.json` schema should generalize to a `workflow-context.json` pattern where the phase structure is dynamic.

**Where it lives:**

```
core/config/workflows.json                    → workflow registry
.github/prompts/core/<workflow>-phase-*.prompt.md  → phase prompts per workflow type
.github/skills/core/<workflow>/SKILL.md       → workflow-level skills
core/.ai-artifacts/<work-item-id>/workflow-context.json  → generalized context
```

### 14.3 Proactive Intelligence

**The problem:** Phase 1 Meridian is pull-based. The engineer invokes a prompt, asks Copilot a question, runs a command. The system responds. But the most valuable operating systems don't just answer — they alert. They surface things you didn't know to ask about. Phase 1 Meridian has all the data to do this; it just lacks the mechanism.

**What Phase 2 builds:**

A **signals engine** that runs during `util-morning-checkin` (and optionally on a scheduled interval) to surface proactive insights. Three signal categories:

**Staleness signals** — Knowledge items approaching or past confidence decay thresholds. Integration records that haven't been validated in 90+ days. Standards documents that reference deprecated platform features. These already exist in the data; the signals engine just surfaces them at the right time.

**Change signals** — A platform extension was updated this week (new prompts, new knowledge). An integration record that your platform depends on was modified by another team. A shared standard changed that affects your platform's conventions. These come from git history analysis against the engineer's configured platform domains.

**Pattern signals** — A pattern was validated on another platform that matches a problem shape in your current ticket. A knowledge gap was identified (e.g., an integration endpoint was discovered by `discover-integrations` but has no corresponding record in the registry). A prompt is consistently getting modified outputs on your platform, suggesting the generic instructions need platform-specific tuning.

**What Phase 1 must leave room for:** The `local.json` engineer profile (platform domains) is already the targeting mechanism — signals are filtered to what's relevant to each engineer. Phase 1 must ensure knowledge files have consistent `last_validated` dates and `confidence` fields, and that integration records have `last_validated` timestamps. Without clean metadata, the signals engine has nothing to reason about.

**Where it lives:**

```
core/scripts/workflow/src/signals-engine/     → signal detection logic
core/config/signal-rules.json                 → configurable signal thresholds
.github/prompts/core/util-morning-checkin.prompt.md  → updated to invoke signals
```

### 14.4 Governance as Code

**The problem:** The PRD requires governance (SG-5) — core maintainers, platform extension owners, knowledge stewards, a cross-team advisory board. The Phase 1 Solution Design enforces safeguards but doesn't operationalize who can change what. A Contact Center engineer can currently push changes to `platforms/crm/` and nobody's architecture prevents it. As Meridian scales to 8+ platform teams contributing to one repository, this becomes a real risk.

**What Phase 2 builds:**

**CODEOWNERS integration.** A `.github/CODEOWNERS` file that maps ownership to the repository structure:

```
# Core — requires core maintainer approval
/core/                          @meridian-core-maintainers
/core/safeguards.json           @meridian-core-maintainers @platform-eng-leadership
/.github/copilot-instructions.md @meridian-core-maintainers

# Shared — requires cross-team review
/shared/knowledge/              @meridian-knowledge-stewards
/shared/standards/              @meridian-core-maintainers
/.github/prompts/shared/        @meridian-core-maintainers
/.github/skills/shared/         @meridian-core-maintainers

# Platforms — owned by respective teams
/platforms/crm/                 @crm-team
/.github/prompts/platforms/crm/ @crm-team
/.github/agents/crm-*           @crm-team
/platforms/contact-center/      @contact-center-team
# ... etc
```

**Contribution guidelines.** A `CONTRIBUTING.md` that defines:

- How to propose changes to shared knowledge (PR with knowledge steward review).
- How to propose changes to shared standards (RFC workflow → advisory board approval).
- How to add a new prompt, agent, or skill to a platform extension (platform team autonomy, no cross-team approval needed).
- How to promote a platform-specific pattern to shared (PR with evidence of cross-platform applicability).

**Role definitions in config:**

```json
// core/config/governance.json
{
  "roles": {
    "coreMaintainers": {
      "team": "@meridian-core-maintainers",
      "scope": "core/, shared/standards/"
    },
    "knowledgeStewards": { "team": "@meridian-knowledge-stewards", "scope": "shared/knowledge/" },
    "platformOwners": {
      "crm": { "team": "@crm-team" },
      "contact-center": { "team": "@contact-center-team" }
    },
    "advisoryBoard": {
      "team": "@platform-eng-leadership",
      "scope": "core/safeguards.json, shared/standards/"
    }
  }
}
```

**What Phase 1 must leave room for:** The three-pillar structure already enables clean ownership boundaries — that's by design. Phase 1 must resist the temptation to put platform-specific content in `shared/` just because it's "useful to everyone." The cleaner the boundaries are in Phase 1, the easier CODEOWNERS is to implement in Phase 2.

### 14.5 CI/CD and Quality Gates

**The problem:** Meridian is a repository that engineers rely on every day. A bad merge can break prompts, introduce invalid knowledge frontmatter, or corrupt the platform manifest schema. There are no automated checks preventing this. The repo has the same quality risks as any production codebase but none of the protections.

**What Phase 2 builds:**

A GitHub Actions pipeline (or Azure DevOps pipeline, depending on where the repo is hosted) that runs on every PR:

**Schema validation** — Every `platform.json` matches the manifest schema. Every knowledge file has valid frontmatter (required fields: `id`, `domain`, `confidence`, `last_validated`). Every integration record has `source`, `target`, `schedule`, and `owner`. Every SKILL.md has valid YAML frontmatter with `name`, `description`, and `allowed-tools`.

**Prompt lint** — Prompts reference valid file paths (no broken `platforms/<name>/` references). Prompts don't contain hardcoded platform assumptions (regex check for vendor-specific tool names outside of platform-specific prompt directories). Prompts follow naming conventions (`<type>-<name>.prompt.md`).

**Knowledge graph integrity** — `related_integrations` fields in knowledge files point to integration records that actually exist. `knowledgeDomains` in platform manifests match the actual subdirectory structure. Cross-references between pillars resolve correctly.

**CLI tool tests** — Standard unit and integration tests for the Node.js/TypeScript tool suites. Mock-based tests for platform API interactions. Contract tests that validate the Platform Tool Interface (every platform tool suite implements the 5 required commands).

**Safeguard enforcement** — CI verifies that `core/safeguards.json` has not been weakened (prohibited operations can only be added, not removed, without explicit core maintainer approval).

**What Phase 1 must leave room for:** Consistent schemas from day one. If Phase 1 knowledge files have inconsistent frontmatter, Phase 2 CI will either require a painful migration or ship with exceptions that undermine trust. The schemas defined in Sections 5, 6, and 7 of this document must be treated as contracts, not suggestions.

**Where it lives:**

```
.github/workflows/meridian-ci.yml           → pipeline definition
core/scripts/validation/                     → validation scripts
core/config/schemas/                         → JSON schemas for manifests, knowledge, integrations
```

### 14.6 Cross-Platform Ticket Orchestration

**The problem:** Some tickets don't belong to one platform. "Update the employee sync to include the new department field" touches SIS (source), iPaaS (middleware), and CRM (target). In Phase 1, this ticket gets assigned to one platform, and the engineer manually discovers the cross-platform impacts through the integration registry. That's better than nothing, but it doesn't orchestrate the work across teams.

**What Phase 2 builds:**

**Multi-platform ticket detection.** During Phase 01 Research, if the integration registry shows the ticket impacts 2+ platforms, Meridian flags it as a cross-platform ticket and activates the `integration-analyst` agent automatically.

**Linked work item generation.** When cross-platform impact is confirmed during Phase 04 Solutioning, Meridian proposes linked ADO work items for the affected platform teams. "This CRM change requires a corresponding iPaaS flow update — create a linked work item for the iPaaS team?" The engineer approves, and `ado-tools` creates the linked item with pre-populated context from the integration registry.

**Cross-platform context sharing.** Linked tickets share a `crossPlatformContext` section in their `workflow-context.json` that references the parent ticket and all sibling tickets. When an engineer on the iPaaS team opens their linked ticket, Meridian automatically loads the CRM ticket's research and solutioning context. Nobody starts from zero.

**Coordination view.** A `util-cross-platform-status.prompt.md` that shows the state of all linked tickets across platforms. "CRM ticket is in Phase 04. iPaaS ticket is in Phase 02. SIS ticket hasn't been started — flag the SIS team."

**What Phase 1 must leave room for:** The `detectedIntegrations` and `crossPlatformImpacts` fields in `ticket-context.json` are already defined. Phase 1 must ensure these fields are reliably populated during Phase 01 and Phase 04. The integration registry must be seeded with enough real data during the pilot to exercise cross-platform detection.

### 14.7 Template Expansion

**The problem:** The template engine formats ADO work items, and it does that well. But platform teams produce far more document types than tickets — and every one of them is currently either unstructured or inconsistently structured across teams.

**What Phase 2 builds:**

An expanded template registry that covers the full range of Platform Engineering artifacts:

| Template Type                     | Purpose                                              | Output                                                                         |
| --------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------ |
| **ADO Work Item**                 | Ticket formatting (exists today)                     | HTML for ADO fields                                                            |
| **Architecture Decision Record**  | Structured decision documentation                    | Markdown in `shared/knowledge/decisions/`                                      |
| **Post-Mortem**                   | Incident analysis and lessons learned                | Markdown with structured sections (timeline, impact, root cause, action items) |
| **Integration Record**            | Cross-platform integration documentation             | Markdown in `shared/knowledge/integrations/` (schema from Section 7)           |
| **Release Notes**                 | Cross-platform release summary                       | Markdown or HTML for wiki publication                                          |
| **Platform Onboarding Checklist** | New engineer ramp-up guide                           | Markdown generated from platform knowledge graph                               |
| **RFC (Request for Comments)**    | Proposed changes to shared standards or architecture | Markdown with review workflow metadata                                         |
| **Runbook**                       | Step-by-step operational procedure                   | Markdown in `knowledge/processes/`, convertible to skill via `sop-to-skill`    |

Templates live in the three-pillar structure: `core/templates/` for universal formats (post-mortem, RFC), `shared/templates/` for cross-platform formats (integration record, release notes), `platforms/<name>/templates/` for platform-specific formats.

**What Phase 1 must leave room for:** The `template-tools` search path already spans all three `templates/` directories. Phase 1 must ensure the template registry format (`template-registry.json`) supports a `type` field that distinguishes template categories, not just a flat list of ADO templates.

---

## 15. Glossary

| Term                                                   | Definition                                                                                                             |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Copilot Interface Layer (`.github/`)**               | Where Copilot discovers prompts, agents, and skills. Required paths dictated by GitHub.                                |
| **Content Pillars (`core/`, `shared/`, `platforms/`)** | Where configuration, knowledge, standards, templates, and source code live. Referenced by the Copilot interface layer. |
| **Core (`core/`)**                                     | The engine — config, scripts, safeguards, runtime artifacts.                                                           |
| **Shared (`shared/`)**                                 | The collective brain — cross-platform knowledge, standards, templates.                                                 |
| **Platforms (`platforms/`)**                           | Where depth lives — one directory per technology platform.                                                             |
| **Platform Manifest**                                  | `platforms/<name>/platform.json` — declares identity, capabilities, and paths.                                         |
| **Skill**                                              | Bundled Copilot competency (SKILL.md + resources) that can auto-discover.                                              |
| **Knowledge Graph**                                    | Structured markdown across all `knowledge/` directories.                                                               |
| **Integration Registry**                               | `shared/knowledge/integrations/` — how platforms connect.                                                              |
| **Ticket Context**                                     | `core/.ai-artifacts/<id>/ticket-context.json` — per-ticket accumulated knowledge.                                      |
| **Confidence Decay**                                   | Knowledge loses confidence without periodic human validation.                                                          |
| **Platform Detection**                                 | Core prompts identify a ticket's platform via ADO metadata matched to manifest detection rules.                        |
| **Workflow Registry**                                  | `core/config/workflows.json` — defines available workflow types and their phase structures (Phase 2).                  |
| **Signals Engine**                                     | Proactive intelligence layer that surfaces staleness, change, and pattern signals (Phase 2).                           |
| **Governance as Code**                                 | CODEOWNERS + `governance.json` — enforces who can change what in the repository (Phase 2).                             |

---

_This solution design is a companion to the Meridian PRD v1.0. Requirements are referenced by ID (e.g., PRD: MP-1) throughout._
