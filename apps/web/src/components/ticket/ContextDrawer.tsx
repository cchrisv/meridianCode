import React, { useState, useEffect } from "react";
import { getWsRpcClient } from "../../wsRpcClient";
import { PHASE_DEFINITIONS, type CopilotPhase } from "@t3tools/contracts";

interface PhaseDefDisplay {
  readonly phase: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly index: number;
}
const PHASES: readonly PhaseDefDisplay[] = PHASE_DEFINITIONS;

/**
 * On-demand drawer showing ticket-context.json organized by phase.
 * Opened via [Context] button near the composer.
 */
export function ContextDrawer({
  workItemId,
  open,
  onClose,
}: {
  workItemId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [context, setContext] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !workItemId) return;
    setLoading(true);
    setError(null);
    const rpc = getWsRpcClient();
    rpc.ticket
      .getContext({ workItemId: workItemId as any })
      .then((result) => setContext(result.context as Record<string, unknown>))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [open, workItemId]);

  if (!open) return null;

  const metadata = context?.metadata as Record<string, unknown> | undefined;
  const research = context?.research as Record<string, unknown> | undefined;
  const grooming = context?.grooming as Record<string, unknown> | undefined;
  const solutioning = context?.solutioning as Record<string, unknown> | undefined;
  const solutioningResearch = context?.solutioning_research as Record<string, unknown> | undefined;
  const finalization = context?.finalization as Record<string, unknown> | undefined;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-96 border-l border-border bg-card shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Ticket Context</h2>
          {metadata?.work_item_id != null && (
            <span className="text-xs text-muted-foreground">
              #{String(metadata.work_item_id)} — {String(metadata.platform ?? "unknown")}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:text-foreground"
        >
          X
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-sm text-muted-foreground">Loading context...</div>
        ) : error ? (
          <div className="text-center text-sm text-destructive">{String(error)}</div>
        ) : !context ? (
          <div className="text-center text-sm text-muted-foreground">
            {workItemId ? "No context data found." : "Select a ticket to view its context."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Metadata */}
            <ContextSection title="Metadata" defaultOpen>
              <MetadataTable data={metadata} />
            </ContextSection>

            {/* Phase sections — renderPhaseSections returns ReactElement[] */}
            {/* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */}
            {renderPhaseSections({ research, grooming, solutioningResearch, solutioning, finalization }) as any}

            {/* Run state */}
            {context.run_state && (
              <ContextSection title="Run State">
                <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground font-mono">
                  {JSON.stringify(context.run_state, null, 2).slice(0, 2000)}
                </pre>
              </ContextSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function renderPhaseSections(phases: {
  research: Record<string, unknown> | undefined;
  grooming: Record<string, unknown> | undefined;
  solutioningResearch: Record<string, unknown> | undefined;
  solutioning: Record<string, unknown> | undefined;
  finalization: Record<string, unknown> | undefined;
}): React.ReactElement[] {
  const sections = [
    { key: "research", label: "Research & Discovery", index: 0, data: phases.research },
    { key: "grooming", label: "Grooming & Refinement", index: 1, data: phases.grooming },
    { key: "solutioning-research", label: "Solutioning Research", index: 2, data: phases.solutioningResearch },
    { key: "solutioning", label: "Solutioning & Design", index: 3, data: phases.solutioning },
    { key: "finalization", label: "Finalization & Sizing", index: 4, data: phases.finalization },
  ];

  return sections.map((s) => {
    const hasData = s.data && Object.keys(s.data).length > 0;
    return (
      <ContextSection key={s.key} title={`Phase ${s.index + 1}: ${s.label}`} empty={!hasData}>
        {hasData ? (
          <pre className="whitespace-pre-wrap text-[11px] text-muted-foreground font-mono">
            {JSON.stringify(s.data, null, 2).slice(0, 3000)}
          </pre>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">Not populated</span>
        )}
      </ContextSection>
    );
  });
}

function ContextSection({
  title,
  children,
  defaultOpen = false,
  empty = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  empty?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded border border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-foreground hover:bg-muted/50"
      >
        <span>{open ? "\u25BE" : "\u25B8"}</span>
        <span className="flex-1">{title}</span>
        {empty && <span className="text-[10px] text-muted-foreground">empty</span>}
      </button>
      {open && <div className="border-t border-border px-3 py-2">{children}</div>}
    </div>
  );
}

function MetadataTable({ data }: { data: Record<string, unknown> | undefined }) {
  if (!data) return <span className="text-[11px] text-muted-foreground italic">No metadata</span>;

  const entries = Object.entries(data).filter(
    ([_, v]) => v !== null && v !== undefined && v !== "" && !Array.isArray(v),
  );

  return (
    <div className="flex flex-col gap-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex items-baseline gap-2 text-[11px]">
          <span className="text-muted-foreground min-w-24">{key.replace(/_/g, " ")}:</span>
          <span className="font-mono text-foreground">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
