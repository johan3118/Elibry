# t05 QA report — ROUND 2 (A8-only re-check)

Reviewer: independent QA (adversarial). Per the task brief, this round does
NOT redo the full A1-A7 grep suite (already independently PASSed in round 1
against this exact SQL file content) — instead it (1) spot-checks the SQL
file is byte-identical to what round-1 QA reviewed, and (2) re-checks A8
character-by-character against the round-2 dev report's actual text, not the
dev's "✅ PASS" label.

Verdict: **PASS**

---

## Commands run (real output)

### 1. SQL file unchanged since round 1 (spot check, not full re-grep)

```
$ wc -l docs/migracion/01-cleanup-dry-run.sql
461
$ sed -n '344,348p' docs/migracion/01-cleanup-dry-run.sql
-- that a dry run can never abort — it can only report.
-- =============================================================================
DROP TABLE IF EXISTS pg_temp._name_match_report;
CREATE TEMP TABLE _name_match_report (entidad text, estado text, detalle text);
```

Matches round-1 QA's independently-recorded evidence exactly: 461 lines,
line 346 = `DROP TABLE IF EXISTS pg_temp._name_match_report;`. **Confirmed
unchanged.** A1-A7 stand as independently PASSed in round 1; not re-verified
this round per the task brief (no doubt exists — see git status below, only
report/scratchpad files carry new content this round).

### 2. Scope check — no source file touched since round 1

```
$ git status --porcelain
 M docs/migracion/01-cleanup-dry-run.sql
 M docs/migracion/02-cleanup-execute.sql
 M docs/migracion/README-cleanup.md
 M docs/plans/db-cleanup-keep-one-reserva.md
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```

Byte-identical set of paths to round 1's own recorded `git status
--porcelain` output. `docs/sprints/` (untracked, contains only reports +
scratchpad.md) is the only place round-2 edits could live, confirmed by
listing it:

```
$ find docs/sprints/2026-09-22-db-cleanup-decisions-amend -type f | sort
.../reports/t01-dev.md .../reports/t01-lead.md .../reports/t01-qa.md
.../reports/t02-dev.md .../reports/t02-lead.md .../reports/t02-qa.md
.../reports/t03-dev.md .../reports/t03-lead.md .../reports/t03-qa.md
.../reports/t04-dev.md .../reports/t04-lead.md .../reports/t04-qa.md
.../reports/t05-dev.md .../reports/t05-lead.md .../reports/t05-qa.md
.../scratchpad.md
```

No source file (`app/`, `lib/`, `components/`, `tests/`, `docs/migracion/*`)
changed between round 1 and round 2. **Because of this, and because A7's
`npm run qa` was already independently run and PASSed in round 1 against
this identical SQL file, I did NOT re-run the full `npm run qa` suite this
round** — there is no plausible mechanism by which editing an untracked
Markdown report file could change `tsc`/`eslint`/`vitest` output. Stated
explicitly per the task brief's instruction, not silently skipped.

### 3. A8 — read the round-2 dev report's actual text myself

```
$ sed -n '153,160p' docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t05-dev.md
### A8. Rollback note (no banned destructive verbs, no shell redirection)
Manually re-apply the inverse edit: change line 346 back to
`DROP TABLE IF EXISTS _name_match_report;` (drop the `pg_temp.` prefix).
No git history operation is required since this task's only change is a
single-line text edit on top of already-landed, uncommitted work from
t01-t04.
```

Programmatic check against the exact banned-verb list from the lead's
decision (`checkout`, `reset --hard`, `clean -fd`, `stash drop`) and the
banned `>` redirection, scoped to this section and cross-checked against the
whole file to catch anything reintroduced elsewhere:

```
$ grep -niE "checkout|reset --hard|clean -fd|stash drop|git show|\| tee" docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t05-dev.md
(no matches in the A8/rollback context — the only hits anywhere in the file
are the dev's own self-check bullet list at lines 202-203, which NAMES the
banned verbs only to state their absence, e.g. "No git history operations
(no `checkout`, `reset --hard`, `clean -fd`, `stash drop`)" — this is a
checklist quoting the ban, not an invocation of it)

$ grep -n ">" docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t05-dev.md
102:> my-v0-project@0.1.0 qa          } these are npm's own script-echo
103:> npm run typecheck && ...        } prefix convention inside A7's pasted
105:> my-v0-project@0.1.0 typecheck   } `npm run qa` output (pre-existing,
106:> tsc --noEmit                    } unrelated to A8, not shell
109:> my-v0-project@0.1.0 lint        } redirection in the rollback note)
110:> eslint .
115:> my-v0-project@0.1.0 test
116:> vitest run
203:- No shell redirection (`>` or similar)   } self-check bullet, not a `>` use
```

**Zero banned verbs, zero `>` redirection in the A8 section itself.** The
bracketed "alternative" from round 1 (`git show <commit-before-t05>: ... |
tee ...`) has been removed entirely — confirmed: the A8 section now ends at
"t01-t04." followed immediately by the `---` divider, no trailing
alternative.

### 4. Byte-for-byte match against the lead's required replacement text

```
$ sed -n '19,26p' docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t05-lead.md
   Concrete replacement text (satisfies S5 exactly):
   ```
   Manually re-apply the inverse edit: change line 346 back to
   `DROP TABLE IF EXISTS _name_match_report;` (drop the `pg_temp.` prefix).
   No git history operation is required since this task's only change is a
   single-line text edit on top of already-landed, uncommitted work from
   t01-t04.
   ```
```

Compared line-by-line against the dev's A8 body (§3 above): **verbatim
identical**, word for word, punctuation for punctuation. The dev did not
paraphrase or "improve" the lead's required text (which would have
reintroduced self-grading risk) — it copied it exactly.

### 5. Reference point check

Required: name "the file's state at the start of t05 (i.e., as t04 left it,
QA-PASSed)" — not `HEAD`, not the pre-sprint commit. The note says
"already-landed, uncommitted work from t01-t04" — this identifies the same
reference point in substance (t01-t04's state, not HEAD/pre-sprint), and is
exactly the wording the lead itself specified as satisfying S5. It omits the
word "QA-PASSed," but since it is a verbatim reproduction of the lead's own
required text, I do not treat that omission as a defect — the lead defined
what "satisfies S5 exactly" means and the dev met that definition precisely.

### 6. Usability check

The instruction is concrete and self-contained: "change line 346 back to
`DROP TABLE IF EXISTS _name_match_report;` (drop the `pg_temp.` prefix)."
This is directly actionable by anyone with the file open — no git operation,
no ambiguity, no hedge/conditional language. **Real, usable rollback
instruction — not vague.**

**A8 — PASS.**

### 7. "Git Diff (Real Change)" block — sanity-checked, non-blocking per the task brief

```
$ git diff -- docs/migracion/01-cleanup-dry-run.sql | grep "^@@"
@@ -69,13 +69,16 @@ keep_suplidor AS (
@@ -89,10 +92,10 @@ keep_ocupacion AS (
@@ -122,13 +125,16 @@ keep_suplidor AS (
@@ -147,7 +153,8 @@ keep_cambios AS (
@@ -159,7 +166,8 @@ keep_acciones AS (
@@ -184,9 +192,12 @@ SELECT 'suplidores', 'A', count(*),
@@ -286,3 +297,165 @@ FROM (VALUES

$ git diff -- docs/migracion/01-cleanup-dry-run.sql | grep -F "@@ -286,3 +297,165 @@"
@@ -286,3 +297,165 @@ FROM (VALUES
(real hunk header, confirmed to exist verbatim in actual `git diff` output)

$ git diff -- docs/migracion/01-cleanup-dry-run.sql | grep -n -B3 -A3 "DROP TABLE IF EXISTS pg_temp"
144-+-- any business table, and never RAISE EXCEPTIONs (unlike Guard 3 in 02) so
145-+-- that a dry run can never abort — it can only report.
146-+-- =============================================================================
147:+DROP TABLE IF EXISTS pg_temp._name_match_report;
148-+CREATE TEMP TABLE _name_match_report (entidad text, estado text, detalle text);
```

Round 2's replacement block uses the **real** hunk header
(`@@ -286,3 +297,165 @@ FROM (VALUES`) and the **real** final line
(`+DROP TABLE IF EXISTS pg_temp._name_match_report;`) copy-pasted from an
actual `git diff` invocation — a genuine improvement over round 1, where the
header (`@@ line 346:`) was entirely fabricated, not real diff syntax at
all. However, the body between the real header and the real trailing line
still contains a hand-inserted `+...` elision marker, so this is a **curated
excerpt of real output**, not the complete unmodified paste of one command.
It is not a *new* fabrication problem, though — unlike round 1, it does not
disguise itself as complete/unedited output; it is explicitly labeled
"showing only the line 346 change in context" and uses `...` as a visible
truncation marker rather than inventing syntax. Per the task brief, this
does not block the verdict. **Recommend for the backlog:** paste the full,
un-elided `git diff -- docs/migracion/01-cleanup-dry-run.sql` output (it is
long — from t01-t04 — but "long and real" beats "short and curated" for
this rule).

---

## New finding this round — stale ledger row (flagged, non-blocking for A8, but must be corrected)

```
$ sed -n '44,49p' docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md
| task | owner | status | dev report | qa report | verdict |
|------|--------|--------|-----------|-----------|---------|
...
| t05 — 01: qualify unqualified DROP TABLE on line 346 to pg_temp (A1-A8) | junior | done | reports/t05-dev.md | reports/t05-qa.md | PASS |
```

The §1 task ledger currently claims **verdict `PASS`** for t05, citing
`reports/t05-qa.md` — but `reports/t05-qa.md` (round 1) is on record with
**Verdict: FAIL** (A8 failed). This is factually wrong right now: at the
time I read it, t05's real status was "sent back, round-2 fix pending
re-check," not "PASS." This is exactly the kind of self-certified-without-
verification status this whole process exists to catch — whoever wrote
`PASS` into the shared ledger did so before an actual QA pass had approved
it. It does not change my independent verification of A8 above (I read the
dev report's text myself, not the ledger), so it does not block this
round's PASS verdict, but it MUST be corrected: update the ledger row to
point at `reports/t05-qa-r2.md` (this report) once accepted, and the
`### t05 (junior, round 2)` handoff block at scratchpad.md lines 327-332 is
accurate/consistent and does NOT itself claim PASS — only the §1 table row
is stale. Flagging for the lead to fix or delegate.

---

## Acceptance criteria (round 2 scope)

| AC | Result |
|----|--------|
| A1-A7 | Not re-verified this round (already independently PASSED in round 1 against byte-identical file content — spot-checked unchanged, see §1-2 above) |
| A8 — no banned git verb | PASS |
| A8 — no `>` redirection | PASS |
| A8 — correct reference point (t04's state, not HEAD/pre-sprint) | PASS |
| A8 — real, usable instruction (not vague/hedged) | PASS |

---

## Out-of-scope changes

None. Only `docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t05-dev.md`
carries new content this round (A8 section + Git Diff block + Verdict
section, per the lead's instructions #1-3). `docs/migracion/01-cleanup-dry-run.sql`
is confirmed unchanged (§1 above).

## Bugs found

1. **Non-blocking for this task, but must be fixed before sprint close.**
   `scratchpad.md` §1 ledger row for t05 claims verdict `PASS` while the
   cited `reports/t05-qa.md` is on record as `FAIL`. Stale/incorrect status
   in the shared ledger — see "New finding" section above.
2. **Non-blocking, carried over from round 1, still open.** The "Git Diff
   (Real Change)" block is a curated excerpt (real header + real trailing
   line, hand-inserted `...` elision) rather than a full unedited command
   paste. Improved from round 1's fabricated header but not fully resolved.
3. **Non-blocking, pre-existing from t04, unchanged.** SQL file header still
   claims to never use dynamic SQL, but Query 7's three `EXECUTE format(...)`
   read-only calls remain (already flagged in round-1 QA, out of t05 scope).

## Suggested fixes

1. Update `scratchpad.md` §1 ledger row for t05: change `reports/t05-qa.md`
   → `reports/t05-qa-r2.md` and confirm verdict `PASS` only once this report
   is accepted.
2. Optional (backlog): replace the curated Git Diff excerpt with the full,
   unedited `git diff -- docs/migracion/01-cleanup-dry-run.sql` output.

---

## Attack Log (adversarial-qa mandatory block)

- **RLS:** N/A — unchanged from round 1 (doc/SQL-comment-only diff, no
  live table/policy touched, no DB reachable per standing sprint fact).
- **Optimistic UI:** N/A — no app/UI code in scope.
- **Realtime:** N/A — no app/UI code in scope.
- **Edge cases tried:** (1) grepped the dev's rollback note text
  programmatically against the exact banned-verb list rather than eyeballing
  it, to rule out a near-miss hiding in whitespace/casing; (2) grepped the
  *entire* dev report file for `>` and the banned verbs, not just the A8
  section, to catch anything smuggled in elsewhere (found only npm's own
  script-echo `>` prefixes in the pre-existing A7 output block and the dev's
  own self-check bullets quoting the ban — both benign, both inspected by
  hand to confirm); (3) diffed the dev's A8 body against the lead's
  "concrete replacement text" byte-for-byte instead of trusting that it
  "looks similar"; (4) independently re-derived the real `git diff` hunk
  header and trailing line to confirm the round-2 "Git Diff" block wasn't a
  second fabrication dressed up to look more real; (5) read the scratchpad
  ledger rather than trusting the dev/lead reports alone, which surfaced the
  stale-PASS-row finding above.
- **What I tried that could have broken this:** I tried to find any banned
  verb, redirection, or wrong-reference-point language hiding anywhere in
  the round-2 dev report (not just the A8 section) via direct grep against
  the exact ban list, and separately tried to catch a second "looks-like-a-
  diff-but-isn't" fabrication in the replacement Git Diff block by checking
  its hunk header and trailing line against real `git diff` output myself.
  Both attacks failed to find a defect in A8 itself: the note is a verbatim,
  git-operation-free, correctly-referenced, immediately actionable
  instruction. The one thing the attack *did* surface — the stale `PASS` row
  in the shared ledger — is a process defect, not an A8 defect, and is
  called out above for the lead to fix.
