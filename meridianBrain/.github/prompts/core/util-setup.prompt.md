# Util – Setup

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Mission: First-time environment setup, authentication, and end-to-end validation.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:README.md`

## Step 0 [LOGIC] – Workspace Check

Before checking tools, verify the user is in a **Meridian** repository workspace (`core/config/shared.json` present):

- Check that `core/config/shared.json` exists in the current workspace
- Check that `.github/prompts/` directory exists

If either is missing → the framework hasn't been set up yet. Guide the user:

- **Fresh start:** clone this Meridian repository (your org’s Git remote), open the repo root in the IDE, then run `/util-setup`
- **Existing clone:** run `git pull` and `/util-sync`, then re-run `/util-setup` if dependencies changed
- **STOP** — do not proceed with prerequisite checks until the workspace has the framework files.

## Step 1 [CLI] – Prerequisites

Verify all required tools are installed:

- `git --version` → must be present (required for repo clone/pull)
- `node --version` → must be v18+
- `npm --version` → must be present
- `az --version` → Azure CLI required for ADO auth
- `sf --version` → Salesforce CLI required for SF auth

If any are missing → install from official sources. **STOP** if Node < 18.

**If Git is missing:** Provide these options:

1. `winget install Git.Git` (requires admin rights)
2. Download from https://git-scm.com/download/win
3. Contact Service Desk for installation

After Git is installed → instruct the user to **restart VS Code** (the terminal PATH must refresh to detect `git`). Re-run the prerequisite check before continuing.

## Step 2 [CLI] – Install Dependencies

A1: Run in `{{paths.scripts}}/`: `npm install`
A2: Run in `{{paths.scripts}}/`: `npm run build`
A3: Verify `{{paths.scripts}}/dist/` contains compiled `.js` files

**Errors:** `npm ERR!` → check Node version, delete `node_modules` and retry.

## Step 3 [CLI] – Authenticate & Validate ADO

B1: `az login` → `az account show` → confirm correct tenant
B2: **Search** — `{{cli.ado_search}} --text "Journey Pipeline" --type "User Story" --top 5 --json`

- Verify results returned (confirms ADO connection + project access)
  B3: **Get** — pick first result ID → `{{cli.ado_get}} <id> --expand Relations --json`
- Verify work item fields, relations, and tags are readable

**Errors:**

- `AADSTS` → re-run `az login`
- `TF401019` → check project permissions in ADO
- `TF401027` → PAT expired, re-authenticate
- Empty search results → verify `{{ado_defaults.project}}` is correct

## Step 3.5 [IO] – Capture & Persist User Identity

Collect the running user's ADO identity so all prompts can attribute work items correctly without asking every time.

C1: Use the interactive question tool to ask:

- **ADO Display Name** — the name shown in ADO (e.g., `Chris Van Der Merwe`)
- **ADO Email** — the email address used to log in to ADO (e.g., `cvandermerwe@umgc.edu`)

C2: Write both values to `core/config/shared.json` under the top-level `"user"` key:

```json
{
  "user": {
    "display_name": "<name>",
    "email": "<email>"
  }
}
```

Edit `core/config/shared.json` directly — set `user.display_name` and `user.email` to the values provided.

C3: Confirm the values were written by reading the file back and displaying:

> ✅ Identity saved — **{{user.display_name}}** (`{{user.email}}`)

**Note:** All prompts that create or default-assign ADO work items will read these values automatically. Re-run `/util-setup` to update your identity if it changes.

## Step 4 [CLI] – Configure & Validate Salesforce Orgs

C1: `sf org login web` → complete browser auth flow (repeat for each org you need)
C2: Run `npx --prefix core/scripts/workflow crm-tools org-setup` to interactively configure orgs.

The setup wizard will:

- List all authenticated orgs
- Ask if you have a single-org or multi-org (two-org) setup
- **Single-org**: assign one org to all roles
- **Multi-org**: ask explicit questions for each role:
  - Which org is your LEGACY org?
  - Which org is your MODERN org?
  - Which org for LEGACY DATA queries (SOQL)?
  - Which org for LEGACY METADATA inspection?
  - Which org for MODERN DATA queries (SOQL)?
  - Which org for MODERN METADATA inspection?
  - Which org for DATA CLOUD?
  - Which org is the PRIMARY (default)?
- Save configuration to `config/sf-orgs.json`
- Validate all configured orgs

C3: **Verify config** — `npx --prefix core/scripts/workflow crm-tools org-status`

- Confirm all roles map to the expected org aliases
  C4: **Describe** — `{{cli.sf_describe}} Organization --fields-only --role modernMetadata --json`
- Verify object metadata is returned (confirms SF connection + object access)
  C5: **Query** — `{{cli.sf_query}} "SELECT Id, Name, InstanceName FROM Organization LIMIT 1" --role modernData --json`
- Verify a record is returned (confirms data access)

**Errors:**

- `No authorization found` → re-run `sf org login web -a <alias>`
- `No org configuration found` → re-run `npx --prefix core/scripts/workflow crm-tools org-setup`
- `INVALID_TYPE` → check object API name and org permissions
- `INVALID_FIELD` → check field-level security for the connected user

## Step 5 [CLI] – Validate Wiki Access

D1: **Search** — `{{cli.wiki_search}} "Journey Pipeline" --json`

- Verify wiki search returns results (confirms wiki connection)
  D2: **Read** — pick first result path → `{{cli.wiki_get}} --path "<page_path>" --json`
- Verify page content is returned (confirms read access)
  D3: **List** — `{{cli.wiki_list}} --path "/" --json`
- Verify top-level wiki structure is readable

**Errors:**

- `404 WikiPageNotFoundException` → verify `{{ado_defaults.wiki}}` name is correct
- `403` → check wiki permissions for the authenticated user

## Step 6 [CLI] – Validate Workflow & Wiki Engine Tools

E1: `{{cli.workflow_status}} -w 217045 --json` → verify status output (uses existing test work item)
E2: `{{cli.wiki_engine_block_menu}} --markdown` → verify wiki engine block menu output (confirms chroma-js, juice, sanitize-html dependencies installed correctly)
E3: `{{cli.wiki_engine_colors}} --json` → verify color scheme generation (confirms chroma-js working)

**Errors:**

- `Cannot find module` → re-run `npm run build` in `{{paths.scripts}}/`
- `ENOENT` → verify `{{paths.artifacts_root}}/` directory exists
- `chroma-js` / `juice` / `sanitize-html` errors → re-run `npm install` in `{{paths.scripts}}/`

## Complete

All tools authenticated and validated. Report results:

| Tool        | Status | Evidence                                                     |
| ----------- | ------ | ------------------------------------------------------------ |
| ADO         | ✅/❌  | Search returned N results, work item #ID readable            |
| Salesforce  | ✅/❌  | Organization described, Organization query returned 1 record |
| Wiki        | ✅/❌  | Search returned N results, page readable                     |
| Workflow    | ✅/❌  | Status check succeeded                                       |
| Wiki Engine | ✅/❌  | Block menu output, color schemes generated                   |

Next → `/workflow-initial-copilot-grooming` with a work item ID.

Having issues with a prompt? → `/util-feedback` to submit feedback as an ADO Issue for leadership triage.
