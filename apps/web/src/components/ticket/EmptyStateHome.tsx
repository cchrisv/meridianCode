import { useState } from "react";
import { TicketImportDialog } from "./TicketImportDialog";

interface EmptyStateAction {
  readonly label: string;
  readonly description: string;
  readonly icon: string;
  readonly onClick: () => void;
}

export function EmptyStateHome({
  onImportTicket,
  onGeneralChat,
}: {
  onImportTicket: (workItemId: string) => Promise<void>;
  onGeneralChat: () => void;
}) {
  const [importOpen, setImportOpen] = useState(false);

  const actions: EmptyStateAction[] = [
    {
      label: "Import Ticket",
      description: "Import an ADO work item to start working",
      icon: "\u{1F4E5}",
      onClick: () => setImportOpen(true),
    },
    {
      label: "General Chat",
      description: "Start a conversation without a ticket",
      icon: "\u{1F4AC}",
      onClick: onGeneralChat,
    },
  ];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">Welcome to Meridian Code</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your AI-powered platform engineering assistant
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 max-w-md">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-6 text-center transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span className="text-2xl">{action.icon}</span>
            <span className="text-sm font-medium">{action.label}</span>
            <span className="text-xs text-muted-foreground">{action.description}</span>
          </button>
        ))}
      </div>

      <TicketImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImport={async (workItemId) => {
          setImportOpen(false);
          await onImportTicket(workItemId);
        }}
      />
    </div>
  );
}
