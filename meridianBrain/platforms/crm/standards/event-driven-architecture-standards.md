# Event-Driven Architecture Standards

> **Meridian:** Active — `util-pr-analysis` `#file:` for async / platform events context.

Loosely coupled systems via events for near real-time updates and scalable integration.

## Principles

- **Async-first** — data consistency, scalability, reduced tech debt
- **Pub/Sub API** for new implementations — unified interface for PE, CDC, RTEM. Migrate Streaming API.
- **ESB/Middleware** (MuleSoft) where available

| Mechanism                  | Status         |
| -------------------------- | -------------- |
| Platform Events            | ✅ Recommended |
| Change Data Capture        | ✅ Recommended |
| Pub/Sub API                | ✅ Recommended |
| Outbound Messages          | ⚠️ Limited     |
| PushTopic / Generic Events | ❌ Deprecated  |

**Good fit:** real-time multi-app · parallel high-volume · same data to multiple systems · IoT · mobile.
**Poor fit:** sync responses · human-in-the-loop · infrequent changes (use batch) · immediate guarantees.

## Platform Events

Naming conventions are defined in `metadata-naming-conventions.md`.

**Required fields:** `Transaction_Id__c` (Text 36, correlation) · `Source_System__c` (Text 50) · `Event_Time__c` (DateTime)

**Publish:** After Commit (default) · Immediately (logging only — ⚠️ race conditions).

```apex
// Publishing
List<Order_Placed__e> events = new List<Order_Placed__e>();
for (Order__c order : orders) {
    events.add(new Order_Placed__e(
        Transaction_Id__c = UUID.randomUUID().toString(), Source_System__c = 'Salesforce-CRM',
        Event_Time__c = System.now(), Order_Id__c = order.Id, Total_Amount__c = order.Total__c));
}
List<Database.SaveResult> results = EventBus.publish(events);
for (Integer i = 0; i < results.size(); i++) {
    if (!results[i].isSuccess()) Logger.error('Publish failed', results[i].getErrors()[0]);
}
```

```apex
// Subscribing (with retry checkpoint)
public class OrderPlacedEventHandler {
    public static void handle(List<Order_Placed__e> events) {
        Logger.setScenario('Order Placed Event Processing');
        try { processEvents(events); }
        catch (Exception e) {
            Logger.error('Failed', e);
            EventBus.TriggerContext.currentContext().setResumeCheckpoint(events[events.size()-1].ReplayId);
            throw e;
        } finally { Logger.saveLog(); }
    }
}
```

## Change Data Capture (CDC)

| Use CDC                        | Use Platform Events      |
| ------------------------------ | ------------------------ |
| Sync record changes externally | Custom business events   |
| Predefined payload structure   | Control over payload     |
| Track all field changes        | Only specific fields     |
| Audit/history systems          | Application-level events |

Enable only for objects requiring external sync with active subscribers (not high-volume transaction objects).

```apex
public class AccountCDCHandler {
    public static void handle(List<AccountChangeEvent> events) {
        Logger.setScenario('Account CDC Processing');
        for (AccountChangeEvent event : events) {
            EventBus.ChangeEventHeader header = event.ChangeEventHeader;
            switch on header.getChangeType() {
                when 'CREATE' { handleCreate(event); }
                when 'UPDATE' { handleUpdate(event, header.getChangedFields()); }
                when 'DELETE' { handleDelete(header.getRecordIds()); }
                when 'UNDELETE' { handleUndelete(header.getRecordIds()); }
            }
        }
        Logger.saveLog();
    }
}
```

## Pub/Sub API

gRPC client · OAuth 2.0 · exponential backoff (max 5, 1s initial) · persistent ReplayId storage.

## Anti-Patterns

| Anti-Pattern           | Fix                                                |
| ---------------------- | -------------------------------------------------- |
| Infinite trigger loops | Don't publish same event type from its own trigger |
| Publish before DML     | Use After Commit, not Immediately                  |
| Events for intra-org   | Use subflows/Flow Orchestrator instead             |
| Oversized payloads     | Send only necessary fields + IDs                   |
| Unselective handling   | Filter handlers to execute only when needed        |

## Event Design

- **Payload** — minimize size · consistent naming · correlation IDs · version for breaking changes
- **Versioning** — `_v2__e` → maintain both → deprecation timeline → remove old
- **Document per event:** purpose · publishers · subscribers · fields · payload example · retry behavior

## Limits

|            | Platform Events     | CDC    |
| ---------- | ------------------- | ------ |
| Payload    | 1 MB                | 1 MB   |
| Replay     | 3 days              | 3 days |
| Batch Size | 2000 (configurable) | —      |

→ Async: [async-processing-standards.md] · Logging: [nebula-logger-standards.md]
