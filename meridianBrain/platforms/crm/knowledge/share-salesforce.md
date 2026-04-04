# Share – Salesforce (Generic)

> **Meridian:** Active — Copilot `#file:platforms/crm/knowledge/share-salesforce.md` on CRM grooming/research prompts.

Salesforce foundation — org resolution, auth, CLI reference, batch operations. Needed by any prompt that touches SF.
References: `#file:config/core/share-core.md`
NEVER references ADO work items, ticket-context.json, ADO fields.

## Salesforce Org Resolution

Org aliases are resolved automatically from `config/sf-orgs.json` (configured via `sf-tools org-setup`).
Each sf-tools command should use `--role <role>` to target the correct org:

| Role             | Purpose                                   |
| ---------------- | ----------------------------------------- |
| `legacyData`     | SOQL queries on legacy org                |
| `modernData`     | SOQL queries on modern org                |
| `legacyMetadata` | Metadata/describe on legacy               |
| `modernMetadata` | Metadata/describe on modern               |
| `dataCloud`      | Data Cloud operations                     |
| `primary`        | General/unspecified (or omit for default) |

Resolution chain: explicit `--org` > role config > designation fallback > primary > SF CLI default.
If config missing or connection fails → ask user which org, suggest running `npx --prefix scripts/workflow sf-tools org-setup`.

## SF Auth Validation

Before SF operations:

1. Verify SF CLI auth via `sf-tools org-status` or `sf-tools org-validate`
2. If not authenticated → suggest `sf org login web -a <alias>` or `sf-tools org-setup`

## SF CLI Quick Reference

| Action            | Command                                                                                | Batch     |
| ----------------- | -------------------------------------------------------------------------------------- | --------- |
| Query data        | `{{cli.sf_query}} "<SOQL>" --role {{role}} --json`                                     | —         |
| Describe object   | `{{cli.sf_describe}} {{obj}} --role {{role}} --json`                                   | `--batch` |
| Discover metadata | `{{cli.sf_discover}} --type {{type}} --name {{name}} --depth 3 --role {{role}} --json` | —         |
| Apex classes      | `{{cli.sf_apex}} [--pattern {{pattern}}] --role {{role}} --json`                       | —         |
| Apex triggers     | `{{cli.sf_apex_triggers}} [--object {{name}}] --role {{role}} --json`                  | —         |
| Validation rules  | `{{cli.sf_validation}} {{obj}} [--all] --role {{role}} --json`                         | `--batch` |
| Flows             | `{{cli.sf_flows}} [--object {{name}}] [--all] --role {{role}} --json`                  | —         |
| Custom objects    | `sf-tools custom-objects --role {{role}} --json`                                       | —         |
| Org setup         | `npx --prefix scripts/workflow sf-tools org-setup`                                     | —         |
| Org status        | `npx --prefix scripts/workflow sf-tools org-status`                                    | —         |
| Org validate      | `npx --prefix scripts/workflow sf-tools org-validate`                                  | —         |

## SF Batch Operations

For describe, discover, and validation-rules with `--batch`:

- Comma-separated names or `--batch` flag → parallel execution
- Returns `[{objectName, success, data/error}]`
- Apply Batch Failure Threshold from share-core: >50% fail → STOP; ≤50% → continue with successes
