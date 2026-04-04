import type { GetKnowledgeStatusResult } from "@t3tools/contracts";
import { useState } from "react";

import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "~/components/ui/dialog";
import { ensureNativeApi } from "~/nativeApi";
import { toastManager } from "~/components/ui/toast";

export function MeridianSyncDialog({
  open,
  onOpenChange,
  status,
  onSynced,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: GetKnowledgeStatusResult | null;
  onSynced?: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const behind = status?.git?.behindCount ?? 0;

  const sync = async () => {
    setBusy(true);
    try {
      const res = await ensureNativeApi().server.syncKnowledge();
      if (!res.success) {
        toastManager.add({
          type: "error",
          title: "Sync failed",
          description: res.errors.join(" ") || "git pull did not complete.",
        });
        return;
      }
      toastManager.add({
        type: "success",
        title: res.pulled ? "Meridian Brain updated" : "Already up to date",
      });
      onSynced?.();
      onOpenChange(false);
    } catch (e) {
      toastManager.add({
        type: "error",
        title: "Sync failed",
        description: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync Meridian Brain</DialogTitle>
          <DialogDescription>
            Fast-forward your local clone to match the upstream branch ({behind} commit
            {behind === 1 ? "" : "s"} behind).
          </DialogDescription>
        </DialogHeader>
        {status && status.pendingCommits.length > 0 ? (
          <ul className="max-h-48 overflow-y-auto px-4 text-xs text-muted-foreground">
            {status.pendingCommits.map((line) => (
              <li key={line} className="font-mono">
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          Active Copilot sessions keep their prior config until restarted; Codex/Claude pick up file
          changes on the next turn.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void sync()} disabled={busy || behind === 0}>
            {busy ? "Syncing…" : "Sync now"}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
