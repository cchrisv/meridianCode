export interface PromptChoiceAction {
  readonly label: string;
  readonly icon: string;
  readonly description: string;
  readonly onClick: () => void;
}

/**
 * "What would you like to do?" menu shown after importing a ticket.
 * Displayed inline in the chat area.
 */
export function TicketPromptChoice({
  workItemId,
  title,
  onRunGrooming,
  onViewContext,
  onChat,
}: {
  workItemId: string;
  title: string;
  onRunGrooming: () => void;
  onViewContext: () => void;
  onChat: () => void;
}) {
  const actions: PromptChoiceAction[] = [
    {
      label: "Run Full Grooming",
      icon: "\u25B6",
      description: "Run the 5-phase AI grooming workflow",
      onClick: onRunGrooming,
    },
    {
      label: "View Ticket Context",
      icon: "\u{1F4CB}",
      description: "Open the context drawer to see ticket data",
      onClick: onViewContext,
    },
    {
      label: "Chat About This Ticket",
      icon: "\u{1F4AC}",
      description: "Start a freeform conversation about this ticket",
      onClick: onChat,
    },
  ];

  return (
    <div className="mx-auto my-4 w-full max-w-md rounded-lg border border-border bg-card p-4">
      <div className="mb-3 text-sm text-foreground">
        <span className="font-medium">Ticket #{workItemId}</span> imported: {title}
      </div>
      <div className="mb-2 text-xs font-medium text-muted-foreground">
        What would you like to do?
      </div>
      <div className="flex flex-col gap-1.5">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
          >
            <span>{action.icon}</span>
            <div>
              <div className="font-medium text-foreground">{action.label}</div>
              <div className="text-xs text-muted-foreground">{action.description}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
