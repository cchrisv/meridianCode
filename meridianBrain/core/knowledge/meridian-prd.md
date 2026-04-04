# MERIDIAN

> **Meridian:** Canonical PRD — human/org source of truth; linked from README. Not attached as `#file:` on every Copilot prompt by default.

## Platform Engineering Company OS

**Product Requirements Document**

| **Version**        | 1.0           |
| ------------------ | ------------- |
| **Date**           | April 2, 2026 |
| **Author**         | Chris V.      |
| **Status**         | Draft         |
| **Classification** | Internal      |

---

## 1. Executive Summary

**Meridian** is the operating system for Platform Engineering. It is a context-aware, AI-powered workflow framework that unifies how platform engineers research, groom, and deliver work across every platform in the enterprise technology stack: CRM (Salesforce), Marketing Automation (SFMC), Contact Center (Five9), Portal, Integration (MuleSoft), Business Apps (Microsoft/D365), SIS (PeopleSoft), HCM (Workday), and future additions.

Today, Meridian exists as a proven workflow engine for the Salesforce team, featuring 40+ structured prompts, 8 CLI tool suites, a phased ticket lifecycle, and AI agents specialized in Salesforce architecture and product ownership. This PRD defines the evolution of Meridian from a single-platform tool into a multi-platform Company OS that captures institutional knowledge, eliminates cross-platform blind spots, and compounds intelligence with every ticket worked.

> **Vision:** Any platform engineer can pick up any ticket on any platform and have the context they need to be productive within minutes — because Meridian remembers what humans forget.

---

## 2. Problem Statement

### 2.1 The Knowledge Crisis

Platform Engineering operates across multiple technology platforms, each managed by a dedicated team. While these teams frequently collaborate on cross-platform projects, their knowledge, processes, and tooling are deeply siloed. Four critical problems compound daily:

- **Knowledge Loss:** When engineers leave, years of institutional knowledge about platform configurations, integration behaviors, edge cases, and undocumented dependencies walk out the door. There is no system that captures and retains this knowledge.
- **Inconsistent Processes:** Each platform team has evolved its own way of working. There is no standard methodology for how tickets are researched, groomed, or documented. Quality and thoroughness vary wildly.
- **Context Switching Overhead:** Engineers waste significant time jumping between Azure DevOps, platform-specific admin consoles, SharePoint, scattered wikis, Slack threads, and email to assemble the context they need to do their work.
- **Cross-Platform Blind Spots:** Platform teams understand their own systems but lack visibility into adjacent platforms. A CRM engineer does not know how Integration (MuleSoft) pipelines that feed CRM actually work — their schedules, source systems, error handling, or data transformation logic. This creates fragile handoffs and slow troubleshooting.

### 2.2 The Tooling Landscape

Outside of the Salesforce team, platform teams operate with mostly ad hoc tooling. Azure DevOps is the common denominator for ticket tracking, but documentation, SOPs, and runbooks are scattered across SharePoint, team-specific wikis, Slack conversations, and personal notes. Each team has adopted different secondary tools with no standardization. The Salesforce team is the only team with a structured, AI-assisted workflow (the current Meridian prototype).

---

## 3. Vision & Goals

### 3.1 Product Vision

Meridian transforms Platform Engineering from a collection of siloed teams into a unified, knowledge-compounding organization. It does this by delivering three outcomes:

1. **Unified Workflow:** All platform teams research, groom, and deliver work through a shared methodology — while retaining the platform-specific depth each team needs.
2. **Living Knowledge Graph:** Institutional knowledge from every ticket, every integration, and every team is captured, connected, and queryable — making cross-platform dependencies visible instead of invisible.
3. **Compounding Intelligence:** Every ticket worked and every human correction makes the system smarter for the next engineer. Knowledge grows by default, not by heroic effort.

### 3.2 Success Criteria (6-Month Horizon)

| Metric                         | Target                                                                 | Measurement                                       |
| ------------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------- |
| Pilot team onboarded           | Marketing Automation + Contact Center teams fully adopted              | Active daily usage by all team members            |
| Ticket context completeness    | 80% of tickets have full phase context                                 | ticket-context.json completeness audit            |
| Cross-platform dependency maps | All Marketing Automation/Contact Center-to-CRM integrations documented | Integration registry coverage                     |
| Knowledge retention            | Zero critical knowledge loss from attrition                            | Onboarding time for replacement hires             |
| Self-improvement signal        | Measurable accuracy improvement in AI assistance                       | Acceptance rate of AI-generated outputs over time |

---

## 4. Current State

The existing Meridian implementation provides a proven foundation for the Salesforce team. Understanding what exists today — and what it lacks — frames the requirements for the expanded product.

### 4.1 What Exists

| Component            | Description                                                                                              |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Phased Workflow      | 5-phase ticket lifecycle: Research → Grooming → Solutioning Research → Solutioning → Finalization        |
| Unified Context      | ticket-context.json accumulates knowledge across all phases per work item                                |
| CLI Tools (8 suites) | workflow-tools, ado-tools, sf-tools, wiki-tools, pr-tools, report-tools, template-tools, team-tools      |
| AI Agents            | SF Solution Architect and SF Product Owner for interactive, domain-specific guidance                     |
| 40+ Prompts          | Structured prompts for every phase plus 25+ standalone utilities (backlog, reporting, wiki, PR analysis) |
| Template Engine      | Nunjucks-based HTML templates for ADO field formatting with block-based wiki composition                 |

### 4.2 What Works

- The phased workflow enforces thoroughness without being rigid — engineers can skip or repeat phases as needed
- The unified context pattern ensures no knowledge is lost between phases
- IDE-first design eliminates context switching — engineers never leave their editor
- Template-driven formatting ensures consistent, professional ADO work items
- Feature Research Pipeline produces living documentation of existing platform functionality

### 4.3 Gaps

- **Single-platform lock-in:** All tooling, agents, configuration, and standards assume CRM (Salesforce). Nothing is reusable by another platform team as-is.
- **No cross-platform awareness:** Integrations between platforms are invisible to the system. An engineer working a CRM ticket has no way to discover or understand the Integration (MuleSoft) pipeline that feeds the object they're modifying.
- **Knowledge dies with the ticket:** Context is captured per work item but there is no mechanism to extract and retain organizational knowledge beyond individual tickets. When the ticket closes, the knowledge effectively archives.
- **No path for other teams:** There is no onboarding path, extension model, or shared standards that would allow another platform team to adopt Meridian without rebuilding it from scratch.

---

## 5. Requirements

### 5.1 Multi-Platform Support

Meridian must support all Platform Engineering teams through a single, shared system. This is the foundational requirement that all other requirements depend on.

| ID   | Requirement                                                                                                                                                                                                                                    | Rationale                                                                                                                                                                                                                         |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MP-1 | The core workflow (phased ticket lifecycle, context accumulation, reporting, backlog management) must work identically regardless of which platform a ticket belongs to.                                                                       | Engineers who work cross-platform projects need a consistent experience. Inconsistent workflows across platforms would recreate the silo problem Meridian is designed to solve.                                                   |
| MP-2 | Each platform team must be able to extend the core workflow with platform-specific tooling, standards, and AI agents without modifying the core.                                                                                               | Platform teams have fundamentally different technical ecosystems (SOQL vs. Dataverse vs. PeopleCode). Forcing a one-size-fits-all approach would make the tool useless for deep platform work.                                    |
| MP-3 | Adding a new platform must not require changes to the core system or to any existing platform's configuration.                                                                                                                                 | If onboarding Integration (MuleSoft) breaks the CRM workflow, adoption will stall. Platform independence is non-negotiable for trust.                                                                                             |
| MP-4 | The system must support the following platform domains at minimum: CRM (Salesforce), Marketing Automation (SFMC), Contact Center (Five9), Portal, Integration (MuleSoft), Business Apps (Microsoft/D365), SIS (PeopleSoft), and HCM (Workday). | These are the current Platform Engineering teams. Platforms are named by domain function, not vendor, to decouple the system from specific technology choices. The design must account for all of them even if rollout is phased. |

### 5.2 Knowledge Capture & Retention

Meridian must capture institutional knowledge automatically through normal workflow use and make it durable, queryable, and growing over time.

| ID   | Requirement                                                                                                                                                                                                                        | Rationale                                                                                                                                                                                                                                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KC-1 | Every phase of the ticket lifecycle must generate structured knowledge artifacts that persist beyond the ticket's closure.                                                                                                         | Today, knowledge dies when the ticket closes. The org loses the research, context, and decisions that informed the work.                                                                                                                                                                                                                                                              |
| KC-2 | Meridian must support ingestion of existing documentation from SharePoint, ADO wikis, and other scattered sources into a unified, queryable format.                                                                                | SOPs and runbooks exist but are scattered and unsearchable. If engineers can't find them, they effectively don't exist.                                                                                                                                                                                                                                                               |
| KC-3 | SOPs and runbooks must be convertible into executable AI skills that can perform a significant portion of the documented procedure.                                                                                                | Static documentation is underused. Executable knowledge that actively assists engineers is dramatically more valuable than a PDF on SharePoint.                                                                                                                                                                                                                                       |
| KC-4 | Knowledge must be organized across eight domains: Platform Knowledge, Integration Knowledge, Process Knowledge, Decision Knowledge, Pattern Knowledge, Persona Knowledge, Business Process Knowledge, and Business Rule Knowledge. | These domains represent the full picture of institutional knowledge — both technical and business — that Platform Engineering depends on. Technical knowledge tells engineers _how_ systems work. Business knowledge tells engineers _why_ systems exist, _who_ depends on them, and _what happens to real people_ when something changes. Missing either side leaves a critical gap. |
| KC-5 | Engineers must be able to search across all captured knowledge using natural language, regardless of which platform or ticket originally generated it.                                                                             | Cross-platform work requires cross-platform knowledge access. A CRM engineer troubleshooting an integration issue needs to find Integration (MuleSoft) knowledge without knowing where to look.                                                                                                                                                                                       |

### 5.3 Cross-Platform Visibility

Meridian must make the connections between platforms visible, queryable, and automatically maintained.

| ID   | Requirement                                                                                                                                                                                                               | Rationale                                                                                                                                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CV-1 | Meridian must maintain a registry of all integrations between platforms, including: source/target systems, data flows, schedules, transformation logic, error handling, and owner contacts.                               | This is the single biggest knowledge gap today. Engineers know their own platform but are blind to how it connects to adjacent platforms. Every production incident involving cross-platform data flow exposes this gap. |
| CV-2 | When an engineer works a ticket that touches an integrated system, Meridian must surface the relevant integration context automatically — without the engineer needing to know it exists.                                 | Engineers don't know what they don't know. If they have to manually search for cross-platform impacts, they won't — and downstream systems will break.                                                                   |
| CV-3 | Meridian must support impact tracing: given a proposed change on one platform, it must be able to identify potentially affected integrations, downstream systems, and dependent processes across all connected platforms. | Today, cross-platform impact analysis is manual, incomplete, and dependent on the engineer knowing the full integration landscape. This is the root cause of integration-related production incidents.                   |
| CV-4 | The integration registry must be populated through a combination of automated discovery (querying platform APIs), guided capture (prompting engineers during workflow), and curated sessions (SME knowledge capture).     | No single method is sufficient. APIs can discover endpoints but not business context. Engineers encounter integrations organically. SMEs hold knowledge that's never been written down. All three are needed.            |

### 5.4 Self-Improving Intelligence

Meridian must get smarter over time through structured feedback loops, not just through adding more static content.

| ID   | Requirement                                                                                                                                                                                                                 | Rationale                                                                                                                                                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SI-1 | When an engineer accepts, modifies, or rejects AI-generated output, the outcome and the engineer's reasoning must be captured as a feedback signal.                                                                         | Without feedback, the AI makes the same mistakes forever. Human corrections are the highest-quality training signal available.                                                      |
| SI-2 | Meridian must periodically surface knowledge assertions for human validation (e.g., "Is this integration schedule still accurate?"). Confirmed knowledge should increase in confidence; outdated knowledge must be flagged. | Knowledge decays. Integration schedules change, APIs get deprecated, processes get updated. Without active validation, the knowledge graph becomes a liability instead of an asset. |
| SI-3 | Patterns that succeed on one platform must be analyzable for applicability to other platforms.                                                                                                                              | Platform teams solve similar categories of problems (data migrations, permission models, automation design). Cross-pollination prevents each team from reinventing the wheel.       |

### 5.5 Access & Experience

Meridian must meet engineers where they work without introducing new context-switching burdens.

| ID   | Requirement                                                                                                                                                                             | Rationale                                                                                                                                                                                         |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AX-1 | The primary interface must be IDE-based (VS Code, Cursor, or equivalent). Engineers must be able to complete their entire workflow without leaving the editor.                          | This is the design principle that made the Salesforce Meridian successful. Context switching is the second-highest pain point. Adding a new tool that requires a browser tab defeats the purpose. |
| AX-2 | Onboarding a new platform team must be self-service and guided — not dependent on the Salesforce team hand-holding each adoption.                                                       | If Meridian scales only as fast as Chris can personally onboard teams, it won't scale. Self-service onboarding is a prerequisite for org-wide adoption.                                           |
| AX-3 | The system must degrade gracefully when a platform extension is unavailable (expired auth, API outage, etc.). Core workflow must continue with reduced platform-specific functionality. | Engineers will lose trust in Meridian if a Contact Center API outage prevents them from grooming a CRM ticket. Platform failures must be isolated.                                                |

### 5.6 Safeguards & Governance

Meridian must enforce accountability boundaries that ensure AI accelerates work without replacing human judgment.

| ID   | Requirement                                                                                                                                                                                                                          | Rationale                                                                                                                                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SG-1 | No Meridian output may be treated as final without human review and approval. Every AI-generated artifact must be clearly marked as a draft or suggestion.                                                                           | 100% AI outputs are not acceptable. This is an operating principle, not a preference. The engineering team owns their work and every mistake.                               |
| SG-2 | Each repository must contain a safeguard configuration that explicitly lists operations Meridian is prohibited from performing autonomously (e.g., production deployments, data modifications, permission changes).                  | Safeguards must be enforceable and visible, not just cultural norms. A config file that the system reads and respects is auditable in a way that verbal agreements are not. |
| SG-3 | Every AI-generated suggestion, human correction, and knowledge update must be logged with attribution and timestamp.                                                                                                                 | Accountability requires traceability. When something goes wrong, the org needs to understand what the AI suggested, what the human decided, and why.                        |
| SG-4 | Platform credentials must be isolated. Authenticating to one platform must never grant access to another.                                                                                                                            | This is a security baseline. Cross-platform visibility must come from the knowledge layer, not from shared credentials.                                                     |
| SG-5 | Ownership of Meridian must transition to Platform Engineering leadership as adoption scales, with a governance model that includes core maintainers, platform extension owners, knowledge stewards, and a cross-team advisory board. | A tool owned by one team lead that serves the entire org is a bus-factor risk. Formal governance ensures Meridian outlives any individual champion.                         |

---

## 6. Rollout Strategy

### Phase 1: Foundation (Months 1–2)

_Goal: Make Meridian platform-agnostic and prove it works for Marketing Automation (SFMC) and Contact Center (Five9) alongside the existing CRM (Salesforce) workflow._

**Why start here:** Marketing Automation and Contact Center are adjacent to the CRM team. Chris's team already understands these platforms, which removes the change management overhead of onboarding an external team. If the multi-platform model works for these three domains, it will work for the rest.

**Entry criteria:** Existing CRM workflow remains fully functional throughout.

**Exit criteria:** Marketing Automation and Contact Center team members are using Meridian daily for their ticket workflow. At least one cross-platform integration (Marketing Automation-to-CRM or Contact Center-to-CRM) is documented in the integration registry through normal workflow use.

### Phase 2: Knowledge (Months 3–4)

_Goal: Build the knowledge capture and retention capabilities. Begin ingesting existing documentation._

**Why now:** With three platforms generating workflow data, there is enough volume to make the knowledge layer meaningful. Waiting longer risks the pilot teams treating Meridian as "just a ticket tool" rather than a knowledge system.

**Entry criteria:** Phase 1 exit criteria met. At least 30 tickets completed across the three platforms.

**Exit criteria:** All known Marketing Automation/Contact Center-to-CRM integrations documented in the registry. At least 10 SOPs or runbooks ingested and queryable. Natural language knowledge search functional across all three platform domains.

### Phase 3: Scale (Months 5–6)

_Goal: Validate success metrics. Prepare for expansion to remaining platform teams._

**Why now:** Six months of data provides statistically meaningful measurement. Integration (MuleSoft) is the highest-impact next domain because it is the integration backbone that connects to nearly every other platform.

**Entry criteria:** Phase 2 exit criteria met. 6-month success metrics measurable.

**Exit criteria:** Success criteria from Section 3.2 measured and reported. Integration (MuleSoft) platform extension development underway. Platform onboarding process documented for self-service adoption. Results and expansion plan presented to Platform Engineering leadership.

### Phase 4: Enterprise (Months 7+)

_Goal: Full Platform Engineering coverage. Meridian becomes the standard operating system._

**Entry criteria:** Phase 3 exit criteria met. Platform Engineering leadership endorses org-wide rollout.

**Exit criteria:** All remaining platform domains (Business Apps, SIS, HCM) onboarded. Governance model operational. Meridian is the default way Platform Engineering works.

---

## 7. Risks & Mitigations

| Risk                     | Description                                                                                                                  | Mitigation                                                                                                                                                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adoption resistance      | Other platform teams may resist adopting a tool built by the CRM team.                                                       | Pilot with adjacent teams (Marketing Automation, Contact Center) first to prove value with results, not pitches. Involve target teams in their own extension design.                                                          |
| Platform API limitations | Some platforms (SIS/PeopleSoft, legacy systems) may have limited or poorly documented APIs for automated metadata discovery. | The system must support manual knowledge ingestion as a first-class path. Not every platform needs full API automation to be valuable — captured human knowledge is still a massive improvement over nothing.                 |
| Knowledge staleness      | Captured knowledge becomes outdated as platforms evolve, and stale knowledge is worse than no knowledge.                     | Active validation loops that surface assertions for periodic human review. Confidence scores that decay over time, triggering re-validation before the system presents outdated information as fact.                          |
| Scope creep              | Pressure to support every team and every use case simultaneously.                                                            | Phased rollout with explicit entry and exit criteria per phase. Each platform must have a designated extension owner before onboarding begins. No exceptions.                                                                 |
| AI accuracy              | AI assistance for unfamiliar platforms may be lower quality initially, eroding trust.                                        | Human-in-the-loop requirement is non-negotiable and enforced by safeguard configuration. Self-improvement loops prioritize accuracy for the platforms with the most usage data. Transparency about confidence levels.         |
| Single champion risk     | Meridian is currently driven by one team lead. If Chris leaves or shifts focus, momentum dies.                               | Governance transition to Platform Engineering leadership is baked into the rollout plan, not deferred. Phase 3 explicitly includes leadership endorsement and self-service onboarding to reduce dependency on any individual. |

---

## 8. Open Questions

The following questions must be resolved during Phase 1 and will inform detailed design decisions:

1. **Platform extension depth:** For each platform, what is the minimum set of platform-specific capabilities that make Meridian valuable to that team? Where is the line between "useful" and "over-engineered"?
2. **Knowledge graph storage:** What is the right persistence model for the knowledge graph — flat files in the repo (consistent with current markdown-first approach), a database, or a hybrid?
3. **Agent specialization threshold:** At what point does a generalized agent need to hand off to a platform-specialized agent? How does an engineer signal that they need deeper platform expertise?
4. **Cross-team integration mapping authority:** Who is the source of truth for integration documentation — the sending platform team, the receiving platform team, or a shared responsibility? How do conflicts get resolved?
5. **Feedback loop mechanics:** What is the minimum-friction way to capture accept/modify/reject signals from engineers without adding overhead that discourages adoption?
6. **SharePoint ingestion scope:** How much of the existing SharePoint documentation is worth ingesting versus starting fresh? What is the quality threshold for ingest
