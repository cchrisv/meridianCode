# Solution Design Document Template - Digital Platforms Project

> **Meridian:** Active — `core/config/shared.json` → `template_files.solution_design_document`.

Complete template for generating Solution Design Documents at the Feature or Epic level. Use this template when producing a consolidated solution design across all child user stories under a Feature, or across all Features and their child user stories under an Epic.

## Overview

The Solution Design Document serves two audiences simultaneously:

1. **Business Stakeholders:** Need to understand the end-to-end current state, future state, strategic value, and scope of the initiative.
2. **Developers:** Need the aggregated solution architecture, component landscape, cross-story dependencies, and per-story technical details.

This document operates at two hierarchy levels:

- **Feature level (1-level):** Aggregates data from child user stories under a single Feature.
- **Epic level (2-level):** Aggregates data from all child Features, and all user stories under each Feature, producing a single comprehensive document that spans the entire initiative.

In both cases, all child user stories must have been groomed and solutioned. The document synthesizes individual story-level designs into a cohesive narrative.

## Data Sources

All data is retrieved from Azure DevOps and the wiki -- no local artifacts are expected.

### Feature-Level Data Sources

| Source                | CLI Command                                                                                            | Key Fields                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Feature work item     | `{{cli.ado_get}} {{work_item_id}} --expand All --comments --json`                                      | Description, Business Value, Objectives, AC, Tags                     |
| Child relations       | `{{cli.ado_relations}} {{work_item_id}} --type child --json`                                           | List of child work item IDs                                           |
| Each child user story | `{{cli.ado_get}} {{child_id}} --expand All --comments --json`                                          | Title, Description, AC, DevelopmentSummary, SFComponents, State, Tags |
| Each child wiki page  | `{{cli.wiki_get}} --path "{{ado_defaults.wiki_copilot_root}}/{{child_id}}-{{sanitized_title}}" --json` | Full wiki page content (research, solution design, testing)           |

### Epic-Level Data Sources (in addition to Feature-level)

| Source                         | CLI Command                                                                                            | Key Fields                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| Epic work item                 | `{{cli.ado_get}} {{work_item_id}} --expand All --comments --json`                                      | Description, Business Value, Objectives, AC, Tags                     |
| Epic child relations           | `{{cli.ado_relations}} {{work_item_id}} --type child --json`                                           | List of child Feature IDs                                             |
| Each child Feature             | `{{cli.ado_get}} {{feature_id}} --expand All --comments --json`                                        | Description, Business Value, Objectives, AC, Tags                     |
| Each Feature's child relations | `{{cli.ado_relations}} {{feature_id}} --type child --json`                                             | List of child user story IDs                                          |
| Each user story (per Feature)  | `{{cli.ado_get}} {{child_id}} --expand All --comments --json`                                          | Title, Description, AC, DevelopmentSummary, SFComponents, State, Tags |
| Each user story wiki page      | `{{cli.wiki_get}} --path "{{ado_defaults.wiki_copilot_root}}/{{child_id}}-{{sanitized_title}}" --json` | Full wiki page content                                                |

## Document Structure

### Section 1: Executive Summary

**Audience:** Business
**Purpose:** Provide a high-level overview of the initiative, its strategic value, and the scope of work.
**Tone:** Concise, outcome-oriented. A busy executive should be able to read this section alone and understand what the initiative delivers and why it matters.

**Data Sources:**

- Feature/Epic `System.Description` (Summary, User Story, Goals & Business Value)
- Feature/Epic `Custom.BusinessProblemandValueStatement`
- Feature/Epic `Custom.BusinessObjectivesandImpact`
- Count and summary of child user stories (and Features when Epic)

**Content Guide:**

- Open with 2-3 sentences explaining the initiative's purpose and strategic importance
- State the scope: number of user stories, functional areas covered
- Summarize the business value in terms of outcomes (not deliverables)
- Set expectations: complexity level and key considerations

**Epic-Specific Guidance:**

- Reference the epic's strategic vision and organizational objectives
- List the constituent Features with a 1-line description of each Feature's scope
- State the total story count across all Features (e.g., "This initiative spans 4 Features containing 23 user stories")
- Explain how the Features relate to each other and combine to deliver the epic's goals

### Section 2: Current State - End-to-End

**Audience:** Both (Business and Developer)
**Purpose:** Provide a comprehensive end-to-end picture of how things work today. This gives readers the baseline for understanding what changes.
**Tone:** Educational and narrative-driven. Walk readers through the current experience as if guiding a colleague who is new to the system.

**Data Sources:**

- Child user story `System.Description` fields (look for current-state context, pain points, "As-Is" references)
- Child wiki pages: Research sections (Discovery & Research, Understanding the Request, Current Situation)
- Child user story comments (may contain stakeholder clarifications about current state)
- Feature/Epic `System.Description` (Assumptions section often references current-state constraints)

**Content Guide:**

- Lead with the business process: describe what the end users experience today, step by step
- Describe the current system landscape: which systems are involved, how data flows between them
- Identify pain points and limitations that the initiative addresses
- Include a current-state data flow or process description (narrative or diagram)
- Use collapsible sections for detailed technical specifics (current metadata, configurations, integrations)

**Synthesis Instructions:**

1. Scan ALL child user story Descriptions across ALL Features for references to current behavior, existing processes, or "today" language
2. Scan child wiki Research sections for technical environment findings, existing components, and codebase analysis
3. Deduplicate and merge into a single coherent narrative -- do NOT repeat the same information from multiple stories or Features
4. Organize by functional area or process flow, not by user story or Feature

**Epic-Specific Guidance:**

- The current-state narrative must span the entire initiative, covering all Features' scope areas
- Do NOT organize by Feature -- organize by process flow so the reader sees a coherent end-to-end picture
- Multiple Features may reference the same systems or processes; deduplicate aggressively

### Section 3: Future State - End-to-End

**Audience:** Both (Business and Developer)
**Purpose:** Describe the end-to-end vision of how things will work after the feature is implemented. This is the "to-be" picture that the solution design delivers.
**Tone:** Aspirational but grounded. Paint the future picture in concrete terms so both business and technical readers can visualize the transformation.

**Data Sources:**

- Child user story `System.Description` fields (Goals & Business Value, User Story sections)
- Child wiki pages: Solution Design sections, Executive Summary "Recommended Approach"
- Child user story `Custom.DevelopmentSummary` (the "Our Solution" narrative portions)
- Feature/Epic `Custom.BusinessObjectivesandImpact`

**Content Guide:**

- Lead with the future business process: describe what end users will experience after implementation
- Describe the future system landscape: new components, changed integrations, improved data flows
- Highlight capabilities gained and pain points eliminated
- Include a future-state data flow or process description (narrative or diagram)
- Draw a clear contrast with the current state to make the transformation tangible
- Use collapsible sections for detailed technical future-state specifics

**Synthesis Instructions:**

1. Extract the "solution approach" and "what success looks like" content from each child user story across ALL Features
2. Extract future-state descriptions from child wiki Solution Design sections
3. Merge into one cohesive future-state narrative organized by process flow or functional area
4. Identify how the individual story solutions combine to deliver the full capability

**Epic-Specific Guidance:**

- The future-state narrative must describe the full transformation across all Features
- Show how the Features' solutions interconnect to deliver the epic's vision
- Do NOT organize by Feature -- organize by process flow so the reader sees a coherent end-to-end future picture

### Section 4: Requirements Inventory

**Audience:** Both
**Purpose:** Provide a structured inventory of all requirements (user stories) under this feature, grouped by functional area.
**Tone:** Structured and factual. This is a reference section for understanding scope.

**Data Sources:**

- All child user stories: `System.Title`, `System.State`, `System.Tags`, `Microsoft.VSTS.Common.AcceptanceCriteria`
- Child user story `Custom.SFComponents` (for grouping by component area)

**Content Guide:**

**User Story Inventory Table:**

| ID            | Title     | State     | Functional Area | Key AC Count |
| ------------- | --------- | --------- | --------------- | ------------ |
| #{{child_id}} | {{title}} | {{state}} | {{area}}        | {{ac_count}} |

- Group user stories by functional area or theme (derive from Tags, SFComponents, or Description analysis)
- For each group, provide a brief narrative explaining the group's purpose
- Summarize acceptance criteria themes per group (not full AC text -- keep it scannable)
- Identify inter-story dependencies (Story A must complete before Story B)
- Call out any stories that are prerequisites or shared foundations for others

**Epic-Specific Guidance:**

- Group first by Feature (collapsible section per Feature with Feature title and brief description)
- Within each Feature section, group user stories by functional area
- Include a Feature summary row showing total stories, story points, and completion status
- Identify inter-feature dependencies (Feature A stories that depend on Feature B stories)
- Use `<details>/<summary>` for each Feature section so the inventory remains scannable

### Section 5: Solution Architecture

**Audience:** Developer
**Purpose:** Present the aggregated solution architecture that spans all user stories. This is the "how" at the feature level.
**Tone:** Technical but well-explained. A developer joining the project mid-stream should be able to understand the full architecture from this section.

**Data Sources:**

- All child user story `Custom.DevelopmentSummary` fields (component tables, integration points, technical narratives)
- Child wiki pages: Solution Design sections (architecture, components, data flow)
- Child user story `Custom.SFComponents`

**Content Guide:**

**Component Landscape:**

- Aggregate all components from ALL child DevelopmentSummary fields into a unified table
- Identify shared components (components that appear in multiple user stories)
- Identify new vs. existing components
- For each component, note which user stories reference it

| Component | Type     | Responsibility     | Referenced By Stories | New/Existing        |
| --------- | -------- | ------------------ | --------------------- | ------------------- |
| {{name}}  | {{type}} | {{responsibility}} | #{{story_ids}}        | {{new_or_existing}} |

**Cross-Story Integration Points:**

- Aggregate all integration points from child DevelopmentSummary fields
- Identify integrations that span multiple stories
- Describe end-to-end data flows that cross story boundaries

**Design Decisions:**

- Aggregate architectural decisions from child wiki Decision Rationale sections
- Highlight decisions that affect multiple stories
- Note any conflicting approaches between stories and how they are reconciled

**Standards & Governance:**

- Aggregate applied standards from child solution designs
- List shared guardrails (governor limits, security, performance considerations)

**Epic-Specific Guidance:**

- Identify cross-feature shared components (components appearing in stories under different Features)
- Identify cross-feature integration points (data flows or APIs connecting components from different Features)
- Note which Feature each component originates from in the component table
- Call out components that are shared foundations across multiple Features -- these are critical path items

### Section 6: Implementation Considerations

**Audience:** Developer
**Purpose:** Provide guidance on implementation sequencing, shared concerns, and technical considerations that span stories.
**Tone:** Practical and advisory. Help developers understand the order of operations and shared concerns.

**Data Sources:**

- Child user story relations and dependencies (from ADO relations)
- Child wiki pages: Implementation sections
- Child user story `Custom.DevelopmentSummary` (dependency references)
- Child user story comments (may contain developer discussions about sequencing)

**Content Guide:**

- Identify user story sequencing based on technical dependencies
- Call out shared components that should be built first (foundation stories)
- Note standards and governance patterns that apply across all stories
- Identify shared configuration or metadata changes
- Highlight areas where developers working on different stories need to coordinate

**Epic-Specific Guidance:**

- Include inter-feature sequencing: which Features should be implemented first based on cross-feature dependencies
- Identify coordination points between teams working on different Features
- Call out shared infrastructure or configuration that must be in place before multiple Features can proceed

### Section 7: Testing Strategy Overview

**Audience:** Both
**Purpose:** Summarize the testing approach at the feature level, focusing on cross-story integration testing needs.
**Tone:** Structured and clear. Help both QA and business understand what will be validated and how.

**Data Sources:**

- Child wiki pages: Quality & Validation sections (test strategies, test data matrices, traceability)
- Child user story `Microsoft.VSTS.Common.AcceptanceCriteria` (aggregated AC themes)

**Content Guide:**

- Summarize the test approach per functional area (not per story)
- Identify cross-story integration testing needs (scenarios that span multiple stories)
- Call out shared test data requirements
- Highlight regression testing considerations
- Summarize the overall test coverage picture

**Epic-Specific Guidance:**

- Identify cross-feature integration testing needs (end-to-end scenarios spanning multiple Features)
- Note test sequencing aligned with Feature implementation order
- Call out shared test environments or test data that span Features

### Section 8: Risks and Dependencies

**Audience:** Both
**Purpose:** Aggregate and deduplicate risks from all child user stories, and identify feature-level risks that only emerge from the cross-story view.
**Tone:** Honest and actionable. Present risks with clear mitigations and owners.

**Data Sources:**

- Child wiki pages: Risk sections, Open Unknowns
- Child user story comments (may contain risk discussions)
- Child user story `Custom.DevelopmentSummary` (risk references)
- Feature `Microsoft.VSTS.Common.AcceptanceCriteria` (feature-level constraints)

**Content Guide:**

| Risk     | Source Stories | Likelihood     | Impact     | Mitigation     |
| -------- | -------------- | -------------- | ---------- | -------------- |
| {{risk}} | #{{story_ids}} | {{likelihood}} | {{impact}} | {{mitigation}} |

- Aggregate risks from all child wiki pages and deduplicate
- Identify cross-story risks (risks that only become visible at the feature level)
- List external dependencies (third-party systems, other teams, licensing)
- Document open unknowns that require human resolution
- Include assumptions that remain unvalidated across stories

**Epic-Specific Guidance:**

- Identify cross-feature risks (risks that emerge only when viewing the full epic scope)
- Note risks related to inter-feature dependencies and sequencing
- Aggregate external dependencies across all Features and deduplicate

### Section 9: Appendix - Per-Story Solution Details

**Audience:** Developer
**Purpose:** Provide a reference to each individual user story's solution design for developers who need story-level detail.
**Tone:** Reference material. Each entry should be concise with a link back to the source.

**Data Sources:**

- Each child user story `Custom.DevelopmentSummary` (full content)
- Each child wiki page URL

**Content Guide:**

- One collapsible section per user story
- Each section shows:
  - Story ID and title
  - State and tags
  - The full DevelopmentSummary content
  - Link to the story's wiki page
- Order by functional area grouping (matching Section 4)
- Use `<details>/<summary>` tags for collapsible content

**Epic-Specific Guidance:**

- Organize with a collapsible Feature section (`<details>/<summary>`) per Feature
- Within each Feature section, include collapsible per-story sections
- Each Feature section header shows Feature ID, title, and story count
- This creates a two-level collapsible structure: Feature -> Stories

## Template Filling Instructions

### For AI Agents

1. **Executive Summary:** Synthesize from the Feature/Epic's Description, Business Value, and Objectives fields. When Epic, list constituent Features. Add scope metrics from child story count.
2. **Current State:** Scan ALL child user story Descriptions and wiki Research sections across ALL Features for current-state references. Merge into a single end-to-end narrative.
3. **Future State:** Scan ALL child user story Descriptions (Goals) and wiki Solution Design sections across ALL Features. Merge into a single future-state narrative.
4. **Requirements Inventory:** Build the table from all child user stories. When Feature: group by functional area. When Epic: group by Feature first, then by functional area within each.
5. **Solution Architecture:** Aggregate ALL DevelopmentSummary fields across ALL Features. Build unified component table, identify shared components (including cross-feature shared components), merge integration points.
6. **Implementation Considerations:** Analyze dependencies between stories (and between Features when Epic). Identify foundation components and sequencing.
7. **Testing Strategy:** Aggregate wiki Testing sections. Identify cross-story and cross-feature integration test needs.
8. **Risks and Dependencies:** Aggregate and deduplicate risks from all wiki pages across ALL Features. Add feature-level and epic-level risks.
9. **Appendix:** When Feature: collapsible section per story. When Epic: collapsible Feature section containing collapsible story sections.

### Validation Checklist

- [ ] Executive Summary is jargon-free and understandable by business stakeholders
- [ ] Current State describes end-to-end processes, not individual story or feature contexts
- [ ] Future State clearly contrasts with Current State
- [ ] Requirements Inventory includes ALL child user stories across ALL Features
- [ ] Solution Architecture aggregates components across stories (and features), not per-story
- [ ] Shared components are identified and called out (including cross-feature shared components when Epic)
- [ ] Cross-story dependencies are documented (and cross-feature dependencies when Epic)
- [ ] Risks are deduplicated across stories and features
- [ ] Aggregate-level risks (visible only at feature/epic level) are identified
- [ ] All per-story details are in the Appendix, not mixed into main sections
- [ ] Narrative tone follows the "knowledgeable colleague" style from wiki-page-format.md
- [ ] Business sections lead with value/impact, not technical details
- [ ] Developer sections use collapsible details for deep-dive content
- [ ] When Epic: Requirements Inventory groups by Feature first, then by functional area
- [ ] When Epic: Appendix uses two-level collapsible structure (Feature -> Story)

### Writing Guidelines

Follow the narrative-first style from `wiki-page-format.md`:

- **Lead with narrative context** before presenting structured data
- **Business sections:** Frame in terms of people, processes, and outcomes
- **Technical sections:** Explain "why" alongside "how"
- **Use "we" language** to create partnership
- **Avoid unexplained jargon** -- define acronyms on first use
- **Use collapsible sections** (`<details>/<summary>`) for developer deep-dives within shared sections
- **Tables support the story** -- they are evidence, not the narrative itself
