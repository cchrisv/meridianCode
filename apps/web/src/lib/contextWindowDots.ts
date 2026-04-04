/** Per-dot visual step: empty (grey), half (first fill), full (second fill). */
export type ContextWindowDotStep = "empty" | "half" | "full";

const DOT_COUNT = 5;

/**
 * Maps context usage (0–100%) to five dots, each representing 20 percentage points.
 * Per dot i: empty if used ≤ 20*i; half if 20*i < used ≤ 20*i+10; full if used > 20*i+10.
 */
export function contextWindowDotsFromUsedPercent(
  usedPercent: number | null,
): ContextWindowDotStep[] {
  const out: ContextWindowDotStep[] = [];
  if (usedPercent === null || !Number.isFinite(usedPercent)) {
    for (let i = 0; i < DOT_COUNT; i += 1) {
      out.push("empty");
    }
    return out;
  }

  const used = Math.max(0, Math.min(100, usedPercent));
  for (let i = 0; i < DOT_COUNT; i += 1) {
    const bandStart = 20 * i;
    const bandMid = bandStart + 10;
    if (used <= bandStart) {
      out.push("empty");
    } else if (used <= bandMid) {
      out.push("half");
    } else {
      out.push("full");
    }
  }
  return out;
}
