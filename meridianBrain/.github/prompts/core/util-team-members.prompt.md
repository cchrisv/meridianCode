# Util – Team Members

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Organization Analyst
Mission: Discover team members from Microsoft Graph (Entra ID) org hierarchy, optionally enriched with Salesforce user data.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md`

## Constraints

- **CLI-only** – use CLI commands from `{{cli.*}}`; NEVER raw shell (curl, az, git, npm)
- **No hardcoded paths** – use `{{paths.*}}`, `{{cli.*}}` from shared.json
- **Config read-only** – NEVER modify shared.json or CLI scripts unless asked
- **Load config first** – always load shared.json before execution
- **Azure CLI auth required** – **STOP** with "Run `az login` first"
- **SF CLI auth required for `--salesforce`** – **STOP** with "Run `sf org login web` first"

## Prerequisites

| Requirement                              | Check                       | Fix                           |
| ---------------------------------------- | --------------------------- | ----------------------------- |
| Azure CLI authenticated                  | `az account show`           | `az login`                    |
| Graph API permission                     | `User.Read.All` in Entra ID | Request admin consent         |
| SF CLI authenticated (if `--salesforce`) | `sf org display`            | `sf org login web -a <alias>` |

---

## Execution

### Step 1 [LOGIC] – Validate

A1: Verify Azure CLI auth → **STOP** if unauthenticated
A2: If `--salesforce` requested, verify SF CLI auth → **STOP** if unauthenticated
A3: Determine discovery mode — you-centric (default) or team-centric (`--leader`)
A4: Determine output flags — `--json`, `--salesforce`, `--markdown`, `--department`

### Step 2 [CLI] – Discover Team Members

`{{cli.team_discover}} [options] --json`

#### CLI Options

| Flag           | Short | Argument  | Default             | Description                                                                                              |
| -------------- | ----- | --------- | ------------------- | -------------------------------------------------------------------------------------------------------- |
| `--leader`     | `-l`  | `<email>` | —                   | Root tree at this leader. Deterministic — any team member running the same command gets the same result. |
| `--department` | `-d`  | —         | off                 | Include all users sharing your Entra ID `department` field (you-centric mode only).                      |
| `--salesforce` | `-s`  | —         | off                 | Enrich each member with Salesforce User data. Requires SF CLI auth. Non-fatal if SF query fails.         |
| `--markdown`   | —     | —         | off                 | Generate Markdown report with Mermaid org chart.                                                         |
| `--csv`        | —     | —         | —                   | Kept for backward compat. CSV is always generated regardless of this flag.                               |
| `--output`     | `-o`  | `<dir>`   | `{{paths.reports}}` | Output directory for all report files.                                                                   |
| `--json`       | —     | —         | off                 | Write compact JSON summary to stdout (suppresses progress logs). Full JSON always written to file.       |
| `--verbose`    | `-v`  | —         | off                 | Debug-level logging.                                                                                     |
| `--quiet`      | `-q`  | —         | off                 | Suppress all progress output.                                                                            |

#### Discovery Modes

**You-Centric (default — no `--leader`):**

| Step | Action                                                                                | Relationship type |
| ---- | ------------------------------------------------------------------------------------- | ----------------- |
| 1    | Authenticate via `az account get-access-token --resource https://graph.microsoft.com` | —                 |
| 2    | Fetch `/me` with manager reference                                                    | `You`             |
| 3    | Fetch manager details                                                                 | `Your Manager`    |
| 4    | Fetch manager's direct reports (your siblings)                                        | `Peer`            |
| 5    | For each peer, recursively fetch their full tree                                      | `Peer's Team`     |
| 6    | Recursively fetch your own direct reports (full tree)                                 | `Subordinate`     |
| 7    | (If `--department`) Query all users with matching `department`                        | `Department`      |

**Team-Centric (`--leader <email>`):**

| Step | Action                                                                                | Relationship type                         |
| ---- | ------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1    | Authenticate via `az account get-access-token --resource https://graph.microsoft.com` | —                                         |
| 2    | Fetch the leader by email from `/users/<email>`                                       | `Leader` (or `You` if you are the leader) |
| 3    | Recursively fetch ALL direct reports under the leader (full tree)                     | `Team Member` (or `You` if found)         |

#### Automatic Filtering

Service accounts and inactive users are excluded automatically at discovery time:

| Rule                                                                    | Example filtered            |
| ----------------------------------------------------------------------- | --------------------------- |
| `accountEnabled === false`                                              | Disabled Entra ID accounts  |
| No `mail` AND no `department`                                           | System/service accounts     |
| UPN starts with `test-`, `svc-`, `admin-`                               | Test and service principals |
| Display name starts with `Test `, `Svc `, or contains `service account` | Named service accounts      |

**Never filtered:** the leader, current user (`You`), and your manager — regardless of these rules.

#### Salesforce Enrichment (`--salesforce`)

When enabled, after Graph discovery completes the tool runs **two query sets** in batches of 150 emails:

**Query 1 — User object:**

```sql
SELECT Email, Username, FederationIdentifier, Profile.Name,
       UserRole.Name, UMUC_Department__c, IsActive,
       LastLoginDate, CreatedDate, Alias, Department_License__c, Department
FROM User WHERE Email IN (...)
```

**Query 2 — Success Team memberships (Success_Team_Member\_\_c):**

```sql
SELECT User__r.Email, Success_Team__r.Name, Success_Team__r.Department__r.Name,
       Success_Team__r.Type__c, Title__c, Active__c, Total_Hours__c
FROM Success_Team_Member__c
WHERE User__r.Email IN (...) AND Active__c = true
```

**Data model:** `Department__c` (36) → `Success_Team__c` (259 teams) → `Success_Team_Member__c` (junction to User).
A user can be on **multiple teams** — results are grouped into an array.

**SF fields per member:**

| Field                    | SF Source                            | Fill Rate        | Description                                                          |
| ------------------------ | ------------------------------------ | ---------------- | -------------------------------------------------------------------- |
| `isSalesforceUser`       | —                                    | 100%             | `true` if email matched a SF User                                    |
| `username`               | `User.Username`                      | 100%             | SF login username                                                    |
| `federationId`           | `User.FederationIdentifier`          | 100%             | SSO federation ID                                                    |
| `profile`                | `User.Profile.Name`                  | 100%             | SF profile (e.g., `System Administrator`, `UMUC SEM Advisor`)        |
| `role`                   | `User.UserRole.Name`                 | 100%             | SF role (e.g., `System Administrators`, `SEM - SAO - Success Coach`) |
| `umgcDepartment`         | `User.UMUC_Department__c`            | 99%              | Custom UMGC department formula                                       |
| `lastLoginDate`          | `User.LastLoginDate`                 | 99%              | Last login timestamp                                                 |
| `createdDate`            | `User.CreatedDate`                   | 100%             | Account creation date                                                |
| `alias`                  | `User.Alias`                         | 100%             | SF alias                                                             |
| `departmentLicense`      | `User.Department_License__c`         | 99%              | License type (e.g., `Salesforce`, `System Administrator`)            |
| `sfDepartment`           | `User.Department`                    | 66%              | SF standard department field                                         |
| `teams[]`                | `Success_Team_Member__c`             | ~70% of SF users | Array of active team memberships                                     |
| `teams[].teamName`       | `Success_Team__r.Name`               | 100%             | Team name (e.g., `Crosstrained`, `Financial Aid`)                    |
| `teams[].departmentName` | `Success_Team__r.Department__r.Name` | 100%             | SF Department\_\_c name (e.g., `Admissions`, `Student Advising`)     |
| `teams[].type`           | `Success_Team__r.Type__c`            | 100%             | Team type                                                            |
| `teams[].title`          | `Title__c`                           | 96%              | Role within team (e.g., `Advisor`, `Manager`, `Trainee`)             |
| `teams[].totalHours`     | `Total_Hours__c`                     | 100%             | Weekly scheduled hours                                               |

Non-SF members get `{ "isSalesforceUser": false }`. If SF auth fails or query errors, Graph results are still returned (non-fatal).

#### Output Files

| File                            | Always?      | Content                                                                                                                                                                                                                                                                |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team-members-<timestamp>.csv`  | **Yes**      | All members. Base columns: Name, Title, Email, Manager, ManagerEmail, Department, Relationship. When `--salesforce`: adds SF_User, SF_Username, SF_FederationId, SF_Profile, SF_Role, SF_UMUC_Dept, SF_Dept, SF_License, SF_Alias, SF_LastLogin, SF_Created, SF_Teams. |
| `team-members-<timestamp>.json` | **Yes**      | Full `TeamDiscoveryResult` — all members with SF enrichment (including teams array), summary counts, file paths.                                                                                                                                                       |
| `team-members-<timestamp>.md`   | `--markdown` | Mermaid org chart + tables grouped by relationship type.                                                                                                                                                                                                               |

All files written to `{{paths.reports}}` (override with `-o`). Paths returned in `result.files`.

#### Examples

```bash
# You-centric (manager, peers, subordinates)
{{cli.team_discover}} --json

# Team-centric with SF enrichment
{{cli.team_discover}} --leader denise.dyer@umgc.edu --salesforce --json

# Full export with org chart
{{cli.team_discover}} --leader denise.dyer@umgc.edu --salesforce --markdown --json

# Include your entire department
{{cli.team_discover}} --department --salesforce --json

# Large org (~2600 members, ~6 min)
{{cli.team_discover}} --leader gregory.fowler@umgc.edu --salesforce --json
```

#### Performance

| Team size | Duration | Example                                  |
| --------- | -------- | ---------------------------------------- |
| 10–20     | 3–5s     | Single team (Denise Dyer)                |
| 50–100    | 10–20s   | Department-level                         |
| 250+      | 30–60s   | Division (Ashish Patel — 258 members)    |
| 2500+     | 5–6 min  | Full org (Gregory Fowler — 2623 members) |

Concurrency is capped at 5 parallel Graph API calls. Salesforce enrichment adds ~1–3s per 150-user batch.

#### Errors

| Error                               | Cause                                       | Fix                                |
| ----------------------------------- | ------------------------------------------- | ---------------------------------- |
| `AADSTS*` / `az account show` fails | Azure CLI not authenticated                 | `az login`                         |
| `Graph API 403`                     | Missing `User.Read.All` permission          | Request admin consent in Entra ID  |
| `Graph API 404` on manager          | User has no manager in directory            | Non-fatal — peers step skipped     |
| `Salesforce query batch failed`     | SF CLI not authenticated or session expired | `sf org login web -a <alias>`      |
| `No default Salesforce org is set`  | SF CLI has no default org configured        | `sf config set target-org <alias>` |

---

### Step 3 [GEN] – Present Results

When `--json` is used, stdout contains a compact summary. Parse it and the full JSON file for presentation.

**Compact stdout JSON shape:**

```json
{
  "success": true,
  "message": "Discovered 16 members of Denise Dyer's team",
  "currentUser": "Chris Van Der Merwe",
  "leader": "Denise Dyer",
  "department": "Platform Engineering",
  "total": 16,
  "durationMs": 5095,
  "files": ["...csv", "...json"],
  "jsonFile": "...json"
}
```

**Full JSON file — `TeamDiscoveryResult` schema:**

| Field                    | Type           | Description                            |
| ------------------------ | -------------- | -------------------------------------- |
| `success`                | `boolean`      | `true` if discovery completed          |
| `message`                | `string`       | Summary message                        |
| `currentUser`            | `string`       | Logged-in user's display name          |
| `leader`                 | `string?`      | Leader name (if `--leader` used)       |
| `department`             | `string`       | Root department from Entra ID          |
| `members`                | `TeamMember[]` | Full member array (see below)          |
| `summary.total`          | `number`       | Total discovered members               |
| `summary.managers`       | `number`       | Count with relationship `Your Manager` |
| `summary.peers`          | `number`       | Count with relationship `Peer`         |
| `summary.peerTeam`       | `number`       | Count with relationship `Peer's Team`  |
| `summary.subordinates`   | `number`       | Count with relationship `Subordinate`  |
| `summary.department`     | `number`       | Count with relationship `Department`   |
| `summary.withManager`    | `number`       | Members who have a manager populated   |
| `summary.withoutManager` | `number`       | Members with no manager                |
| `files`                  | `string[]`     | Paths to all generated report files    |

**`TeamMember` record:**

| Field                               | Type      | Description                                                                                                |
| ----------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| `name`                              | `string`  | Display name                                                                                               |
| `title`                             | `string`  | Job title                                                                                                  |
| `email`                             | `string`  | Primary email                                                                                              |
| `manager`                           | `string`  | Manager display name                                                                                       |
| `managerEmail`                      | `string`  | Manager email                                                                                              |
| `department`                        | `string`  | Entra ID department                                                                                        |
| `relationship`                      | `string`  | One of: `You`, `Your Manager`, `Peer`, `Peer's Team`, `Subordinate`, `Department`, `Leader`, `Team Member` |
| `salesforce`                        | `object?` | Present only when `--salesforce` used                                                                      |
| `salesforce.isSalesforceUser`       | `boolean` | `true` if email matched a SF User                                                                          |
| `salesforce.username`               | `string?` | SF login username                                                                                          |
| `salesforce.federationId`           | `string?` | SSO federation ID                                                                                          |
| `salesforce.profile`                | `string?` | SF profile name                                                                                            |
| `salesforce.role`                   | `string?` | SF role name                                                                                               |
| `salesforce.umgcDepartment`         | `string?` | `UMUC_Department__c` value                                                                                 |
| `salesforce.lastLoginDate`          | `string?` | Last login timestamp                                                                                       |
| `salesforce.createdDate`            | `string?` | Account creation date                                                                                      |
| `salesforce.alias`                  | `string?` | SF alias                                                                                                   |
| `salesforce.departmentLicense`      | `string?` | License type                                                                                               |
| `salesforce.sfDepartment`           | `string?` | SF standard department                                                                                     |
| `salesforce.teams`                  | `array?`  | Active Success Team memberships (can be multiple)                                                          |
| `salesforce.teams[].teamName`       | `string`  | Team name                                                                                                  |
| `salesforce.teams[].departmentName` | `string`  | SF Department\_\_c name                                                                                    |
| `salesforce.teams[].type`           | `string`  | Team type                                                                                                  |
| `salesforce.teams[].title`          | `string`  | Role within team                                                                                           |
| `salesforce.teams[].totalHours`     | `number`  | Weekly scheduled hours                                                                                     |

**Presentation:**

- **Leader mode:** group as Leader → You → Team Members
- **You-centric mode:** group as Your Manager → You → Peers → Peer's Team → Subordinates → Department
- If `--salesforce`: include SF profile, role, last login, and team assignments in the summary; note SF match rate (e.g., "14 of 16 are Salesforce users")
- Always reference the JSON and CSV file paths for the user to inspect full data
