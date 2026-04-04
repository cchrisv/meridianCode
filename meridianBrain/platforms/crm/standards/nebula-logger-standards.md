# Nebula Logger Standards

> **Meridian:** Active — `util-pr-analysis` `#file:` for Apex/Flow PRs (logging).

Standardized logging for Salesforce. Debugging, monitoring, troubleshooting across Apex and Flows.

## Scenarios & Tags

- **Scenarios** — set before logging: `Logger.setScenario('<Name>')`. Configure via `LoggerScenarioRule__mdt`.
- **Tags** — keywords for finding entries (use sparingly): Callout, Controller Class, Trigger, Exception.
- **Related Records** — add Related Records component to parent record's related list.
- **Settings** — `LoggerSettings__c` takes precedence over Scenario Rules.

## Apex API

```apex
// Exceptions
Logger.error(logMessage, apexException)
Logger.error(logMessage, record/recordId/records, apexException)
// Callouts
Logger.info('Callout: ', contactId).setHttpRequestDetails(req).setHttpResponseDetails(res);
// Database Results
Logger.error(logMessage, List<Database.SaveResult/UpsertResult/DeleteResult/MergeResult/UndeleteResult>)
// Standard (each level: error, warn, info, debug, fine)
Logger.error/warn/info/debug/fine(logMessage)
Logger.error/warn/info/debug/fine(message, recordId)
```

## Save Methods

| Method                | Use Case                         |
| --------------------- | -------------------------------- |
| `EVENT_BUS` (default) | `LogEntryEvent__e` via EventBus  |
| `QUEUEABLE`           | Async — defers CPU/limits        |
| `REST`                | Sync callout — avoids mixed DML  |
| `SYNCHRONOUS_DML`     | Direct insert — ⚠️ rollback risk |

## Async Logs

`Logger.setParentLogTransactionId(String)` → relates child `Log__c` to parent via `ParentLog__c`. Batch: 1 parent (start) + N children (execute/finish).

## Data Masking

`LogEntryDataMaskRule__mdt` with RegEx. Built-in: US SSN, Visa, Mastercard.

## Levels

| Level | Use For                                                         |
| ----- | --------------------------------------------------------------- |
| ERROR | Exceptions, DB errors, critical failures                        |
| WARN  | Unusual but non-blocking (missing optional records, deprecated) |
| INFO  | Business events, state changes, integration calls               |
| DEBUG | Diagnostic (variable values, decision branches)                 |
| FINE+ | Verbose active debugging only                                   |

## Best Practices

```apex
// Always: scenario + try/catch + context + saveLog
Logger.setScenario('Order Processing');
try {
    Logger.debug('Eligible: {0}, Reason: {1}', new List<Object>{ isEligible, reason });
    List<Database.SaveResult> results = Database.update(records, false);
    for (Integer i = 0; i < results.size(); i++) {
        if (!results[i].isSuccess())
            Logger.error('Update failed', records[i].Id, results[i].getErrors()[0]);
    }
} catch (Exception e) {
    Logger.error('Failed to process', accountId, e);
    throw e;
} finally { Logger.saveLog(); }
// Callouts
Logger.info('Calling API', contactId).setHttpRequestDetails(req);
Logger.info('API response', contactId).setHttpResponseDetails(res);
```

## Flow Logging

Flows do NOT use the Apex Logger API (`Logger.setScenario()`, `Logger.saveLog()`, etc.). Flows use the **Nebula Logger Invocable Actions** instead.

### Required Fault Paths

All flows regardless of type must have fault paths on these element types:

- Get Records
- Update Records
- Create Records
- Delete Records
- Apex Action

Decision elements where a specific outcome would cause the flow to critically fail should also incorporate error handling.

### Three-Step Error Pattern

Once a fault path or critical decision outcome is added, implement these elements in order:

1. **Assign error message** — Set a `textErrorMessage` text variable with a user-friendly, clear explanation of why the flow is failing in this specific case.

2. **Add Log Entry (Apex Action)** — Use the appropriate Nebula Logger Invocable Action:
   - Include the **flow name**
   - Set **Log Entry Message** to the `textErrorMessage` variable
   - Include the **flow fault message** (from the fault path)
   - Set **Logging Level** based on severity (see Levels table above)
   - Set **Save Log** to `true`
   - If part of a feature, add the **Feature Flag** custom metadata label as a tag
   - If applicable, pass in the **record ID**, **record collection**, or **record** depending on the action variant

3. **Surface the error to the user:**
   - **Record-triggered flows** → add a Custom Error element using the `textErrorMessage` variable
   - **Screen flows** → launch the Error Screen subflow, passing in `textErrorMessage`

### Invocable Action Variants

| Action                                     | When to Use                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Add Log Entry** (with Record ID)         | When a specific record ID is available (SObject variable or text)                                |
| **Add Log Entry** (with Record Collection) | When logging against a collection of records                                                     |
| **Add Log Entry** (no record)              | When no record ID exists — typically screen flows or autolaunched flows without a trigger record |

### Flow Logging Best Practices

- **Reuse elements** — connect multiple fault paths to the same Assignment → Log Entry → Custom Error chain to reduce element count and simplify maintenance
- **Consistent tags** — use the Feature Flag custom metadata label as the tag across all error messages in a feature for reporting consistency
- **Level selection** — use ERROR for critical failures (DML faults, missing required data), WARN for non-blocking issues (optional lookup miss), DEBUG for diagnostic information
- **Always save** — set Save Log to `true` on every Log Entry action; Flows do not have a `finally` block equivalent

### Log Retention

| Category     | Levels                     | Retention |
| ------------ | -------------------------- | --------- |
| Critical     | ERROR, FINE, FINER, FINEST | 30 days   |
| Non-Critical | WARN, INFO, DEBUG          | 7 days    |

Logs are automatically purged via OwnBackup daily policies based on these thresholds.

### Flow Anti-Patterns

- **Missing fault paths** → every DML and Apex Action element must have a fault connector
- **Silent failures** → fault path exists but no Log Entry action — errors are swallowed
- **Generic error messages** → `textErrorMessage` should explain the specific failure, not "An error occurred"
- **Missing record context** → always pass the record ID when available for traceability
- **No Custom Error element** → record-triggered flows must surface errors to users via Custom Error
- **Logging Apex API in Flows** → never reference `Logger.setScenario()` or `Logger.saveLog()` for Flows; use the Invocable Action

## Anti-Patterns

- Log everything at INFO → use appropriate levels
- Missing context → always include record IDs
- Not logging errors → always log exceptions + throw
- Logging sensitive data → use `LogEntryDataMaskRule__mdt`
- Excessive logging in loops → use DEBUG/FINE levels
