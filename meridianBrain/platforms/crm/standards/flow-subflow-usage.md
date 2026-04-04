# Flow Subflow Usage

> **Meridian:** Active — `util-pr-analysis` `#file:` for Flow PRs.

Naming source of truth:

- Use [metadata-naming-conventions.md](metadata-naming-conventions.md) for all flow, subflow, utility flow, variable, and interface naming rules.

## When to Use

- **Reusable logic** — common actions (email, record creation, calculations, approval, validation)
- **Complex flows** — break into smaller subflows for readability/troubleshooting/isolation
- **Error handling** — dedicated subflows for consistent exception management

## Patterns

- **Parent-Child** — main flow orchestrates; children handle specific tasks
- **Functional** — utility (formatting, calculations) and process (qualification, validation)
- **Decision-Driven** — call subflows based on conditions
- **Try-Catch** — fault path calls error-handling subflow for logging/notification

## Best Practices

- **Inputs/Outputs** — clear parameters, minimal dependencies
- **Performance** — optimize for frequent calls and large volumes
- **Testing** — test independently AND within parent flow

## Common Utility Subflow Capabilities

All return standard outputs: `error` (Boolean), `errorMessage`, `faultMessage`.

| Capability                | Purpose                                                    | Key Inputs                                                                  |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------- |
| Error presentation        | Display error or fault information in screen flows         | `errorMessage`, `faultMessage`                                              |
| Internal navigation       | Navigate to a record page in Lightning Experience          | `objectApiName`, `recordId`, `actionName`                                   |
| External navigation       | Navigate to an external URL in Lightning Experience        | `url`, `target`                                                             |
| Record type lookup        | Return record types accessible to the running user         | `objectApiName` → `recordTypes`                                             |
| Toast notification        | Display a toast message in Lightning Experience            | `message`, `title`, `mode`, `variant`                                       |
| Modal notification        | Display a modal message in Lightning Experience            | `header`, `message`, `title`, `variant`                                     |
| Assignment rule execution | Run Case assignment logic when async execution is required | `case`, `triggerAutoResponseEmail`, `triggerOtherEmail`, `triggerUserEmail` |

## Implementation

**Create:** identify reusability → define interface (inputs/outputs) → handle errors (return error info) → document → test independently.

**Use in parents:** call early (feature flags, validation) → check error outputs → pass complete context.

**Anti-patterns:** over-fragmenting one-time logic · tight coupling to parent context · unclear interfaces (`data1` → specific names) · missing error handling · hidden side effects.
