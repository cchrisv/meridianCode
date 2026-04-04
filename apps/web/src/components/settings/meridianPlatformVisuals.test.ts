import { describe, expect, it } from "vitest";

import { formatPlatformLabel, resolvePlatformVisual } from "./meridianPlatformVisuals";

describe("formatPlatformLabel", () => {
  it("title-cases slug segments", () => {
    expect(formatPlatformLabel("crm")).toBe("CRM");
    expect(formatPlatformLabel("sales-cloud")).toBe("Sales Cloud");
    expect(formatPlatformLabel("foo_bar")).toBe("Foo Bar");
  });
});

describe("resolvePlatformVisual", () => {
  it("is stable for the same name", () => {
    const a = resolvePlatformVisual("acme-widget");
    const b = resolvePlatformVisual("acme-widget");
    expect(a.Icon).toBe(b.Icon);
    expect(a.paletteClass).toBe(b.paletteClass);
  });

  it("uses CRM override", () => {
    const v = resolvePlatformVisual("crm");
    expect(v.paletteClass).toContain("sky");
  });

  it("matches compound slug before segments", () => {
    const v = resolvePlatformVisual("contact-center");
    expect(v.paletteClass).toContain("sky");
  });

  it("matches segment inside hyphenated slug", () => {
    const m = resolvePlatformVisual("foo-marketing-bar");
    expect(m.paletteClass).toContain("cyan");
  });
});
