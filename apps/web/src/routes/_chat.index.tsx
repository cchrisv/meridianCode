import { createFileRoute } from "@tanstack/react-router";

import { isElectron } from "../env";
import { SidebarTrigger } from "../components/ui/sidebar";
import { EmptyStateHome } from "../components/ticket/EmptyStateHome";
import { useTicketImport } from "../hooks/useTicketImport";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { useStore } from "../store";

function ChatIndexRouteView() {
  const { importTicket } = useTicketImport();
  const { handleNewThread } = useHandleNewThread();
  const projects = useStore((s) => s.projects);

  const handleGeneralChat = () => {
    const project = projects[0];
    if (project) {
      void handleNewThread(project.id);
    }
  };

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground">
      {!isElectron && (
        <header className="border-b border-border px-3 py-2 md:hidden">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="size-7 shrink-0" />
            <span className="text-sm font-medium text-foreground">Meridian Code</span>
          </div>
        </header>
      )}

      {isElectron && (
        <div className="drag-region flex h-[52px] shrink-0 items-center border-b border-border px-5">
          <span className="text-xs text-muted-foreground/50">Meridian Code</span>
        </div>
      )}

      <EmptyStateHome
        onImportTicket={importTicket}
        onGeneralChat={handleGeneralChat}
      />
    </div>
  );
}

export const Route = createFileRoute("/_chat/")({
  component: ChatIndexRouteView,
});
