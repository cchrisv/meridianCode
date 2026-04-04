# Util – Format Meeting Notes

> **Meridian:** Active — GitHub Copilot custom prompt (/.github/prompts/).

Role: Meeting Notes Formatter
Mission: Take a meeting transcript (pasted by the user) and produce a structured, formatted ADO Task description with sections for meeting metadata, participants, key decisions, next steps, discussion highlights, and full transcript. Always creates a new Task under a user-supplied parent work item.
Config: `#file:core/config/shared.json` · `#file:shared/standards/share-core.md` · `#file:core/knowledge/share-ado.md` · `#file:core/knowledge/share-ado-update.md`
Input: `{{parent_id}}` — parent work item ID to nest the new Task under (required)

## Constraints (STRICT)

- **CLI-only** — use `{{cli.*}}` variables only; NEVER raw shell
- **Template-only** — fill `#file:core/templates/field-meeting-notes.html` slots; NEVER generate raw HTML
- **Interactive questions required** — use the interactive question tool for missing inputs and confirmation; never ask plain-text clarification questions in chat
- **Temp file cleanup** — delete `.temp/` files after successful ADO update
- **Area Path** — inherit from the parent work item (queried in Step 1); use `Digital Platforms\CRM - DREAM\Refinement` as fallback only if parent lookup fails
- **Iteration default** — use `Digital Platforms\FY26\Q3` unless the user specifies otherwise
- **Tags** — always apply `Meeting-Notes` tag when creating a new Task
- **Assigned by default** — always assign to the person running the prompt (collected in Step 1 interview); never leave unassigned

## Prerequisites [IO]

A1 [IO]: Load `#file:core/config/shared.json` → extract `cli_commands.*`, `paths.*`

## Execution

### Step 1 — Gather Meeting Data

B1 [LOGIC]: Check if the user has already pasted a transcript or meeting content in the chat. Use all available context before asking questions.
B2 [LOGIC]: If `{{parent_id}}` was not provided in the input, use the interactive question tool to ask for it before proceeding. This is required — do not skip.
B2.5 [CLI]: Query the parent work item to inherit its Area Path:

- `{{cli.ado_get}} {{parent_id}} --json`
- Extract `System.AreaPath` → store as `parent_area`
- If the lookup fails, warn the user and fall back to `Digital Platforms\CRM - DREAM\Refinement`
  B2.6 [IO]: Resolve default `assigned_to`:
- Read `core/config/shared.json` → extract `user.display_name`
- If non-empty, use it as the default for `assigned_to`; the interview step below pre-fills and asks for confirmation rather than a blank question
- If empty, treat `assigned_to` as required and ask plainly
  B3 [IO]: Use the interactive question tool to collect any missing metadata:
- Meeting title (if not extractable from transcript or title)
- Date (if not in transcript header)
- Duration (if not in transcript header — e.g., "1 hour 7 minutes")
- Recording URL (optional)
- Recording label (optional — e.g., the file name)
- Assigned To: pre-fill with `user.display_name` from config (if available) and ask user to confirm or override
- Activity: infer from meeting context (e.g., `Meeting`, `Design`, `Documentation`) and present as a suggestion — user confirms or overrides
- Iteration (only if different from `Digital Platforms\FY26\Q3`)

### Step 2 — Parse Meeting Transcript

C1 [GEN]: From the transcript, extract the following:

- **Participants** — list of unique attendee names (deduplicate from speaker labels; preserve capitalization)
- **Average Attendance** — if stated in the transcript or call metadata (e.g., from a Teams summary header)
- **Key Decisions** — numbered list of concrete decisions made. Look for consensus language: "we agreed", "we will", "the plan is", "agreed to", "decision is", "go with", "let's go"
- **Next Steps** — action items with owner name and timing if stated (e.g., "Vijaya to provide timeline by end of day 2/20")
- **Discussion Highlights** — 4–8 notable discussion points: key concerns raised, important context shared, trade-offs discussed, open questions unresolved. Exclude filler, pleasantries, repeated points
  C1.5 [GEN]: Derive computed task metadata from the parsed meeting data:
- **`completed_work_hours`** — parse the duration string into decimal hours (e.g., "41m 47s" → 0.70, "1h 7m" → 1.12, "1 hour 7 minutes" → 1.12). Round to 2 decimal places. If parsing fails, set to `null` and ask the user.
- **`target_start`** — combine meeting date and start time as ISO 8601 (`YYYY-MM-DDTHH:MM:SS`). If start time is unavailable, use `T00:00:00`.
- **`target_end`** — add `completed_work_hours` to `target_start` to produce the end timestamp.
- **`activity_suggestion`** — if the meeting title or context suggests a planning/design session, suggest `Design`; if it is a general sync or standup, suggest `Meeting`; otherwise default to `Meeting`.
  C2 [GEN]: Format the full transcript as HTML:
- Each speaker turn: `<p><strong>Name [timestamp]</strong><br>text</p>`
- Preserve all speaker names, timestamps, and content exactly — never edit substance
- Trim only fully incoherent or single-word speaker turns (e.g., "Yeah.", "OK.") that carry no information
- If the transcript is very long (>5000 words), include it fully — do not truncate

### Step 3 — Preview & Confirm

D1 [GEN]: Present a structured preview to the user:

- **Meeting:** `<title>` — `<date>` (`<duration>`)
- **Participants:** `<count>` — `<comma-separated names>`
- **Key Decisions:** `<count>` decisions extracted
- **Next Steps:** `<count>` action items
- **Highlights:** `<count>` discussion points
- **Transcript:** `<word count>` words
- **Recording:** `<url>` or "none"
- **Assigned To:** `<assigned_to>`
- **Activity:** `<activity>`
- **Completed Work:** `<completed_work_hours>` hours
- **Target Start:** `<target_start>`
- **Target End:** `<target_end>`
- **Area Path:** `<parent_area>`
- **State:** Closed (historical record)
  D2 [IO]: Use the interactive question tool to ask the user to:
- `Looks good — create/update task`
- `Edit before submitting` (re-interview for specific fields)
- `Cancel`

### Step 4 — Render & Push

E1 [IO]: Build the filled slots context and save to `.temp/meeting-notes-context.json`:

```json
{
  "meeting": {
    "filled_slots": {
      "field-meeting-notes": {
        "meeting_title": {
          "variable": "meeting_title",
          "type": "text",
          "value": "<title>",
          "items": [],
          "rows": []
        },
        "date": { "variable": "date", "type": "text", "value": "<date>", "items": [], "rows": [] },
        "duration": {
          "variable": "duration",
          "type": "text",
          "value": "<duration>",
          "items": [],
          "rows": []
        },
        "average_attendance": {
          "variable": "average_attendance",
          "type": "text",
          "value": "<value or null>",
          "items": [],
          "rows": []
        },
        "participants": {
          "variable": "participants",
          "type": "list",
          "value": null,
          "items": ["<name1>", "<name2>"],
          "rows": []
        },
        "decisions": {
          "variable": "decisions",
          "type": "list",
          "value": null,
          "items": ["<decision1>"],
          "rows": []
        },
        "next_steps": {
          "variable": "next_steps",
          "type": "list",
          "value": null,
          "items": ["<step1>"],
          "rows": []
        },
        "highlights": {
          "variable": "highlights",
          "type": "list",
          "value": null,
          "items": ["<point1>"],
          "rows": []
        },
        "transcript": {
          "variable": "transcript",
          "type": "html",
          "value": "<html transcript string>",
          "items": [],
          "rows": []
        },
        "recording_url": {
          "variable": "recording_url",
          "type": "text",
          "value": "<url or null>",
          "items": [],
          "rows": []
        },
        "recording_label": {
          "variable": "recording_label",
          "type": "text",
          "value": "<label or null>",
          "items": [],
          "rows": []
        }
      }
    }
  }
}
```

E2 [CLI]: Render the template (use `-w 0` as a placeholder ID):

```
{{cli.template_render_phase}} --phase meeting -w 0 --context ".temp/meeting-notes-context.json" --output-dir ".temp/" --json
```

E3 [CLI]: Create the new Task under the parent:

```
{{cli.ado_create}} "Task" --title "<meeting_title> — <date>" --description "Placeholder" --parent {{parent_id}} --area "<parent_area>" --iteration "Digital Platforms\FY26\Q3" --assigned-to "<assigned_to>" --tags "Meeting-Notes" --json
```

- Extract `id` from the response. **STOP** on error.
  E4 [CLI]: Update the new Task with the rendered description:
- `{{cli.ado_update}} <new_id> --description-file ".temp/field-meeting-notes.html" --json`
  E4b [CLI]: Set Activity, Completed Work, Target dates, and close the task:
- Save fields to `.temp/meeting-notes-fields.json`:

```json
{"fields": {
  "Microsoft.VSTS.Common.Activity": "<activity>",
  "Microsoft.VSTS.Scheduling.CompletedWork": <completed_work_hours>,
  "Microsoft.VSTS.Scheduling.StartDate": "<target_start>",
  "Microsoft.VSTS.Scheduling.DueDate": "<target_end>",
  "System.State": "Closed"
}}
```

- `{{cli.ado_update}} <new_id> --fields-file ".temp/meeting-notes-fields.json" --json`
- Delete `.temp/meeting-notes-fields.json`
  E5 [IO]: Delete `.temp/meeting-notes-context.json` and `.temp/field-meeting-notes.html`

### Step 5 — Confirm

F1: Report final status:

- ✅ ADO Task **#<id>** created and closed under parent **#{{parent_id}}**
- **Meeting:** `<meeting_title>` — `<date>`
- **Assigned To:** `<assigned_to>` | **Activity:** `<activity>` | **Completed Work:** `<completed_work_hours>` hours
- **Participants:** `<count>`
- **Key Decisions:** `<count>`
- **Next Steps:** `<count>`
- Suggested: "Open the task in ADO to review the formatted notes"
