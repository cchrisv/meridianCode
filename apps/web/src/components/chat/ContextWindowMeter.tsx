import { type ContextWindowSnapshot, formatContextWindowTokens } from "~/lib/contextWindow";
import {
  contextWindowDotsFromUsedPercent,
  type ContextWindowDotStep,
} from "~/lib/contextWindowDots";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";

function formatPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

function ContextDot(props: { step: ContextWindowDotStep }) {
  const { step } = props;
  return (
    <span
      className={cn(
        "inline-block size-1.5 shrink-0 rounded-full transition-colors duration-300 motion-reduce:transition-none",
        step === "empty" && "bg-muted",
        step === "half" && "bg-muted-foreground/85",
        step === "full" && "bg-amber-600 dark:bg-amber-500",
      )}
      aria-hidden
    />
  );
}

export function ContextWindowMeter(props: {
  readonly usage: ContextWindowSnapshot;
  readonly onCompact?: () => void | Promise<void>;
  readonly compactDisabled?: boolean;
  readonly compactPending?: boolean;
  readonly compactSupported?: boolean;
}) {
  const { usage, onCompact, compactDisabled, compactPending, compactSupported } = props;
  const usedPctLabel = formatPercentage(usage.usedPercentage);
  const remainingPctLabel = formatPercentage(usage.remainingPercentage);
  const dots = contextWindowDotsFromUsedPercent(usage.usedPercentage);
  const [d0 = "empty", d1 = "empty", d2 = "empty", d3 = "empty", d4 = "empty"] = dots;

  const filledSteps = dots.filter((d) => d !== "empty").length;
  const ariaLabel =
    usage.usedPercentage !== null && Number.isFinite(usage.usedPercentage)
      ? `Context window about ${Math.round(usage.usedPercentage)} percent used, ${filledSteps} of 5 indicators filled`
      : `Context window ${formatContextWindowTokens(usage.usedTokens)} tokens used`;

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            className="inline-flex items-center gap-0.5 rounded-md px-0.5 py-0.5 transition-opacity hover:opacity-85"
            aria-label={ariaLabel}
          >
            <ContextDot step={d0} />
            <ContextDot step={d1} />
            <ContextDot step={d2} />
            <ContextDot step={d3} />
            <ContextDot step={d4} />
          </button>
        }
      />
      <PopoverPopup
        side="top"
        align="end"
        className="w-80 max-w-[min(20rem,calc(100vw-1rem))] text-xs shadow-md/10"
        tooltipStyle={false}
      >
        <div className="space-y-2 leading-tight">
          <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Context window
          </div>
          {usage.maxTokens !== null && usedPctLabel ? (
            <div className="font-medium text-foreground">
              <span>{usedPctLabel}</span>
              <span className="mx-1">·</span>
              <span>{formatContextWindowTokens(usage.usedTokens)}</span>
              <span>/</span>
              <span>{formatContextWindowTokens(usage.maxTokens ?? null)}</span>
              {remainingPctLabel ? (
                <span className="text-muted-foreground"> ({remainingPctLabel} remaining)</span>
              ) : null}
            </div>
          ) : (
            <div className="text-foreground">
              {formatContextWindowTokens(usage.usedTokens)} tokens used so far
            </div>
          )}
          {usage.maxTokensIsEstimated ? (
            <div className="text-muted-foreground">
              Context limit estimated from current model settings (not reported by the provider).
            </div>
          ) : null}
          {(usage.totalProcessedTokens ?? null) !== null &&
          (usage.totalProcessedTokens ?? 0) > usage.usedTokens ? (
            <div className="text-muted-foreground">
              Total processed: {formatContextWindowTokens(usage.totalProcessedTokens ?? null)}{" "}
              tokens
            </div>
          ) : null}
          {usage.compactsAutomatically ? (
            <div className="text-muted-foreground">
              This provider may compact its context automatically when needed.
            </div>
          ) : null}
          {compactSupported && onCompact ? (
            <Button
              className="mt-1 w-full"
              disabled={compactDisabled || compactPending}
              size="sm"
              type="button"
              variant="secondary"
              onClick={() => void onCompact()}
            >
              {compactPending ? "Compacting…" : "Compact conversation"}
            </Button>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
