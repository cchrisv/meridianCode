import { describe, expect, it } from "vitest";

import { contextWindowDotsFromUsedPercent } from "./contextWindowDots";

describe("contextWindowDotsFromUsedPercent", () => {
  it("returns all empty when percent is null", () => {
    expect(contextWindowDotsFromUsedPercent(null)).toEqual([
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps boundary 0", () => {
    expect(contextWindowDotsFromUsedPercent(0)).toEqual([
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps first dot half at 10 inclusive", () => {
    expect(contextWindowDotsFromUsedPercent(10)).toEqual([
      "half",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps first dot full just above 10", () => {
    expect(contextWindowDotsFromUsedPercent(10.0001)).toEqual([
      "full",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps 20 as first full second empty", () => {
    expect(contextWindowDotsFromUsedPercent(20)).toEqual([
      "full",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps 25 as first full second half", () => {
    expect(contextWindowDotsFromUsedPercent(25)).toEqual([
      "full",
      "half",
      "empty",
      "empty",
      "empty",
    ]);
  });

  it("maps 100 as all full", () => {
    expect(contextWindowDotsFromUsedPercent(100)).toEqual(["full", "full", "full", "full", "full"]);
  });

  it("clamps negatives and overshoot", () => {
    expect(contextWindowDotsFromUsedPercent(-5)).toEqual([
      "empty",
      "empty",
      "empty",
      "empty",
      "empty",
    ]);
    expect(contextWindowDotsFromUsedPercent(150)).toEqual(["full", "full", "full", "full", "full"]);
  });
});
