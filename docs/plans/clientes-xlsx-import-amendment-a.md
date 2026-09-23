# Amendment A — generator file-size ruling (mid-sprint)

**Amends:** `docs/plans/clientes-xlsx-import.md` §2, subsection
"File-size rule — explicit, pre-decided exemption", and T2 AC 1's "≤500 lines" clause
(forward-looking only — T2's own approval at exactly 500 lines is not retroactively altered).
**Date:** 2026-09-22 · **Sprint:** `docs/sprints/2026-09-22-clientes-xlsx-import/` · **Trigger:** T4 BLOCKED.

The main plan file is deliberately left **byte-unchanged**. Rewriting a 573-line approved plan to
insert one subsection is a transcription-drift risk (`assertion-without-verification`,
`retyped-verification-quote-vs-pasted-output`) with no offsetting benefit. This file is the
amendment of record; the generator's docstring and T4's round-2 report must cite it by path.

---

## RULING: Option 1 — extend the exemption to `docs/migracion/generate-clientes-import.py`

New ceiling for that one path: **650 lines**. Current: 635. It is at 635 today and has **no remaining
generator-editing task in this sprint** (T5–T8 do not touch it). Crossing 650 re-opens this ruling and
returns to the architect; it does not authorize a dev to keep growing the file.

## Reasoning

**1. The rule's own intent points this way.** `.claude/rules/file-size.md` calls >500 lines "a refactor
signal — flag it", and its enforcement verb is *don't do it silently*. A signal exists to trigger an
action. Here the action has no addressee: T4 is the last task that edits this file, and after the
human's `COMMIT` the generator's remaining job is to be **re-run**, not maintained. "Prefer extracting a
module" is a preference stated for code that will be read and edited again; this file's edit life ends
with this ruling. The rule was honoured in the way it actually asks to be honoured — the dev flagged it
and stopped rather than exceeding it silently. That is the rule working, not the rule being broken.

**2. The cut is not clean, and unclean cuts are where the logged failure lives.** I read the file. The
only sub-500 cut under the no-reduce-checks constraint is to move `render_sql` / `render_execute_sql` /
`_checks_block` out. Those three read `DB_COLUMNS`, `INSERT_COLUMNS`, `SHEET_ONLY_COLUMNS`,
`PRESERVE_COLUMNS`, `COLUMN_LIMITS`, `MAPPING_TABLE`, `JROSA_ID`, `PAT_JROSA`, `PAT_MELISSA`,
`EXPECTED_ROW_COUNT` and `sql_str()` — so the constants must move too, or be imported back, which means
either a circular import or a **third** module. A 3-file split of a one-shot 635-line script, mid-sprint,
to satisfy a line count. `extraction-changes-failure-mode` (flowcrm-wa-meta-template-submission-flow T8)
is exactly this: an extraction that passed every conventional gate — zero-byte test diff, green suite,
clean tsc/lint — and still introduced a failure mode the pre-extraction structure could not have had. Its
prevention rule requires re-attacking the extracted module with the **prior** task's own verification. For
this generator the prior verification that a hash comparison does *not* observe is the abort-path set:
`main()`'s workbook-hash mismatch, `check_overflow`'s HC-1 gate, and `transform()`'s five `sys.exit`
validators. Those are precisely the safety mechanisms standing between a bad workbook and 1,231 rows
written to production client data — and they are the part an extraction would silently relocate.

**3. The risk asymmetry is decisive.** Cost of Option 1: a reviewer reads a 635-line linear script instead
of three files. Cost of Option 2: touching the generator puts a byte-anchored, live-verified artifact
chain at risk — `03`'s sha256 `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4` is the
anchor of t03 round 3's approved 42/42 live run — for zero functional gain, on the last hand-written input
to a script that writes real client PII to production. Nothing about the import gets safer; several things
get less proven.

**4. The precedent exists and is already an open brain item.** `flowcrm-default-pipeline-window-disclosure`
shipped `docs/plans/default-pipeline-deploy.md` at 754 lines as "an authorized file-size exception", and
that sprint's own close flagged "the deploy runbook's 754-line file-size exception should be formalized in
`.claude/rules/file-size.md` — open policy question, flagged for the architect." One-shot
migration/deploy artifacts are a recognised, unformalised class. This ruling is a second data point in that
class, not a new doctrine.

**5. Where Option 1 is genuinely weaker, stated plainly.** The generator *is* hand-written and *was*
hand-maintained — it took four rounds in T2. So the rule's literal target does cover it; I am not
pretending otherwise. What defeats the literal reading is the file's remaining edit life (zero) and the
cost of the remedy (a 3-file split at the worst possible moment). If this generator ever acquires a second
consumer, a second workbook, or a further sprint's edits, the exemption dies on the spot (see scope below).

## Exemption scope — deliberately narrow, non-precedential

This exemption covers **exactly one path**: `docs/migracion/generate-clientes-import.py`, at **≤650 lines**,
for the life of the `2026-09-22-clientes-xlsx-import` sprint and its artifacts. It is granted on four
conjunctive grounds, all of which must hold:

1. one-shot migration tooling with a hash-pinned single input and a finite life (ends at the human's `COMMIT`);
2. a single entry point, zero importers, no runtime coupling to `app/`, `lib/`, `components/` or `tests/`;
3. its total observable behaviour is a deterministic byte string whose sha256 is recorded, so equivalence
   is provable in full rather than sampled by tests;
4. the growth is driven by a named correctness invariant — `weak-backstop-guard` parity between `03` and
   `04` — not by accumulated hand-maintained bloat.

It may **not** be cited for: anything under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`;
any file with more than one importer; any file that will be edited in a later sprint; any React component,
server action, route, or data-layer helper; or any file whose only justification is "splitting it is
awkward". For those the 500-line rule is unamended and a split remains its own scoped task, exactly as
`.claude/rules/file-size.md` says. **This ruling does not edit `.claude/rules/file-size.md`** — the
exemption is documented here, per the main plan's must-not-touch list.

## Consequential rulings (answer the questions this raises)

- **`03` is NOT regenerated and NOT re-run live.** Its bytes are unchanged
  (`a5f74af3…42cc4`), so t03 round 3's approved live run stands. Standing rule for the rest of this sprint:
  **any change that alters `03`'s sha256 re-opens t03 and requires a fresh live run** — a dry run whose
  bytes differ from the one that was actually executed predicts nothing.
- **`render_sql` must not be touched.** `03`'s generated header carries a now-stale line
  ("Companion (future tasks, not yet generated): 04-clientes-import-execute.sql"). Correcting a comment is
  not worth voiding a live-verified artifact. Record it instead as a known cosmetic staleness in T6's
  runbook, traced to the literal line that produces it.
- **The generator's module docstring IS now false and must be fixed.** Lines 1–26 still say "this
  generator produces ONLY the dry run" and that `04` / `_jrosa_preserva` are "T4's job … DEFERRED". A
  description that misdescribes the artifact's actual behaviour is the
  `runbook-pass-condition-misdescribes-behavior` defect class, already binding on this sprint. The
  docstring is not interpolated into either `.sql` output, so the fix is hash-neutral and must be **proven**
  hash-neutral, not asserted.
- **Nothing here causes any agent to execute `04`.** The real `COMMIT` remains the human's own action,
  outside this sprint.

## T4 round 2 — closing instructions (not a new task; t04a is not created)

Owner: **senior-dev** (same agent). Dependencies: unchanged (T3). Files in scope — exactly three:
`docs/migracion/generate-clientes-import.py`, `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev.md`,
`docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own row only).
`docs/migracion/04-clientes-import-execute.sql` is regenerated as output, not hand-edited.
**No other file may change.** Do not run `04`.

Acceptance criteria (PASS/FAIL, each with pasted evidence):

1. The module docstring (lines 1–26 only) is corrected to state that the generator emits **both**
   `03-clientes-import-dry-run.sql` and `04-clientes-import-execute.sql` from one `checks` list
   (`weak-backstop-guard`), and that `_jrosa_preserva` preserves the 17 non-sheet columns. The stale "ONLY
   the dry run" / "DEFERRED to T4" sentences are gone. Real diff pasted. No other line of the file changes —
   prove with a `diff -u` against the current on-disk copy whose hunks are confined to lines 1–26.
2. The docstring now cites this amendment by path (`docs/plans/clientes-xlsx-import-amendment-a.md`) and
   states the 650-line ceiling.
3. `wc -l docs/migracion/generate-clientes-import.py` ≤ **650**, output pasted.
4. **Hash neutrality, re-proven not asserted** (`assertion-without-verification`): after the edit, run
   `python3 docs/migracion/generate-clientes-import.py` twice and show
   `shasum -a 256` for both outputs across both runs —
   `03` = `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4` (unchanged; if it differs,
   FAIL and stop — t03 re-opens) and `04` = `9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1`
   (unchanged), each identical across the two runs.
5. **`weak-backstop-guard` parity re-proven after the edit**, not carried over from round 1: re-run the
   `grep "^INSERT INTO _checks" | diff` between `03` and `04`, show `42`/`42` and IDENTICAL.
6. Statement inventory re-shown on the regenerated `04`: 3 × `INSERT INTO clientes`, 1 × `UPDATE`,
   1 × `DELETE`, DDL is `CREATE TEMP TABLE` / `DROP TABLE IF EXISTS pg_temp.*` only, zero hits for
   `alter table|create policy|row level security|grant |revoke |create role|comprobante|balance_`, and the two
   `pagos` hits are read-only guard `SELECT`s.
7. `npm run qa` actually run, output pasted green (`unrun-command-claimed-green`).
8. File scope stated as **N of M against `git status --short`**, never `git diff`
   (`git-diff-scope-excludes-untracked-files` — every file here is `??`).
9. No client PII and no credential or connection string in the report (`redaction-discipline`).
10. One-line rollback note in prose, **no git verb** (`destructive-op-named-in-rollback-note`): the
    docstring edit is reverted by restoring lines 1–26 from the diff pasted in this report, then re-running
    the generator and confirming both hashes above.

Round 1's already-evidenced work (mechanical inventory, determinism, live 42/42 read-only guard run,
`EXPLAIN`-only validation, §8e's disclosed limitation) is **accepted and not re-litigated**; only the
items above are re-proven, because they are the ones the edit could move.

## T8 addendum

The sprint audit additionally verifies: this amendment file exists; the generator is ≤650 lines; the
generator's docstring cites the amendment; `03` still hashes to `a5f74af3…42cc4`; and the sprint close
records "generator file-size exemption granted, scope-limited, non-precedential" as a CBrain filing
candidate alongside flowcrm's unformalised 754-line deploy-runbook exception.

## When a split becomes mandatory anyway

If any of these occur, Option 1 is void and a scoped split task is required before further work:
a second workbook or second consumer; a further sprint editing the generator; growth past 650 lines; or
any need to change `03`'s bytes (which re-opens t03 regardless). In that event the split must carry the
`extraction-changes-failure-mode` prevention rule in its ACs: both `.sql` sha256 values byte-unchanged
across the move, plus explicit re-proof of every abort path (workbook-hash mismatch, HC-1 overflow, and
each `transform()` validator) by actually firing them against a tampered copy in the scratchpad — a green
run and matching hashes alone are not sufficient evidence that an extraction changed nothing.

PLAN_PATH: docs/plans/clientes-xlsx-import-amendment-a.md
