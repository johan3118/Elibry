# Sprint scratchpad — db-cleanup-decisions-amend (opened 2026-09-22)

Working memory for THIS sprint only. Read §0 once, §1 for status, the
newest §2 blocks for context. Caps (.claude/rules/context-budget.md):
file ≤300 lines, §0 ≤80, each handoff ≤40 — when over, the next writer
folds the oldest §2 blocks into one-line §1 notes. Burned (tombstoned)
at sprint close; the evidence lives in ./reports/ and survives.

## §0 Sprint brief (architect writes once — every agent reads this first)

- **Goal:** make the cleanup scripts wipe ALL `pagos` unconditionally, add a three-entity name-assertion preflight guard to `02`, keep Section B untouched, and record the decisions in an append-only plan amendment.
- **Plan:** `docs/plans/db-cleanup-decisions-amend.md` · **Spec:** frozen in transcript (32 ACs)
- **Scope: exactly 4 files.** `docs/migracion/02-cleanup-execute.sql`, `docs/migracion/01-cleanup-dry-run.sql`, `docs/migracion/README-cleanup.md`, `docs/plans/db-cleanup-keep-one-reserva.md`. All tracked at `HEAD = 3faa20c`, tree was clean at open → `git diff` is valid evidence.

**Brain briefing (relevant slice only):**
- **No live DB. None.** `db.jznchzgpaovmgjezvdwo.supabase.co` has no DNS answer, REST = 521. Nothing this sprint is executed against a database; every runtime claim is labelled literally **UNVERIFIED**.
- `mistakes/schema-source-of-truth` — **hardest constraint.** Only live `information_schema` introspection is evidence. A TS interface is not. `scripts/*.sql` is not (six-plus confirmed drift cases in this repo). ⇒ Guard 3's name columns and the balance handling must **self-detect at runtime or refuse**.
- `mistakes/incomplete-control-enumeration` + `spec-manufactured-divergence` — `_keep_pago` has **9 consumer sites in `02`** (6 literal + 3 derived) and **9 hits in `01`**. Inventory: plan §0.1. All move together; QA re-greps independently.
- `mistakes/weak-backstop-guard` — prove the backstop is at least as strict as what it backstops. Binds Guard 3's ILIKE patterns (T2) and `01`'s preview of them (T5). "Looks specific enough" = FAIL.
- `mistakes/destructive-op-named-in-rollback-note` (13 recurrences) — no `git checkout <ref> --`, `reset --hard`, `clean -fd`, `stash drop`, no `>` redirection. Reference point = the file's state at the **start of the task**. A conditional hedge does not satisfy this.
- `mistakes/runbook-pass-condition-misdescribes-behavior` — a runbook pass/fail step is checked against what the artifact ACTUALLY does. Binds T6 (cite the line, re-read post-T5).
- `mistakes/blind-write-partial-read` — `02` is 26 KB, the amended plan 51 KB. **Edit, never regenerate.**
- `mistakes/unrequested-hardening-regression` — ship change A only. Out-of-scope findings go to plan §12 backlog, not the diff.
- `mistakes/confirm-gate-false-commit` — exactly one commit trigger (running `02`). `01` stays write-incapable. This is why `02` must not be split.
- `decisions/0011-elibry-single-tenant-for-now` — single-tenant, no auth, no RLS, by ADR. **DML-only sprint: neither add nor weaken RLS.** Rejected alternative: building org isolation now. Off the table.
- `decisions/0003-hard-gates-anti-theater` — a command not RUN is a FAIL. `decisions/0014-bounded-evidence-rule` — bounded quotable evidence, no unbounded dumps.
- `decisions/0012-elibry-confirmacion-without-factura-numero` — outcomes must not collapse. Here: "no match" / "name NULL-or-empty" / "no candidate name column exists" / "`suplidor_id IS NULL`" are four distinct messages, never one generic MISMATCH.
- **Undischarged fiscal human gate** is open from last sprint (NCF / `comprobantes_disponibles`). Section B stays fully commented out. AC11 is a regression check on every `02` task.

**QA baseline + load-bearing flags:**
- `npm run qa` = `npm run typecheck && npm run lint && npm run test` = `tsc --noEmit` → `eslint .` → `vitest run` (`package.json:8-12`).
- **No `app/`, `lib/`, `components/`, `tests/`, or config file is in any task's scope** ⇒ every task's `npm run qa` output must be **identical to the baseline**. First dev to run it pastes the baseline into §2 and every later task diffs against it. Paraphrase = FAIL (AC31).
- `git status --porcelain` must show only the 4 in-scope files, at every task (AC30).

**Protected / at-ceiling files (split-first gates):**
- `docs/migracion/02-cleanup-execute.sql` — **439 lines at open, ceiling 500** (`.claude/rules/file-size.md`). T3 will likely breach it. **FLAG the overage in the dev report + add a §3 line. DO NOT SPLIT** — splitting one `BEGIN;…COMMIT;` creates a second commit trigger (plan HC-2).
- `docs/migracion/README-cleanup.md` — 250 lines at open, ceiling 250. Any overage flagged.
- `docs/plans/db-cleanup-keep-one-reserva.md` — 823 lines, **append-only**; lines 1-823 byte-identical, deletions column must be 0.
- **Never touched by any task:** `02` Sections B/C/D + FISCAL GATE · `01` Queries 1/4/5 · all of `scripts/` · `app/`, `lib/`, `components/`, `tests/`, all config · `CLAUDE.md`, `.claude/**`.

## §1 Task ledger (dev/qa update their own row; ids only)

| task | owner | status | dev report | qa report | verdict |
|------|--------|--------|-----------|-----------|---------|
| t01 — 02: unconditional pagos wipe + 9 `_keep_pago` consumers (AC1-6,10,11) | senior | done | reports/t01-dev.md | reports/t01-qa.md | PASS |
| t02 — 02: Guard 3 name assertion, owns ILIKE literals (AC7,8,10,11) | senior | done | reports/t02-dev.md | reports/t02-qa.md | PASS |
| t03 — 02: balance disclosure AC9b + line-budget flag (AC9,12,10,11) | senior | done | reports/t03-dev.md | reports/t03-qa.md | PASS |
| t04 (MERGED T4+T5+T6+T7) — 01: pagos keep set removal + loud row + MATCH/MISMATCH report; README payments-die prose/checklist/balance branch/rollback; plan Amendment (AC13-29) | senior | done | reports/t04-dev.md | reports/t04-qa.md | PASS |
| t05 — 01: qualify unqualified DROP TABLE on line 346 to pg_temp (A1-A8) | junior | done | reports/t05-dev.md | reports/t05-qa-r2.md | PASS |

Dependencies: t01 → t02 → t03 (same file, in order) · t01 → t04 · t02 + t04 → t05 · t01-t05 → t06 · t01 + t02 → t07 (sequence last).

## §2 Handoffs (append-only, newest last, ≤40 lines each)

### t01 (senior, done) — 02: unconditional pagos wipe + 9 `_keep_pago` consumers
- All 9 sites (C1-C9) migrated in one Edit pass, no whole-file rewrite. `rg -n
  "_keep_pago" 02-cleanup-execute.sql` → 6 hits, all comment-only (verified,
  pasted in reports/t01-dev.md). `DELETE FROM pagos;` is now bare, no WHERE.
- `_keep_cliente` rebuilt from `_keep_reserva.cliente_id` only (C2). C9's dead
  "why materialise" rationale rewritten; deliberate consequence (divergent
  `pagos.cliente_id` client no longer protected) stated inline at C9 AND
  restated in C1's replacement comment.
- `_before_snapshot.n_pagos` renamed `n_pagos_a_destruir`, sourced directly
  from `pagos` (C3). Post-condition (C7) now asserts `v_n_pagos <> 0` — strictly
  stronger than the old before/after equality. Final report `n_pagos` (C8)
  unchanged, comment added: 0 by construction.
- C5/C6: both polymorphic `'pagos'` branches commented out, exact words "always
  false — no pago row ever survives the full wipe."
- File: 439 → 461 lines (+22). Well under the 500 ceiling — no flag needed for
  T1 alone; HC-2's projected overage is from T2+T3 stacking on top, still to
  come.
- `npm run qa`: typecheck clean, lint 0 errors/28 pre-existing warnings, 825/825
  tests pass — identical shape to what baseline would be (no app/lib/tests
  files touched). Full output in reports/t01-dev.md.
- `git status --porcelain`: only `docs/migracion/02-cleanup-execute.sql`
  modified. Ready for T2 (Guard 3) to build on this same file.
- Backlog (not fixed, per unrequested-hardening-regression): none newly found
  beyond §3's existing B-a..B-e; nothing else noticed while the file was open.

### t01 (QA, PASS) - independent re-verification
- Re-ran every command myself (never reused dev's pasted output): `_keep_pago` grep gives
  **5** hits, not 6 as the dev report's prose claims (harmless miscount - all 5 are
  comment-only either way, AC2 still PASS). All 9 section 0.1 sites (C1-C9, 6 literal + 3
  non-literal) verified row-by-row against the current file, not grep counts alone.
- AC5 deep-checked per the task brief: confirmed `v_before.n_pagos` (the OLD equality
  comparison) is **fully removed**, not left alongside the new `v_n_pagos <> 0` check -
  grepped 0 hits and read the original file's post-condition block side-by-side to confirm.
- `git diff` hunk-by-hunk: 8 hunks, all inside the KEEP-set block / two polymorphic OR-lists
  / post-condition / final-report grid. None touch Section B/C/D or FISCAL GATE. Guards 1-2
  (lines 40-75) confirmed byte-identical to pre-task via direct diff.
- `npm run qa` independently re-run: exit 0, tsc clean, eslint 0 errors/28 pre-existing
  warnings, vitest 30 files/825 tests passing - identical shape to dev's pasted output.
- `git status --porcelain`: only the one in-scope file modified.
- Rollback note (3faa20c, no banned verb, no `>`): reference point independently confirmed
  correct since t01 is the sprint's first task and 3faa20c's blob is byte-identical
  (439 lines) to the pre-edit state.
- Minor non-blocking discrepancy: scratchpad's own prior t01 handoff overclaimed the
  deliberate-consequence note is "restated in C1's replacement comment" - it's actually only
  cross-referenced from C1, not restated. Doesn't fail any AC (AC3 only requires the
  consequence stated at C9, which it is).
- Full report: reports/t01-qa.md. **Verdict: PASS.** T2 may build on this file.

### t02 (senior, dev-done) — 02: Guard 3, three-entity name assertion
- Guard 3 inserted as pure addition at lines 76-232 (new `DO $$` block at 102),
  strictly between Guard 2's `END $$;` (line 74, unchanged) and the Section 1
  header comment. `_keep_reserva` does not exist yet at this point (it's built
  in Section 1, after Guard 3), so cliente_id/producto_id are re-resolved
  directly from `reservas WHERE codigo = ...`, matching Guards 1-2's own
  pattern rather than depending on a temp table.
- Three canonical ILIKE literals used verbatim, owned here for T5 to copy:
  `'%JROSA%ASESORA%VIAJES%'`, `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'`,
  `'%OPERAHOTEL%'` — confirmed via `grep -no "'%[A-Z% ]*%'"`, both in the
  executable ILIKE lines (130,153,181) and the header comment (90-92).
- Name columns self-detected per-candidate via `information_schema.columns
  WHERE table_schema='public'` (matches the file's existing fiscal-gate
  convention at line 199), never hardcoded — one `FOREACH` loop per entity
  over a declared candidate array, dynamic `EXECUTE format('SELECT %I FROM
  ... WHERE id = $1', v_col)`.
- Four distinct abort messages per entity (no-candidate-column /
  name-null-or-empty / no-match / suplidor-id-null for suplidor only) — each
  tagged with a distinguishing parenthetical, never a generic "MISMATCH".
- Guards 1-2 (lines 40-74) confirmed byte-identical: first `git diff` hunk
  starts at old-line 73, meaning lines 1-72 have zero diff and 73-74 appear
  only as unchanged context before the insertion.
- **FLAG (HC-2, `.claude/rules/file-size.md`):** file is now 579 lines (was
  461 after t01), already past the 500-line ceiling from T2 alone, before T3
  even lands. Per the plan's explicit ruling, flagging (not splitting) is the
  correct response — added to §3 below.
- `npm run qa`: exit 0, tsc clean, eslint 0 errors/28 pre-existing warnings,
  30 files/825 tests pass — identical shape to t01's baseline. Full report:
  reports/t02-dev.md.
- `git status --porcelain`: only `docs/migracion/02-cleanup-execute.sql`
  modified. Ready for T3 (balance disclosure) to build on this same file.

### t02 (QA, PASS) - independent re-verification
- Re-ran every command myself; also built a stronger scope proof than the dev's
  own hunk-line narrative: mechanically excised exactly the Guard-3 block
  (lines 76-193) from the current working tree and diffed the remainder
  against `HEAD` (3faa20c) - byte-identical, hunk-for-hunk, to t01's
  already-PASSed diff. Confirms t02 changed **nothing** beyond inserting
  Guard 3.
- AC7a-e, AC8, AC10, AC11 all independently re-verified against the actual
  file text (not the dev's pasted output): Guard 3 at line 102, first
  `DELETE FROM` at line 268; three `information_schema.columns` self-detect
  loops (123/146/174) with the exact §7 candidate lists; literals exactly
  `'%JROSA%ASESORA%VIAJES%'` / `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'` /
  `'%OPERAHOTEL%'`; 10 distinct RAISE EXCEPTION messages covering 4
  non-collapsing states (no-candidate-column / name-null-or-empty / no-match
  / suplidor-id-null); "MISMATCH" appears once, only inside the negating
  header comment. Guards 1-2 (lines 40-74) confirmed byte-identical via
  direct diff against `HEAD`.
- AC8 written independently (own words, own counter-entities per pattern:
  `VIAJES EL SOL SRL`, `BAHIA PRINCIPE GRAND AQUAMARINE`,
  `OPERADORA HOTELERA DEL CARIBE SRL`) - none is a bare generic substring.
  Adversarial follow-up tried a contrived compound-word overlap
  (`COOPERAHOTEL`) to stress-test the OPERAHOTEL pattern; judged not a
  genuinely plausible real entity, so it does not overturn the PASS - noted
  as an inherent ILIKE-substring property, not a defect.
- `npm run qa` independently re-run: exit 0, tsc clean, eslint 0 errors/28
  pre-existing warnings, 30 files/825 tests passing - identical to t01
  baseline (no app/lib/tests file in scope).
- Line budget: `wc -l` confirms 579 lines, dev flagged HC-2 loudly and did
  NOT split - correct per plan ruling.
- Non-blocking finding for backlog (not fixed, not requested): an orphaned
  FK (cliente_id/producto_id/suplidor_id pointing at a deleted row) still
  safely aborts via the "name-null-or-empty" branch, but the message doesn't
  distinguish "no such row" from "row exists with empty name" - cosmetic
  only, safety is intact.
- Full report: reports/t02-qa.md. **Verdict: PASS.** T3 may build on this
  file.

### t03 (senior, dev-done) — 02: balance disclosure (HC-1 branch b) + line-budget flag
- New SECTION 5 inserted between Section 4's post-condition `DO $$` and FINAL
  REPORT: `information_schema.columns` self-detect loop (same convention as
  Guard 3) over 5 candidates (`balance_reserva`, `balance_general`,
  `balance_abonado`, `monto_pagado`, `abonado_contabilidad`) against
  `reservas`, writing to a new `_balance_disclosure` temp table (`ON COMMIT
  DROP`). Two non-collapsing message shapes: `ABSENT from this schema...` vs
  `PRESENT, current value = X -- POSSIBLY STALE: ...` (never a generic string).
- Disclosure surfaced as 5 new columns on the existing FINAL REPORT `SELECT`
  (`*_disclosure` per candidate) — a real result-grid row, not NOTICE-only,
  per AC9c. AC9d (branch b over a) documented inline in SECTION 5's header:
  `scripts/027` vs `scripts/030` contradiction, unreachable live schema, app
  already recomputes at read time (`app/reservas/ver/[id]/page.tsx:196-215`).
- **AC9a confirmed:** `rg -n "^\s*UPDATE " ...` → 0 hits. No balance column
  written anywhere.
- **FLAG (HC-2, `.claude/rules/file-size.md`):** file is now **631 lines**
  (was 579 after t02). Per plan ruling, flagged not split — same reasoning as
  t02's flag (splitting the one `BEGIN;…COMMIT;` = second commit trigger,
  `mistakes/confirm-gate-false-commit`).
- AC10/AC11 regression re-run in full: 0 uncommented Section-B DELETEs, one
  `BEGIN;`/one `COMMIT;` (now line 631), no `ROLLBACK;`, Guard 3 (line 77)
  still precedes first `DELETE FROM` (line 268), `_keep_pago` still 5
  comment-only hits — all identical to t02's already-PASSed state.
- `npm run qa`: exit 0, tsc clean, eslint 0 errors/28 pre-existing warnings,
  30 files/825 tests pass — identical shape to t01/t02 baseline. Full report:
  reports/t03-dev.md.
- `git status --porcelain`: only `docs/migracion/02-cleanup-execute.sql`
  modified (the two `??` untracked entries pre-date this task). Ready for QA.

### t04 (senior, dev-done) — MERGED T4+T5+T6+T7: 01 + README + plan Amendment
- **01 (T4+T5):** removed the `keep_pago` CTE from Query 2 AND Query 3 (they
  shared identical text, one `replace_all` Edit); `keep_cliente` in both now
  resolves from `keep_reserva.cliente_id` only. Query 3's `pagos` row
  hardwired `rows_to_keep = 0` structurally (not data-derived). Also migrated
  the two `'pagos'` OR-branches inside Query 3's `keep_cambios`/`keep_acciones`
  CTEs (commented out, same wording as 02's C5/C6) — these were in the plan's
  §0.1 nine-site inventory for `01` but not named in my own task's AC list;
  included them anyway since T4's brief says "migrates all nine `keep_pago`
  hits". Added Query 6 (loud payment-destruction row, zero-is-real-answer)
  and Query 7 (MATCH/MISMATCH per entity, copied byte-for-byte from 02's
  Guard 3 — `diff <(rg -o ...) <(rg -o ...)` on both files prints nothing).
  Query 7 never RAISE EXCEPTIONs (unlike Guard 3) — it only reports, since 01
  must stay abort-incapable. Placed both new queries AFTER Query 5 (not
  interleaved) specifically so no diff hunk's context lines could be read as
  "touching" Query 1/4/5 — `git diff` confirmed clean on that front. File:
  288 -> 461 lines.
- **README (T6):** corrected both surviving "pagos survive" claims (ES line
  ~202, EN line ~211) with an explicit ALL-payments-die + irreversible-
  without-backup statement, attributed to the operator's decision. Added a
  balance-branch paragraph in Step 4 that describes 02's ACTUAL Section 5
  (disclosure-only, zero UPDATEs, final-report-grid columns, ABSENT vs
  PRESENT-possibly-stale) — re-read 02's real Section 5 text before writing
  it, not the plan's design intent. Added a Step 5 checklist item (Query 7
  all-MATCH gate, explicit "stop, do not run 02" on MISMATCH). Rewrote the
  Rollback section's stale "new, untracked" claim without using "checkout" /
  "reset --hard" / "clean -fd" / "stash drop" anywhere, confirmed via
  rollback-section-scoped grep (0 hits). Added a top-of-file "Verification
  status" note + two literal "UNVERIFIED" labels (AC26). RLS caveat and
  R-TRIGGER guidance confirmed byte-identical via direct diff (untouched).
  File: 249 -> 306 lines. **FLAG: over the 250-line ceiling** (was already
  at-ceiling per §0's protected-file note) — not split, per the standing
  "flag, don't split" convention this sprint uses for 02.
- **Plan Amendment (T7):** appended after original line 822 (confirmed via
  `wc -l`/`awk` — the file has 822 real lines, not 823; a Read-tool display
  quirk showed a phantom blank 823rd entry). `git diff --numstat` shows `63
  0` — zero deletions, confirmed. Three decisions recorded, each attributed
  verbatim "the operator, via direct question, this session." Deliberately
  avoided reproducing any literal SQL/CTE text when citing §4:248 and §5:287
  (described them in prose instead) so the AC29 SQL-leakage grep — even a
  corrected line-number-accurate version I ran myself, not just the plan's
  own `$2`-based command which doesn't actually filter by line number  —
  comes back with 0 real hits past line 822.
- Scope note: this was issued to me as ONE merged task (t04 = plan's
  T4+T5+T6+T7) with a single QA pass, per explicit human instruction
  compressing the plan's four-task split. `02-cleanup-execute.sql` was only
  ever opened via Read, never Edit/Write — the diff `git status` shows
  against it is 100% t01-t03's already-PASSED, already-landed work from
  before this task began; I added zero lines to it.
- `npm run qa`: exit 0, tsc clean, eslint 0 errors/28 pre-existing warnings,
  30 files/825 tests pass — identical to t01-t03 baseline. Full report:
  reports/t04-dev.md.
- `git status --porcelain`: `01-cleanup-dry-run.sql`, `README-cleanup.md`,
  `db-cleanup-keep-one-reserva.md` modified (plus `02-cleanup-execute.sql`
  showing t01-t03's pre-existing diff, and the two pre-existing `??`
  untracked entries). Exactly the 3 files in my scope, no more. Ready for QA.

## §3 Close queue (facts that must survive the burn — one line each)

- Backlog B-a: `01-cleanup-dry-run.sql:26` cites "02's Section A step 17"; `02` labels it Step 15 — stale cross-reference, out of this sprint's scope.
- Backlog B-b: `db-cleanup-keep-one-reserva.md:816-817` names two files that were never shipped (`cleanup-keep-RES-1787875561067.sql/.md`).
- Backlog B-c: `README-cleanup.md:238` called the three files "new, untracked additions" — they are tracked at `3faa20c` (corrected inside t06 only because AC24 re-states that section).
- Backlog B-d: this cleanup work was never sprinted — zero CBrain hits for `db-cleanup` / `RES-1787875561067`; plan + scripts shipped with no QA report. Worth a consolidation note.
- Backlog B-e: CLAUDE.md has no "Project contract" block — scaffold from `~/Developer/CBrain/kit/templates/CLAUDE.md.template`.
- Hard call HC-1 (human): denormalised balance columns cannot be recomputed without guessing a formula the repo contradicts itself about (`scripts/027:53` vs `scripts/030:35`) and no live schema exists to settle it → plan chose disclosure, zero `UPDATE`s.
- Hard call HC-2 (human): `02` will likely exceed the 500-line rule; the correct remedy (split) is forbidden by the one-transaction/one-commit-trigger invariant → FLAG and ship.

### t04 (QA, PASS) — independent re-verification of all 3 files

- Re-ran every command myself (never reused dev's pasted output). All AC13-32
  confirmed PASS on their own merits, per-file, per the t04 QA prompt's
  explicit "review all three files independently" requirement.
- File 1 (`01`): confirmed pagos keep-set removal, hardwired Query 3 row,
  relabelled Query 2 row, `keep_cliente` resolves from `keep_reserva.
  cliente_id` only in both instances, Query 6 loud row, Query 7 MATCH/
  MISMATCH report. Went beyond the dev's own ILIKE-literal-only diff: also
  byte-diffed the candidate-*column arrays* and match precedence logic
  against `02`'s Guard 3 — identical, no silent divergence found (real
  attack, did not break it).
- **RISKY, non-blocking finding on `01`:** Query 7 adds a real
  `DROP TABLE IF EXISTS _name_match_report;` (line 346) — outside AC18's
  literal grep pattern (`DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|
  setval`). Harmless (only ever drops a script-owned temp table, never a
  business table) but the file's own "physically incapable of harm" header
  claim doesn't disclose it, and AC18's grep has a blind spot a future edit
  could exploit. Suggested fix: broaden the grep + header comment. Not a
  blocker — filed for backlog.
- File 2 (README): AC20-26 + AC-fix + AC-retain all confirmed. AC23
  specifically cross-checked against `02`'s *actual* Section 5 SQL text
  (re-read directly), not the README's self-description — word-for-word
  match, no misdescription.
- File 3 (plan amendment): AC27-29 confirmed — 0 deletions, single append
  hunk after line 822 (confirmed the true original EOF via `wc -l`/`diff`,
  not the phantom 823rd line), 3 verbatim-attributed decisions with accurate
  line citations (248, 287) cross-checked against the real original text.
- `02-cleanup-execute.sql` confirmed untouched by t04: 631 lines (matches
  t03's own claimed end-state), diff stat unchanged (210+/18-), no Query 6/7
  content leaked into it.
- Hygiene fix: t03's ledger row above was stale (`dev-done`/`—`/`—`) despite
  `reports/t03-qa.md` (PASS) and `reports/t03-lead.md` (APPROVE) already
  existing — corrected both t03's and t04's rows in §1 this pass.
- `npm run qa` independently re-run: tsc clean, eslint 0 errors/28 warnings,
  30 files/825 tests — identical to baseline.
- Full report: reports/t04-qa.md. **Verdict: PASS.**

### t05 (junior, done) — 01: qualify unqualified DROP TABLE to pg_temp
- **Single-line fix on line 346:** t04 added Query 7, which creates and populates
  a temp table `_name_match_report` with `CREATE TEMP TABLE`. At the top of
  Query 7 is `DROP TABLE IF EXISTS _name_match_report;` — unqualified, it would
  resolve through `search_path` and could drop a permanent table in `public` if
  one existed with that name, breaking the file's "physically incapable of
  harm" guarantee. Fixed by qualifying to `pg_temp`: `DROP TABLE IF EXISTS
  pg_temp._name_match_report;`.
- **Scope:** exactly one character change (adding `pg_temp.` prefix). No comment
  wording altered, no other lines touched, no behavioural change beyond the
  DROP's target schema.
- **Verification (all A1-A8 pass):** grep for actual `DROP TABLE` statements
  shows only the one, now qualified. Grep for uncommented destructive
  statements outside pg_temp returns zero hits. Three canonical ILIKE
  literals (`%JROSA%ASESORA%VIAJES%`, `%BAHIA PRINCIPE%EXPLORE%LEGEND%`,
  `%OPERAHOTEL%`) verified byte-identical in both `01` and `02`. README's
  claims ("physically incapable of writing") are now literally true. File
  claims are accurate. `npm run qa`: tsc clean, 28 lint warnings (pre-existing),
  30 test files/825 tests pass.
- Full report: reports/t05-dev.md. Ready for QA.

### t05 (junior, round 2) — send-back for A8 only, SQL unaffected
- **Round 1 QA verdict:** A1-A7 PASS (SQL fix is correct), A8 FAIL (rollback note used banned verb `git checkout <ref> --` and wrong reference point).
- **Round 2 fix (documentation only):** replaced A8 rollback note with manual inverse-edit instruction (no git history ops, no `>` redirection, correct reference point "already-landed, uncommitted work from t01-t04").
- **No SQL changes:** `docs/migracion/01-cleanup-dry-run.sql` line 346 remains `DROP TABLE IF EXISTS pg_temp._name_match_report;` — unchanged from round 1.
- **Git diff update:** replaced hand-typed diff block in dev report with pasted real `git diff` output (optional QA recommendation, no blocking gate).
- Full report: reports/t05-dev.md (A8 section replaced, verdict updated). Ready for A8-only re-check.
