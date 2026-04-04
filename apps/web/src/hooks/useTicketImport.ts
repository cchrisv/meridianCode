import { useCallback, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { type ThreadId, DEFAULT_RUNTIME_MODE } from "@t3tools/contracts";
import { DEFAULT_MODEL } from "@t3tools/contracts";

import { ensureNativeApi } from "../nativeApi";
import { getWsRpcClient } from "../wsRpcClient";
import { useTicketStore } from "../ticketStore";
import { useStore } from "../store";
import { newCommandId, newThreadId } from "../lib/utils";
import { toastManager } from "../components/ui/toast";

export interface TicketImportState {
  /** Whether an import is currently in progress. */
  readonly importing: boolean;
  /** Progress message for the current import step. */
  readonly progress: string | null;
  /** Error message if the last import failed. */
  readonly error: string | null;
}

/**
 * Hook encapsulating the complete ticket import flow:
 * 1. Show loading toast
 * 2. Call ticket.import RPC (workflow-tools prepare + ado-tools get)
 * 3. Create a real orchestration thread linked to the ticket
 * 4. Add ticket to store
 * 5. Show success/error toast
 * 6. Navigate to the new thread
 */
export function useTicketImport() {
  const navigate = useNavigate();
  const projects = useStore((s) => s.projects);
  const addTicket = useTicketStore((s) => s.addTicket);
  const setActiveWorkItem = useTicketStore((s) => s.setActiveWorkItem);

  const [state, setState] = useState<TicketImportState>({
    importing: false,
    progress: null,
    error: null,
  });

  const importTicket = useCallback(
    async (workItemId: string, projectId?: string): Promise<void> => {
      setState({ importing: true, progress: "Connecting to ADO...", error: null });

      const loadingToastId = toastManager.add({
        type: "loading" as const,
        title: `Importing ticket #${workItemId}...`,
      });

      try {
        // Step 1: Call server to prepare workflow + fetch ADO data
        setState((s) => ({ ...s, progress: "Preparing workflow..." }));
        const rpc = getWsRpcClient();
        const result = await rpc.ticket.import({ workItemId: workItemId as any });

        // Step 2: Create a real orchestration thread linked to the ticket
        setState((s) => ({ ...s, progress: "Creating thread..." }));
        const api = ensureNativeApi();
        const activeProject = projectId
          ? projects.find((p) => p.id === projectId) ?? projects[0]
          : projects[0];
        if (!activeProject) {
          throw new Error("No space available. Create a space first.");
        }

        const threadId = newThreadId();
        const commandId = newCommandId();
        const title = result.state.metadata.title as string;

        await api.orchestration.dispatchCommand({
          type: "thread.create",
          commandId,
          threadId,
          projectId: activeProject.id,
          title,
          modelSelection: {
            provider: "copilot",
            model: DEFAULT_MODEL,
          },
          runtimeMode: DEFAULT_RUNTIME_MODE,
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          createdAt: new Date().toISOString(),
          workItemId: result.workItemId as string,
          workItemStage: (result.state.currentStage as string) ?? null,
          copilotPhase: (result.state.copilotPhase as string) ?? null,
        });

        // Step 3: Add to ticket store
        addTicket({
          workItemId: workItemId as any,
          title: title as any,
          workItemType: result.state.metadata.workItemType,
          currentStage: result.state.currentStage,
          copilotPhase: result.state.copilotPhase as any,
          platform: result.state.metadata.platform,
          priority: result.state.metadata.priority,
          assignedTo: result.state.metadata.assignedTo,
          threadId: threadId as any,
          updatedAt: new Date().toISOString() as any,
        });
        setActiveWorkItem(result.workItemId as string);

        // Step 4: Success toast + navigate
        toastManager.close(loadingToastId);
        toastManager.add({
          type: "success" as const,
          title: "Ticket imported",
          description: `#${workItemId} — ${title}`,
        });

        setState({ importing: false, progress: null, error: null });

        void navigate({
          to: "/$threadId",
          params: { threadId: threadId as string },
        });
      } catch (err) {
        toastManager.close(loadingToastId);
        const errorMessage = err instanceof Error ? err.message : String(err);
        toastManager.add({
          type: "error" as const,
          title: "Import failed",
          description: errorMessage.slice(0, 200),
        });
        setState({ importing: false, progress: null, error: errorMessage });
      }
    },
    [navigate, projects, addTicket, setActiveWorkItem],
  );

  return { importTicket, ...state };
}
