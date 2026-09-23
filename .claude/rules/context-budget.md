# Context budget

Token discipline is a hard gate. The failure mode this rule kills: context
cost growing quadratically because every agent re-reads the full history and
every sprint appends its full story to always-loaded files. Canonical
protocol: `~/Developer/CBrain/meta/context-protocol.md` (ADR-0019).

## Two layers

1. **Per-agent** — every dev/QA/lead call starts fresh and reads the
   scratchpad instead of prior history. (Layer 1.)
2. **Per-task** — the orchestrator does not run the dev→QA→lead cycle in
   its own session either. It spawns one fresh `task-runner` per task,
   which runs the cycle and returns ONE line. The cycle dialogue dies with
   the runner, so the orchestrator's context stays flat across a 20- or
   60-task sprint instead of compounding. (Layer 2.) Sprint state lives in
   the scratchpad ledger, which is why `/sprint-resume` can rebuild an
   interrupted sprint from disk.

   The runner holds **no Write, no Edit, no Bash** — it is a pure router
   and structurally cannot author a report or a verdict. That is what makes
   delegating the loop safe: the evidence chain is still produced only by
   the agents that own it, and the orchestrator re-verifies each task
   against the qa file on disk (`/sprint` Step 3c) rather than trusting the
   runner's word. The lead additionally writes a decision record per
   decision (`reports/tNN-lead[-rN].md`) — proof the review happened, and
   the source the close phase reads to rebuild the send-back log.

## Hot-file caps (checked at sprint close — over cap = the close FAILS)

- `CLAUDE.md` ≤ 500 lines, always. Architect's close edit: net delta
  within ±15 lines; REPLACE superseded lines (move them verbatim to
  `docs/state/history.md`'s "Retired from CLAUDE.md" section in the same
  edit — create the file with that heading if the repo lacks it) — never
  stack a new sprint block.
- `MEMORY/project_sprint_state.md`: one entry per sprint, ≤80 lines —
  the rich per-sprint narrative lives there and in the sprint dir, not
  in CLAUDE.md.
- Sprint scratchpad (`docs/sprints/<slug>/scratchpad.md`): ≤300 lines
  total; §0 brief ≤80; each handoff block ≤40. When it overflows, the
  next writer folds the oldest handoffs into one-line ledger rows first.

## Read discipline (per agent invocation)

- In a sprint: read the scratchpad FIRST; it replaces bulk-reading the
  vault, the repo's history archives, and prior task reports. Grep a
  specific note only when your task needs a specific fact.
- Read your task's block in the plan with grep/offset — not the whole
  plan file.

## Write discipline

- Full evidence (diffs, command output) goes to
  `docs/sprints/<slug>/reports/tNN-{dev,qa}[-rN].md` — never pasted into
  the orchestrator transcript. Return only: status, report path, ≤25-line
  summary.
- Nothing is deleted, only relocated: any line cut from a hot file must
  land verbatim in its archive (`docs/state/history.md` or the state
  file) in the same edit.
- Write-only roles (product / architect / lead — no Edit tool): never
  append to a LARGE existing file by full-file rewrite. Write a NEW file
  (summary, digest, plan) and let the orchestrator hand the append to a
  dev scribe — the standing fix for the recurring
  `reviewing-role-write-without-edit` mistake.
