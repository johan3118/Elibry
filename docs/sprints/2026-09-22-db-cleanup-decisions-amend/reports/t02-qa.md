# t02 QA report — Guard 3, three-entity name-assertion guard

Verdict: PASS

Every command below was independently re-run by QA (not copy-pasted from the
dev report). Where the dev's own pasted output is quoted for comparison, it
is explicitly labelled as such.

## Commands run

```
$ git status --porcelain
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
Matches scratchpad's documented pre-existing untracked entries (predate this
task, ignorable per brief). Only the one in-scope file modified.

```
$ git log -1 --oneline
3faa20c fix
```

```
$ rg -n '^DO \$\$' docs/migracion/02-cleanup-execute.sql
40:DO $$
60:DO $$
102:DO $$
312:DO $$
379:DO $$
493:DO $$

$ rg -n "^DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -3
268:DELETE FROM seguimiento_comentarios;                    -- CASCADE child of casos (036:34); explicit anyway
269:DELETE FROM seguimiento_casos;
275:DELETE FROM pagos;
```
AC7b — PASS. Guard 3's `DO $$` opens at line 102, strictly before the file's
first executable `DELETE FROM` at line 268 (40/60 = Guards 1-2, 312/379/493
are pre-existing later blocks unrelated to this task).

```
$ rg -n "information_schema" docs/migracion/02-cleanup-execute.sql
85:-- below is checked against information_schema.columns at run time
123:      SELECT 1 FROM information_schema.columns
146:      SELECT 1 FROM information_schema.columns
174:      SELECT 1 FROM information_schema.columns
316:      SELECT 1 FROM information_schema.columns
```
AC7c — PASS. Three per-entity self-detect checks (123/146/174), each inside a
`FOREACH v_col IN ARRAY v_*_cols LOOP` over the exact candidate lists from
plan §7 (`clientes`: nombre_completo/razon_social/nombre_comercial;
`productos`: nombre_producto/nombre_original; `suplidores`:
razon_social/nombre_comercial — confirmed by reading the full inserted block,
not just the grep). No hardcoded single-column dependency: every value fetch
goes through dynamic `EXECUTE format('SELECT %I FROM <table> WHERE id = $1',
v_col)`, `v_col` sourced only from the candidate array, never a literal
column name in the SELECT.

```
$ grep -no "'%[A-Z% ]*%'" docs/migracion/02-cleanup-execute.sql | sort -u
130:'%JROSA%ASESORA%VIAJES%'
153:'%BAHIA PRINCIPE%EXPLORE%LEGEND%'
181:'%OPERAHOTEL%'
90:'%JROSA%ASESORA%VIAJES%'
91:'%BAHIA PRINCIPE%EXPLORE%LEGEND%'
92:'%OPERAHOTEL%'
```
AC8 (literal exactness) — PASS. Exactly the three canonical literals from
plan §7, byte-identical between the executable `ILIKE` lines (130/153/181)
and the header comment restating them (90-92). No fourth or divergent
pattern anywhere in the file.

```
$ rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql
(no matches, rg exit 1)
```
Scope constraint — PASS. Zero `UPDATE` statements added by this task (that's
t03's job per HC-1).

```
$ rg -n "RAISE EXCEPTION" docs/migracion/02-cleanup-execute.sql
46:...expected exactly 1 reserva...
69:...cliente_id IS NULL...
72:...producto_id IS NULL...
135:'ABORT: GUARD 3 (cliente, no-candidate-column) — ...'
137:'ABORT: GUARD 3 (cliente, name-null-or-empty) — ...'
139:'ABORT: GUARD 3 (cliente, no-match) — ...'
158:'ABORT: GUARD 3 (producto, no-candidate-column) — ...'
160:'ABORT: GUARD 3 (producto, name-null-or-empty) — ...'
162:'ABORT: GUARD 3 (producto, no-match) — ...'
168:'ABORT: GUARD 3 (suplidor, suplidor-id-null) — ...'
186:'ABORT: GUARD 3 (suplidor, no-candidate-column) — ...'
188:'ABORT: GUARD 3 (suplidor, name-null-or-empty) — ...'
190:'ABORT: GUARD 3 (suplidor, no-match) — ...'
```
AC7d — PASS. Read the full text of each message directly in the file (not
just grep for the label). Four distinct tags used across the three entities
(`no-candidate-column`, `name-null-or-empty`, `no-match`, and the
suplidor-only `suplidor-id-null`), each with its own wording naming exactly
which condition fired. The string `MISMATCH` appears exactly once in the
whole file, and only inside the explanatory header comment negating it
("never collapsed into one generic 'MISMATCH'") — never as an actual raised
message:
```
$ grep -n "MISMATCH" docs/migracion/02-cleanup-execute.sql
93:-- Four distinct abort states, never collapsed into one generic "MISMATCH"
```

```
$ git show HEAD:docs/migracion/02-cleanup-execute.sql | sed -n '40,74p' > /tmp/guards_old.txt
$ sed -n '40,74p' docs/migracion/02-cleanup-execute.sql > /tmp/guards_new.txt
$ diff /tmp/guards_old.txt /tmp/guards_new.txt
(no output)
```
AC7e — PASS. Guards 1-2 (lines 40-74) are byte-identical to `HEAD` (3faa20c),
confirmed by direct line-range diff, not by trusting the dev's hunk-header
argument alone.

**Stronger scope proof than the dev report attempted** (reconstructed the
post-t01 file by mechanically excising exactly the Guard-3 block from the
current working tree, then diffed the result against `HEAD`):
```
$ python3 - <<'EOF'   # locates the Guard-3 block boundaries by content match
...
sep_idx(0-based) 75 -> line 76
end_idx (separator before SECTION1) 193 -> line 194
EOF
$ sed -n '1,75p;194,$p' docs/migracion/02-cleanup-execute.sql > /tmp/reconstructed_post_t01.sql
$ git show HEAD:docs/migracion/02-cleanup-execute.sql > /tmp/head_file.sql
$ diff -u /tmp/head_file.sql /tmp/reconstructed_post_t01.sql
```
Result: exactly the same 8 hunks, at the same old/new line numbers, with the
same content, as t01's already-PASSed diff in `reports/t01-dev.md` /
`reports/t01-qa.md`. This proves — independent of anything the t02 dev
claimed — that removing precisely the inserted Guard-3 block (lines 76-193)
from the current file reconstructs t01's file byte-for-byte. **t02 changed
nothing except inserting the Guard-3 block.**

```
$ rg -n "TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY" docs/migracion/02-cleanup-execute.sql
24:--   - SET session_replication_role = replica;  (056:8 — ...
26:--   - ALTER SEQUENCE ... RESTART WITH ...       (056:91-141 — ...
29:--   - TRUNCATE, DROP TABLE, DROP VIEW, DROP POLICY, ALTER ... DISABLE ROW LEVEL
30:--     SECURITY, CREATE POLICY
266:-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE
324:    RAISE NOTICE 'comprobantes_fiscales does not exist (matches 039:2 DROP TABLE ... CASCADE) — nothing to do.';
378:-- keep set -> bare DELETE, chosen over TRUNCATE to stay in this transaction.
448:-- Rows survive in most tables, so ALTER SEQUENCE ... RESTART WITH 1 (the
465:-- permitted form here — never RESTART WITH 1, since another future run of this
```
All 9 hits are inside `--` comments. 0 executable occurrences.

```
$ head -35 docs/migracion/02-cleanup-execute.sql | grep -n "^BEGIN;"
33:BEGIN;
$ tail -3 docs/migracion/02-cleanup-execute.sql
-- This is a real commit. Nothing above this line was a dry run.
-- =============================================================================
COMMIT;
$ rg -n "^\s*ROLLBACK;" docs/migracion/02-cleanup-execute.sql
(no matches)
```
AC10 — PASS. File still opens `BEGIN;` (line 33), ends `COMMIT;` (line 579),
no `ROLLBACK;`.

```
$ rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql
(no matches, rg exit 1)

$ grep -n "comprobantes_disponibles" docs/migracion/02-cleanup-execute.sql
420:-- comprobantes_disponibles holds LIVE DGII NCF SEQUENCE STATE: numero_actual
443:-- DELETE FROM comprobantes_disponibles; -- COMPLIANCE EVENT — see warning above. Requires fiscal sign-off.
```
AC11 — PASS. 0 uncommented `DELETE FROM` against any Section-B/fiscal-gate
table. `comprobantes_disponibles`'s only `DELETE` is commented out, exactly
as it was before this task. Undischarged fiscal gate untouched.

```
$ wc -l docs/migracion/02-cleanup-execute.sql
     579 docs/migracion/02-cleanup-execute.sql
```
HC-2 line-budget — PASS (flag, not split). 579 > 500 ceiling. Dev report
explicitly flags this ("FLAG: refactor signal... The file is NOT split")
and the scratchpad §3 close queue already records HC-2 as a human-facing
flag. No file split occurred — confirmed there is still exactly one
`docs/migracion/02-cleanup-execute.sql` file in scope, one `BEGIN;`/`COMMIT;`
pair (checked above).

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test
> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(clean, no output)
> my-v0-project@0.1.0 lint
> eslint .
✖ 28 problems (0 errors, 28 warnings)
> my-v0-project@0.1.0 test
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  07:15:35
   Duration  1.91s
$ echo "exit=$?"
exit=0
```
S2/S3 — PASS. Identical shape to t01's baseline (typecheck clean; lint 0
errors / 28 pre-existing warnings, same warning classes — react-hooks/
exhaustive-deps + @next/next/no-img-element across app/clientes, app/crm,
app/facturacion, app/page.tsx, app/pagos, app/productos, app/reservas; 30
files / 825 tests passing). No `app/`, `lib/`, `components/`, `tests/`, or
config file is in this task's diff, so this had to be identical — confirmed
identical, not merely "close".

```
$ git diff --stat -- docs/
 docs/migracion/02-cleanup-execute.sql | 174 ++++++++++++++++++++++++++++++----
 1 file changed, 157 insertions(+), 17 deletions(-)
$ git diff -- docs/migracion/02-cleanup-execute.sql | grep -c "^@@"
8
```
8 hunks — Edit-style incremental diff, not a whole-file rewrite
(`mistakes/blind-write-partial-read` respected).

## AC8 — independent written substitution argument (QA's own words, not restating the dev's)

- **`'%JROSA%ASESORA%VIAJES%'`** — the pattern demands three tokens in a
  fixed order with arbitrary text allowed between them: `JROSA`, then
  `ASESORA`, then `VIAJES`. `JROSA` is not a Spanish or English dictionary
  word, so it functions as a de-facto brand fingerprint. Plausible different
  real entity that fails: **`VIAJES EL SOL SRL`** — a generic Dominican
  travel agency name. It contains `VIAJES` but neither `JROSA` nor `ASESORA`
  anywhere in the string, so the pattern's first required token never
  appears and the match fails at the first `%JROSA%` test. A harder
  near-miss, **`ASESORES DE VIAJES INTERNACIONAL`**, still fails: it has
  `VIAJES` and something ASESOR*-shaped, but never the literal substring
  `JROSA`, so it fails regardless of the other two tokens.
- **`'%BAHIA PRINCIPE%EXPLORE%LEGEND%'`** — requires the full two-word chain
  name plus two additional sub-brand qualifiers, in order. Plausible
  different real entity that fails: **`BAHIA PRINCIPE GRAND AQUAMARINE`** —
  a genuinely distinct, real-sounding property in the same hotel chain. It
  contains `BAHIA PRINCIPE` but has neither `EXPLORE` nor `LEGEND` anywhere
  after it, so the second required token is never found and the match
  fails. This is the pattern where over-matching risk is highest (a tour
  operator plausibly stocks a dozen Bahia Principe products), which is
  exactly why the two extra qualifiers are load-bearing, not decorative.
- **`'%OPERAHOTEL%'`** — one token, but a coined, no-space compound that
  does not occur as a substring of any ordinary Spanish/English phrase built
  from "opera" + "hotel" as two separate words. Plausible different real
  entity that fails: **`OPERADORA HOTELERA DEL CARIBE SRL`** — a realistic
  generic name for a hotel-operating company. Scanning for the contiguous
  literal substring `OPERAHOTEL`: the string contains `OPERADORA` (extra
  `D`, `O`, `R`, `A` before the next word) followed by `HOTELERA` — the
  exact 10-character sequence `O-P-E-R-A-H-O-T-E-L` never occurs
  contiguously, so the match fails. None of the three patterns is a bare
  generic substring like `%SRL%` or `%HOTEL%` — each requires either
  multiple ordered tokens or one coined compound absent from ordinary
  business-name vocabulary. **No automatic-FAIL condition (weak-backstop-guard)
  applies.**
- **Adversarial follow-up I tried and explicitly did not let pass as a
  finding:** substring ILIKE matching is inherently vulnerable to
  coincidental overlap inside a longer coined word — e.g. a contrived name
  like `COOPERAHOTEL` (`co-opera-hotel`) contains `OPERAHOTEL` as a
  contiguous substring purely by coincidence. I judged this **not** a
  genuinely plausible real Dominican supplier name (it requires manufacturing
  a compound word specifically to create the overlap, not naming an entity
  that actually exists in this domain), so it does not satisfy AC8's "one
  plausible different real-world entity" bar, and I am not failing the task
  on it. Recorded here as a design property worth knowing, not a defect:
  substring-based ILIKE matching can never be made airtight against
  adversarially-constructed names; the plan accepted this tradeoff
  explicitly (§7) in exchange for zero live-DB dependency.

## Acceptance criteria

- AC7a (resolve cliente/producto/suplidor name, RAISE EXCEPTION unless all three ILIKE-match) — PASS
- AC7b (Guard 3 strictly before first DELETE, line-number proof) — PASS (102 < 268)
- AC7c (columns self-detected via information_schema, zero hardcoded single-column dependency) — PASS
- AC8 (exact literals, written substitution argument, no bare generic substring) — PASS
- AC7d (four distinct non-collapsing abort states/messages) — PASS
- AC7e (Guards 1-2 byte-identical, pure addition) — PASS
- AC10 (regression: 0 hits for banned DDL/policy ops outside comments; BEGIN/COMMIT/no ROLLBACK) — PASS
- AC11 (0 uncommented DELETE against Section-B/fiscal-gate tables) — PASS
- Scope constraint (0 `UPDATE` statements added) — PASS
- AC12/HC-2 (line-budget overage flagged, not split) — PASS
- S1 (git status --porcelain: only the in-scope file) — PASS
- S2/S3 (`npm run qa` run, output pasted, identical to t01 baseline) — PASS
- S4 (runtime claims labelled UNVERIFIED) — PASS (dev report's dedicated "UNVERIFIED runtime claims" section is present and honest)
- S5 (rollback note: correct reference point, no banned verb, no `>` redirection) — PASS
- mistakes/blind-write-partial-read (Edit-style hunks, not whole-file rewrite) — PASS

## Out-of-scope changes

None. Independently reconstructed the post-t01 file by removing exactly the
Guard-3 insertion (lines 76-193) from the current working tree and diffed it
against `HEAD` (3faa20c) — the result is byte-identical, hunk-for-hunk and
line-for-line, to t01's already-PASSed diff. This is a stronger scope proof
than accepting the dev's line-range assertion.

## Bugs found

None blocking. One non-blocking observation for the backlog (not an AC
violation, not fixed by QA per the rules): if `cliente_id`/`producto_id`/
`suplidor_id` points at a row that no longer exists (orphaned FK, no live DB
to rule this out), every candidate column's dynamic `SELECT ... WHERE id =
$1` returns no row, so `v_val` stays NULL for all candidates. The guard
correctly still aborts (falls into the `name-null-or-empty` branch) — it
does not silently proceed — but the exception message says "has every
candidate name column NULL or empty" rather than "no such row exists",
which is a minor label imprecision, not a safety gap. Safe to leave as-is;
flagging for the sprint's backlog rather than requesting a fix (out of this
task's scope per `mistakes/unrequested-hardening-regression`).

## Suggested fixes

None required for PASS. Optional, non-blocking: if the dev wants to tighten
diagnostics later, the `name-null-or-empty` message could optionally note
"or the id does not exist" — purely cosmetic, not requested as a change to
this diff.

## Rollback note verification (S5)

Dev's note: "The file's state at the start of t02 ... was 461 lines, with
Guard 3 absent ... To roll back t02 only: remove the inserted block that
starts at the line `-- GUARD 3 ...` and ends at the `END $$;` immediately
before the restored `-- SECTION 1 —` header comment ... leaving everything
else (t01's already-landed changes) untouched." No banned verb (`git
checkout <ref> --`, `reset --hard`, `clean -fd`, `stash drop`), no `>`
redirection. Reference point (461 lines, post-t01, pre-t02) independently
confirmed correct against `reports/t01-qa.md`'s own `wc -l` output (461).

## Attack Log (adversarial-qa skill)

- RLS / org isolation: N/A, evidenced — `decisions/0011-elibry-single-tenant-for-now`
  forbids adding or weakening RLS this sprint; confirmed 0 hits for
  `CREATE POLICY`/`DROP POLICY`/`DISABLE ROW LEVEL SECURITY` in the file
  (regression grep above), and this task adds no table, no policy, no DDL.
  No RLS surface exists to probe.
- Optimistic UI: N/A — zero UI, zero component, zero mutation in this
  sprint's surface (plan §6). Nothing to force-fail.
- Realtime: N/A — no subscriber, no realtime channel touched.
- Edge cases tried: (1) orphaned FK (cliente_id/producto_id/suplidor_id
  pointing at a deleted row) — traced by hand through the PL/pgSQL logic,
  confirmed it still aborts (safe, see Bugs found); (2) case-difference in a
  matching name (`ILIKE` case-insensitivity) — confirmed by Postgres
  semantics, not merely assumed; (3) multiple candidate columns present with
  only one matching — confirmed the `v_matched` flag is OR'd across the
  `FOREACH` loop and not reset per-column, so a single matching candidate
  correctly passes; (4) coincidental substring overlap inside a longer
  coined word (`COOPERAHOTEL`) — tried deliberately to break AC8's "no bare
  generic substring" bar, concluded it is a contrived (not plausible)
  counter-example and does not overturn the PASS, but recorded as an
  inherent property of ILIKE substring matching.
- What I tried that could have broken this: reconstructed the exact
  pre-t02 file state from the current working tree by mechanically excising
  the Guard-3 block and diffing the remainder against `HEAD`, specifically
  to catch an out-of-scope edit hiding inside a hunk the dev's own line-range
  narrative might have glossed over — it came back byte-identical to t01's
  already-approved diff, so the scope claim survived a harder test than
  "trust the dev's hunk-header pointer." I also hand-traced the orphaned-FK
  and multi-candidate-match code paths (no live DB to execute against) and
  tried to construct a real-world name that would slip past each of the
  three ILIKE patterns without becoming a bare generic substring; none
  succeeded except a contrived, not-plausible compound-word coincidence.

## Verdict: PASS
