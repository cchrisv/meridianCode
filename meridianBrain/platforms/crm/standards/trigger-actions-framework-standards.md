# Trigger Actions Framework Standards

> **Meridian:** Active — `util-pr-analysis` `#file:` for `*.trigger` PRs.

Metadata-driven Apex trigger development. Partitioning, ordering, and bypassing record-triggered automations.

**Principles:** Open-Closed · SRP · Strategy Pattern (metadata-driven) · Separation of Concerns.

## Custom Metadata

### sObject_Trigger_Setting\_\_mdt

| Field                                             | Req | Description                          |
| ------------------------------------------------- | --- | ------------------------------------ |
| `Object_API_Name__c`                              | Yes | sObject API name (without namespace) |
| `Object_Namespace__c`                             | No  | Namespace for managed packages       |
| `Bypass_Execution__c`                             | No  | Bypass all actions                   |
| `Bypass_Permission__c` / `Required_Permission__c` | No  | Custom permissions                   |
| `TriggerRecord_Class_Name__c`                     | No  | Entry criteria subclass              |

### Trigger_Action\_\_mdt

| Field                                                                        | Req | Description                       |
| ---------------------------------------------------------------------------- | --- | --------------------------------- |
| `Apex_Class_Name__c`                                                         | Yes | Fully qualified class name        |
| `Order__c`                                                                   | Yes | Execution order (lower = earlier) |
| Context fields (`Before/After_Insert/Update/Delete__c`, `After_Undelete__c`) | 1+  | Link to sObject setting           |
| `Bypass_Execution__c` / `Bypass_Permission__c` / `Required_Permission__c`    | No  | Controls                          |
| `Flow_Name__c` / `Allow_Flow_Recursion__c`                                   | No  | Flow action config                |
| `Entry_Criteria__c`                                                          | No  | Filter formula                    |

**Core Classes:** `MetadataTriggerHandler` · `TriggerBase` · `TriggerAction` · `TriggerActionFlow` · `TriggerRecord` · `TriggerTestUtility`

## Implementation

```apex
trigger AccountTrigger on Account (
    before insert, after insert, before update, after update,
    before delete, after delete, after undelete
) { new MetadataTriggerHandler().run(); }
```

⚠️ Include **all contexts** even if not initially needed.

| Component     | Convention                  | Example                           |
| ------------- | --------------------------- | --------------------------------- |
| Trigger       | `{SObject}Trigger`          | `AccountTrigger`                  |
| Action Class  | `TA_{SObject}_{Action}`     | `TA_Account_SetDefaultValues`     |
| Test Class    | `TA_{SObject}_{Action}Test` | `TA_Account_SetDefaultValuesTest` |
| TriggerRecord | `{SObject}TriggerRecord`    | `AccountTriggerRecord`            |

## Interfaces

| Context             | Interface                        | Signature                                                                     |
| ------------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| Before/After Insert | `.BeforeInsert` / `.AfterInsert` | `void before/afterInsert(List<SObject> triggerNew)`                           |
| Before/After Update | `.BeforeUpdate` / `.AfterUpdate` | `void before/afterUpdate(List<SObject> triggerNew, List<SObject> triggerOld)` |
| Before/After Delete | `.BeforeDelete` / `.AfterDelete` | `void before/afterDelete(List<SObject> triggerOld)`                           |
| After Undelete      | `.AfterUndelete`                 | `void afterUndelete(List<SObject> triggerNew)`                                |
| DML Finalizer       | `.DmlFinalizer`                  | `void execute()`                                                              |

```apex
public with sharing class TA_Opportunity_StageInsertRules implements TriggerAction.BeforeInsert {
    @TestVisible private static final String PROSPECTING = 'Prospecting';
    @TestVisible private static final String INVALID_STAGE_INSERT_ERROR = 'Stage must be \'Prospecting\' on insert';
    public void beforeInsert(List<SObject> triggerNew) {
        for (Opportunity opp : (List<Opportunity>) triggerNew) {
            if (opp.StageName != PROSPECTING) { opp.addError(INVALID_STAGE_INSERT_ERROR); }
        }
    }
}
```

Multi-context: implement multiple interfaces. Old values: `Map<Id, SObject> oldMap = new Map<Id, SObject>(triggerOld)`.

## Flow-Based Actions

**Autolaunched Flow** (not Record-Triggered) with variables: `record` (input+output), `recordPrior` (input only).
Config: `Apex_Class_Name__c` = `TriggerActionFlow` · `Flow_Name__c` = API name.
⚠️ Max recursion = **3** (vs 16 Apex). Use Entry Criteria to limit.

## Entry Criteria

```apex
global class AccountTriggerRecord extends TriggerRecord {
    global Account record { get { return (Account) this.newSObject; } }
    global Account recordPrior { get { return (Account) this.oldSObject; } }
}
```

Register in `TriggerRecord_Class_Name__c`. Formula: `record.Industry = "Technology" && record.AnnualRevenue > 1000000`
⚠️ Cannot traverse relationships. Direct field references only.

## Bypass

**Hierarchy:** Global (`Bypass_Execution__c`) → Permission (`Bypass_Permission__c`) → Transaction (programmatic)

```apex
TriggerBase.bypass('Account');
MetadataTriggerHandler.bypass('TA_Account_SetDefaultValues');
TriggerActionFlow.bypass('My_Trigger_Action_Flow');
// Clear
TriggerBase.clearBypass('Account'); TriggerBase.clearAllBypasses();
MetadataTriggerHandler.clearAllBypasses();
```

Flow bypass: `TriggerActionFlowBypass.bypass` invocable — Type: `Apex`/`Flow`/`Object`.

## DML Finalizers

Execute once at end of DML. Use for: queueable enqueueing, aggregated inserts, cleanup.
**Caveats:** no DML triggering framework · runs once per transaction · all sObjects should use framework.

## Recursion Prevention

```apex
if (TriggerBase.idToNumberOfTimesSeenAfterUpdate.get(opp.Id) == 1) { /* process */ }
```

## Testing

```apex
@IsTest static void shouldPreventInvalidStageChange() {
    Opportunity oldOpp = new Opportunity(Id = TriggerTestUtility.getFakeId(Schema.Opportunity.SObjectType), StageName = 'Prospecting');
    Opportunity newOpp = oldOpp.clone(true, true, true, true);
    newOpp.StageName = 'Closed Won';
    new TA_Opportunity_StageChangeRules().beforeUpdate(new List<Opportunity>{ newOpp }, new List<Opportunity>{ oldOpp });
    System.Assert.isTrue(newOpp.hasErrors());
}
```

Own test per action · success + error + bypass · boundary conditions · 100% coverage · always clear bypasses after: `MetadataTriggerHandler.clearAllBypasses(); TriggerBase.clearAllBypasses();`

## Best Practices

**DO:** descriptive names · SRP per class · `@TestVisible` constants · cast to concrete types early · Entry Criteria · clear bypasses · order: validations → field updates → related records
**DON'T:** static vars for cross-context state · SOQL/DML in loops · hardcode values · swallow exceptions · mix approaches

## Checklist

New action: sObject trigger (if first) → `sObject_Trigger_Setting__mdt` → optional `TriggerRecord` → action class → `Trigger_Action__mdt` per context → `Order__c` → bypass permissions → test class → wiki.

Managed packages: `Object_Namespace__c` + `Object_API_Name__c` separately (e.g., `Acme` + `Explosives__c`).

→ Feature flags: [feature-flags-standards.md] · Logging: [nebula-logger-standards.md]
