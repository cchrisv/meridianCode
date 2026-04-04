import { describe, expect, it } from "vitest";

import { APP_BASE_NAME, appDisplayName } from "./branding";

describe("branding", () => {
  it("uses the public product name", () => {
    expect(APP_BASE_NAME).toBe("Meridian Code");
  });

  it("formats display names with stage", () => {
    expect(appDisplayName(true)).toBe("Meridian Code (Dev)");
    expect(appDisplayName(false)).toBe("Meridian Code (Alpha)");
  });
});
