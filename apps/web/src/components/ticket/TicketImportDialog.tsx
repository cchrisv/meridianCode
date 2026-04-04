import { useState } from "react";

export function TicketImportDialog({
  open,
  onOpenChange,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (workItemId: string) => void;
}) {
  const [workItemId, setWorkItemId] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = workItemId.trim();
    if (!trimmed) return;
    setLoading(true);
    onImport(trimmed);
    setWorkItemId("");
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Import Ticket</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter an Azure DevOps work item ID to import
        </p>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <input
            type="text"
            placeholder="Work item ID (e.g., 12345)"
            value={workItemId}
            onChange={(e) => setWorkItemId(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            autoFocus
            disabled={loading}
          />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!workItemId.trim() || loading}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
            >
              {loading ? "Importing..." : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
