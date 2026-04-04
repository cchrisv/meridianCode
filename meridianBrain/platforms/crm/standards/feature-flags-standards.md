# Feature Flags Standards

> **Meridian:** Active — `util-pr-analysis` `#file:` when PR references feature flags.

Decouple deployment from release. Enables: controlled rollout · quick disable without rollback · per-user/profile customization · environment management.

## When to Use

Gradual rollout · production testing · toggling experimental features · multiple user segments · risk mitigation · versioning.

## Considerations

**Naming** — clear, descriptive, matching feature · **Scope** — user/profile/org-wide · **Lifecycle** — plan removal after full rollout · **Performance** — optimize retrieval for triggers/batch · **Dependencies** — document inter-flag relationships · **Monitoring** — log flag usage.

## Flows

**Record-Triggered Flows** — entry criteria: `{!$CustomMetadata.Feature_Flag__mdt.RecordAPIName.Active__c} = TRUE`

Best practice: assign `featureName` variable at flow start from `Feature__c` picklist — avoids updating name in multiple places.

**Other Flow Types** — call `Feature Flag - Subflow - Check for Active Feature Flag` → Decision on boolean output.

**Before-Save Flows** (Apex action unavailable):

1. Trigger criteria formula checks Feature Flag active
2. Get Records → active Feature Flag → Decision
3. Get Records for bypass (separate by username + profile — OR unavailable in Get Records for custom metadata)
4. Decision → bypass found? Yes → end. No → proceed. Optionally display custom error.

**Subflows** — always check flags within subflows even if parent checks; enables independent reuse.

## Apex

```apex
if (FeatureFlagUtil.isEnabled('Account Trigger')) {
    new AccountTriggerHandler().run();
}
```

**Rules:** `FeatureFlagUtil` for all checks · verify in After Insert/Update handlers · optimize retrieval · **test both enabled AND disabled states**.

## Configuration

### Feature_Flag\_\_mdt

| Field            | Type     | Purpose                                           |
| ---------------- | -------- | ------------------------------------------------- |
| `Active__c`      | Checkbox | Active in current environment                     |
| `Feature__c`     | Picklist | Feature identifier (picklist for Flow usage)      |
| `Description__c` | Text     | Purpose, user stories/defects, documentation link |

### Feature_Bypass\_\_mdt

| Field              | Type     | Purpose                |
| ------------------ | -------- | ---------------------- |
| `Active__c`        | Checkbox | Bypass active          |
| `Feature_Flag__c`  | Lookup   | Related Feature Flag   |
| `Username__c`      | Text     | SF username to exclude |
| `Profile_Name__c`  | Text     | SF profile to exclude  |
| `Bypass_Reason__c` | Text     | Rationale              |

**Rule:** Username OR Profile Name, **never both**.

**Permission Set:** `Feature Flag Management` — manage Feature Flag and Feature Bypass records.

## Creating a New Flag

1. Create `Feature__c` picklist value matching the label
2. Create Feature Flag record: descriptive label, Active as needed, Description (reason + user stories + doc link)
3. Feature Bypass records (if needed): Label `<Flag> | <User>`, Username or Profile (not both), Active + Reason

## ADO Tracking

1. Architect tags ADO work item matching Feature Flag label
2. DREAM Team Features List entry with documentation
3. Intake Form request (Michael Watts) for end-user requests
4. Developer creates Feature Flag per these guidelines
