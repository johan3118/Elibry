# Plan — Amend the DB-cleanup scripts: full `pagos` wipe + name-assertion guard

Sprint slug: `db-cleanup-decisions-amend` · opened 2026-09-22
Scratchpad: `docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md`
Amends (does not replace): `docs/plans/db-cleanup-keep-one-reserva.md`

---

## 0. Grounding — what I actually opened (not the CLAUDE.md summary)

Everything below was read this session, in full, at `HEAD = 3faa20c`:

| File | Lines read | What it actually is |
|---|---|---|
| `docs/migracion/02-cleanup-execute.sql` | 1-439 (whole file) | One `BEGIN;`…`COMMIT;` transaction. Guard 1 (40-48), Guard 2 (60-74), temp-table KEEP set (84-110), `_before_snapshot` (117-124), Section A deletes (133-277), Section B commented (280-309), Section C commented (312-334), Section D ledger (337-348), post-conditions (359-420), final report `SELECT` (426-434) |
| `docs/migracion/01-cleanup-dry-run.sql` | 1-289 (whole file) | 5 read-only queries. Q1 loud preflight (46-53), Q2 KEEP-set listing (61-99), Q3 per-table grid (114-231), Q4 `comprobantes_fiscales` (242-262), Q5 undeclared-table census (272-288) |
| `docs/migracion/README-cleanup.md` | 1-250 (whole file) | 6-step operator runbook + KEEP-set prose (196-214) + "NOT covered" (218-232) + Rollback (236-249) |
| `docs/plans/db-cleanup-keep-one-reserva.md` | headings + §4 (228-277), §5 (278-305), §11 (814-823) | The superseded design. `_keep_pago` is defined at §4:248; §5 step 3 (line 287) binds `pagos` to `WHERE id NOT IN _keep_pago`. File ends at line 823 with its own `PLAN_PATH:` line |
| `lib/finance.ts` | 1-129 (whole file) | The single source of truth for MONTO PAGADO / BALANCE RESERVA / BALANCE GENERAL — **pure functions, computed from the `pagos` rows at read time** (`montosDePagosDeReserva`, `calcularBalanceReserva`) |
| `app/reservas/ver/[id]/page.tsx` | 123-135, 196-215, 426-452 | Overwrites `balance_reserva` / `balance_general` / `balance_abonado` **in memory** from the live `pagos` rows before rendering (196-215). The stored DB columns are not what this screen shows |
| `scripts/001-create-tables.sql` | 15-80, 177-179, 217, 255 | Name columns: `suplidores.razon_social`/`nombre_comercial`, `clientes.nombre_completo`/`razon_social`/`nombre_comercial`, `productos.nombre_producto`/`nombre_original`. `AFTER INSERT OR UPDATE OR DELETE ON pagos` audit trigger at 255 |
| `scripts/007,026,027,029,030` | balance lines | `reservas.balance_reserva`/`balance_general`/`balance_abonado` (007:34-36), `monto_pagado` (026:53-54), `abonado_contabilidad`. **027 and 030 define `balance_reserva` contradictorily** (027:53 = `precio_total - abonado_contabilidad`; 030:35 = `precio_total`) |
| `package.json` | 5-13 | `qa` = `npm run typecheck && npm run lint && npm run test` = `tsc --noEmit` → `eslint .` → `vitest run` |

**Live `information_schema` is NOT available.** `db.jznchzgpaovmgjezvdwo.supabase.co` has no DNS answer (briefing, verified this session). Per `mistakes/schema-source-of-truth`, `scripts/*.sql` is **not evidence** of the live schema — it has been wrong six-plus separate times in this exact repo. Every column name this sprint needs must therefore be **detected at runtime** (`information_schema` inside the script) or **refused**, never hardcoded on faith. This is the hardest constraint of the sprint and it shapes T2 and T3 completely.

### 0.1 The complete `_keep_pago` consumer inventory (derived by grepping the WHOLE file, not the named line)

`mistakes/incomplete-control-enumeration` + `mistakes/spec-manufactured-divergence`. `rg -n "_keep_pago"` gives **6 literal hits in 02**; there are **3 further non-literal consumers** that assert "some pagos survive" and would be left divergent:

| # | `02` line(s) | Site | Literal `_keep_pago`? | Must become |
|---|---|---|---|---|
| C1 | 95-96 | `CREATE TEMP TABLE _keep_pago` | yes | removed (replaced by a comment naming the amendment) |
| C2 | 98-101 | `_keep_cliente` UNION branch | yes | `_keep_cliente` = `_keep_reserva.cliente_id` only |
| C3 | 117-124 | `_before_snapshot.n_pagos` | yes (124) | repurposed: count sourced **directly** from `pagos WHERE reserva_id IN _keep_reserva`, renamed to mean "payments that WILL be destroyed" |
| C4 | 143 | `DELETE FROM pagos WHERE id NOT IN (...)` | yes | `DELETE FROM pagos;` (bare, unconditional) |
| C5 | 222 | `cambios_provisionales` `tabla_afectada='pagos'` branch | yes | branch commented out as always-false |
| C6 | 234 | `acciones_pendientes` `tabla_objetivo='pagos'` branch | yes | branch commented out as always-false |
| C7 | 403 + 414-416 | post-condition `v_n_pagos <> v_before.n_pagos` | **no** | `IF v_n_pagos <> 0 THEN RAISE EXCEPTION …` |
| C8 | 433 | final report grid `n_pagos` sub-select | **no** | kept as-is; it runs after the wipe so it is `0` by construction — add a comment saying exactly that |
| C9 | 76-82 | Section-1 header comment: *"Why materialise …: `_keep_cliente` reads `pagos`"* | **no** (prose) | rewritten — that rationale is now factually dead |

In `01`, `rg -n "keep_pago"` gives **9 hits**: 72-74 (Q2 CTE), 78 (Q2 `keep_cliente` UNION), 95 (Q2 listing row), 125-126 (Q3 CTE), 131 (Q3 `keep_cliente` UNION), 150 (`keep_cambios` pagos branch), 162 (`keep_acciones` pagos branch), 188-189 (Q3 `pagos` row FILTERs). All nine move in T4.

In `README-cleanup.md` the KEEP set prose claims payments are kept — **twice**, once in Spanish (line 202: *"y sus pagos (`pagos`)"*) and once in English (line 211: *"and its payments (`pagos`)"*). Both move in T6. `mistakes/schema-source-of-truth` instance 6: the sweep unit is the task's declared file scope, not the one line a finding cited.

---

## 1. Technical approach (one paragraph)

Three surgical, additive-or-deleting edits to two SQL scripts, one prose rewrite, one append-only plan amendment — no application code, no migration, no DDL, no DB execution. In `02`, `pagos` stops having a keep set at all: `_keep_pago` is deleted and each of its nine consumer sites (0.1) is migrated in the same task so nothing is left asserting that a payment survives; the `pagos` post-condition flips from "count unchanged" to "count is exactly zero", which is a *strictly stronger* assertion and therefore cannot mask the new behaviour. A third preflight guard is added ahead of the file's first `DELETE`, resolving the kept reserva's cliente / producto / producto-suplidor names and `RAISE EXCEPTION`-aborting the whole transaction unless all three match distinctive case-insensitive substrings — with the column names *detected at runtime via `information_schema`*, never hardcoded, because the live schema is unreachable and this repo has been burned six times by trusting `scripts/`. Denormalised balance columns are handled by **disclosure, not mutation** (branch AC9b, reasoned in §3): the script adds no `UPDATE`. `01` is then realigned to report the same reality (pagos `rows_to_keep = 0`, a loud "N payments will be destroyed" row, and a MATCH/MISMATCH grid that reuses `02`'s ILIKE literals byte-for-byte), the README's prose is corrected to say plainly that all payment history dies, and the old plan gets an append-only Amendment section recording the three decisions.

---

## 2. Seam map (the total file budget) and its complement

**In scope — exactly four files, all tracked at `3faa20c`:**

| File | Why it is in the budget |
|---|---|
| `docs/migracion/02-cleanup-execute.sql` | the behaviour change itself (T1, T2, T3) |
| `docs/migracion/01-cleanup-dry-run.sql` | must predict what 02 does, or it is a lying dry run (T4, T5) |
| `docs/migracion/README-cleanup.md` | the runbook that describes both (T6) |
| `docs/plans/db-cleanup-keep-one-reserva.md` | append-only decision record (T7) |

**MUST NOT be touched — no task may name any of these:**
- Any file under `app/`, `lib/`, `components/`, `tests/`, `hooks/`, `styles/`, or any config (`package.json`, `tsconfig.json`, `next.config.mjs`, `vitest.config.*`, `eslint*`). `npm run qa` must come back **identical to baseline** precisely because none of these moves (AC31).
- Any file under `scripts/` — this sprint writes no migration and reorders no prior one.
- `CLAUDE.md`, `.claude/**`, `MEMORY/**` (except the scratchpad this plan creates).
- **`02` Section B (lines 280-309)** — stays fully commented, `comprobantes_disponibles` included. An undischarged fiscal human gate from the previous sprint rides on this (briefing). AC11 is a regression check on every single 02 task, not just one.
- **`02` Section C (312-334)** and **Section D (337-348)** — untouched.
- **`02`'s FISCAL GATE block (168-195)** — untouched. It is not a pagos concern.
- **`01` Query 1 / Query 4 / Query 5** — untouched (AC19). Their known imperfections (see §8 backlog) are out of this sprint's frozen scope; `mistakes/unrequested-hardening-regression`: ship change A only.
- **`docs/plans/db-cleanup-keep-one-reserva.md` lines 1-823** — byte-identical after T7.

---

## 3. The two genuinely hard calls (flagged, not hidden)

### HC-1 — the denormalised balance columns cannot be recomputed without guessing a formula. Choose disclosure (AC9b).

`reservas` carries at least five money columns that *look* payment-derived: `balance_reserva`, `balance_general`, `balance_abonado` (`scripts/007:34-36`), `monto_pagado` (`026:53-54`), `abonado_contabilidad`. Detecting **which exist** is easy and safe (`information_schema.columns`). Deciding **what each should become after every payment is deleted** is not, for three independent reasons:

1. **The repo contradicts itself about their meaning.** `scripts/027:53` sets `balance_reserva = precio_total - abonado_contabilidad`; `scripts/030:35` sets `balance_reserva = precio_total` and puts the payment-derived value in `balance_general` instead. Both are in `scripts/`, which `mistakes/schema-source-of-truth` rules is **not evidence** of the live semantics anyway. Live introspection is unavailable. Any formula the script wrote would be a guess — written **inside a committed destructive transaction, into money columns**.
2. **The app does not read them as truth.** `app/reservas/ver/[id]/page.tsx:196-215` recomputes `balance_reserva`/`balance_general`/`balance_abonado` in memory from the live `pagos` rows via `lib/finance.ts` before rendering. The screen an operator will look at after the wipe is already self-healing. A stored stale value is a data-hygiene concern for other consumers, not a rendering bug on the main path.
3. **Line budget.** `02` is 439 lines against the 500-line ceiling (`.claude/rules/file-size.md`). A guarded dynamic-UPDATE block costs ~45 lines on top of Guard 3's ~35.

**Decision: branch (b) — disclose, do not mutate.** `02` gains a read-only `information_schema` probe that reports *which* candidate balance columns actually exist on `reservas` at run time and their current values for the kept reserva, plus an explicit instruction that these may now be stale and must be checked by hand. **Zero `UPDATE` statements are added to `02`** — that is the testable form of this decision (`rg -n '^\s*UPDATE ' docs/migracion/02-cleanup-execute.sql` → 0 hits). The reasoning above goes inline in the file, per AC9's "choice documented inline".
**Surfacing note that the dev must not miss:** `02`'s own header (lines 422-425) already establishes that `RAISE NOTICE` is **not reliably surfaced by the Supabase SQL editor**. A NOTICE-only disclosure would therefore be invisible to the exact operator it is written for. The disclosure must land in the **final report result grid** as well as a NOTICE. This is `mistakes/runbook-pass-condition-misdescribes-behavior` pre-empted at the source.

### HC-2 — the 500-line ceiling collides with the one-transaction invariant. FLAG, never split.

`02` is 439 lines. T1 is roughly net-neutral (deletes ~8, adds ~10 of comment), T2 adds ~35, T3 adds ~30 → the file lands around **500-515 lines**. `.claude/rules/file-size.md` says a file over ~500 lines is a refactor signal and that splitting is *itself a scoped task, never bundled into a feature task*. Here splitting is worse than a scope violation: `02` is **one `BEGIN;`…`COMMIT;`**. Cutting it into two files creates a **second commit trigger**, which is exactly `mistakes/confirm-gate-false-commit` (the confirm gate must stay one trigger — the 01/02 split is the one trigger boundary this design allows). **Ruling: if T3 pushes `02` past 500 lines, the dev FLAGS it loudly in the dev report and adds a backlog line to the scratchpad §3 — and does not split.** The human sees the flag at sprint close. Mitigation available to the dev *within* the rule: prefer terse comments; the file's existing comment density is high, but T1 deletes a now-false rationale (C9) and two branch lines (C5/C6) which buys some of the budget back.

---

## 4. DB changes / RLS / org isolation

**None. Zero. Not one line of DDL.**
- No `CREATE TABLE`, no `ALTER TABLE`, no new migration in `scripts/`, no new `0NN-` file.
- The only `CREATE` statements touched are `CREATE TEMP TABLE … ON COMMIT DROP` inside `02`'s own transaction (one of which, `_keep_pago`, is being **removed**). Temp tables live and die inside the transaction; they are not schema.
- **RLS: untouched, neither added nor weakened.** Per `decisions/0011-elibry-single-tenant-for-now`, Elibry is deliberately single-tenant with no auth and no RLS on the ~29 business tables; building org isolation now was explicitly *rejected*. This is a DML-script sprint — re-proposing RLS here would re-litigate a live ADR. AC10's regression grep enforces the invariant mechanically: `CREATE POLICY`, `DROP POLICY`, and `ALTER … DISABLE ROW LEVEL SECURITY` must all have **0 hits** in `02`. The one real RLS fact in play is already documented and stays documented: `reserva_pasajeros` / `reserva_ocupaciones` have RLS enabled `TO authenticated` without `FORCE`, so a non-owner run of `02` could silently match zero rows there (`README-cleanup.md:125-131`) — T6 must not delete that caveat.

## 5. API / service changes

**None.** No `lib/supabase.ts` helper, no route handler, no server action, no data-layer function is touched. These four files are operator artifacts; nothing in the Next.js app imports or executes them.

## 6. UI changes

**None.** No component, no page, no optimistic mutation, therefore no rollback path to copy and no realtime subscriber to update. The nearest UI *consequence* — a post-wipe reserva showing zero payments — is already handled by the existing read-time recomputation at `app/reservas/ver/[id]/page.tsx:196-215` + `lib/finance.ts`, which this sprint does not modify.

---

## 7. The name guard (T2) — design the dev implements

**The three operator-named entities and their canonical ILIKE literals.** These are decided here so that `01` and `02` cannot drift (AC17's cross-file coupling); **T2 writes them into `02`, T5 copies them out of `02` byte-for-byte**:

| Entity | Resolved from | Canonical pattern |
|---|---|---|
| cliente | `reservas.cliente_id` → `clientes` | `'%JROSA%ASESORA%VIAJES%'` |
| producto | `reservas.producto_id` → `productos` | `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'` |
| suplidor | `productos.suplidor_id` → `suplidores` | `'%OPERAHOTEL%'` |

**Strictness argument (AC8 — this is the written substitution reasoning, it cannot be executed against a DB):**
- `%JROSA%ASESORA%VIAJES%` — `JROSA` is a coined token, not a dictionary word. A different-but-plausible travel agency (`VIAJES CARIBE SRL`, `ASESORES DE VIAJES DEL ESTE`, `J. ROSA TOURS`) fails: the first two lack `JROSA`, the third lacks the contiguous `JROSA` sequence. Requiring all three tokens **in order** also rejects `JROSA CONSTRUCTORA`.
- `%BAHIA PRINCIPE%EXPLORE%LEGEND%` — the chain name alone (`BAHIA PRINCIPE`) is *not* sufficient and deliberately is not the pattern; a sibling property (`BAHIA PRINCIPE GRAND PUNTA CANA`, `BAHIA PRINCIPE LUXURY AMBAR`) fails on `EXPLORE` and `LEGEND`. This is the single most important pattern to keep narrow, because a tour operator's DB plausibly holds a dozen Bahia Principe products.
- `%OPERAHOTEL%` — one token, but a **coined compound**: `OPERA TOURS SRL`, `HOTEL OPERA`, `OPERADORA HOTELERA SRL` all fail (no contiguous `OPERAHOTEL`). A bare `%SRL%` or `%HOTEL%` would match half the table and is explicitly what AC8 forbids.

**Column resolution must self-detect (`mistakes/schema-source-of-truth`).** The guard may **not** hardcode `clientes.nombre_completo`. It builds, per entity, the set of candidate name columns that actually exist at run time via `information_schema.columns`, and matches the pattern against any of them:
- `clientes`: `nombre_completo`, `razon_social`, `nombre_comercial`
- `productos`: `nombre_producto`, `nombre_original`
- `suplidores`: `razon_social`, `nombre_comercial`

Candidate lists above are corroborated by `scripts/001-create-tables.sql:17-18,52-57,75-76` — cited as *corroboration, never as proof*. If **none** of an entity's candidate columns exists at run time, the guard must abort with a message that says so explicitly.

**Non-collapse of outcomes (`decisions/0012-elibry-confirmacion-without-factura-numero`).** The guard's failure messages must distinguish at least four states, never merging them into one "MISMATCH": (a) name present and does not match the pattern; (b) name column exists but is NULL/empty; (c) no candidate name column exists on that table at run time; (d) `productos.suplidor_id IS NULL` so no suplidor row can be resolved at all (Guard 2 checks `cliente_id`/`producto_id`, **not** `suplidor_id` — this state is reachable today). All four abort; they must abort saying *which*.

**Position.** Guard 3 goes after Guard 2 (line 74) and before Section 1 — comfortably before the file's first `DELETE FROM` at line 137. AC7's proof is a line-number comparison of the two `rg -n` outputs.

---

## 8. Edge cases

| Case | Where it is handled |
|---|---|
| Kept reserva has **zero** payments today | Fine and must stay *distinguishable* from "lookup failed" (ADR-0012 analogue in the briefing). 01's new loud row must read `0 payments … ALL will be destroyed` as a real answer, never as an error or a blank. |
| `pagos.cliente_id` diverges from `reservas.cliente_id` | **Deliberate behaviour change.** Such a client was previously kept via the `_keep_pago` UNION; now it is deleted. Safe on FKs because all `pagos` die first (Step 3 stays before Step 10), and the post-condition still proves `reservas.cliente_id` resolves. T1 must state this in the replacement comment at C2/C9. |
| `cambios_provisionales` / `acciones_pendientes` rows with `tabla = 'pagos'` | Now deleted (their branch is always false). Commented out rather than silently removed, so a reader sees *why* (AC4). |
| `auditoria` grows during the run | Unchanged — the unconditional `pagos` delete still fires `audit_trigger()` (`scripts/001:255`), and `DELETE FROM auditoria` is still last. The dry run's `auditoria` figure remains a lower bound (01 header 20-26, README 120-124). Do not "fix" this. |
| Post-condition can no longer detect a delete-order bug via before/after equality | Replaced by a **stronger** assertion (`= 0`). A bug that deletes too little now fails; a bug that deletes too much of `pagos` is definitionally impossible since the target is zero. |
| Guard 3 aborts | Nothing is committed — it precedes the first `DELETE` and the whole file is one transaction. Same class as Guards 1/2; T6 documents it in the same list (README 169-174). |
| Concurrent edits / realtime races | **Cannot occur.** No UI, no subscription, no optimistic mutation in this sprint's surface. `02` is a single-session transactional script; its intra-script "concurrency-shaped" hazard (keep-set re-evaluation) is already solved by temp-table materialisation, and removing `_keep_pago` strictly *reduces* that surface. |
| Rollback of a committed `02` run | Unchanged and still brutal: restore the Step-1 backup. T6 must keep saying so, now also covering the payments. |

---

## 9. Test plan (exact commands — every AC gets a check)

Run from the repo root. **Every command below must be pasted verbatim into the QA report with its real output** (`decisions/0003-hard-gates-anti-theater`, `decisions/0014-bounded-evidence-rule`, AC32). Paraphrase = FAIL.

```bash
# --- Standing gates, every task ---
npm run qa                                   # AC31 — must match baseline exactly
git status --porcelain                       # AC30 — only the 4 in-scope files, ever
git diff --stat -- docs/                     # scope proof

# --- 02, T1 ---
rg -n "DELETE FROM pagos" docs/migracion/02-cleanup-execute.sql          # AC1 — no NOT IN
rg -n "_keep_pago" docs/migracion/02-cleanup-execute.sql                 # AC2 — classify EVERY hit comment-only
rg -n -A4 "CREATE TEMP TABLE _keep_cliente" docs/migracion/02-cleanup-execute.sql   # AC3
rg -n "tabla_afectada = 'pagos'|tabla_objetivo = 'pagos'" docs/migracion/02-cleanup-execute.sql  # AC4
rg -n "v_n_pagos|n_pagos" docs/migracion/02-cleanup-execute.sql          # AC5, AC6

# --- 02, T2 ---
rg -n "DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -3      # AC7 — first DELETE line no.
rg -n "GUARD 3|ILIKE" docs/migracion/02-cleanup-execute.sql              # AC7 — guard line no. < first DELETE
rg -n "information_schema" docs/migracion/02-cleanup-execute.sql         # AC7 — columns self-detected
#   AC8 is a WRITTEN substitution argument in the QA report (§7 above), not a command.

# --- 02, T3 ---
rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql                # AC9b — must be 0 hits
rg -n "balance|stale" docs/migracion/02-cleanup-execute.sql              # AC9 — disclosure present
wc -l docs/migracion/02-cleanup-execute.sql                              # AC12 — >500 ⇒ FLAG, never split

# --- 02, regression on EVERY 02 task ---
rg -n "TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY" docs/migracion/02-cleanup-execute.sql   # AC10 — 0 hits
head -1 docs/migracion/02-cleanup-execute.sql; rg -n "^BEGIN;|^COMMIT;|^ROLLBACK;" docs/migracion/02-cleanup-execute.sql   # AC10
rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql  # AC11 — 0 UNCOMMENTED hits

# --- 01, T4/T5 ---
rg -n "keep_pago" docs/migracion/01-cleanup-dry-run.sql                  # AC13, AC14
rg -n -B2 -A6 "'pagos'" docs/migracion/01-cleanup-dry-run.sql            # AC13
rg -n -A4 "keep_cliente AS" docs/migracion/01-cleanup-dry-run.sql        # AC15
rg -n "will be|DESTR|destru" docs/migracion/01-cleanup-dry-run.sql       # AC16
rg -n "MATCH|MISMATCH|ILIKE" docs/migracion/01-cleanup-dry-run.sql       # AC17
diff <(rg -o "'%[A-Z% ]+%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) \
     <(rg -o "'%[A-Z% ]+%'" docs/migracion/02-cleanup-execute.sql | sort -u)   # AC17 — MUST be empty
rg -n "DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|setval" docs/migracion/01-cleanup-dry-run.sql  # AC18 — comments only
git diff -- docs/migracion/01-cleanup-dry-run.sql                        # AC19 — Q1/Q4/Q5 hunks absent

# --- README, T6 ---
rg -n "checkout|reset --hard|clean -fd|stash drop|>" docs/migracion/README-cleanup.md   # AC24 — 0 in rollback section
rg -n "UNVERIFIED" docs/migracion/README-cleanup.md                      # AC26
wc -l docs/migracion/README-cleanup.md                                   # AC25
git diff -- docs/migracion/README-cleanup.md                             # AC21 — step order unchanged

# --- Plan amendment, T7 ---
git diff --numstat -- docs/plans/db-cleanup-keep-one-reserva.md          # AC27 — deletions column MUST be 0
rg -n "Amendment" docs/plans/db-cleanup-keep-one-reserva.md              # AC28
rg -n "SELECT|DELETE|CREATE TEMP|ILIKE" docs/plans/db-cleanup-keep-one-reserva.md | awk -F: '$2>823'  # AC29 — 0 hits after line 823
```

**Not tested, and honestly so:** nothing in this sprint is executed against any database. No SQL syntax check, no `psql --dry-run`, no parse. The briefing confirms the live host is gone (no DNS, REST 521), and the frozen spec's NON-GOALS forbid executing SQL anywhere. Every claim about *runtime* behaviour in any dev or QA report must therefore be labelled literally **UNVERIFIED** (`mistakes/assertion-without-verification`, AC26). `npm run qa` proves only that the repo's TS/lint/test surface is unchanged — which is the whole point of AC31, since no file it inspects is in scope.

---

## 10. Plan pre-mortem — which task drifts, and the pre-emption

1. **T1 is the most drift-prone, by a distance.** Its nine consumer sites are spread from line 76 to line 433 of a 439-line file, so a dev with the file open is one impulse away from "while I'm here" fixes to Section B, the FISCAL GATE, or the commented `auditoria` alternative — all of which are `mistakes/unrequested-hardening-regression`, and the Section-B one would ride the undischarged fiscal gate. **Pre-emption:** §0.1 hands the dev the complete, line-numbered inventory so nothing has to be discovered mid-edit; T1's ACs name the forbidden regions explicitly; and QA reads `git diff` **hunk by hunk**, rejecting any hunk whose line range falls outside {76-82, 95-101, 117-124, 137-143, 216-238, 400-416, 426-434}.
2. **T3 could grow into a general balance recompute** (a frozen NON-GOAL). **Pre-emption:** HC-1 converts the boundary into a single grep — zero `UPDATE` statements in `02`. A dev cannot half-violate that.
3. **T5 could "improve" the ILIKE patterns**, silently making `01`'s report weaker or stronger than `02`'s guard — `mistakes/weak-backstop-guard`, where the dry run is the operator's only preview of the guard. **Pre-emption:** T5 copies the literals out of `02` and the `diff <(rg -o …)` command above must print nothing; a single character of divergence fails the task.
4. **T6 could describe what the writer intends rather than what the files do** — `mistakes/runbook-pass-condition-misdescribes-behavior`. **Pre-emption:** T6 runs last, and each README claim it adds must cite the `02`/`01` line it describes, re-read after T1-T5 landed.
5. **`mistakes/blind-write-partial-read`:** `02` is 26 KB. Every task must use **Edit**, never Write/regenerate. This is an AC on all three 02 tasks.

---

## 11. Task list

Standing acceptance criteria — **appended to every task below, all seven**:
- **S1 (AC30)** `git status --porcelain` shows changes to **only** the task's declared files. Zero files outside scope.
- **S2 (AC31)** `npm run qa` actually run, output pasted verbatim, **identical to the sprint baseline** recorded in scratchpad §0 (no `app/`, `lib/`, `components/`, `tests/`, or config file is in any task's scope).
- **S3 (AC32)** Every AC that names a command is backed by that command's pasted output. Paraphrase = FAIL.
- **S4** Every runtime claim not actually executed is labelled literally **UNVERIFIED** (no DB exists to run against).
- **S5** A one-line rollback note naming **the file's state at the START OF THIS TASK** as the reference point, using **no** banned destructive git verb (`git checkout <ref> --`, `reset --hard`, `clean -fd`, `stash drop`) and **no** `>` shell redirection — `mistakes/destructive-op-named-in-rollback-note` (recurred 13×; a conditional hedge does not satisfy it).
- **DB / RLS / org isolation: none** in every task — no DDL, no policy, no migration (§4).

---

### T1 — `02`: unconditional `pagos` wipe + migrate all nine `_keep_pago` consumers
- **Owner:** senior-dev · **Tag:** `[senior]` · **Depends on:** — (first task)
- **Files in scope:** `docs/migracion/02-cleanup-execute.sql` (only)
- **What it does:** Executes every row of the §0.1 inventory C1-C9 in one pass.
- **Acceptance criteria:**
  - **AC1** `rg -n "DELETE FROM pagos" docs/migracion/02-cleanup-execute.sql` shows a bare unconditional statement — no `WHERE`, no `NOT IN`, no keep-set reference. PASS/FAIL on the pasted output.
  - **AC2** `rg -n "_keep_pago" …` — **every** remaining hit is classified in the report as comment-only. One executable hit = FAIL.
  - **AC3** `_keep_cliente` is built from `_keep_reserva.cliente_id` alone; no `pagos`-derived term. The now-dead "why materialise: `_keep_cliente` reads `pagos`" rationale (C9, lines 76-82) is rewritten, and the deliberate consequence (a divergent `pagos.cliente_id` client is no longer protected, §8) is stated there.
  - **AC4** Both polymorphic `'pagos'` branches (C5 line 222, C6 line 234) are commented out with the words *always false — no pago row ever survives the full wipe*.
  - **AC5** `_before_snapshot`'s payment count is sourced directly from `pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)` and renamed to mean "will be destroyed"; the Section-4 post-condition asserts **`v_n_pagos <> 0` ⇒ RAISE EXCEPTION**. Keeping `v_n_pagos <> v_before.n_pagos` as the sole check = FAIL.
  - **AC6** The final report grid's `n_pagos` (line 433) still runs after the wipe and carries a comment stating it is `0` by construction.
  - **AC10** Regression greps: 0 hits for `TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY`; file still opens `BEGIN;`, ends `COMMIT;`, has no `ROLLBACK;`.
  - **AC11** 0 **uncommented** `DELETE FROM` against any Section-B table (`comprobantes_disponibles` included). The undischarged fiscal gate rides on this.
  - **Prevention rules named, and each verified in the QA report:** `mistakes/incomplete-control-enumeration` — the affected set was derived by grepping the whole file, and QA **re-greps independently** rather than trusting §0.1; `mistakes/spec-manufactured-divergence` — no consumer is left asserting a payment survives; `mistakes/blind-write-partial-read` — edits only, the 26 KB file is never regenerated (QA checks the diff is hunks, not a whole-file rewrite); `mistakes/unrequested-hardening-regression` — every diff hunk falls inside {76-82, 95-101, 117-124, 137-143, 216-238, 400-416, 426-434}.
  - Plus S1-S5.

### T2 — `02`: Guard 3, the three-entity name assertion (owns the canonical ILIKE literals)
- **Owner:** senior-dev · **Tag:** `[senior]` · **Depends on:** T1
- **Files in scope:** `docs/migracion/02-cleanup-execute.sql` (only)
- **What it does:** Adds Guard 3 per §7, immediately after Guard 2 (line 74) and before Section 1.
- **Acceptance criteria:**
  - **AC7a** Guard 3 resolves the kept reserva's cliente name, producto name, and that producto's suplidor name, and `RAISE EXCEPTION`s unless **all three** match, case-insensitively, via `ILIKE`.
  - **AC7b** Line-number proof: the guard's first line number < the line number of the file's first `DELETE FROM`, both from pasted `rg -n` output.
  - **AC7c** Name **columns are detected at run time** via `information_schema.columns` from the candidate lists in §7. Zero hardcoded single-column dependencies. `mistakes/schema-source-of-truth` — the live DB is unreachable, `scripts/` is not evidence, so the guard self-detects or refuses.
  - **AC8** The literals are exactly `'%JROSA%ASESORA%VIAJES%'`, `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'`, `'%OPERAHOTEL%'`. QA reproduces §7's substitution argument **in its own words**, naming for each pattern one plausible different entity that fails to match. `mistakes/weak-backstop-guard` — "looks specific enough" is a FAIL; the guard must be shown at least as strict as the operator's named string, and a bare `%SRL%`/`%HOTEL%`/`%` is an automatic FAIL.
  - **AC7d** Outcome non-collapse (`decisions/0012-elibry-confirmacion-without-factura-numero`): the four abort states of §7 — no match / NULL-or-empty name / no candidate column exists / `suplidor_id IS NULL` — produce **distinguishable** messages. Any two collapsed into one generic "MISMATCH" = FAIL.
  - **AC7e** Guard 3 is a pure addition: it does not weaken, duplicate, or replace Guards 1-2 (frozen NON-GOAL). `git diff` shows lines 40-74 unchanged.
  - **AC10 + AC11** re-run in full on the post-T2 file (regression, same commands as T1).
  - Plus S1-S5.

### T3 — `02`: denormalised-balance disclosure (AC9b) and the line-budget flag
- **Owner:** senior-dev · **Tag:** `[senior]` · **Depends on:** T2
- **Files in scope:** `docs/migracion/02-cleanup-execute.sql` (only)
- **What it does:** Implements HC-1 branch (b): an `information_schema`-driven report of which payment-derived balance columns exist on `reservas` and their current values for the kept reserva, plus the explicit "these may now be stale, check them by hand" instruction — surfaced in the **final report grid**, not only via `RAISE NOTICE`.
- **Acceptance criteria:**
  - **AC9a** `rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql` → **0 hits**. No column is mutated; no balance column name is hardcoded as a mutation target (frozen NON-GOAL: no hardcoded balance column name, no general all-reservas recompute).
  - **AC9b** The disclosure names the candidate columns it probed, distinguishes *"column absent"* from *"column present with value X"* (non-collapse again), and tells the operator plainly that any such value may now be stale post-wipe.
  - **AC9c** The disclosure reaches the operator through the **final report result grid**. A `RAISE NOTICE`-only implementation = FAIL, because `02:422-425` already states NOTICE is not reliably surfaced in the Supabase SQL editor.
  - **AC9d** The choice of branch (b) over (a) is documented **inline** with its reasoning (HC-1: contradictory `scripts/027` vs `scripts/030` semantics, unreachable live schema, app recomputes at read time).
  - **AC12** `wc -l docs/migracion/02-cleanup-execute.sql` pasted. If > 500, the dev report carries an explicit **FLAG: refactor signal, `.claude/rules/file-size.md`** and a scratchpad §3 backlog line. **The file is NOT split** — splitting a single `BEGIN;…COMMIT;` creates a second commit trigger (`mistakes/confirm-gate-false-commit`, HC-2). Silently splitting = FAIL; flagging an overage = PASS.
  - **AC10 + AC11** re-run in full (regression).
  - `mistakes/schema-source-of-truth` + `mistakes/unrequested-hardening-regression` named and evidenced.
  - Plus S1-S5.

### T4 — `01`: remove the `pagos` keep set, add the loud destruction row
- **Owner:** senior-dev · **Tag:** `[senior]` · **Depends on:** T1 (01 must predict what 02 now does)
- **Files in scope:** `docs/migracion/01-cleanup-dry-run.sql` (only)
- **What it does:** Migrates all nine `keep_pago` hits (§0.1) and adds the loud row.
- **Acceptance criteria:**
  - **AC13** Query 3's `pagos` row reports `rows_to_keep = 0` and `rows_to_delete = rows_total` **structurally** — the CTE is removed or hardwired empty, never relying on live data happening to be empty.
  - **AC14** Query 2's `keep_pago` listing row reflects the empty set or is relabelled *"pagos: ALL rows will be deleted, no keep set"*.
  - **AC15** `keep_cliente` in **both** Query 2 and Query 3 resolves from `keep_reserva.cliente_id` only, matching `02` after T1. QA diffs the two files' `keep_cliente` definitions.
  - **AC16** A new loud row states how many payments the kept reserva currently has **and** that all of them will be permanently deleted, using Query 1's "loud status" convention. Zero payments must read as a real answer, not an error/blank (ADR-0012 non-collapse).
  - **AC18** `rg -n "DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|setval" docs/migracion/01-cleanup-dry-run.sql` — every hit is inside a comment. One executable hit = FAIL; the file's whole safety claim is "physically incapable of harm".
  - **AC19** `git diff` shows **no hunk** touching Query 1, Query 4, or Query 5 (auditoria lower-bound caveat, `comprobantes_fiscales` ambiguity, the 9 undeclared tables).
  - `mistakes/spec-manufactured-divergence` + `mistakes/incomplete-control-enumeration` named; QA re-greps `keep_pago` independently.
  - Plus S1-S5.

### T5 — `01`: the three-entity MATCH/MISMATCH report
- **Owner:** junior-dev · **Tag:** `[junior]` · **Depends on:** T2 (pattern source), T4 (same file)
- **Files in scope:** `docs/migracion/01-cleanup-dry-run.sql` (only)
- **What it does:** Adds one read-only query reporting MATCH/MISMATCH per entity, **copying the ILIKE literals and the candidate-column logic out of `02`'s Guard 3 verbatim**. No new logic is invented in this task.
- **Acceptance criteria:**
  - **AC17a** A new query reports MATCH or MISMATCH for cliente, producto and suplidor.
  - **AC17b** `diff <(rg -o "'%[A-Z% ]+%'" 01 | sort -u) <(rg -o "'%[A-Z% ]+%'" 02 | sort -u)` prints **nothing**. Any divergence in the ILIKE patterns = FAIL — `mistakes/weak-backstop-guard`: the dry run is the operator's only preview of the guard, so a report weaker (or stronger) than the guard it previews is a gap wearing a report's name.
  - **AC17c** The report distinguishes the same four states as Guard 3 (no match / NULL-or-empty / no candidate column / `suplidor_id IS NULL`) — `decisions/0012`. Collapsing any two = FAIL.
  - **AC18** re-run on the post-T5 file: still 0 executable write statements.
  - **AC19** re-run: Query 1 / 4 / 5 still untouched.
  - Plus S1-S5.

### T6 — `README-cleanup.md`: tell the operator the truth about payments
- **Owner:** senior-dev · **Tag:** `[senior]` · **Depends on:** T1, T2, T3, T4, T5 (it describes their final state)
- **Files in scope:** `docs/migracion/README-cleanup.md` (only)
- **Acceptance criteria:**
  - **AC20** In **prose** (not inside a code block or comment): ALL payment history is destroyed, **including the kept reserva's own payments**, and this is irreversible without the Step-1 backup. The KEEP-set section's two surviving claims to the contrary — Spanish line 202 *"y sus pagos"*, English line 211 *"and its payments"* — are both corrected. Either one left standing = FAIL.
  - **AC21** The ordered runbook (backup → transaction-honoring probe → run 01 → read the report → sign-offs → run 02) is unchanged in order; no step removed. Proven from `git diff`, not from assertion.
  - **AC22** A new Step-5 checklist item: confirm `01`'s name-match report is **all-MATCH** before running `02`, and state plainly what MISMATCH means — *stop, do not run 02, investigate*.
  - **AC23** The "Step 4 — Read the report" section names the implemented balance branch (HC-1(b)) and says whether a manual post-run balance check is needed, matching what `02` actually prints **in the result grid** after T3.
  - **AC24** The rollback section contains **no** `git checkout <ref> --`, `reset --hard`, `clean -fd`, `stash drop`, and **no** `>` redirection anywhere in the file; the reference point is each file's state at the **start of this task**, not the pre-sprint commit. Note: line 238's current claim that these files are *"new, untracked additions"* is now **false** — they are tracked at `3faa20c` — and must be corrected without introducing a banned verb. `mistakes/destructive-op-named-in-rollback-note`.
  - **AC25** `wc -l` ≤ 250, or the overage is explicitly flagged.
  - **AC26** No claim that anything was executed against a database; every unexecuted claim labelled literally **UNVERIFIED**.
  - **AC-retain** The RLS caveat (current lines 125-131) and the R-TRIGGER guidance (176-183) survive — they are unrelated to this change and deleting them is a regression.
  - `mistakes/runbook-pass-condition-misdescribes-behavior` named: **every** pass/fail sentence T6 writes or edits cites the `01`/`02` line it describes, re-read post-T5 — never the writer's recollection. `mistakes/confirm-gate-false-commit`: the runbook must still present exactly one commit trigger (running `02`), with `01` incapable of committing anything.
  - Plus S1-S5.

### T7 — `docs/plans/db-cleanup-keep-one-reserva.md`: append-only Amendment
- **Owner:** junior-dev · **Tag:** `[junior]` · **Depends on:** T1, T2 (the decisions it records); sequence **last**
- **Files in scope:** `docs/plans/db-cleanup-keep-one-reserva.md` (only)
- **Acceptance criteria:**
  - **AC27** Strictly additive. `git diff --numstat` shows a **deletions column of exactly 0**. Lines 1-823 are byte-identical; the Amendment section is appended after line 823. No existing section (0-11 or the task list) is rewritten, reordered, or deleted.
  - **AC28** Records **exactly three** decision changes, each attributed verbatim to *"the operator, via direct question, this session"*: (a) `pagos` — no keep set, full unconditional wipe, **superseding §4's `_keep_pago` definition (line 248) and §5 step 3 (line 287)**, both cited by section and line; (b) the three-entity name-assertion guard added as a new preflight requirement; (c) Section B's commented-out status explicitly **reaffirmed unchanged**, `comprobantes_disponibles` included.
  - **AC29** Contains **no SQL** and no implementation detail beyond naming the three amended files. `rg -n "SELECT|DELETE|CREATE TEMP|ILIKE"` restricted to lines > 823 → 0 hits. It is a decision record, not a redesign.
  - `mistakes/unrequested-hardening-regression`: the temptation to "fix" §11's stale filenames (lines 816-817 still name `cleanup-keep-RES-1787875561067.sql`, which was never shipped) is **out of scope** — it goes in the backlog, not the diff. `mistakes/blind-write-partial-read`: append via Edit, never regenerate the 51 KB file.
  - Plus S1-S5.

---

## 12. Backlog (findings outside this sprint's frozen scope — do NOT fix in this diff)

- **B-a** `01-cleanup-dry-run.sql:26` cites *"02's Section A step 17"*; `02` labels the `auditoria` delete **Step 15**. Stale cross-reference, pre-existing.
- **B-b** `db-cleanup-keep-one-reserva.md:816-817` (§11 rollback) names two files that were never shipped (`cleanup-keep-RES-1787875561067.sql/.md`) instead of the three that were.
- **B-c** `README-cleanup.md:238` calls the three files "new, untracked additions" — they are tracked at `3faa20c`. (Corrected inside T6 only because AC24 forces the rollback section to be re-stated; nothing else in that section changes.)
- **B-d** This cleanup work was never sprinted: the plan and both scripts shipped without a QA report. `CBrain` has zero hits for `db-cleanup` / `RES-1787875561067`. Worth a consolidation note at sprint close.
- **B-e** `CLAUDE.md` has no "Project contract" block — scaffold from `~/Developer/CBrain/kit/templates/CLAUDE.md.template`.

---

## Architecture Reasoning (show your work)

- **Invariants in play + the exact mechanism each follows in THIS codebase:**
  (1) *One transaction, one commit trigger* — `02` opens `BEGIN;` at line 33 and ends `COMMIT;` at 439 with no `ROLLBACK;`; `01` is write-incapable. That two-file split **is** the confirm gate, and nothing this sprint does may create a second trigger (this is why HC-2 forbids splitting `02` even at >500 lines).
  (2) *Abort-is-the-undo* — every guard is a `RAISE EXCEPTION` inside that transaction (Guards 1/2 at 40-74, post-conditions at 359-420). Guard 3 inherits the mechanism exactly rather than inventing a new failure path.
  (3) *Org isolation / RLS* — none exists by deliberate ADR (`0011-elibry-single-tenant-for-now`); the invariant is **do not add and do not weaken**, enforced by AC10's `CREATE POLICY` / `DROP POLICY` / `DISABLE ROW LEVEL SECURITY` zero-hit grep. The real RLS fact (`reserva_pasajeros`/`reserva_ocupaciones`, `TO authenticated`, no `FORCE`, owner bypass — `scripts/061:93-94`) stays documented in `README-cleanup.md:125-131`.
  (4) *Fiscal integrity* — `comprobantes_disponibles` holds live DGII NCF sequence state (`scripts/039:12,163`, `obtener_proximo_ncf()` at 039:114-155) and an undischarged human gate from last sprint rides on it; AC11 is therefore a regression check on all three `02` tasks, not a one-off.
  (5) *Money math single source of truth* — `lib/finance.ts` computes MONTO PAGADO / BALANCE from the `pagos` rows at read time, and `app/reservas/ver/[id]/page.tsx:196-215` overwrites the stored columns with it. That is why HC-1 lands on disclosure rather than mutation.
  (6) *Optimistic UI / realtime* — **not in play at all**: this sprint touches no component, no subscription, no mutation. Stated explicitly rather than left as a silent gap.
- **Approaches considered + trade-offs + choice:**
  *(A) Keep `_keep_pago` but hardwire it empty* — smallest diff, but leaves a keep-set abstraction that reads as if payments could survive and leaves the `_keep_cliente` UNION, the two polymorphic branches, and the equality post-condition intact. That is `spec-manufactured-divergence` by construction. **Rejected.**
  *(B) Delete `_keep_pago` and migrate all nine consumers (chosen).* Larger diff, but it is the only option where no surviving line asserts a payment lives, and it makes the post-condition *stronger* (`= 0` instead of before/after equality). Blast radius is one file, nine known line ranges, all enumerated up front.
  *(C) Rewrite `02` as a parameterised generator / split it into per-section files* — would relieve the 500-line pressure, but creates a second commit trigger and re-opens the two-file architecture, both frozen NON-GOALS. **Rejected.**
  For the balance question: *(a) runtime-guarded recompute* vs *(b) disclosure* — chose (b), reasoned in HC-1, because no formula is knowable without live introspection and (a) would write guessed money values inside a committed destructive transaction.
- **Seam map (file budget) and its complement:** §2. Four files in, everything else explicitly out — `app/`, `lib/`, `components/`, `tests/`, all config, all of `scripts/`, `02`'s Sections B/C/D and FISCAL GATE, `01`'s Queries 1/4/5, and lines 1-823 of the amended plan.
- **Negative space checked** — `~/Developer/CBrain/decisions` and `~/Developer/CBrain/mistakes` grepped and read this session (`weak-backstop-guard.md` and `schema-source-of-truth.md` read in full; decisions 0003/0011/0012/0014 per the briefing). Nothing here re-proposes an ADR-rejected option: **no RLS/org-isolation work** (`0011` rejected it — this is DML only); **no "would pass" claims** (`0003` — every AC carries a real command and `npm run qa` must actually run); **no unbounded audit dump as proof** (`0014` — the evidence set is the bounded command list in §9); **no collapsed outcomes** (`0012` — Guard 3 and `01`'s report must distinguish four states, never one generic MISMATCH). Known mistakes are pre-empted by name and written into the task ACs rather than the prose: `schema-source-of-truth` (T2/T3 — runtime detection or refusal; `scripts/` cited only as corroboration), `incomplete-control-enumeration` + `spec-manufactured-divergence` (T1/T4 — whole-file inventory in §0.1, QA re-greps independently), `weak-backstop-guard` (T2/T5 — written substitution argument plus a byte-equality diff of the patterns), `blind-write-partial-read` (T1/T2/T3/T7 — Edit only, never regenerate), `destructive-op-named-in-rollback-note` (S5 on all seven tasks + T6/AC24), `runbook-pass-condition-misdescribes-behavior` (T6 — cite the line, re-read post-T5), `unrequested-hardening-regression` (all — §12 backlog absorbs every out-of-scope finding), `confirm-gate-false-commit` (HC-2 + T6).
- **Pre-mortem — most drift-prone task + mitigation:** §10. T1, mitigated by the pre-computed nine-site inventory plus a hunk-range check in QA; T3 mitigated by the zero-`UPDATE` grep; T5 by the byte-equality pattern diff; T6 by running last and citing lines.
- **Hard calls flagged for the human:** **two.** HC-1 — the denormalised balance columns cannot be recomputed without guessing a formula the repo itself contradicts (`scripts/027` vs `scripts/030`) and no live schema exists to settle it; the plan chooses disclosure and adds zero `UPDATE`s, but if the operator has out-of-band knowledge of the live balance semantics, that is a human decision this sprint cannot make. HC-2 — `02` will very likely finish this sprint **over the 500-line file-size rule**, and the correct remedy (splitting) is forbidden by a stronger invariant (one transaction = one commit trigger). The plan's ruling is FLAG-and-ship; the human should see that flag at sprint close.

PLAN_PATH: docs/plans/db-cleanup-decisions-amend.md
