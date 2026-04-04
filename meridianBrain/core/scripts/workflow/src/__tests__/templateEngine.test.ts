/**
 * Template Engine Tests
 * Tests for scaffold generation, rendering, and validation.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  extractVariables,
  generateFillSpec,
  generatePhaseFillSpec,
  renderTemplate,
  validateRendered,
  listTemplates,
  getTemplateEntry,
  loadTemplateHtml,
  clearRegistryCache,
} from "../templateEngine.js";
import type { FillSlot } from "../types/templateTypes.js";
import { encodeNonAsciiToEntities } from "../templateRenderer.js";

beforeEach(() => {
  clearRegistryCache();
});

// ---------------------------------------------------------------------------
// Registry & Listing
// ---------------------------------------------------------------------------
describe("Registry", () => {
  it("should load the template registry", () => {
    const entry = getTemplateEntry("field-user-story-description");
    expect(entry).toBeDefined();
    expect(entry.file).toBe("field-user-story-description.html");
    expect(entry.phase).toBe("grooming");
    expect(entry.ado_field).toBe("System.Description");
  });

  it("should throw for unknown template key", () => {
    expect(() => getTemplateEntry("nonexistent-template")).toThrow(/not found in registry/);
  });

  it("should list templates by phase", () => {
    const grooming = listTemplates({ phase: "grooming" });
    const keys = Object.keys(grooming);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(grooming[key]!.phase).toBe("grooming");
    }
  });

  it("should list templates by work item type", () => {
    const bugTemplates = listTemplates({ workItemType: "Bug" });
    const keys = Object.keys(bugTemplates);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(bugTemplates[key]!.work_item_types).toContain("Bug");
    }
  });

  it("should filter by both phase and type", () => {
    const featureGrooming = listTemplates({ phase: "grooming", workItemType: "Feature" });
    const keys = Object.keys(featureGrooming);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      const entry = featureGrooming[key]!;
      expect(entry.phase).toBe("grooming");
      expect(entry.work_item_types).toContain("Feature");
    }
  });

  it("should default grooming User Story templates to functional routing", () => {
    const userStoryTemplates = listTemplates({ phase: "grooming", workItemType: "User Story" });
    expect(userStoryTemplates["field-user-story-description"]).toBeDefined();
    expect(userStoryTemplates["field-user-story-acceptance-criteria"]).toBeDefined();
    expect(userStoryTemplates["field-technical-description"]).toBeUndefined();
    expect(userStoryTemplates["field-technical-acceptance-criteria"]).toBeUndefined();
  });

  it("should filter grooming User Story templates by technical requirement type", () => {
    const technicalTemplates = listTemplates({
      phase: "grooming",
      workItemType: "User Story",
      requirementType: "technical",
    });
    expect(technicalTemplates["field-technical-description"]).toBeDefined();
    expect(technicalTemplates["field-technical-acceptance-criteria"]).toBeDefined();
    expect(technicalTemplates["field-user-story-description"]).toBeUndefined();
    expect(technicalTemplates["field-user-story-acceptance-criteria"]).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Variable Extraction
// ---------------------------------------------------------------------------
describe("extractVariables", () => {
  it("should extract simple variables", () => {
    const vars = extractVariables("<p>{{foo}} and {{bar}}</p>");
    expect(vars).toContain("foo");
    expect(vars).toContain("bar");
    expect(vars).toHaveLength(2);
  });

  it("should deduplicate variables", () => {
    const vars = extractVariables("{{x}} {{x}} {{y}}");
    expect(vars).toHaveLength(2);
  });

  it("should extract from actual template HTML", () => {
    const entry = getTemplateEntry("field-user-story-description");
    const html = loadTemplateHtml(entry);
    const vars = extractVariables(html);
    expect(vars).toContain("what_text");
    expect(vars).toContain("why_text");
  });

  it("should return empty for HTML with no tokens", () => {
    const vars = extractVariables("<div>No tokens here</div>");
    expect(vars).toHaveLength(0);
  });

  it("should filter out Nunjucks expressions (function calls, dot access, filters)", () => {
    const html =
      '{{ gradientHeader("Title", "#fff") }} {{ scenario.title }} {{ name | safe }} {{ simple_var }}';
    const vars = extractVariables(html);
    expect(vars).toContain("simple_var");
    expect(vars).not.toContain('gradientHeader("Title", "#fff")');
    expect(vars).not.toContain("scenario.title");
    expect(vars).not.toContain("name | safe");
    expect(vars).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Fill Spec Generation (scaffold)
// ---------------------------------------------------------------------------
describe("generateFillSpec", () => {
  it("should generate a fill spec for user story description", () => {
    const spec = generateFillSpec("field-user-story-description");
    expect(spec.template).toBe("field-user-story-description");
    expect(spec.ado_field).toBe("System.Description");
    expect(spec.phase).toBe("grooming");
    expect(spec.slots).toBeDefined();
    expect(spec.slots["what_text"]).toBeDefined();
    expect(spec.slots["what_text"]!.type).toBe("text");
    expect(spec.slots["what_text"]!.required).toBe(true);
    expect(spec.slots["what_text"]!.value).toBeNull();
    expect(spec.slots["why_text"]).toBeDefined();
    expect(spec.slots["unknowns"]).toBeDefined();
    expect(spec.slots["unknowns"]!.type).toBe("list");
    expect(spec.slots["unknowns"]!.required).toBe(false);
  });

  it("should include block variable definitions for Done When items", () => {
    const spec = generateFillSpec("field-user-story-acceptance-criteria");
    const dw = spec.slots["done_when_items"];
    expect(dw).toBeDefined();
    expect(dw!.type).toBe("repeatable_block");
    expect(dw!.block_variables).toBeDefined();
    expect(dw!.block_variables!["assertion"]).toBeDefined();
    expect(dw!.block_variables!["group_label"]).toBeDefined();
    expect(dw!.blocks).toEqual([]);
  });

  it("should apply prefill values", () => {
    const spec = generateFillSpec("field-user-story-description", {
      what_text: "Deliver filter UX",
      unknowns: ["Who owns policy X?"],
    });
    expect(spec.slots["what_text"]!.value).toBe("Deliver filter UX");
    expect(spec.slots["unknowns"]!.items).toEqual(["Who owns policy X?"]);
  });
});

describe("generatePhaseFillSpec", () => {
  it("should generate specs for all grooming User Story templates", () => {
    const phase = generatePhaseFillSpec("grooming", "User Story", "12345");
    expect(phase.phase).toBe("grooming");
    expect(phase.work_item_type).toBe("User Story");
    expect(phase.requirement_type).toBe("functional");
    expect(phase.work_item_id).toBe("12345");
    expect(Object.keys(phase.templates).length).toBeGreaterThan(0);
    expect(phase.templates["field-user-story-description"]).toBeDefined();
    expect(phase.templates["field-user-story-acceptance-criteria"]).toBeDefined();
    expect(phase.templates["field-technical-description"]).toBeUndefined();
  });

  it("should generate specs for grooming technical User Story templates", () => {
    const phase = generatePhaseFillSpec("grooming", "User Story", "12345", undefined, "technical");
    expect(phase.requirement_type).toBe("technical");
    expect(phase.templates["field-technical-description"]).toBeDefined();
    expect(phase.templates["field-technical-acceptance-criteria"]).toBeDefined();
    expect(phase.templates["field-user-story-description"]).toBeUndefined();
    expect(phase.templates["field-user-story-acceptance-criteria"]).toBeUndefined();
  });

  it("should generate specs for grooming Bug templates", () => {
    const phase = generatePhaseFillSpec("grooming", "Bug", "99999");
    expect(phase.templates["field-bug-description"]).toBeDefined();
    expect(phase.templates["field-bug-acceptance-criteria"]).toBeDefined();
    expect(phase.templates["field-bug-repro-steps"]).toBeDefined();
    expect(phase.templates["field-bug-system-info"]).toBeDefined();
    // Should NOT include user story templates
    expect(phase.templates["field-user-story-description"]).toBeUndefined();
  });

  it("should generate specs for solutioning templates (all types)", () => {
    const phase = generatePhaseFillSpec("solutioning", "User Story", "12345");
    expect(phase.templates["field-solution-design"]).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
describe("renderTemplate", () => {
  it("should render simple text slots", () => {
    const slots: Record<string, FillSlot> = {
      bug_summary_description: {
        variable: "bug_summary_description",
        type: "text",
        required: true,
        hint: "",
        value: "A test bug summary",
        items: [],
        rows: [],
      },
      expected_behavior: {
        variable: "expected_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "It should work",
        items: [],
        rows: [],
      },
      actual_behavior: {
        variable: "actual_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "It does not work",
        items: [],
        rows: [],
      },
      business_impact: {
        variable: "business_impact",
        type: "text",
        required: true,
        hint: "",
        value: "Users are blocked",
        items: [],
        rows: [],
      },
      affected_functionality: {
        variable: "affected_functionality",
        type: "text",
        required: true,
        hint: "",
        value: "Login page",
        items: [],
        rows: [],
      },
    };

    const result = renderTemplate("field-bug-description", slots);
    expect(result.success).toBe(true);
    expect(result.html).toContain("A test bug summary");
    expect(result.html).toContain("It should work");
    expect(result.html).toContain("It does not work");
    expect(result.html).toContain("Users are blocked");
    expect(result.html).toContain("Login page");
    expect(result.html).not.toContain("{{");
    expect(result.slots_filled).toBe(5);
    expect(result.slots_missing).toBe(0);
  });

  it("should report missing required slots", () => {
    const slots: Record<string, FillSlot> = {
      bug_summary_description: {
        variable: "bug_summary_description",
        type: "text",
        required: true,
        hint: "",
        value: "Partial fill",
        items: [],
        rows: [],
      },
    };

    const result = renderTemplate("field-bug-description", slots);
    expect(result.success).toBe(false);
    expect(result.slots_missing).toBeGreaterThan(0);
    expect(result.missing_slots.length).toBeGreaterThan(0);
  });

  it("should escape HTML in text slots", () => {
    const slots: Record<string, FillSlot> = {
      bug_summary_description: {
        variable: "bug_summary_description",
        type: "text",
        required: true,
        hint: "",
        value: 'XSS attempt: <script>alert("xss")</script>',
        items: [],
        rows: [],
      },
      expected_behavior: {
        variable: "expected_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "safe",
        items: [],
        rows: [],
      },
      actual_behavior: {
        variable: "actual_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "safe",
        items: [],
        rows: [],
      },
      business_impact: {
        variable: "business_impact",
        type: "text",
        required: true,
        hint: "",
        value: "safe",
        items: [],
        rows: [],
      },
      affected_functionality: {
        variable: "affected_functionality",
        type: "text",
        required: true,
        hint: "",
        value: "safe",
        items: [],
        rows: [],
      },
    };

    const result = renderTemplate("field-bug-description", slots);
    expect(result.html).not.toContain("<script>");
    expect(result.html).toContain("&lt;script&gt;");
  });

  it('should strip "Add more" comments', () => {
    const result = renderTemplate("field-bug-description", {
      bug_summary_description: {
        variable: "bug_summary_description",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      expected_behavior: {
        variable: "expected_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      actual_behavior: {
        variable: "actual_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      business_impact: {
        variable: "business_impact",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      affected_functionality: {
        variable: "affected_functionality",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
    });
    expect(result.html).not.toMatch(/<!--\s*Add more/i);
  });
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
describe("validateRendered", () => {
  it("should pass for fully rendered bug description", () => {
    const slots: Record<string, FillSlot> = {
      bug_summary_description: {
        variable: "bug_summary_description",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      expected_behavior: {
        variable: "expected_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      actual_behavior: {
        variable: "actual_behavior",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      business_impact: {
        variable: "business_impact",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
      affected_functionality: {
        variable: "affected_functionality",
        type: "text",
        required: true,
        hint: "",
        value: "test",
        items: [],
        rows: [],
      },
    };
    const rendered = renderTemplate("field-bug-description", slots);
    const validation = validateRendered("field-bug-description", rendered.html);

    expect(validation.valid).toBe(true);
    expect(validation.checks.no_unfilled_tokens).toBe(true);
    expect(validation.checks.sections_present).toBe(true);
    expect(validation.checks.gradients_intact).toBe(true);
  });

  it("should fail when unfilled tokens remain", () => {
    const entry = getTemplateEntry("field-bug-description");
    const rawHtml = loadTemplateHtml(entry);
    const validation = validateRendered("field-bug-description", rawHtml);

    expect(validation.valid).toBe(false);
    expect(validation.checks.no_unfilled_tokens).toBe(false);
    expect(validation.issues.some((i) => i.code === "UNFILLED_TOKEN")).toBe(true);
  });

  it("should fail when gradients are stripped", () => {
    const validation = validateRendered("field-bug-description", "<div>No styles at all</div>");
    expect(validation.checks.gradients_intact).toBe(false);
  });

  it("should not false-warn about extra sections for macro-based templates", () => {
    // Templates using gradientHeader() macros have 0 inline linear-gradient
    // but rendered output has many — the check must count macro calls as expected gradients
    const spec = generateFillSpec("field-user-story-description");
    for (const [, slot] of Object.entries(spec.slots)) {
      if (slot.type === "text") slot.value = "test";
      if (slot.type === "list") slot.items = ["item1"];
      if (slot.type === "table")
        slot.rows = [Object.fromEntries((slot.columns ?? []).map((c) => [c.key, "test"]))];
    }
    const rendered = renderTemplate("field-user-story-description", spec.slots);
    const validation = validateRendered("field-user-story-description", rendered.html);

    expect(validation.checks.no_extra_sections).toBe(true);
    expect(validation.issues.filter((i) => i.code === "EXTRA_SECTIONS")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Repeatable Block Rendering (nested-div regression tests)
// ---------------------------------------------------------------------------
describe("renderTemplate repeatable_block", () => {
  it("should render user-story Done When with grouped assertions", () => {
    const spec = generateFillSpec("field-user-story-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [
          {
            group_label: "Expected behavior",
            assertion:
              "When the advisor applies the Active filter, only active students are listed and the result count matches the filtered set.",
          },
          {
            group_label: "",
            assertion:
              "When no inactive records exist and the advisor applies the Inactive filter, the page shows an empty state and no student rows.",
          },
          {
            group_label: "Regression",
            assertion:
              "After saving a record from the filtered list, the list refreshes and the post-save confirmation remains visible.",
          },
        ],
      },
    };
    const result = renderTemplate("field-user-story-acceptance-criteria", filledSlots);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("Done When");
    expect(result.html).toContain("Expected behavior");
    expect(result.html).toContain("When the advisor applies the Active filter");
    expect(result.html).toContain("empty state");
    expect(result.warnings.filter((w) => w.includes("remains after"))).toHaveLength(0);

    const validation = validateRendered("field-user-story-acceptance-criteria", result.html);
    expect(validation.valid).toBe(true);
    expect(validation.checks.no_unfilled_tokens).toBe(true);
  });

  it("should render many Done When lines in one section", () => {
    const spec = generateFillSpec("field-user-story-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [
          {
            group_label: "Expected behavior",
            assertion:
              "Email notifications can be enabled and the confirmation states Email notifications updated.",
          },
          {
            group_label: "",
            assertion:
              "SMS can be enabled when a verified phone exists; SMS shows as enabled after save.",
          },
          {
            group_label: "Boundaries",
            assertion:
              "Without a verified phone, enabling SMS is blocked with Verify your phone number before enabling SMS.",
          },
          {
            group_label: "Error handling",
            assertion:
              "Mandatory notification types cannot be disabled; the page explains the requirement.",
          },
          {
            group_label: "Regression",
            assertion: "After save, downstream sync reflects the latest preference set.",
          },
          {
            group_label: "",
            assertion:
              "Advisors see communication preferences read-only with Students manage their own communication preferences.",
          },
        ],
      },
    };
    const result = renderTemplate("field-user-story-acceptance-criteria", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain("Students manage their own communication preferences");
    expect(result.html).toContain("Verify your phone number before enabling SMS");
    expect((result.html.match(/list-style: disc/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("should render technical Done When with measurable assertions", () => {
    const spec = generateFillSpec("field-technical-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [
          {
            group_label: "Happy path",
            assertion:
              "After two HTTP 503 responses, the third retry succeeds and the job completes in under 5 seconds total.",
          },
          {
            group_label: "Error handling",
            assertion:
              "When every attempt returns HTTP 400, the job stops retrying, logs ERROR with the payload reference, and marks the update failed.",
          },
          {
            group_label: "Boundaries",
            assertion:
              "A single queued contact update completes without bulk-only branches and the payload shape is unchanged.",
          },
          {
            group_label: "Regression",
            assertion:
              "Success responses match the pre-change contract with no breaking field changes.",
          },
        ],
      },
    };
    const result = renderTemplate("field-technical-acceptance-criteria", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain("Done When");
    expect(result.html).toContain("logs ERROR with the payload reference");
    expect(result.html).toContain("pre-change contract");
    expect(result.html).toContain("#172A3A");
    expect(result.html).toContain("#004346");
  });

  it("should keep acceptance criteria templates free of flex-gap layout and legacy scenario token punctuation", () => {
    const userStoryAcHtml = loadTemplateHtml(
      getTemplateEntry("field-user-story-acceptance-criteria"),
    );
    expect(userStoryAcHtml).not.toContain("display: flex");
    expect(userStoryAcHtml).not.toContain("gap: 8px");
    expect(userStoryAcHtml).not.toContain("{{scenario_1_given}},");
    expect(userStoryAcHtml).not.toContain("{{scenario_1_when}},");
    expect(userStoryAcHtml).not.toContain("{{scenario_1_then}}.");

    const technicalAcHtml = loadTemplateHtml(
      getTemplateEntry("field-technical-acceptance-criteria"),
    );
    expect(technicalAcHtml).not.toContain("display: flex");
    expect(technicalAcHtml).not.toContain("gap: 8px");
    expect(technicalAcHtml).not.toContain("{{scenario_1_given}},");
    expect(technicalAcHtml).not.toContain("{{scenario_1_when}},");
    expect(technicalAcHtml).not.toContain("{{scenario_1_then}}.");
    expect(technicalAcHtml).toContain("Done When");
    expect(technicalAcHtml).toContain("#172A3A");
    expect(technicalAcHtml).toContain("#004346");

    const featureAcHtml = loadTemplateHtml(getTemplateEntry("field-feature-acceptance-criteria"));
    expect(featureAcHtml).not.toContain("display: flex");
    expect(featureAcHtml).not.toContain("gap: 8px");
    expect(featureAcHtml).not.toContain("{{success_indicator_1_given}},");
    expect(featureAcHtml).not.toContain("{{success_indicator_1_when}},");
    expect(featureAcHtml).not.toContain("{{success_indicator_1_then}}.");
    expect(featureAcHtml).toContain("Success Indicator");
    expect(featureAcHtml).toContain("#DA3E52");
    expect(featureAcHtml).toContain("#6D1A36");

    const userStoryDescriptionHtml = loadTemplateHtml(
      getTemplateEntry("field-user-story-description"),
    );
    expect(userStoryDescriptionHtml).not.toContain("{{persona}},");
    expect(userStoryDescriptionHtml).not.toContain("{{action}},");
    expect(userStoryDescriptionHtml).not.toContain("{{business_value}}.");
  });

  it("should use the requested palette and Modern Work Item headers for technical description templates", () => {
    const technicalDescriptionHtml = loadTemplateHtml(
      getTemplateEntry("field-technical-description"),
    );
    expect(technicalDescriptionHtml).toContain("🛠️ TECHNICAL REQUIREMENT");
    expect(technicalDescriptionHtml).toContain('"What"');
    expect(technicalDescriptionHtml).toContain('"🧭"');
    expect(technicalDescriptionHtml).toContain('"Why"');
    expect(technicalDescriptionHtml).toContain('"📈"');
    expect(technicalDescriptionHtml).toContain('"Unknowns"');
    expect(technicalDescriptionHtml).toContain("#508991");
    expect(technicalDescriptionHtml).toContain("#172A3A");
    expect(technicalDescriptionHtml).toContain("#004346");
  });

  it("should render technical Done When assertion text verbatim (no double punctuation added by template)", () => {
    const spec = generateFillSpec("field-technical-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [
          {
            group_label: "Scope",
            assertion:
              "When the in-scope Journey Pipeline V3 path is invoked, and the job is exercised under supported conditions,",
          },
          {
            group_label: "",
            assertion:
              "the handoff completes and preserves compatibility with Enable V3 & Shadow Validation.",
          },
          {
            group_label: "Metrics",
            assertion:
              "Processing stays within stated governor targets for the reference batch size.",
          },
        ],
      },
    };

    const result = renderTemplate("field-technical-acceptance-criteria", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain("supported conditions,");
    expect(result.html).not.toContain("supported conditions,,");
    expect(result.html).toContain("Shadow Validation.");
    expect(result.html).not.toContain("Shadow Validation..");
  });

  it("should render functional User Story description with What and Why sections", () => {
    const spec = generateFillSpec("field-user-story-description");
    const filledSlots: Record<string, FillSlot> = {
      what_text: {
        ...spec.slots["what_text"]!,
        value: "Advisors can filter student contacts by enrollment status.",
      },
      why_text: {
        ...spec.slots["why_text"]!,
        value: "Reduces time-to-call for outreach campaigns during peak periods.",
      },
      unknowns: { ...spec.slots["unknowns"]!, items: ["Confirm policy for archived students."] },
    };
    const result = renderTemplate("field-user-story-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("What");
    expect(result.html).toContain("Why");
    expect(result.html).toContain("Unknowns");
    expect(result.html).toContain("Advisors can filter");
    expect(result.html).toContain("archived students");

    const validation = validateRendered("field-user-story-description", result.html);
    expect(validation.valid).toBe(true);
  });

  it("should render feature acceptance criteria with all block variables", () => {
    const spec = generateFillSpec("field-feature-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      success_indicators: {
        ...spec.slots["success_indicators"]!,
        blocks: [
          {
            title: "Core Capability",
            given: "system configured",
            when: "pipeline runs",
            then: "95% accuracy",
          },
          {
            title: "Data Quality",
            given: "source data loaded",
            when: "validation runs",
            then: "zero critical errors",
          },
          {
            title: "Performance",
            given: "peak load",
            when: "batch executes",
            then: "completes in 30 min",
          },
        ],
      },
    };
    const result = renderTemplate("field-feature-acceptance-criteria", filledSlots);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("system configured");
    expect(result.html).toContain("pipeline runs");
    expect(result.html).toContain("95% accuracy");
    expect(result.html).toContain("zero critical errors");
    expect(result.html).toContain("completes in 30 min");
    expect(result.html.match(/>Success Indicator<\/span>/g)?.length).toBe(3);
    expect(result.html.match(/Feature-level outcome/g)?.length).toBe(3);

    const validation = validateRendered("field-feature-acceptance-criteria", result.html);
    expect(validation.valid).toBe(true);
  });

  it("should render feature description with all block variables", () => {
    const spec = generateFillSpec("field-feature-description");
    const filledSlots: Record<string, FillSlot> = {
      feature_summary: {
        ...spec.slots["feature_summary"]!,
        value:
          "Affiliate vendor leads move from a legacy API to the enterprise integration platform.",
      },
      persona: {
        ...spec.slots["persona"]!,
        value: "UMGC Admissions Advisor",
      },
      high_level_capability: {
        ...spec.slots["high_level_capability"]!,
        value: "have affiliate vendor leads routed automatically through standard assignment rules",
      },
      strategic_business_outcome: {
        ...spec.slots["strategic_business_outcome"]!,
        value: "I can contact prospects without waiting for manual reassignment jobs",
      },
      value_items: {
        ...spec.slots["value_items"]!,
        blocks: [
          {
            category: "Eliminate Manual Processing",
            description: "Remove scheduled reassignment work.",
          },
          { category: "Faster Lead Response", description: "Assign vendor leads within minutes." },
          {
            category: "Improved Student Engagement",
            description: "Support faster follow-up with prospects.",
          },
        ],
      },
      business_assumptions: {
        ...spec.slots["business_assumptions"]!,
        items: [
          "The enterprise Lead API is production-ready.",
          "Vendors can migrate in phases.",
          "Daily lead volume will stay within expected limits.",
        ],
      },
    };

    const result = renderTemplate("field-feature-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("UMGC Admissions Advisor");
    expect(result.html).toContain("Eliminate Manual Processing");
    expect(result.html).toContain("Faster Lead Response");
    expect(result.html).toContain("Improved Student Engagement");

    const validation = validateRendered("field-feature-description", result.html);
    expect(validation.valid).toBe(true);
  });

  it("should render feature business value with all block variables", () => {
    const spec = generateFillSpec("field-feature-business-value");
    const filledSlots: Record<string, FillSlot> = {
      value_items: {
        ...spec.slots["value_items"]!,
        blocks: [
          {
            category: "Delayed Lead Assignment",
            description: "Manual processing delays prospect follow-up.",
          },
          {
            category: "Security Vulnerability",
            description: "The legacy API uses static credentials.",
          },
          {
            category: "Scalability Limitations",
            description: "New vendors require custom coordination.",
          },
        ],
      },
    };

    const result = renderTemplate("field-feature-business-value", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("Delayed Lead Assignment");
    expect(result.html).toContain("Security Vulnerability");
    expect(result.html).toContain("Scalability Limitations");

    const validation = validateRendered("field-feature-business-value", result.html);
    expect(validation.valid).toBe(true);
  });

  it("should render feature objectives with all block variables", () => {
    const spec = generateFillSpec("field-feature-objectives");
    const filledSlots: Record<string, FillSlot> = {
      objectives: {
        ...spec.slots["objectives"]!,
        blocks: [
          { title: "Foundation Objective", description: "Establish core data pipeline" },
          { title: "Visibility Objective", description: "Real-time dashboards for stakeholders" },
          { title: "Quality Objective", description: "Automated validation reduces errors by 40%" },
        ],
      },
    };
    const result = renderTemplate("field-feature-objectives", filledSlots);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("Foundation Objective");
    expect(result.html).toContain("Establish core data pipeline");
    expect(result.html).toContain("Real-time dashboards for stakeholders");
    expect(result.html).toContain("Automated validation reduces errors by 40%");

    const validation = validateRendered("field-feature-objectives", result.html);
    expect(validation.valid).toBe(true);
  });

  it("should render blockers critical_blockers with all block variables", () => {
    const spec = generateFillSpec("field-blockers");
    const filledSlots: Record<string, FillSlot> = {
      blocker_count: { ...spec.slots["blocker_count"]!, value: "2" },
      escalation_summary: {
        ...spec.slots["escalation_summary"]!,
        value: "Two items need leadership attention",
      },
      critical_blockers: {
        ...spec.slots["critical_blockers"]!,
        blocks: [
          {
            work_item_id: "12345",
            title: "Auth blocked",
            description: "SSO config pending",
            impact: "Blocks all login work",
            target_date: "2025-02-01",
            target_date_status: "5 days overdue",
            days_stalled: "12",
          },
          {
            work_item_id: "12346",
            title: "API timeout",
            description: "External API down",
            impact: "Integration stalled",
            target_date: "2025-02-15",
            target_date_status: "On track",
            days_stalled: "3",
          },
        ],
      },
      medium_dependencies: { ...spec.slots["medium_dependencies"]!, blocks: [] },
      risks: { ...spec.slots["risks"]!, blocks: [] },
      resolved_items: { ...spec.slots["resolved_items"]!, blocks: [] },
      leadership_ask_text: {
        ...spec.slots["leadership_ask_text"]!,
        value: "Escalate SSO config to vendor",
      },
    };
    const result = renderTemplate("field-blockers", filledSlots);
    expect(result.html).toContain("SSO config pending");
    expect(result.html).toContain("Blocks all login work");
    expect(result.html).toContain("12 days");
    expect(result.html).toContain("External API down");
    expect(result.html).toContain("Integration stalled");
    // No critical_blocker tokens should remain
    expect(result.html).not.toContain("{{blocker_");
  });

  it("should render progress weeks with all block variables", () => {
    const spec = generateFillSpec("field-progress");
    const filledSlots: Record<string, FillSlot> = {
      completion_percent: { ...spec.slots["completion_percent"]!, value: "45" },
      completed_count: { ...spec.slots["completed_count"]!, value: "27" },
      total_count: { ...spec.slots["total_count"]!, value: "60" },
      update_date: { ...spec.slots["update_date"]!, value: "Jun 18, 2025" },
      overall_status_summary: {
        ...spec.slots["overall_status_summary"]!,
        value: "Steady progress across all workstreams.",
      },
      window_start: { ...spec.slots["window_start"]!, value: "05/07/2025" },
      window_end: { ...spec.slots["window_end"]!, value: "06/18/2025" },
      weeks: {
        ...spec.slots["weeks"]!,
        blocks: [
          {
            start: "06/16",
            end: "06/18",
            narrative: "Auth sprint completed",
            activities: "<ul><li>Closed 3 stories</li></ul>",
          },
          {
            start: "06/09",
            end: "06/15",
            narrative: "Testing focus week",
            activities: "<ul><li>QA started</li></ul>",
          },
          {
            start: "06/02",
            end: "06/08",
            narrative: "Dev ramp-up",
            activities: "<ul><li>Sprint planning</li></ul>",
          },
        ],
      },
      leadership_helped_text: {
        ...spec.slots["leadership_helped_text"]!,
        value: "Removed procurement blocker",
      },
      support_needed_text: { ...spec.slots["support_needed_text"]!, value: "No immediate needs" },
    };
    const result = renderTemplate("field-progress", filledSlots);
    expect(result.html).toContain("Auth sprint completed");
    expect(result.html).toContain("Closed 3 stories");
    expect(result.html).toContain("Testing focus week");
    expect(result.html).toContain("QA started");
    expect(result.html).toContain("Dev ramp-up");
    // No week tokens should remain
    expect(result.html).not.toContain("{{week_");
  });

  it("should render a minimal Done When set (three assertions) without leftover tokens", () => {
    const spec = generateFillSpec("field-user-story-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [
          {
            group_label: "Happy path",
            assertion: "Given preconditions, the primary action succeeds.",
          },
          {
            group_label: "Edge",
            assertion: "Boundary inputs are rejected or normalized as specified.",
          },
          {
            group_label: "Regression",
            assertion: "Existing dependent behavior still works after the change.",
          },
        ],
      },
    };
    const result = renderTemplate("field-user-story-acceptance-criteria", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).not.toContain("{{");
    expect(result.html).toContain("Given preconditions");
  });

  it("should fail when required Done When items are empty", () => {
    const spec = generateFillSpec("field-user-story-acceptance-criteria");
    const filledSlots: Record<string, FillSlot> = {
      done_when_items: {
        ...spec.slots["done_when_items"]!,
        blocks: [],
      },
    };
    const result = renderTemplate("field-user-story-acceptance-criteria", filledSlots);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Integration: scaffold → fill → render → validate loop
// ---------------------------------------------------------------------------
describe("Full scaffold→fill→render→validate loop", () => {
  it("should work end-to-end for solution design", () => {
    // Step 1: Scaffold
    const spec = generateFillSpec("field-solution-design");
    expect(spec.slots["overview"]).toBeDefined();
    expect(spec.slots["components"]).toBeDefined();

    // Step 2: Fill (simulate AI output)
    const filledSlots: Record<string, FillSlot> = {
      overview: {
        ...spec.slots["overview"]!,
        value:
          '<p style="margin:0 0 12px 0;">We are adding retry logic to the login flow so users can successfully log in after a password reset.</p><div style="font-weight:600;color:#495057;margin:16px 0 8px 0;">Why This Approach</div><p style="margin:0 0 12px 0;">We chose to extend the existing authentication service with retry logic rather than replacing the login flow.</p>',
      },
      ac_mapping: {
        ...spec.slots["ac_mapping"]!,
        rows: [
          {
            ac_id: "AC-1",
            criterion: "User can log in after password reset",
            how_addressed: "Retry logic handles transient auth failures automatically",
          },
        ],
      },
      legacy_analysis: {
        ...spec.slots["legacy_analysis"]!,
        value:
          '<div style="font-weight:600;color:#495057;margin-bottom:8px;">1. Session Timeout Not Handled</div><p style="margin:0 0 12px 0;">Current code does not retry on session expiry, causing silent failures.</p>',
      },
      solution_approach: {
        ...spec.slots["solution_approach"]!,
        value:
          '<div style="font-weight:600;color:#495057;margin-bottom:8px;">Architecture Overview</div><p style="margin:0 0 12px 0;">The solution uses a 3-retry mechanism with exponential backoff.</p><div style="font-weight:600;color:#495057;margin-bottom:8px;">Component 1: AuthService — Retry Mechanism</div><p style="margin:0 0 12px 0;">Method: <code>retryAuth(Integer maxAttempts)</code>, CC target &lt;5.</p><div style="font-weight:600;color:#303f9f;margin-bottom:8px;font-size:14px;">Phase 1: Core Logic</div><p style="margin:0 0 8px 0;"><strong>Goal:</strong> Implement retry mechanism</p><ol style="margin:0 0 12px 0;padding-left:20px;"><li>Add retry to AuthService</li><li>Write unit tests</li></ol>',
      },
      components: {
        ...spec.slots["components"]!,
        rows: [
          {
            name: "AuthService",
            type: "Apex Class",
            responsibility: "Handles login retry logic with exponential backoff",
          },
          {
            name: "LoginController",
            type: "LWC",
            responsibility: "Provides the user interface for the login flow",
          },
        ],
      },
      integrations: {
        ...spec.slots["integrations"]!,
        value: "Integrates with SSO provider via SAML for federated authentication",
      },
      standards: {
        ...spec.slots["standards"]!,
        rows: [
          {
            standard: "Apex Well-Architected",
            how_applied: "with sharing, PascalCase class, input validation",
          },
          { standard: "Code Complexity", how_applied: "CC <10 per method, nesting ≤3 levels" },
        ],
      },
      risks: {
        ...spec.slots["risks"]!,
        rows: [
          {
            risk: "SSO provider rate limiting",
            mitigation: "Exponential backoff with max 3 retries per user",
          },
        ],
      },
    };

    // Step 3: Render
    const result = renderTemplate("field-solution-design", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain("retry logic");
    expect(result.html).toContain("AuthService");
    expect(result.html).toContain("LoginController");
    expect(result.html).toContain("linear-gradient");
    expect(result.html).toContain("Phase 1: Core Logic");
    expect(result.html).toContain("AC-1");
    expect(result.html).toContain("Session Timeout");
    expect(result.html).toContain("Apex Well-Architected");
    expect(result.html).toContain("SSO provider rate limiting");

    // Step 4: Validate
    const validation = validateRendered("field-solution-design", result.html);
    expect(validation.valid).toBe(true);
    expect(validation.checks.no_unfilled_tokens).toBe(true);
    expect(validation.checks.sections_present).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Emoji & Unicode Handling
// ---------------------------------------------------------------------------
describe("Emoji and Unicode handling", () => {
  it("should preserve emojis in text slot values", () => {
    const spec = generateFillSpec("field-bug-description");
    const filledSlots: Record<string, FillSlot> = {
      bug_summary_description: {
        ...spec.slots["bug_summary_description"]!,
        value: "🐛 Bug in login flow",
      },
      expected_behavior: {
        ...spec.slots["expected_behavior"]!,
        value: "✅ User logs in successfully",
      },
      actual_behavior: { ...spec.slots["actual_behavior"]!, value: "❌ 500 error on submit" },
      business_impact: {
        ...spec.slots["business_impact"]!,
        value: "🚨 Critical - blocks all users",
      },
      affected_functionality: {
        ...spec.slots["affected_functionality"]!,
        value: "🔐 Authentication module",
      },
    };

    const result = renderTemplate("field-bug-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain(encodeNonAsciiToEntities("🐛 Bug in login flow"));
    expect(result.html).toContain(encodeNonAsciiToEntities("✅ User logs in successfully"));
    expect(result.html).toContain(encodeNonAsciiToEntities("❌ 500 error on submit"));
    expect(result.html).toContain(encodeNonAsciiToEntities("🚨 Critical - blocks all users"));
    expect(result.html).toContain(encodeNonAsciiToEntities("🔐 Authentication module"));
  });

  it("should preserve emojis in list items", () => {
    const spec = generateFillSpec("field-bug-description");
    const filledSlots: Record<string, FillSlot> = {
      bug_summary_description: { ...spec.slots["bug_summary_description"]!, value: "Summary" },
      expected_behavior: { ...spec.slots["expected_behavior"]!, value: "Works" },
      actual_behavior: { ...spec.slots["actual_behavior"]!, value: "Broken" },
      business_impact: { ...spec.slots["business_impact"]!, value: "High" },
      affected_functionality: { ...spec.slots["affected_functionality"]!, value: "Login" },
    };
    // If the template has list slots, fill them with emojis
    for (const [key, slot] of Object.entries(filledSlots)) {
      if (slot.type === "list") {
        slot.items = ["🔴 First item", "🟡 Second item", "🟢 Third item"];
      }
    }

    const result = renderTemplate("field-bug-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).not.toContain("{{");
  });

  it("should preserve multi-codepoint emojis (flags, skin tones, ZWJ sequences)", () => {
    const spec = generateFillSpec("field-bug-description");
    const filledSlots: Record<string, FillSlot> = {
      bug_summary_description: {
        ...spec.slots["bug_summary_description"]!,
        value: "👨‍💻 Developer reported issue",
      },
      expected_behavior: { ...spec.slots["expected_behavior"]!, value: "🇺🇸 US locale works" },
      actual_behavior: { ...spec.slots["actual_behavior"]!, value: "👍🏽 Thumbs up with skin tone" },
      business_impact: { ...spec.slots["business_impact"]!, value: "🏳️‍🌈 Diversity flag test" },
      affected_functionality: {
        ...spec.slots["affected_functionality"]!,
        value: "🧑‍🤝‍🧑 People holding hands",
      },
    };

    const result = renderTemplate("field-bug-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain(encodeNonAsciiToEntities("👨‍💻 Developer reported issue"));
    expect(result.html).toContain(encodeNonAsciiToEntities("🇺🇸 US locale works"));
    expect(result.html).toContain(encodeNonAsciiToEntities("👍🏽 Thumbs up with skin tone"));
    expect(result.html).toContain(encodeNonAsciiToEntities("🏳️‍🌈 Diversity flag test"));
    expect(result.html).toContain(encodeNonAsciiToEntities("🧑‍🤝‍🧑 People holding hands"));
  });

  it("should preserve emojis through full scaffold→render→validate cycle", () => {
    const spec = generateFillSpec("field-user-story-description");
    const filledSlots: Record<string, FillSlot> = {};
    for (const [key, slot] of Object.entries(spec.slots)) {
      filledSlots[key] = { ...slot };
      if (slot.type === "text") {
        filledSlots[key]!.value = `⚙️ Test value for ${key}`;
      } else if (slot.type === "list") {
        filledSlots[key]!.items = ["📋 Item 1", "📋 Item 2"];
      } else if (slot.type === "table" && slot.columns) {
        filledSlots[key]!.rows = [
          slot.columns.reduce(
            (r, c) => ({ ...r, [c.key]: `🔧 ${c.key}` }),
            {} as Record<string, string>,
          ),
        ];
      } else if (slot.type === "repeatable_block" && slot.block_variables) {
        filledSlots[key]!.blocks = [
          Object.fromEntries(Object.keys(slot.block_variables).map((v) => [v, `🛠️ ${v}`])),
        ];
      }
    }

    const result = renderTemplate("field-user-story-description", filledSlots);
    expect(result.success).toBe(true);
    expect(result.html).toContain(encodeNonAsciiToEntities("⚙️"));

    const validation = validateRendered("field-user-story-description", result.html);
    expect(validation.valid).toBe(true);
  });
});
