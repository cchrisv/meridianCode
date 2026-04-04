# Feature Templates - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.feature`. HTML in `core/templates/` + `template-registry.json` is what `template-tools` renders.

Complete templates for Feature work items in Azure DevOps. Use these templates when applying business requirements during the AI Refinement phase.

> **User Story standard:** Feature grooming will align with the **Meridian Modern Work Item** four-section narrative on User Stories (`What` / `Why` / `Done When` / optional `Unknowns`). Feature templates below may still use earlier section names in HTML until a dedicated Feature refresh.

## Overview

Features represent a collection of related User Stories that deliver a cohesive capability. Feature-level documentation should provide:

- **Strategic Context**: How this feature aligns with organizational goals
- **Business Value**: Why this work matters to the organization
- **Success Criteria**: How we know the feature is complete and successful

## Target Fields

| Field Name                           | ADO Path                                   | Purpose                                                                                                                                                                              |
| ------------------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Description                          | `System.Description`                       | Summary, User Story, Goals & Business Value, Assumptions, Out of Scope                                                                                                               |
| Business Problem and Value Statement | `Custom.BusinessProblemandValueStatement`  | Why this work matters and the value it delivers                                                                                                                                      |
| Business Objectives and Impact       | `Custom.BusinessObjectivesandImpact`       | Measurable objectives and expected outcomes                                                                                                                                          |
| Acceptance Criteria                  | `Microsoft.VSTS.Common.AcceptanceCriteria` | Feature-level success indicators (templates today may use GWT-style indicators; align child User Stories to **Done When** assertions per `shared/standards/refinement-standards.md`) |

---

## Field 1: Description (`System.Description`)

**Use the rich HTML template:** See `#file:core/templates/field-feature-description.html` for the complete styled template with gradient headers, card layouts, and visual hierarchy.

### Template (Legacy Format)

```html
<!-- See field-feature-description.html for the complete styled template -->
<h2>📋 Summary</h2>
<p>
  [2-3 sentences describing the feature's purpose and strategic importance. Include the business
  context and the transformation this feature enables.]
</p>

<h2>✍️ User Story</h2>
<p>
  As a [primary persona - e.g., UMGC constituent, staff member],<br />
  I want to [high-level capability this feature delivers],<br />
  so that [strategic business outcome and benefit to the user].
</p>

<h2>🌟 Goals & Business Value</h2>
<ul>
  <li><strong>[Value Category 1]</strong>: [Specific business value delivered]</li>
  <li><strong>[Value Category 2]</strong>: [Specific business value delivered]</li>
  <li><strong>[Value Category 3]</strong>: [Specific business value delivered]</li>
  <li><strong>[Value Category 4]</strong>: [Specific business value delivered]</li>
  <li><strong>[Value Category 5]</strong>: [Specific business value delivered]</li>
  <li><strong>[Value Category 6]</strong>: [Specific business value delivered]</li>
</ul>

<h2>💡 Business Assumptions</h2>
<ul>
  <li>[Assumption about data, systems, or processes that must hold true]</li>
  <li>[Assumption about integrations or dependencies]</li>
  <li>[Assumption about user adoption or behavior]</li>
  <li>[Assumption about technical feasibility]</li>
  <li>[Assumption about timeline or resources]</li>
  <li>[Assumption about licensing or budget constraints]</li>
</ul>
```

### Example (Feature 211780 - Unified CRM Data)

```html
<h2>📋 Summary</h2>
<p>
  This foundational Data Cloud implementation establishes the core data layer for the CRM ecosystem.
  This phase integrates Legacy CRM (Sales/Service Cloud), Modern CRM (Education Cloud), Marketing
  Orchestrator (Marketing Cloud Engagement), and Contact Center (Five9). This unified foundation
  will transform how UMGC serves constituents by enabling real-time insights, intelligent
  automation, and hyper-personalized experiences that improve both constituent satisfaction and
  operational efficiency.
</p>

<h2>✍️ User Story</h2>
<p>
  As a UMGC constituent (student or prospective student),<br />
  I want to have a seamless, personalized experience across all touchpoints with the university,<br />
  so that I receive relevant information and support at the right time without having to repeat my
  information or needs multiple times.
</p>

<h2>🌟 Goals & Business Value</h2>
<ul>
  <li>
    <strong>Constituent Experience Transformation</strong>: Create frictionless journeys that adapt
    to individual constituent needs in real-time
  </li>
  <li>
    <strong>Data-Driven Decision Making</strong>: Enable staff to make informed decisions based on
    complete, accurate constituent data
  </li>
  <li>
    <strong>Proactive Engagement</strong>: Shift from reactive to proactive support through
    behavioral triggers and predictive insights
  </li>
  <li>
    <strong>Operational Efficiency</strong>: Automate routine tasks and eliminate duplicate data
    entry across systems
  </li>
  <li>
    <strong>Marketing Effectiveness</strong>: Increase campaign ROI through precise segmentation and
    personalization
  </li>
  <li>
    <strong>Scalable Foundation</strong>: Build a future-proof platform that can adapt to evolving
    business needs
  </li>
</ul>

<h2>💡 Business Assumptions</h2>
<ul>
  <li>Canonical data model will enable consistent experiences across all touchpoints</li>
  <li>Real-time data synchronization will improve decision-making speed and accuracy</li>
  <li>Staff adoption will be achieved through intuitive, no-code tools</li>
  <li>Existing MuleSoft integrations can be leveraged for faster implementation</li>
  <li>Identity resolution will successfully merge duplicate records across systems</li>
  <li>Licensing model will support planned usage without exceeding budget constraints</li>
</ul>
```

---

## Field 2: Business Problem and Value Statement (`Custom.BusinessProblemandValueStatement`)

**Use the rich HTML template:** See `#file:core/templates/field-feature-business-value.html` for the complete styled template with color-coded value items and visual hierarchy.

### Template (Legacy Format)

```html
<!-- See field-feature-business-value.html for the complete styled template -->
<h2>🎯 Business Problem & Value Statement</h2>
<ul>
  <li>
    <strong>[Primary Strategic Objective]</strong>: [How this feature addresses a core business
    need]
  </li>
  <li><strong>[User Experience Improvement]</strong>: [How end users benefit from this feature]</li>
  <li><strong>[Friction Reduction]</strong>: [What pain points are eliminated]</li>
  <li><strong>[Effort Reduction]</strong>: [How this reduces manual work or complexity]</li>
  <li><strong>[Proactive Capability]</strong>: [How this enables anticipation vs. reaction]</li>
  <li><strong>[Channel Excellence]</strong>: [How this improves consistency across touchpoints]</li>
  <li><strong>[Operational Excellence]</strong>: [Quantified efficiency gains]</li>
  <li><strong>[Data Quality]</strong>: [How this improves data accuracy and trust]</li>
</ul>
```

### Example (Feature 211780)

```html
<h2>🎯 Business Problem & Value Statement</h2>
<ul>
  <li>
    <strong>Establish the Foundational Data Layer</strong>: Implement Data Cloud as the foundational
    data layer for the CRM, integrating Legacy CRM, Modern CRM, Marketing Orchestrator, and Contact
    Center to enable data-driven decision making
  </li>
  <li>
    <strong>Enhanced Constituent Satisfaction</strong>: Deliver personalized experiences that meet
    constituents where they are, increasing satisfaction scores and engagement rates
  </li>
  <li>
    <strong>Seamless Constituent Journey</strong>: Remove friction points by ensuring constituents
    never have to repeat their story, regardless of which department they interact with
  </li>
  <li>
    <strong>Reduced Constituent Effort</strong>: Enable one-touch resolution by providing complete
    constituent context to all service teams instantly
  </li>
  <li>
    <strong>Proactive Constituent Support</strong>: Anticipate constituent needs through behavioral
    triggers, reaching out before issues escalate
  </li>
  <li>
    <strong>Omnichannel Excellence</strong>: Deliver consistent, high-quality experiences whether
    constituents engage via phone, email, chat, or in-person
  </li>
  <li>
    <strong>Operational Excellence</strong>: Reduce manual effort by 40% through automated workflows
    and unified data access
  </li>
  <li>
    <strong>Single Source of Truth</strong>: Eliminate data discrepancies and duplicate records,
    ensuring every decision is based on accurate, real-time information
  </li>
</ul>
```

---

## Field 3: Business Objectives and Impact (`Custom.BusinessObjectivesandImpact`)

**Use the rich HTML template:** See `#file:core/templates/field-feature-objectives.html` for the complete styled template with gradient objective cards.

### Template (Legacy Format)

```html
<!-- See field-feature-objectives.html for the complete styled template -->
<h2>📊 Business Objectives & Expected Impact</h2>
<ul>
  <li>
    <strong>[Foundation/Platform Objective]</strong>: [What infrastructure or platform capability is
    being established]
  </li>
  <li>
    <strong>[Visibility/Access Objective]</strong>: [What data or insights become available to
    users]
  </li>
  <li>
    <strong>[Quality/Accuracy Objective]</strong>: [How data quality or reporting accuracy improves]
  </li>
  <li>
    <strong>[Automation Objective]</strong>: [What processes become automated and the time savings]
  </li>
  <li>
    <strong>[Personalization Objective]</strong>: [How user experiences become more personalized]
  </li>
</ul>
```

### Example (Feature 211780)

```html
<h2>📊 Business Objectives & Expected Impact</h2>
<ul>
  <li>
    <strong>Unified Data Foundation</strong>: Implement canonical data model in Data Cloud serving
    as the foundational data layer for the entire CRM ecosystem
  </li>
  <li>
    <strong>Cross-Org Visibility</strong>: Enable all authorized users in both Legacy and Modern CRM
    to access unified constituent profiles in real-time
  </li>
  <li>
    <strong>Enhanced Reporting Accuracy</strong>: Deliver consistent reporting across both orgs with
    complete data accuracy, eliminating conflicting metrics
  </li>
  <li>
    <strong>Intelligent Automations</strong>: Activate data-driven workflows reducing response time
    from days to minutes for critical constituent interactions
  </li>
  <li>
    <strong>Marketing Personalization</strong>: Enable Marketing Cloud to leverage real-time
    segments, significantly increasing campaign relevance and constituent engagement
  </li>
</ul>
```

---

## Field 4: Acceptance Criteria (`Microsoft.VSTS.Common.AcceptanceCriteria`)

**Use the rich HTML template:** See `#file:core/templates/field-feature-acceptance-criteria.html` for the complete styled template with user-story-style success indicator cards.

### Authoring pattern (align with User Story **Done When**)

Feature-level acceptance criteria should be **high-level, testable outcomes** for the whole capability — plain English, specific metrics, no **Given / When / Then** labels. The HTML template may still render “success indicator” cards; the **words inside** should read as **Done When**-style sentences.

**Skeleton (plain text before templating):**

- **Core capability:** When identity resolution completes for ingested sources, users open a unified constituent profile and see interactions, preferences, and calculated insights in **under 2 seconds** on the reference hardware.
- **Data quality:** When users read constituent data from any connected system, values match in real time with **no** unexplained cross-system drift for mapped fields.
- **Reporting:** When users run defined reports from either CRM against Data Cloud, headline metrics reconcile to source detail drill-down.
- **Automation:** When behavioral thresholds fire, downstream workflow starts within **30 seconds** under nominal load.
- **Personalization:** When marketing launches against Data Cloud segments, segment membership refresh keeps campaigns aligned to current constituent behavior.

### Example (Feature 211780) — same content, outcome-first

- **Unified profile:** With all four sources ingested and resolution successful, the 360° view loads in **under 2 seconds** with interactions, preferences, and insights visible.
- **Consistency:** With the unified model active, the same constituent viewed from any connected system shows **identical** real-time field values for mapped attributes.
- **Reporting:** With unified Data Cloud data, reports from either CRM match at **100%** on defined KPIs and support drill-down to source rows.
- **Automation:** With behavioral triggers configured, when thresholds hit (e.g. engagement drop), workflows start within **30 seconds**.
- **Campaigns:** With dynamic segments in Data Cloud, launched campaigns see segment membership refresh in near real time as behavior changes.

_(Rich HTML for this field: `#file:core/templates/field-feature-acceptance-criteria.html` — structure may still use cards; keep copy in the form above.)_

---

## Usage Notes

1. **Adapt to Context**: These templates provide structure; adapt the content categories to match the specific feature's domain
2. **Measurable Outcomes**: Always include specific metrics, percentages, or time thresholds where possible
3. **User-Centric Language**: Frame everything from the perspective of the end user or business stakeholder
4. **Solution Neutrality**: Keep technical implementation details out of these fields; they belong in child User Stories
5. **Strategic Alignment**: Connect each feature to broader organizational goals (e.g., Student Success, Operational Excellence)
