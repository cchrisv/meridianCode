"use client";

import { BrainCircuitIcon, LayoutGridIcon, NetworkIcon } from "lucide-react";
import type { KnowledgeStructureSummary } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { cn } from "~/lib/utils";

import { formatPlatformLabel, resolvePlatformVisual } from "./meridianPlatformVisuals";

export function MeridianKnowledgeCoresChips({
  structure,
}: {
  readonly structure: KnowledgeStructureSummary;
}) {
  const coreOk = structure.coreKnowledgeFileCount > 0;

  return (
    <div
      className={cn(
        "w-full min-w-0 space-y-4 rounded-2xl border border-indigo-500/10 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent p-4",
        "shadow-sm dark:border-indigo-500/10 dark:from-indigo-500/10",
      )}
      aria-label="Meridian Brain layout"
    >
      <div className="grid gap-3 min-[420px]:grid-cols-2">
        <Card className="border-border/80 shadow-none transition-colors hover:border-primary/25">
          <CardHeader className="flex flex-row items-start gap-3 p-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                coreOk
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "bg-destructive/12 text-destructive dark:text-destructive",
              )}
              aria-hidden
            >
              <BrainCircuitIcon className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold leading-tight">
                  Core knowledge
                </CardTitle>
                <Badge variant={coreOk ? "success" : "error"} size="sm">
                  {coreOk
                    ? `${structure.coreKnowledgeFileCount} doc${structure.coreKnowledgeFileCount === 1 ? "" : "s"}`
                    : "Missing"}
                </Badge>
              </div>
              <CardDescription className="text-xs leading-snug">
                Team engine docs under <span className="font-mono text-[11px]">core/knowledge</span>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>

        <Card className="border-border/80 shadow-none transition-colors hover:border-primary/25">
          <CardHeader className="flex flex-row items-start gap-3 p-4">
            <div
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/5 dark:ring-white/10",
                structure.hasSharedKnowledge
                  ? "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"
                  : "bg-muted text-muted-foreground",
              )}
              aria-hidden
            >
              <NetworkIcon className="size-5" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-sm font-semibold leading-tight">
                  Shared knowledge
                </CardTitle>
                <Badge
                  variant={structure.hasSharedKnowledge ? "success" : "outline"}
                  size="sm"
                  className={
                    structure.hasSharedKnowledge ? undefined : "border-dashed text-muted-foreground"
                  }
                >
                  {structure.hasSharedKnowledge ? "Active" : "Optional · off"}
                </Badge>
              </div>
              <CardDescription className="text-xs leading-snug">
                Org-wide depth under <span className="font-mono text-[11px]">shared/knowledge</span>
              </CardDescription>
            </div>
          </CardHeader>
        </Card>
      </div>

      {structure.platforms.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-border/80 bg-background/40 px-3 py-2.5 text-xs text-muted-foreground">
          <LayoutGridIcon className="size-4 shrink-0 opacity-70" aria-hidden />
          <span>No platform folders under platforms/* yet</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Platforms
            </h4>
            <span className="text-[11px] text-muted-foreground">
              {structure.platforms.length} platform{structure.platforms.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {structure.platforms.map((name) => {
              const { Icon, paletteClass } = resolvePlatformVisual(name);
              const label = formatPlatformLabel(name);
              return (
                <Card
                  key={name}
                  title={`platforms/${name}/`}
                  className={cn(
                    "group relative overflow-hidden border-border/80 shadow-none",
                    "transition-all duration-200",
                    "hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md",
                    "dark:hover:shadow-lg/25",
                  )}
                >
                  <CardHeader className="space-y-0 p-4">
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          "flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ring-1 ring-black/[0.06] transition-transform duration-200 group-hover:scale-[1.03] dark:ring-white/10 [&_svg]:size-[1.35rem]",
                          paletteClass,
                        )}
                        aria-hidden
                      >
                        <Icon strokeWidth={1.65} />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <CardTitle className="text-[0.9375rem] font-semibold leading-snug tracking-tight">
                          {label}
                        </CardTitle>
                        <CardDescription className="font-mono text-[11px] leading-snug">
                          platforms/{name}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
