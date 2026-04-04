# Ticket Import End-to-End Flow -- Implementation Plan

## Overview
This plan connects the existing disconnected ticket import pieces into a single coherent user journey with proper progress tracking, empty states, and transitions.

## Current State Analysis
### What already works
- TicketImportDialog: portaled modal with loading state
- TicketSidebarSection.handleImportTicket: calls rpc.ticket.import, adds to ticketStore, navigates
- Server TicketServiceLive.importTicket: runs ado-tools get + workflow-tools prepare
- OrchestrationThread schema already has ticketId, ticketStage, copilotPhase (null defaults)
- TicketPromptChoice, StageIndicator, MeridianComposerBar, ContextDrawer, UtilityActionMenu, UtilityWizardDialog
- EmptyStateHome: welcome screen with Import Ticket and General Chat cards

### What is broken or missing
1. ThreadCreateCommand (orchestration.ts:326-340) does NOT include ticketId/ticketStage/copilotPhase
2. ThreadCreatedPayload (orchestration.ts:652-665) does NOT include those fields
3. Decider (decider.ts:138-169) does NOT pass ticket fields from command to event
4. Projector (projector.ts:243-282) does NOT set ticket fields when constructing thread
5. _chat.index.tsx shows generic empty message instead of EmptyStateHome
6. handleImportTicket does NOT dispatch thread.create: navigates to placeholder threadId, no real thread
7. MessagesTimeline shows generic empty text for ticket threads instead of TicketPromptChoice
8. ChatView does NOT render StageIndicator above timeline for ticket threads
9. No toast notifications on import success/failure
10. No error display or retry on import failure
11. Run Full Grooming not wired to load and inject grooming prompt

## Implementation Steps

### Step 1: Extend ThreadCreateCommand and ThreadCreatedPayload
File: packages/contracts/src/orchestration.ts

1a. ThreadCreateCommand (after worktreePath, line 338): add three optional fields ticketId, ticketStage, copilotPhase as Schema.optional(Schema.NullOr(TrimmedNonEmptyString)). Using Schema.optional ensures existing non-ticket thread.create calls (ChatView:3024, ChatView:3494) work unmodified.

1b. ThreadCreatedPayload (after updatedAt, line 664): add same three fields with withDecodingDefault(() => null) so existing events replay correctly.

Test: Run contract unit tests. All existing tests must pass.

### Step 2: Forward ticket fields through the decider
File: apps/server/src/orchestration/decider.ts

In thread.create case (line 138-169), add to the payload after worktreePath (line 165): ticketId, ticketStage, copilotPhase from command with ?? null fallbacks.

Test: Dispatch thread.create with ticketId set, verify emitted event includes it.

### Step 3: Include ticket fields in the projector
File: apps/server/src/orchestration/projector.ts

In thread.created case (line 243-282), add to thread construction after session: null (line 270): ticketId, ticketStage, copilotPhase from payload with ?? null fallbacks.

Test: Verify projected thread carries ticketId after dispatch.

### Step 4: Replace home screen empty state
File: apps/web/src/routes/_chat.index.tsx

Replace generic text with EmptyStateHome. Import EmptyStateHome, useHandleNewThread, useTicketImport. Render with onImportTicket and onGeneralChat callbacks. Keep mobile header and electron drag-region.

Test: Navigate to /. Verify EmptyStateHome renders.

### Step 5: Create shared import handler
5a. New file: apps/web/src/hooks/useTicketImport.ts

Hook returns { importTicket(workItemId, projectId) }. Full flow: (1) loading toast, (2) rpc.ticket.import, (3) newThreadId(), (4) thread.create dispatch with ticket fields, (5) addTicket with real threadId, (6) dismiss loading + success toast, (7) navigate. On error: error toast + re-throw.

5b. Update TicketSidebarSection in Sidebar.tsx (lines 674-718) to use hook.

5c. Update _chat.index.tsx to use hook.

### Step 6: StageIndicator and TicketPromptChoice
6a. ChatView: render StageIndicator between error banner and timeline when activeThread.ticketId is set.

6b. MessagesTimeline: add optional ticket props. At empty-state branch (line 558), render TicketPromptChoice when ticket props present.

6c. Pass ticket props from ChatView to MessagesTimeline at line 4024.

6d. Implement callbacks: handleTicketRunGrooming (load prompt, inject into composer), handleTicketViewContext (lift contextOpen state, open drawer), handleTicketChat (focus composer).

### Step 7: Import dialog error handling
File: apps/web/src/components/ticket/TicketImportDialog.tsx

Add error state, show inline error, keep dialog open on failure.

### Step 8: Lift context drawer state
File: apps/web/src/components/ticket/MeridianComposerBar.tsx

Accept optional contextOpen/onContextOpenChange props for external control.

## Dependency Graph
Step 1 -> Step 2 -> Step 3 (backend, sequential)
Step 4, Step 7 (independent)
Step 5 depends on Steps 1-3
Step 6 depends on Step 5
Step 8 depends on Step 6

## Critical Files for Implementation
1. packages/contracts/src/orchestration.ts
2. apps/web/src/hooks/useTicketImport.ts (NEW)
3. apps/web/src/components/ChatView.tsx
4. apps/web/src/components/chat/MessagesTimeline.tsx
5. apps/server/src/orchestration/decider.ts