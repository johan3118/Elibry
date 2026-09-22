# t03 QA report — `02`: denormalised-balance disclosure (AC9a-d) + line-budget flag (AC12), plus AC10/AC11 regression

Verdict: **PASS**

All commands below were run independently by QA (not copy-pasted from the dev
report). Where useful, the dev's pasted numbers are compared against my own
output.

## Commands run (full, real output)

### 1. AC9a — zero UPDATE statements (anchored + broad)

```
$ rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql
(no output)
$ echo "exit=$?"
exit=1
```

```
$ rg -in "update\s" docs/migracion/02-cleanup-execute.sql
561:-- zero UPDATE statements anywhere in this file, on purpose. HC-1 branch (b)
$ echo "exit=$?"
exit=0
```

Only one broad hit, and it is inside a `--` comment (the SECTION 5 header,
line 561), stating "zero UPDATE statements anywhere in this file, on
purpose" — not a real statement. I manually classified this single hit: it
is prose, not SQL. **AC9a: PASS, 0 real UPDATE statements anywhere in the
file.**

Additional covert-write check (dynamic SQL / SET-clause smuggling):

```
$ rg -n "EXECUTE" docs/migracion/02-cleanup-execute.sql
127:      EXECUTE format('SELECT %I FROM clientes WHERE id = $1', v_col) INTO v_val USING v_cliente_id;
150:      EXECUTE format('SELECT %I FROM productos WHERE id = $1', v_col) INTO v_val USING v_producto_id;
178:      EXECUTE format('SELECT %I FROM suplidores WHERE id = $1', v_col) INTO v_val USING v_suplidor_id;
319:      EXECUTE 'DELETE FROM comprobantes_fiscales WHERE reserva_id NOT IN (SELECT id FROM _keep_reserva)';
382:    EXECUTE 'DELETE FROM audit_logs';
388:    EXECUTE 'DELETE FROM logs';
394:    EXECUTE 'DELETE FROM performance_metrics';
597:      EXECUTE format('SELECT %I::text FROM reservas WHERE id = $1', v_col) INTO v_val USING v_id;
```

Every dynamic `EXECUTE` T3 introduces (lines 127/150/178 pre-date T3 from
Guard 3/T2; line 597 is T3's own) builds a `SELECT`, never an `UPDATE`. The
`DELETE`-building EXECUTEs (319/382/388/394) pre-date T3 (t01/t02 scope) and
target non-money tables. No `SET` clause targets any balance column anywhere
in the file (grepped `\bset\b` case-insensitively — all hits are either
`ON DELETE SET NULL` FK comments or unrelated prose). **No covert write
path found.**

### 2. AC9b/c/d — read the actual SECTION 5 block + FINAL REPORT SELECT

```
$ sed -n '555,640p' docs/migracion/02-cleanup-execute.sql
```
(full block read and reproduced verbatim; matches the dev report's pasted
diff exactly, character for character)

Confirmed by direct read of the file (not the dev's paste):
- **AC9b (non-collapse + staleness warning):** two distinct message shapes —
  `'ABSENT from this schema at run time -- nothing to disclose.'` vs.
  `'PRESENT, current value = %s -- POSSIBLY STALE: pagos was unconditionally
  wiped above (Step 3) and this column was NOT recomputed here...'`. These
  are genuinely different strings, not the same template with a blank
  fill-in — "absent" never mentions a value, "present" always does and
  always carries the explicit staleness warning. Edge case checked: if the
  column exists but its live value is SQL `NULL`, `COALESCE(v_val, 'NULL')`
  still renders `PRESENT, current value = NULL -- POSSIBLY STALE...` —
  correctly distinguished from "ABSENT" (column exists, value is null, vs.
  column doesn't exist at all). **PASS.**
- **AC9c (result-grid, not NOTICE-only):** the five `*_disclosure` columns
  are real `SELECT ... AS balance_reserva_disclosure` etc. subqueries
  appended to the file's one existing FINAL REPORT `SELECT` (lines 619-625),
  which is the file's actual queryable result grid — not inside any
  `RAISE NOTICE` call. **PASS.**
- **AC9d (branch-b-over-a reasoning inline):** SECTION 5's header comment
  (lines 559-580) explicitly cites all three required points: (1)
  `scripts/027:53` vs `scripts/030:35` contradiction on what `balance_reserva`
  means, (2) the live schema being unreachable this sprint, (3)
  `app/reservas/ver/[id]/page.tsx:196-215` already recomputing the balance
  columns from live `pagos` via `lib/finance.ts`. **PASS.**

### 3. Runtime detection, not hardcoded-on-faith

```
$ sed -n '585,600p' docs/migracion/02-cleanup-execute.sql
```
Shows a `FOREACH v_col IN ARRAY v_cols LOOP` over the 5-candidate array,
guarded by `IF EXISTS (SELECT 1 FROM information_schema.columns WHERE
table_schema = 'public' AND table_name = 'reservas' AND column_name = v_col)`
before any value read. This is a genuine runtime introspection query, not a
hardcoded boolean or a static "these columns exist" assumption. Matches
Guard 3's (t02, already-PASSed) exact convention at lines 123/146/174.
**PASS.**

Cross-check against real app code (does the AC9d citation actually say what
the dev claims, not a fabricated line reference?):

```
$ sed -n '190,220p' "app/reservas/ver/[id]/page.tsx"
        // Calcular balances correctos basados en pagos reales
        const precioTotal = Number.parseFloat(reservaData.precio_total || 0)
        const totalPagosRealizados = (pagosData || []).reduce((sum, pago) => {
          return sum + Number.parseFloat(pago.monto || 0)
        }, 0)
        const saldoRestante = precioTotal - totalPagosRealizados
        ...
        const montos = montosDePagosDeReserva(Number(reservaId), pagosData || [])
        const reservaActualizada = {
          ...reservaData,
          balance_reserva: precioTotal,
          balance_general: calcularBalanceReserva(precioTotal, 0, montos),
          balance_abonado: calcularMontoPagado(0, montos),
          abonado_contabilidad: abonadoContabilidadFijo,
          ...
```
Confirmed: real, existing code at those line numbers recomputes
`balance_reserva`/`balance_general`/`balance_abonado` from live `pagos`
before rendering. The AC9d citation is accurate, not fabricated.

### 4. AC12 — line budget

```
$ wc -l docs/migracion/02-cleanup-execute.sql
     631 docs/migracion/02-cleanup-execute.sql
```
Matches the dev's claim (631) exactly.

```
$ grep -n "FLAG" docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t03-dev.md
183:**FLAG: refactor signal, `.claude/rules/file-size.md`.** File is now 631
```
Explicit FLAG present in the dev report per `.claude/rules/file-size.md`.

```
$ rg -n "^BEGIN;|^COMMIT;|^ROLLBACK;" docs/migracion/02-cleanup-execute.sql
33:BEGIN;
631:COMMIT;
```
One `BEGIN;`, one `COMMIT;`, no `ROLLBACK;` — file was NOT split (still a
single transaction, single commit trigger). **AC12: PASS.**

### 5. AC10 + AC11 regression (independently re-verified, not trusted from dev paste)

```
$ rg -n "_keep_pago" docs/migracion/02-cleanup-execute.sql
207:-- `_keep_pago`, so that client survived even though it was not the kept
223:-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
254:  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
355:  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
368:  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
```
5 hits, all comment-only. Matches t01/t02's already-PASSed state, unchanged
by T3.

```
$ rg -n "^\s*DELETE FROM (usuarios|usuarios_sistema|colaboradores|datos_maestros|parametros_sistema|tipos_productos|configuracion_empresa|permisos_roles|comprobantes_disponibles)" docs/migracion/02-cleanup-execute.sql
(no output)
```
0 uncommented Section-B DELETEs — still fully commented.

```
$ rg -n "GUARD 3" docs/migracion/02-cleanup-execute.sql | head -1
77:-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
$ rg -n "^DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -3
268:DELETE FROM seguimiento_comentarios;
269:DELETE FROM seguimiento_casos;
275:DELETE FROM pagos;
```
Guard 3 (line 77) precedes the first `DELETE FROM` (line 268). One
`BEGIN;`/one `COMMIT;` already confirmed above, no `ROLLBACK;`.
**AC10/AC11: PASS, no regression.**

### 6. Scope check

```
$ git status --porcelain
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
```
$ git diff --name-only
docs/migracion/02-cleanup-execute.sql
$ git diff --cached --name-only
(no output)
```
```
$ find docs/sprints -maxdepth 3 -type f | sort
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t01-dev.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t01-lead.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t01-qa.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t02-dev.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t02-lead.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t02-qa.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t03-dev.md
docs/sprints/2026-09-22-db-cleanup-decisions-amend/scratchpad.md
```
Only one **tracked** file shows as modified: `docs/migracion/02-cleanup-execute.sql`.
The two `??` untracked entries (`docs/plans/db-cleanup-decisions-amend.md`,
`docs/sprints/`) are consistent with t01/t02's already-PASSed reports
(t01-qa.md and t02-qa.md both record the same two untracked entries at their
own time of review, and `docs/sprints/` already contained t01/t02's dev+qa+lead
reports before this task ran — i.e. this task did not create that directory).
No file outside `02-cleanup-execute.sql`'s scope was created or modified by
T3. **Scope check: PASS.**

### 7. `git diff` sanity — full diff read, hunk by hunk

```
$ git diff --stat -- docs/migracion/02-cleanup-execute.sql
 docs/migracion/02-cleanup-execute.sql | 228 +++++++++++++++++++++++++++++++---
 1 file changed, 210 insertions(+), 18 deletions(-)
```
(This stat is cumulative t01+t02+t03 vs `HEAD`=3faa20c, matching t02-qa.md's
already-confirmed state plus T3's two new hunks.) Read the full diff: the
first six hunks are byte-identical to what t01-qa.md and t02-qa.md already
independently verified and PASSed (Guard 3 insertion, `_keep_pago` removal,
unconditional `pagos` wipe, post-condition strengthening) — I re-read them to
confirm no further edits were smuggled in alongside T3's work. The **last
two hunks** are new and are exactly what T3 claims:
- Hunk 7: inserts SECTION 5 (the `_balance_disclosure` temp table + the
  `information_schema.columns` probe loop) between Section 4's post-condition
  `DO $$ ... END $$;` and the FINAL REPORT header.
- Hunk 8: appends the five `*_disclosure` columns (plus a 3-line comment) to
  the existing FINAL REPORT `SELECT`.

No edit touches Guards 1-3, Section 1-4's existing logic, Section B/C/D, or
the FISCAL GATE. **Diff sanity: PASS.**

### 8. `npm run qa` (independently re-run in full)

```
$ npm run typecheck
> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(exit 0, no output)
```

```
$ npm run lint
> my-v0-project@0.1.0 lint
> eslint .
... (28 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element
warnings, same files/lines as t01/t02's baseline)
✖ 28 problems (0 errors, 28 warnings)
(exit 0)
```

```
$ npm run test  (via npm run qa)
> my-v0-project@0.1.0 test
> vitest run
...
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  07:30:30
   Duration  1.90s
```

Identical in shape to t01/t02's baseline in the scratchpad §2: tsc clean,
eslint 0 errors/28 pre-existing warnings, vitest 30 files/825 tests passing.
No `app/`, `lib/`, `components/`, `tests/`, or config file was touched by
this task, so this shape match is expected and confirmed. **`npm run qa`:
PASS.**

### 9. Rollback note sanity

```
$ sed -n '308,318p' docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t03-dev.md
```
Reference point stated as "the file's state at the start of this task
(post-t02, 579 lines, HEAD = 3faa20c plus t01's and t02's already-landed
edits)" — correct, matches t02-qa.md's confirmed post-t02 state (579 lines).
The rollback instructions describe a manual hunk revert ("re-open the file
and revert the two hunks... restoring the file to its exact post-t02
579-line content"). No banned destructive git verb (`checkout <ref> --`,
`reset --hard`, `clean -fd`, `stash drop`) is used or implied, and no `>`
redirection is used. **Rollback note: PASS.**

## Attack Log (show your work)

- **RLS / org-isolation:** N/A for this task — this sprint is explicitly a
  single-tenant, no-RLS DML sprint (`decisions/0011-elibry-single-tenant-for-now`),
  and T3 adds zero new tables with persisted state (`_balance_disclosure` is
  `ON COMMIT DROP`, dies with the transaction, never queryable outside this
  run). Confirmed by reading the `CREATE TEMP TABLE` statement directly
  (line 582): `ON COMMIT DROP` is present.
- **Optimistic UI:** N/A — this is a one-shot SQL migration script, not a
  UI mutation; there is no optimistic client state to roll back.
- **Realtime:** N/A — no realtime subscribers touch `02-cleanup-execute.sql`;
  it is a manually-run, one-transaction script.
- **Money-math attack (the sprint's real risk surface):** actively tried to
  find a covert write to a balance column — broad case-insensitive `update`
  grep, inspected every `EXECUTE`/`format(...)` call for a dynamically-built
  `UPDATE` or `SET` clause, grepped `\bset\b` case-insensitively across the
  whole file. Found zero covert writes; the only `SET` hits are pre-existing
  `ON DELETE SET NULL` FK comments, unrelated to T3.
- **Fabricated-citation attack:** did not trust the dev's claim that
  `app/reservas/ver/[id]/page.tsx:196-215` recomputes the balance columns —
  read the actual file at those lines and confirmed the code genuinely does
  what's claimed (recomputes `balance_reserva`/`balance_general`/
  `balance_abonado` from live `pagos` via `lib/finance.ts`).
- **Message-collapse attack:** manually inspected the "PRESENT" vs "ABSENT"
  message construction for the edge case where a column exists but its value
  is SQL NULL (`COALESCE(v_val, 'NULL')`) — confirmed it still renders as a
  distinguishable "PRESENT, current value = NULL" message, not silently
  merged with "ABSENT".
- **Scope-creep attack:** read the full six-hunk diff, not just T3's claimed
  two hunks, to confirm no additional edit was smuggled into t01/t02's
  already-PASSed hunks alongside T3's work.
- **Edge cases tried:** NULL balance-column value at disclosure time; column
  absent entirely; broad/case-insensitive UPDATE search across whole file
  (not just the diff); dynamic-SQL covert-write search.
- **What I tried that could have broken this:** I actively hunted for a
  disguised write to a balance column (case-insensitive whole-file grep,
  every `EXECUTE`/`format` call inspected, every `SET` occurrence
  classified) and for a fabricated inline citation (read the actual app
  file at the cited lines) — both attacks failed to find a problem, so PASS
  is earned, not assumed from a green build.

## Acceptance criteria

- AC9a (zero UPDATE statements) — PASS
- AC9b (non-collapsing disclosure states + staleness warning) — PASS
- AC9c (disclosure reaches FINAL REPORT result grid, not NOTICE-only) — PASS
- AC9d (branch b over a reasoning documented inline) — PASS
- Runtime detection via `information_schema.columns`, not hardcoded — PASS
- AC12 (line budget: 631 lines, explicit FLAG, no split, single BEGIN/COMMIT) — PASS
- AC10 (Section B / TRUNCATE / DROP / RLS-disable regression) — PASS
- AC11 (fiscal gate / Section B untouched regression) — PASS
- Scope (only `02-cleanup-execute.sql` modified) — PASS
- `git diff` sanity (only Section 5 + FINAL REPORT SELECT touched) — PASS
- `npm run qa` (tsc/eslint/vitest, identical shape to t01/t02 baseline) — PASS
- Rollback note sanity (no banned verb, correct reference point) — PASS

## Out-of-scope changes

None. Only `docs/migracion/02-cleanup-execute.sql` is modified (tracked).
The two untracked entries (`docs/plans/db-cleanup-decisions-amend.md`,
`docs/sprints/`) pre-date this task, consistent with t01/t02's already-PASSed
QA reports.

## Bugs found

None. No covert write to any balance column, no hardcoded column detection,
no NOTICE-only disclosure, no message collapse, no fabricated citation, no
file split, no regression on Section B/AC10/AC11, no scope creep.

## Suggested fixes

None required. Non-blocking observation for the human/backlog only (not a
defect): SECTION 5's disclosure is scoped to the single kept reserva
(`RES-1787875561067`) via `_keep_reserva`, which is correct and sufficient
for this script's stated purpose (report the kept reserva's own balance
columns) — but if a future consumer expects a disclosure across *all*
reservas that survive some other cleanup variant, that would be a new,
separately-scoped task, not a gap in this one.

Verdict: PASS
