---
description: "T3 Code project overview: architecture, conventions, package roles, Effect patterns, and how to extend the codebase. Always load for any code changes in this repository."
applyTo: "**"
---

# T3 Code — Project Instructions

T3 Code is a minimal web GUI for coding agents (Codex, Claude). It is a Bun monorepo managed by Turborepo.

## Package Roles

| Package              | Purpose                                                                                                                                            |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/server`        | Node.js WebSocket/HTTP server. Wraps `codex app-server` (JSON-RPC over stdio), manages provider sessions, serves the web app.                      |
| `apps/web`           | React 19 / Vite UI. Session UX, conversation rendering, client-side state. Connects via WebSocket RPC.                                             |
| `apps/desktop`       | Electron shell around server + web.                                                                                                                |
| `packages/contracts` | **Schema-only.** Effect/Schema definitions for WebSocket protocol, provider events, and model/session types. No runtime logic.                     |
| `packages/shared`    | Shared runtime utilities. Explicit subpath exports only — no barrel `index.ts`. Import as `@t3tools/shared/logging`, `@t3tools/shared/model`, etc. |

## Commands

```bash
bun dev              # Full dev stack
bun run test         # Run Vitest (NEVER use `bun test`)
bun fmt              # Format with oxfmt
bun fmt:check        # Check formatting only
bun lint             # Lint with oxlint
bun typecheck        # Full monorepo typecheck
bun build            # Build all packages
```

**All three must pass before a task is complete: `bun fmt`, `bun lint`, `bun typecheck`.**

## TypeScript Conventions

- TypeScript strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- Module resolution: `Bundler`
- PascalCase: classes, interfaces, Effect services (`ProviderRegistry`, `OrchestrationEngine`)
- camelCase: functions, variables, hooks
- SCREAMING_SNAKE_CASE: constants / method-name maps
- `make*` prefix for factory functions: `makeProviderRegistry`
- `*Live` suffix for Effect Layers: `ProviderRegistryLive`

## Effect Patterns (server-heavy)

The server uses Effect throughout for dependency injection, async workflows, and streams.

**Service definition:**

```typescript
export class MyService extends ServiceMap.Service<MyService, MyServiceShape>()(
  "t3/domain/Services/MyService",
) {}
```

**Layer construction:**

```typescript
export const MyServiceLive = Layer.effect(MyService)(makeMyService);
```

**Factory function:**

```typescript
const makeMyService = Effect.gen(function* () {
  const dep = yield* SomeDependency;
  return {
    doThing: Effect.gen(function* () {
      /* ... */
    }),
  };
});
```

**Always `yield*` services, never `.pipe(Effect.provide(...))`** inside factory functions.

## File Organization (server)

```
src/
  <domain>/
    Services/    ← Service interfaces + implementations
    Layers/      ← Layer constructors
    Errors.ts    ← Domain error types
    Schemas.ts   ← Local schemas (non-contract)
    *.test.ts    ← Colocated tests
```

## contracts Package Rules

- **Schema-only.** Never add functions, classes, or runtime logic.
- Export paired schema + type: `export const Foo = Schema.Struct({...}); export type Foo = typeof Foo.Type;`
- Group by domain: `orchestration.ts`, `provider.ts`, `terminal.ts`, `git.ts`, `rpc.ts`

## shared Package Rules

- Add explicit subpath exports to `package.json` — never create or import from a barrel `index.ts`.
- Each module has a single focused concern.

## WebSocket / RPC Pattern

- Server defines methods in `WsRpcGroup.toLayer(...)` in `apps/server/src/ws.ts`.
- Client calls them via `wsRpcClient` (e.g., `wsRpcClient.orchestration.getSnapshot()`).
- Orchestration domain events are pushed via `orchestration.domainEvent` channel.
- Instrument new RPC calls with `observeRpcEffect()` / `observeRpcStream()`.

## Web App Patterns (React/Zustand)

- State: Zustand stores (`store.ts`, `uiStateStore.ts`, `composerDraftStore.ts`, etc.)
- Routing: TanStack Router with file-based routes in `src/routes/`
- Server data: `@tanstack/react-query`
- Reactive atoms: `@effect/atom-react`
- Terminal: xterm.js; Rich text input: Lexical editor
- Minimal Effect usage in web — prefer plain TypeScript + React hooks

## Linting & Formatting

- **oxfmt** for formatting, **oxlint** for linting.
- Do not add `eslint-disable` or `@ts-ignore` without a comment explaining why.
- `react-in-jsx-scope` is disabled (React 19 automatic JSX transform).

## Codex App Server

- Codex is started per provider session via `codexAppServerManager.ts` (JSON-RPC over stdio).
- Provider dispatch is in `providerManager.ts`.
- Reference: https://developers.openai.com/codex/sdk/#app-server
- Reference implementation: https://github.com/Dimillian/CodexMonitor
