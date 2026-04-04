import type { LucideIcon } from "lucide-react";
import {
  AppWindow,
  Building2,
  Cpu,
  Database,
  Globe2,
  Headset,
  Layers3,
  Package,
  ShoppingCart,
  Users,
  Workflow,
} from "lucide-react";

export const PLATFORM_ICON_PALETTES = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/15 text-cyan-800 dark:text-cyan-300",
] as const;

const DEFAULT_ICONS = [
  Layers3,
  Building2,
  Package,
  Cpu,
  Globe2,
  Workflow,
] as const satisfies readonly LucideIcon[];

/** Match longest / most specific keys first in resolver. */
const OVERRIDES: Record<string, { readonly Icon: LucideIcon; readonly paletteIndex: number }> = {
  "contact-center": { Icon: Headset, paletteIndex: 0 },
  "marketing-automation": { Icon: Globe2, paletteIndex: 5 },
  crm: { Icon: Users, paletteIndex: 0 },
  sales: { Icon: ShoppingCart, paletteIndex: 1 },
  erp: { Icon: Database, paletteIndex: 2 },
  finance: { Icon: Building2, paletteIndex: 3 },
  hr: { Icon: Users, paletteIndex: 4 },
  marketing: { Icon: Globe2, paletteIndex: 5 },
  automation: { Icon: Workflow, paletteIndex: 1 },
  portal: { Icon: AppWindow, paletteIndex: 2 },
  ops: { Icon: Workflow, paletteIndex: 0 },
  operations: { Icon: Workflow, paletteIndex: 0 },
  inventory: { Icon: Package, paletteIndex: 2 },
  platform: { Icon: Layers3, paletteIndex: 1 },
  core: { Icon: Cpu, paletteIndex: 3 },
  contact: { Icon: Headset, paletteIndex: 0 },
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

const SEGMENT_ACRONYMS = new Set([
  "api",
  "bi",
  "cms",
  "crm",
  "erp",
  "hr",
  "it",
  "ops",
  "qa",
  "ui",
  "ux",
]);

export function formatPlatformLabel(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter((p) => p.length > 0)
    .map((w) => {
      const lower = w.toLowerCase();
      if (SEGMENT_ACRONYMS.has(lower)) {
        return lower.toUpperCase();
      }
      return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
    })
    .join(" ");
}

function applyOverride(override: { readonly Icon: LucideIcon; readonly paletteIndex: number }): {
  readonly Icon: LucideIcon;
  readonly paletteClass: string;
} {
  const idx = override.paletteIndex % PLATFORM_ICON_PALETTES.length;
  return {
    Icon: override.Icon,
    paletteClass: PLATFORM_ICON_PALETTES[idx]!,
  };
}

export function resolvePlatformVisual(name: string): {
  readonly Icon: LucideIcon;
  readonly paletteClass: string;
} {
  const compound = name.toLowerCase().trim();
  if (compound.length === 0) {
    return { Icon: Layers3, paletteClass: PLATFORM_ICON_PALETTES[0]! };
  }

  const exact = OVERRIDES[compound];
  if (exact) {
    return applyOverride(exact);
  }

  const segments = compound.split(/[-_/]+/).filter((s) => s.length > 0);
  for (const seg of segments) {
    const segOverride = OVERRIDES[seg];
    if (segOverride) {
      return applyOverride(segOverride);
    }
  }

  const h = hashString(name);
  const iconIdx = h % DEFAULT_ICONS.length;
  const paletteIdx = h % PLATFORM_ICON_PALETTES.length;
  return {
    Icon: DEFAULT_ICONS[iconIdx]!,
    paletteClass: PLATFORM_ICON_PALETTES[paletteIdx]!,
  };
}
