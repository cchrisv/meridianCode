# Asynchronous Processing Standards

> **Meridian:** Active — `util-pr-analysis` `#file:` for async patterns.

Async increases scalability via higher governor limits. Background thread execution.

## Principles

**Use when:** large volumes (thousands–millions) · multi-system integrations · no immediate feedback · horizontal scale.
**Constraints:** no SLA · variable latency · daily limits + fair usage · finite threads.

**Tool selection (Flow-First):**

| Tool                  | Best For                            | Code Level |
| --------------------- | ----------------------------------- | ---------- |
| Scheduled Flows       | Batch record processing             | Low-code   |
| Asynchronous Flows    | Record-triggered async              | Low-code   |
| Mass Action Scheduler | Declarative batch, flexible sources | Low-code   |
| Queueable Apex        | DB ops, callouts, chaining          | Pro-code   |
| Batch Apex            | Complex batch processing            | Pro-code   |
| Scheduled Apex        | Cron-driven execution               | Pro-code   |
| Platform Events       | Loose coupling, survives rollback   | Low + Pro  |

## Queueable Apex (Preferred Pro-Code)

Supersedes `@future`. Job IDs · non-primitive params · chaining · dedup · delay (10min) · finalizers.

```apex
public class AccountProcessingQueueable implements Queueable, Database.AllowsCallouts {
    private List<Id> accountIds;
    private Integer retryCount = 0;
    public AccountProcessingQueueable(List<Id> accountIds) { this.accountIds = accountIds; }
    public void execute(QueueableContext context) {
        Logger.setScenario('Account Processing');
        try {
            System.attachFinalizer(new AccountProcessingFinalizer(this));
            List<Account> accounts = [SELECT Id, Name, Industry FROM Account WHERE Id IN :accountIds WITH SECURITY_ENFORCED];
            processAccounts(accounts);
        } catch (Exception e) { Logger.error('Failed', e); throw e; }
        finally { Logger.saveLog(); }
    }
}
```

### Transaction Finalizer (retry)

```apex
public class AccountProcessingFinalizer implements Finalizer {
    private static final Integer MAX_RETRIES = 5;
    private AccountProcessingQueueable parentJob;
    public AccountProcessingFinalizer(AccountProcessingQueueable parentJob) { this.parentJob = parentJob; }
    public void execute(FinalizerContext context) {
        switch on context.getResult() {
            when UNHANDLED_EXCEPTION {
                if (parentJob.retryCount < MAX_RETRIES) { parentJob.retryCount++; System.enqueueJob(parentJob); }
                else { Logger.error('Max retries exceeded', context.getException()); }
            }
            when SUCCESS { Logger.info('Completed'); }
        }
        Logger.saveLog();
    }
}
```

**DO:** Queueable over `@future` · `AllowsCallouts` · attach finalizers · `AsyncOptions` for dedup/delay
**DON'T:** enqueue from high-volume actions · >1 async per sync · small batch scopes · assume immediate

## Batch Apex

Large record sets · extended processing · off-peak · batch-level isolation.

```apex
public class AccountCleanupBatch implements Database.Batchable<SObject>, Database.Stateful {
    private Integer processed = 0, errors = 0;
    public Database.QueryLocator start(Database.BatchableContext bc) {
        Logger.setScenario('Account Cleanup Batch');
        Logger.info('Starting: {0}', new List<Object>{ bc.getJobId() }); Logger.saveLog();
        return Database.getQueryLocator([SELECT Id FROM Account WHERE LastModifiedDate < LAST_N_YEARS:2 WITH SECURITY_ENFORCED]);
    }
    public void execute(Database.BatchableContext bc, List<Account> scope) {
        Logger.setAsyncContext(bc);
        List<Database.DeleteResult> results = Database.delete(scope, false);
        for (Integer i = 0; i < results.size(); i++) {
            if (results[i].isSuccess()) processed++;
            else { errors++; Logger.error('Failed', scope[i].Id, results[i].getErrors()[0]); }
        }
        Logger.saveLog();
    }
    public void finish(Database.BatchableContext bc) {
        Logger.setAsyncContext(bc);
        Logger.info('Done. Processed: {0}, Errors: {1}', new List<Object>{ processed, errors }); Logger.saveLog();
    }
}
```

| Limit      | Value                           |
| ---------- | ------------------------------- |
| Scope size | Default 200; avoid small scopes |
| Concurrent | Max 5                           |
| Flex queue | Max 100                         |
| Callouts   | `Database.AllowsCallouts`       |
| Errors     | `BatchApexErrorEvent`           |

**Guard:** check `AsyncApexJob` before enqueuing from triggers/schedulers.

## Step-Based Async Framework

Complex multi-step workflows with independent steps, retries, observability.

```apex
public interface Step { void execute(); void finalize(); String getName(); Boolean shouldRestart(); }

public class StepProcessor implements Queueable, Finalizer, Database.AllowsCallouts {
    private final List<Step> steps = new List<Step>();
    private Step currentStep;
    public void execute(QueueableContext context) {
        this.currentStep = this.currentStep ?? this.steps.remove(0);
        if (context != null) { System.attachFinalizer(this); Logger.setAsyncContext(context); }
        try { this.currentStep.execute(); }
        catch (Exception e) { Logger.error('Step failed', e); throw e; }
        Logger.saveLog();
    }
    public void execute(FinalizerContext context) {
        switch on context.getResult() {
            when UNHANDLED_EXCEPTION { Logger.error('Unhandled', context.getException()); }
            when SUCCESS {
                this.currentStep.finalize();
                if (this.currentStep.shouldRestart()) kickoff();
                else if (!this.steps.isEmpty()) { this.currentStep = this.steps.remove(0); kickoff(); }
            }
        }
        Logger.saveLog();
    }
    public String kickoff() { return this.steps.isEmpty() ? null : System.enqueueJob(this); }
}
```

### Cursor-Based Processing

```apex
public abstract class CursorStep implements Step {
    protected Database.Cursor cursor;
    private Integer chunkSize = Limits.getLimitDMLRows(), position = 0;
    protected abstract Database.Cursor getCursor();
    protected abstract void innerExecute(List<SObject> records);
    public void execute() {
        this.cursor = this.cursor ?? this.getCursor();
        this.innerExecute(this.cursor.fetch(this.position, this.chunkSize));
        this.position += this.chunkSize;
    }
    public Boolean shouldRestart() { return this.position < this.cursor.getNumRecords(); }
}
```

## Platform Events

→ Full standard: [event-driven-architecture-standards.md]

Loose coupling · async communication · high-volume outbound · survives rollback.
**Publish modes:** After Commit (default) · Immediately (logging only). **No callouts** from PE triggers.

## Scheduled Flows (Preferred Simple Batch)

First choice: daily/weekly ops · admin-configurable · metadata-driven.
Environment gating: `{!$Api.Enterprise_Server_URL_100}` Decision · fault paths → Nebula Logger · 200 records/invocation.
**Escalate to MAS when:** flexible data sources · field mapping · built-in logging · complex scheduling.

## Mass Action Scheduler (MAS)

Open-source declarative batch bridging Flow and Batch Apex.

| Use MAS               | Use Batch Apex              |
| --------------------- | --------------------------- |
| Reports/List Views    | Complex transaction control |
| Invoke existing Flows | Custom retry logic          |
| Admin-maintained      | Cursor-based high-volume    |
| Built-in logging      | CPU-intensive per-record    |

**Sources:** Reports · List Views · SOQL · Custom Apex. **Targets:** Flow · Quick Action · Email Alert · Invocable Apex.
**Architecture:** Sources → `Mass_Action_Mapping__c` → `MA_*SourceBatchable` → `Mass_Action_Log__c` + Platform Events.

## Monitoring

All async **MUST**: log via Nebula Logger (scenarios/tags) · track progress · capture exceptions · monitor `AsyncApexJob`.
**Batch logging:** `parentLogTransactionId` in `start()` → `Logger.setParentLogTransactionId()` in `execute()`/`finish()`.
**Avoid throttling:** no small batches · no excessive chaining · process off-peak · batch related ops.

## Anti-Patterns

| Anti-Pattern                         | Fix                                     |
| ------------------------------------ | --------------------------------------- |
| DML in loops (even async)            | Bulk operations                         |
| Assume immediate execution           | Design for eventual consistency         |
| Enqueue from triggers without guards | Single job with feature flag            |
| Silent error swallowing              | `Logger.error(e); throw e;` + finalizer |
| `@future` for new dev                | Queueable with tracking                 |

## Testing

`Test.startTest()` → enqueue/batch → `Test.stopTest()` (forces sync) → assert.

```apex
@IsTest static void shouldProcess() {
    List<Account> accs = TestDataFactory.createAccounts(200);
    insert accs;
    Test.startTest();
    System.enqueueJob(new AccountProcessingQueueable(new List<Id>(new Map<Id,Account>(accs).keySet())));
    Test.stopTest();
    for (Account a : [SELECT Status__c FROM Account WHERE Id IN :accs])
        Assert.areEqual('Processed', a.Status__c);
}
```

## Decision Matrix (Flow-First)

1. Scheduled Flows → 2. Mass Action Scheduler → 3. Batch Apex

| Scenario                         | 1st             | 2nd   | 3rd   |
| -------------------------------- | --------------- | ----- | ----- |
| Simple daily updates             | Scheduled Flow  | MAS   | Batch |
| Process from Report/List View    | MAS             | Flow  | Batch |
| Invoke Flows in batch            | MAS             | Flow  | —     |
| Admin-configurable               | Flow            | MAS   | —     |
| Single callout after DML         | Queueable       | —     | —     |
| 1-200 records async              | Queueable       | —     | —     |
| CPU-intensive per-record         | Batch           | —     | —     |
| Multi-step workflows             | Step Framework  | Batch | —     |
| Real-time external notifications | Platform Events | —     | —     |

→ Feature flags: [feature-flags-standards.md] · Logging: [nebula-logger-standards.md] · Events: [event-driven-architecture-standards.md]
