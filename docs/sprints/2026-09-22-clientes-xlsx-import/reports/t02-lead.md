# T2 — Generator + generated dry-run SQL — lead decision record

**Decision: B — SEND BACK TO DEV**

---

## Plan reviewed

`docs/plans/clientes-xlsx-import.md`, §9 T2 (lines 384–417), 12 numbered
acceptance criteria. Read in full before reviewing either report. Cross-checked
against T1's already-PASSed report (`reports/t01-dev.md`, ledger row `t01 |
done | PASS`) for the Q4 column list and the `pais` human-ruling inheritance,
and against T3's plan text (lines 421-429+) to confirm the downstream blast
radius of a bad live-check.

## HARD GATE triggered

**"Acceptance criterion marked FAIL → B."** QA's report marks AC 5
(placeholder-backfill counts, plan line 401-403) as **FAIL**, and the verdict
line is FAIL. That alone is dispositive under this project's decision
framework — no discretion to override with the other 11 passes. This is not a
close call: QA independently re-parsed all 1,231 rows with two separate
parsers, cross-checked the generator's own Python-side arithmetic against the
raw pinned `.xlsx`, and reproduced a genuine predicate/expected-value mismatch
in the *shipped* artifact — not in the generator's internal reasoning, which is
correct.

No other HARD GATE is triggered:
- Real diff: present (git status enumeration, `--no-index` diff for the .py,
  bounded greps/excerpts for the generated SQL per ADR-0014 — full-file paste
  correctly withheld, this is not a "no diff" violation).
- Tests run with output pasted: yes, `npm run qa` output shown, independently
  re-run by QA with matching result.
- No new table / RLS: none created; ADR-0011 (no RLS, single-tenant) applies;
  grep-verified, QA re-verified.
- No out-of-scope files: QA independently ran `git status --short` and
  confirmed exactly the 2 declared new files plus in-scope report additions.
- Rollback note: present, prose-only, no git verb.

So this is a narrow, single-site implementation bug, not a systemic or design
failure — routed back to the same dev, not escalated.

## The bug (confirmed, not taken on QA's word alone)

I re-read QA's derivation rather than rubber-stamping the verdict:
- The generator's **Python-side** backfill accounting is correct: it tracks
  *provenance* (was this cell blank before transform?) and counts 402 NORMAL
  rows genuinely backfilled to `'N/A'` from blank `sexo` cells.
- The **SQL check embedded in the generated file**,
  `Q4_backfill_sexo_402` (`docs/migracion/03-clientes-import-dry-run.sql`,
  around line 1335-ish per the file's `_checks` block), asserts
  `expected='402'` against the predicate `WHERE sexo = 'N/A'`. That predicate
  measures the *final stored value*, which cannot distinguish "backfilled from
  blank" from "6 sheet rows whose cell already literally contained the string
  `N/A`" (a legitimate, pre-existing value under `clientes_sexo_check`). The
  true count for that predicate is 408.
- This is the only one of the six backfill-count checks with this defect,
  because `sexo` is the only field where the placeholder literal (`'N/A'`)
  collides with a value that can also occur natively in the sheet. QA
  independently re-verified the other five sites (`responsable`, `direccion`,
  `email`, `telefonos`, `identificacion`, `nombre_completo`) have no such
  collision and are correct as shipped.
- Consequence if shipped as-is: T3 (plan AC 4, "Q3/Q4 grids read PASS on every
  distribution and every backfill count, or the task reports FAIL loudly and
  stops") will genuinely, falsely ABORT on live execution against real data
  that has nothing wrong with it. This would bounce T3 back to T2 anyway,
  after burning a live DB round-trip — better to catch it now.

## Instructions for the dev (precise, not "fix the check")

Pick exactly one of these two fixes — both were offered by QA and both are
acceptable, but implement only one, cleanly, not a hybrid:

**Option A (provenance-aware, preferred if it's a small diff):** add a
generator-computed boolean column to the staged temp table, e.g.
`sexo_was_blank boolean`, set per-row during `transform()` at the same point
the `'N/A'` backfill literal is assigned for `sexo`. Change
`Q4_backfill_sexo_402`'s predicate to `WHERE sexo_was_blank` (still
`expected='402'`). This preserves the check's original meaning ("how many rows
were backfilled") without relying on a value-equality proxy that can collide
with legitimate data.

**Option B (re-baseline, if a schema-shape change to `_clientes_import` is
judged out of proportion for this fix):** rename the check to
`Q4_sexo_na_total_408` (or similarly explicit name that does not imply "=
backfill count"), set `expected='408'`, and keep `402` as a Python-side-only
fact printed in the generator's summary and the dev report — not asserted as a
live SQL check. Add a one-line comment immediately above the check in the
generated SQL explaining why this count includes both backfilled and
originally-literal `N/A` rows, so a future reader isn't confused by the same
ambiguity QA just found.

Either way:
1. Regenerate `03-clientes-import-dry-run.sql` from the corrected generator
   (never hand-edit the generated file — it's `DO NOT EDIT — generated`).
2. Re-run determinism (two runs, matching SHA-256, shown twice — same bar as
   original AC 2).
3. Re-run the AC 3 row-count/id-set proof and the AC 5 backfill-count table
   with the corrected `sexo` accounting, showing the live-checkable value now
   matches its own `expected` literal.
4. Re-run `npm run qa` and paste the output (regression gate, unlikely to move
   but must be shown again since the file changed).
5. Resubmit a fresh `t02-dev.md` (or a clearly marked addendum) with the new
   payload-sha256 and the same evidence shape as before — QA will re-verify
   from scratch, not diff against the prior submission.

Do not touch anything else in `generate-clientes-import.py` or
`03-clientes-import-dry-run.sql` outside what's needed for this fix — the
other 11 ACs are independently confirmed correct twice over (dev + QA) and are
not in question.

## Judgment items reviewed (not verdict-affecting, my sign-off)

**1. Q6 "7 preserved columns capturable" deferral to T4.** I re-read plan §9
T2's own AC list (lines 388-417) — it is silent on Q6/`_jrosa_preserva`. That
construct is explicitly T4's (plan §3 statement 1: `CREATE TEMP TABLE
_jrosa_preserva AS SELECT <7 cols> FROM clientes WHERE id = 15`). I agree with
both the dev's scoping call and QA's independent review: correctly out of
scope for T2, correctly disclosed rather than silently dropped, not a
blocker. No action needed. This does carry one live risk worth naming for
whoever owns T4: the dev's own report flags that the 7-column identity is
**not** unambiguously pinned by the plan text and offers a hypothesis
(`{estado_registro, usuario_creacion, fecha_provisional, documentos_urls,
imagen_url, dependencias_ids, fecha_editado}`) explicitly labeled "not
pre-approved." T4's dev must resolve this with a real decision traceable to
T1's Q4 column list, not silently inherit the T2 dev's guess.

**2. `pais` human-ruling paper trail.** The accented `'República Dominicana'`
literal (superseding the plan's frozen `'REPUBLICA DOMINICANA'` text at HC-4)
was applied identically by T1, T2's dev, and QA, and I'm told by the
orchestrator that this ruling was given directly to it by the human, then
relayed identically to every downstream agent. I am recording — not waiving —
QA's flag: an agent-relayed assertion that "the human ruled X" is not itself
the human's approval per this project's own consent rules, and this
overrides a value explicitly marked FROZEN in the human-approved plan (HC-4).
Since T1 already shipped and PASSed with this literal baked in, unwinding it
now would cascade into T1 rework, not just T2 — so I am not blocking T2's
resubmission on it. But I am flagging it up: **before T3 executes the dry run
live and this literal becomes operationally load-bearing, the orchestrator
should get the human to confirm the `pais` override in their own words, in
this transcript or an equivalent durable record** — not as a new decision,
just as closing the paper-trail gap QA correctly identified. This is a
process note for the orchestrator, not a change to the T2 rework instructions
above.

## Rollback (unchanged from dev/QA)

No DB touched, no git verb. This task's artifacts are two new untracked files;
reverting means deleting `docs/migracion/generate-clientes-import.py` and
`docs/migracion/03-clientes-import-dry-run.sql`. Nothing else to undo.
