# T2 — Lead Decision, ROUND 4

**Decision: A) APPROVE.**

## Plan reference

`docs/plans/clientes-xlsx-import.md`, "### T2 — Generator + generated dry-run SQL" (lines
384–418), read fresh for this round. Files in scope: `docs/migracion/generate-clientes-import.py`,
`docs/migracion/03-clientes-import-dry-run.sql`, `reports/t02-dev.md` (round reports, in this
sprint's convention). DB/isolation per plan: "none — offline generation only" — the live,
read-only smoke gate this round adds is the same narrowly-bounded, disclosed, read-only deviation
the lead already accepted without penalty in round 3 (t02-lead-r3.md §5), now made a standing
practice rather than a one-off.

Scope of this review: round 4 only, on its own merits — (1) did it genuinely fix the specific
T3-round-2 defect, (2) did it build and actually run the mandated live full-file smoke gate rather
than merely claim to, (3) are all 12 plan ACs genuinely met per QA's independent scoring, (4) is
scope/PII discipline intact, (5) is QA's PASS itself independently earned. Rounds 1–3 are closed
history (already approved: t02-lead.md, t02-lead-r2.md, t02-lead-r3.md) and not re-litigated.

## 1. Is the dev's evidence real, cross-checked against QA's independent reproduction?

Yes — and this round's QA report is unusually strong corroboration because it does not reuse a
single line of the dev's tooling:

- QA built its own Node+`pg` runner (`myrun.js`) from scratch, independently confirmed
  `supabase db query` cannot run multi-statement text (reproducing the same channel-gap error text
  the dev cites), and independently verified session/temp-table persistence before trusting its
  own runner on the real file.
- QA re-hashed the on-disk SQL file itself (`a5f74af3...42cc4`) and the payload-sha256 header
  (`9664ee4e...932392`) — both match the dev's claims exactly, from QA's own `shasum`/`grep`, not
  copied from the report text.
- QA re-read the generator diff itself (`sed -n`) at both fix sites (`Q1_audit_clientes_trigger_absent`
  line ~274, `Q5_dirty_email_count` line ~331) and confirmed the literal code the dev's diff hunks
  claim is actually on disk.
- QA independently ran the OLD (pre-fix) `Q5_dirty_email_count` predicate live against the real
  staged payload and reproduced the same 54 → 48 → 45 progression the dev reports, plus
  independently hex-dumped the same three NBSP row IDs (569, 816, 1071) the dev cites.
- This last check is exactly what caught the one discrepancy in the whole round (see §6) — proof
  QA was not rubber-stamping; it was actively trying to break the claim and found a real, if
  cosmetic, crack.

I treat this as real, cross-validated evidence, not agent theater.

## 2. Did the mandatory live full-file smoke gate actually get built and executed?

Yes, on both sides independently:

- **Dev:** built `pg_run.js` (full-file runner) and `sweep.js` (42 individual-statement runner) in
  scratch, outside the repo. First live full-file run (Hunk 1 only) completed with zero SQL errors
  but surfaced a genuine data-assertion FAIL on `Q5_dirty_email_count` (45 expected vs. 54 actual)
  — precisely the class of live-only defect this round's gate was mandated to catch. Root-caused
  it to an NBSP (U+00A0) vs. ASCII-`btrim()` mismatch, fixed it, regenerated, reran the full file
  live a second time: 42/42 `_checks` rows PASS, Q7 = PROCEED. Then ran all 42 check statements as
  independent, separately-dispatched statements (`sweep.js`) to rule out a masked defect behind an
  early abort: 0/42 errors.
- **QA:** built a separate runner (`myrun.js`, structurally different — a single generic
  file/inline-text runner, no separate sweep script, using the fact that the file's own 42
  sequential `INSERT` statements in one session already constitute the individual-statement sweep)
  and independently ran the entire unmodified on-disk file live. Its own 42-row `_checks` grid
  matches the dev's row-for-row, and its own Q7 verdict reads the identical
  `PROCEED — fallas: 0`.
- Both sides captured baseline `count(*)=1, max(id)=15` before their first live statement and
  after their last, on their own connections, and both held unchanged. No `BEGIN`/explicit write
  transaction was opened by either side; every statement was the file's own read-only
  `SELECT`/`pg_temp`-scoped DDL/`INSERT INTO _clientes_import`/`_checks`, or a bare diagnostic
  `SELECT`.

This is a genuinely built, genuinely executed, genuinely independently-reproduced gate — not a
claim. It did exactly the job this round existed for: it caught a second live-only bug class
(Unicode whitespace vs. `btrim()`) that three prior rounds of pure Python-side re-derivation could
never have surfaced, matching the process gap T3 rounds 1–2 flagged.

## 3. Are all 12 plan T2 ACs genuinely met, per QA's independent scoring?

Yes — QA's report scores all 12 (plan lines 388–417) individually against its own
independently-produced evidence, not the dev's:

- AC1 (stdlib-only, hard-coded path, ≤500 lines) — QA's own `wc -l`/`grep`, 500 lines exactly.
- AC2 (determinism) — QA's own two independent generator runs, diffed against each other and
  against the pre-existing on-disk file; all three byte-identical.
- AC3 (1231 rows, id-set) — QA's own fresh regex parser (not the dev's), independently confirms
  1231 rows and the exact expected id set.
- AC4 (mapping fidelity) — confirmed live against QA's own full-file run's `_checks` grid (all
  Q3/Q4 mapping rows PASS), including the accented `'República Dominicana'` literal correction
  inherited from T1's human ruling (unchanged since round 1, not reopened this round).
- AC5 (six backfill counts, no invented values) — QA's own from-scratch XLSX reader with its own
  business-rule logic (`independent_backfill.py`, sha256-verified against the pinned workbook),
  reproducing all six counts exactly (229/910/599/255/402/15), `sexo_was_blank`=402 not regressed
  to 408.
- AC6 (verbatim preservation) — QA's own live diagnostic query reproduces the 45 dirty-email count
  and both dup-`identificacion` PASS rows.
- AC7 (HC-1 gate) — QA mutation-tested it independently (own scratch copy, `pais` limit forced
  100→5), real abort, non-zero exit, zero output file, real files re-hashed unchanged afterward.
- AC8 (mapping table, no silent drop) — QA's own `grep -c`, unchanged since round 2/3.
- AC9 (header) — QA's own `head -20`, all four required elements present.
- AC10 (isolation/DDL grep) — QA's own grep, identical single benign `pagos`-read hit, only
  `pg_temp` DDL, zero policy/grant/role/fiscal hits. Per ADR-0011 (single-tenant, no RLS), no
  policy is owed.
- AC11 (`npm run qa` green) — QA ran it itself: 0 typecheck errors, 0 lint errors (28 pre-existing
  warnings, all outside this task's files), 825/825 tests.
- AC12 (rollback note, no git verb) — present, correctly names the two untracked files, no git
  verb, correctly states no destructive DB op occurred.

**12/12 PASS, independently re-derived — not trusted.**

## 4. Scope discipline

- Files touched this round: `docs/migracion/generate-clientes-import.py` (edited),
  `docs/migracion/03-clientes-import-dry-run.sql` (regenerated, never hand-edited),
  `reports/t02-dev-r4.md` (this round's report) — exactly the three in-scope paths.
- `git status --short` is byte-identical (same 8 top-level entries) before and after, captured
  independently by both the dev and QA.
- `docs/migracion/04-clientes-import-execute.sql` confirmed absent by both sides (`ls`).
- All live-DB tooling (`pg_run.js`, `sweep.js`, diagnostic `.sql` scratch files, the HC-1 mutation
  copy, and QA's independently-built `myrun.js`/`independent_backfill.py`/mutation copy) lived
  entirely under each party's own private scratch directory outside the repo — none appear in
  `git status --short`.
- One transient `docs/migracion/__pycache__/` byproduct from an ad-hoc cross-check script was
  created and deleted before the dev finished; confirmed absent from the final `git status
  --short`.
- Read-only held throughout: `count(*)=1, max(id)=15` unchanged before/after on both the dev's and
  QA's independent connections; no `BEGIN`/explicit write transaction ever opened; the only DDL
  executed anywhere was the file's own `pg_temp`-scoped `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS`,
  gone on connection close.

No out-of-scope files changed. No destructive DB op. Scope discipline is intact.

## 5. Does QA's report show genuine independent re-derivation?

Yes, and more thoroughly than round 3's already-strong bar: different runner implementation,
different hashing passes, a from-scratch XLSX reader with independently-authored business-rule
logic (not calling into `generate-clientes-import.py`'s `transform()`), an independent mutation
test, and — critically — QA's own adversarial hex-dump of the three cited NBSP row IDs actually
surfaced a real (if non-blocking) discrepancy the dev's own report got wrong (see §6). A QA report
that finds nothing ever is easier to be suspicious of; a QA report that goes looking for cracks and
finds a real (if minor) one, then correctly assesses it as non-blocking, is stronger evidence of
genuine adversarial review, not rubber-stamping.

## 6. Is the leading-vs-trailing NBSP inaccuracy blocking?

No — correctly non-blocking, and QA scored it correctly. The dev's prose said id=569's NBSP "ends
c2a0"; QA's own hex dump shows it's actually at the start of the string (leading), not the end. This
is a one-word wording error in the dev's narrative description of a diagnostic finding. It does not
affect: the fix itself (`replace(email, chr(160), ' ')` then `btrim()` strips NBSP regardless of
position), any of the reported counts (54/48/45, all independently reproduced by QA), the `_checks`
grid, or any of the 12 ACs. Both IDs 816 and 1071 are correctly described as trailing. This is a
report-accuracy footnote, not a functional or evidentiary defect, and QA's own "Suggested fixes"
section correctly labels it optional/cosmetic. Not a HARD GATE, not a fork, not something a human
needs to see. No re-submission needed on this basis.

## 7. PII / redaction

Both reports show only counts, hex-encoded byte signatures (used only to prove the NBSP
character's identity, never to reveal a name/address), booleans, hashes, and hit counts. QA
grepped the dev's report itself for connection strings, keys, and email-shaped patterns (0 hits)
and disclosed its own hex-dump/comma-count discipline for the one place a real cell (the AC6
3-address email, id=890) could have leaked. No connection string, anon/service-role key, or client
PII appears in either report. Consistent with ADR-0014 and the sprint brief's redaction-discipline
mistake note.

## HARD GATES

- Real diff produced — **yes**: 3 literal hunks pasted (the precedence fix, the NBSP fix, a
  docstring blank-line removal to hold the 500-line ceiling), confirmed on-disk by QA's own `sed`.
- Tests actually run, output shown — **yes**: `npm run qa` pasted in full by the dev, independently
  re-run by QA with matching shape (825/825 tests, 0 lint errors).
- RLS / org isolation — **N/A**, ADR-0011 (single-tenant, no RLS), zero tables created outside
  `pg_temp`; both parties independently grep zero `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER
  TABLE|CREATE ROLE`.
- Rollback note — **present and correct**: restore/delete the two touched files; explicitly flags
  the round-3-and-earlier forms as "live-proven-broken, not recommended"; no git verb; no
  destructive DB op (read-only baseline unchanged, proven twice independently).
- Acceptance criterion marked FAIL — **none**; QA scores 12/12 PASS.
- Out-of-scope files changed — **none** (§4 above).
- Optimistic UI without rollback — **N/A**, no UI/React file touched.
- Auth/payment/destructive DB change not in plan — **none**: every live statement on both sides
  was read-only or `pg_temp`-scoped; `count(*)=1, max(id)=15` unchanged before/after by both
  parties independently.

None of the automatic-B/D gates fire.

## Conclusion

Round 4 did both of its jobs for real: it fixed the specific T3-round-2 defect
(`Q1_audit_clientes_trigger_absent` operator-precedence) and it built and actually executed the
mandated live full-file smoke gate — which earned its keep immediately by catching a second,
previously-undetected live-only defect (`Q5_dirty_email_count`, NBSP-vs-`btrim()`) that Python-side
verification alone could never have found. QA independently reproduced every material claim with
its own from-scratch tooling — a different runner, a different XLSX reader, its own hashes, its
own live full-file execution, its own mutation test — and that independent scrutiny is what
surfaced the round's only finding (a cosmetic leading/trailing NBSP wording slip), which does not
affect correctness, any count, or any AC, and which QA itself correctly scored as non-blocking. All
12 plan ACs are independently confirmed PASS. Scope, read-only discipline, and PII/redaction are
all intact and independently proven on both sides.

**APPROVE T2 (round 4).**

Per the plan's dependency chain and the precedent already established in `t03-lead-r2.md`
(round 3's approval required a fresh T3 re-run before T4), this artifact
(payload-sha256 `9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`,
output-sha256 `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`) must now go back
through **T3 for a fresh live re-run — T3 round 3** — before T4 may proceed. T1 and T2 (rounds
1–4, this round now included) stand approved. T4/T5/T6 remain blocked on T3 round 3 passing.
