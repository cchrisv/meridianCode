# Share – Salesforce Update (Placeholder)

> **Meridian:** WIP / not wired — no Copilot `#file:` today; future SF write-back patterns. Content below is draft.

Patterns for writing to Salesforce — deployment evidence, audit trail, future CRUD.
References: `#file:config/platform-salesforce/share-salesforce.md` → `#file:config/core/share-core.md`
NEVER references ADO work items.

## Copado Deployment Evidence

Query deployment status from Copado managed objects:

- `copado__User_Story__c` — user story records with deployment info
- `copado__Deployment__c` — deployment records with status, dates
- Code coverage extraction from deployment results

## SetupAuditTrail Querying

Standard SOQL for recent setup/metadata changes:

```soql
SELECT Action, Section, Display, CreatedDate, CreatedBy.Name
FROM SetupAuditTrail
WHERE CreatedDate >= {{date_start}}
ORDER BY CreatedDate DESC
```

Filter by date range for bounded historical analysis. Use `--role primary` or `--role legacyData`/`--role modernData` depending on target org.

## Future Patterns

This block will grow as SF CRUD operations are added to the prompt library:

- Metadata deployment patterns
- Data migration patterns
- Sandbox refresh evidence
- Permission set assignment tracking
