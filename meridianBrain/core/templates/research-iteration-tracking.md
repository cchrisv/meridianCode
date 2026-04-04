# Research Iteration Tracking Template

> **Meridian:** Active — `core/config/shared.json` → `template_files.research_iteration`.

This template defines the artifact schema for tracking research iteration state across all sub-phases.

## Artifact Location

**File:** `{{research}}/research-iteration-state.json`

**Path:** `.ai-artifacts/{{work_item_id}}/research/research-iteration-state.json`

## Schema

```json
{
  "version": "1.0",
  "current_pass": 2,
  "global_clue_register": {
    "keywords": [
      {
        "term": "Banner_API",
        "discovered_in": "wiki",
        "investigated_in": ["salesforce", "code"],
        "confidence": 0.9,
        "status": "investigated"
      },
      {
        "term": "Platform Events",
        "discovered_in": "web",
        "investigated_in": [],
        "confidence": 0.0,
        "status": "uninvestigated"
      }
    ],
    "entities": [
      {
        "name": "Contact_Assignment_Flow",
        "type": "Flow",
        "discovered_in": "ado",
        "investigated_in": ["salesforce"],
        "confidence": 0.95,
        "status": "investigated"
      }
    ],
    "contradictions": [
      {
        "claim_a": "Uses Handler Pattern",
        "source_a": "code",
        "claim_b": "Direct trigger logic",
        "source_b": "salesforce",
        "resolved": false,
        "priority": "critical",
        "resolution_attempts": 1
      }
    ],
    "gaps": [
      {
        "description": "Integration auth method unknown",
        "could_be_filled_by": ["wiki", "salesforce"],
        "priority": "high",
        "status": "open"
      }
    ],
    "questions": [
      {
        "question": "Is the round-robin assignment still active?",
        "answer": null,
        "source": null,
        "status": "unanswered"
      }
    ]
  },
  "sub_phase_status": {
    "ado": {
      "passes": 1,
      "complete": true,
      "revisited_by": [],
      "loop_count": 0,
      "last_completed": "2024-01-15T10:30:00Z"
    },
    "wiki": {
      "passes": 2,
      "complete": true,
      "revisited_by": ["salesforce"],
      "loop_count": 1,
      "last_completed": "2024-01-15T11:00:00Z"
    },
    "salesforce": {
      "passes": 1,
      "complete": false,
      "revisited_by": [],
      "loop_count": 0,
      "pending_revisits": ["code"],
      "last_updated": "2024-01-15T11:15:00Z"
    }
  },
  "feedback_loops_executed": [
    {
      "loop_number": 1,
      "timestamp": "2024-01-15T10:45:00Z",
      "from": "salesforce",
      "to": "wiki",
      "reason": "Found Banner_API integration, need documentation",
      "trigger": "New Topic Discovered",
      "findings": [
        "Found Banner_API integration documentation in wiki",
        "Retrieved authentication details"
      ],
      "research_complete_after_loop": true
    },
    {
      "loop_number": 2,
      "timestamp": "2024-01-15T11:20:00Z",
      "from": "code",
      "to": "salesforce",
      "reason": "Metadata discrepancy - code shows Pattern A but metadata shows Pattern B",
      "trigger": "Contradiction",
      "findings": ["Verified Pattern B is active in production", "Code repository is outdated"],
      "research_complete_after_loop": true
    }
  ],
  "total_loop_count": 2,
  "iteration_limits": {
    "max_loops_per_subphase": 3,
    "max_total_loops": 10,
    "max_revisits_per_target": 2
  },
  "limits_hit": [],
  "research_metrics": {
    "total_duration_minutes": 45,
    "sub_phases_executed": 9,
    "total_iterations": 7,
    "iterations_by_sub_phase": {
      "ado": 1,
      "wiki": 2,
      "salesforce": 3,
      "code": 1
    },
    "clues_discovered": 23,
    "clues_investigated": 21,
    "clues_uninvestigated": 2,
    "contradictions_found": 3,
    "contradictions_resolved": 3,
    "iteration_limits_hit": 0
  },
  "last_updated": "2024-01-15T11:30:00Z"
}
```

## Field Descriptions

### Top-Level Fields

- **version**: Schema version for future compatibility
- **current_pass**: Current iteration pass number across all sub-phases
- **global_clue_register**: Accumulated clues across all sub-phases
- **sub_phase_status**: Status tracking for each research sub-phase
- **feedback_loops_executed**: Log of all feedback loops executed
- **total_loop_count**: Total number of feedback loops executed (safety limit tracking)
- **iteration_limits**: Configuration limits (loaded from research-orchestration.json)
- **limits_hit**: Array of limit violations encountered
- **research_metrics**: Aggregated metrics for analysis
- **last_updated**: ISO timestamp of last update

### Global Clue Register

Tracks clues discovered across all sub-phases:

- **keywords**: Technical terms, acronyms, concepts
- **entities**: Objects, flows, classes, integrations
- **contradictions**: Conflicting information between sources
- **gaps**: Missing evidence that could be filled
- **questions**: Unanswered questions needing investigation

Each clue entry includes:

- Discovery source (`discovered_in`)
- Investigation sources (`investigated_in`)
- Confidence level (0.0-1.0)
- Status (`investigated`, `uninvestigated`, `partially_investigated`)

### Sub-Phase Status

For each sub-phase, tracks:

- **passes**: Number of times this sub-phase was executed
- **complete**: Boolean indicating completion
- **revisited_by**: Array of sub-phases that triggered revisits to this one
- **loop_count**: Number of feedback loops executed for this sub-phase
- **pending_revisits**: Array of sub-phases queued for revisit (if incomplete)
- **last_completed** / **last_updated**: ISO timestamp

### Feedback Loops Executed

Each entry logs:

- **loop_number**: Sequential loop number
- **timestamp**: When the loop was executed
- **from**: Sub-phase that triggered the loop
- **to**: Sub-phase that was revisited
- **reason**: Human-readable reason for the revisit
- **trigger**: Which of the 5 trigger criteria was met
- **findings**: Array of findings from the revisit
- **research_complete_after_loop**: Whether research was complete after this loop

### Research Metrics

Aggregated statistics:

- **total_duration_minutes**: Total research phase duration
- **sub_phases_executed**: Number of sub-phases executed
- **total_iterations**: Total number of iterations across all sub-phases
- **iterations_by_sub_phase**: Breakdown by sub-phase
- **clues_discovered/investigated/uninvestigated**: Clue statistics
- **contradictions_found/resolved**: Contradiction tracking
- **iteration_limits_hit**: Number of times limits were reached

## Usage

This artifact is:

1. **Created** at the start of the research phase
2. **Updated** after each sub-phase execution
3. **Updated** after each feedback loop execution
4. **Read** to determine iteration state and prevent infinite loops
5. **Analyzed** for research quality metrics

## Integration

- **Created by:** Research Orchestrator initialization
- **Updated by:** Each research sub-phase after execution
- **Read by:** Feedback loop evaluation logic
- **Used by:** Runner.js iteration functions
- **Referenced by:** Research summary generation

## Best Practices

1. **Always update** the artifact after each sub-phase completes
2. **Track all clues** in the global register, even if not immediately investigated
3. **Document all loops** with clear reasons and findings
4. **Respect limits** and document when limits are hit
5. **Update metrics** continuously for accurate reporting
6. **Preserve history** - don't overwrite, append to arrays
