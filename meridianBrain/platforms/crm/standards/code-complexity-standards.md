# Code Complexity Standards

> **Meridian:** Active — `util-pr-analysis` always-load `#file:`.

Complexity guardrails for Apex and LWC using PMD and SonarQube.

## Metrics

- **Cyclomatic Complexity (CC)** — independent paths via decision points. Tool: PMD via SF Code Analyzer.
- **Cognitive Complexity (CoC)** — comprehension difficulty (nesting, non-linear flow, recursion). Tool: SonarQube.

## Thresholds

| Metric                | Apex method       | LWC function  |
| --------------------- | ----------------- | ------------- |
| CC Pass / Warn / Fail | <10 / 10–15 / >15 | <10 / — / >10 |
| CoC Pass / Fail       | ≤15 / >15         | ≤15 / >15     |

Fail PRs when exceeded · document mitigation if guardrails must be overridden.

## Tooling

```bash
# Install
sf plugins install @salesforce/sfdx-scanner
# Run
sf scanner run --target "force-app/**/*.{cls,js}" --engine pmd --pmdconfig ./pmd-apex-complexity.xml --format table --severity-threshold 2
```

**PMD ruleset** (`pmd-apex-complexity.xml`):

```xml
<ruleset name="Apex Complexity" xmlns="http://pmd.sourceforge.net/ruleset/2.0.0">
  <rule ref="category/apex/design.xml/StdCyclomaticComplexity">
    <properties><property name="reportLevel" value="10"/></properties>
  </rule>
</ruleset>
```

SonarQube (optional): CoC analysis · dashboards · PR decorations. Set CoC ≤15 for Apex and JS.

## Refactoring

**When:** CC >15 (Apex) / >10 (LWC) · CoC >15 · nesting >3 levels · methods >50–100 lines.

**Strategies:** extract methods · early returns · Strategy/Factory patterns · guard clauses · SRP decomposition.

```apex
// BAD: nested conditions → GOOD: guard clause + extract + switch
public void processAccount(Account acc) {
    if (acc == null || !isEligibleAccount(acc)) return;
    processByRating(acc);
}
private Boolean isEligibleAccount(Account acc) {
    return acc.Industry == 'Technology' && acc.AnnualRevenue > 1000000 && acc.NumberOfEmployees > 100;
}
private void processByRating(Account acc) {
    switch on acc.Rating {
        when 'Hot' { processHotAccount(acc); }
        when 'Warm' { processWarmAccount(acc); }
        when else { processOtherAccount(acc); }
    }
}
```

```javascript
// LWC: guard clause + strategy map
handleDataChange(event) {
    if (!this.isEligibleForProcessing(this.data)) return;
    const processors = { 'credit': () => this.processCredit(this.data), 'debit': () => this.processDebit(this.data) };
    processors[this.data.paymentMethod]?.();
}
```

## Solutioning Integration

Estimate CC + CoC during option evaluation · compare against thresholds · document mitigation if exceeded · high complexity → higher test coverage.
