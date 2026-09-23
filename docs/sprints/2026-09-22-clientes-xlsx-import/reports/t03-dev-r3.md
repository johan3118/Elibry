# T3 ROUND 3 — Final live re-run of the corrected dry-run SQL, from a clean state

**Verdict: PASS.** Independently re-verified from a clean state (not inherited from T2 round 4's
own live run). Both hash checks matched the expected values exactly before any live work. The full
file was run live, read-only, TWICE (literal, unmodified, back-to-back), and both runs produced
**42/42 `_checks` rows reading PASS** and the final `veredicto_final` reading `PROCEED`. `count(*)`/
`max(id)` on `clientes` were checked at four checkpoints (before Run 1, after Run 1, before Run 2,
after Run 2) and read `1`/`15` every single time — nothing was ever written to any real table.

---

## 0. Pre-flight — expected artifact hashes verified BEFORE running (task's STOP-if-different gate)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql

$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql
19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```

- output-sha256 expected: `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`
- output-sha256 on disk: `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4` — **MATCH**
- payload-sha256 expected: `9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392`
- payload-sha256 on disk: `9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392` — **MATCH**

No drift. Safe to proceed. Re-checked again at the very end of this task (§7) — unchanged.

`docs/migracion/04-clientes-import-execute.sql` confirmed absent throughout:
```
$ ls docs/migracion/04-clientes-import-execute.sql
ls: docs/migracion/04-clientes-import-execute.sql: No such file or directory
```

---

## 1. Channel — Node + `pg` (simple query protocol), independent scratch instance, clean state

`supabase db query` cannot run this multi-statement file (`cannot insert multiple commands into a
prepared statement`, a hard PG wire-protocol limit for the extended/prepared-statement protocol —
established fact from T3 rounds 1-2, not re-litigated this round). `psql` is not installed on this
machine. Per the task's CHANNEL note, used Node + the `pg` npm package's simple query protocol,
which natively supports multi-statement text in one session (so `pg_temp` state persists across the
whole file, exactly as `psql -f` or the Supabase SQL editor would behave).

**This round used a brand-new scratch working directory** (`.../scratchpad/t03r3/`), separate from
the directories used by T2 round 4 (`.../scratchpad/t02r4/`) and T3 round 2
(`.../scratchpad/pgtool/`, `.../scratchpad/qa-t03-r2/`) — a genuinely clean state for this round's own
run, not a re-use of another task's already-open session or already-staged temp table (temp tables
are connection-scoped and die on connection close regardless, but this also avoids any risk of stale
Node process state). The runner script itself (`pg_run.js`) is the same ~35-line implementation
pattern already proven correct across three prior rounds (T3 r1, T3 r2, T2 r4) — copied fresh into
the new directory, not modified. Connection string read at runtime from `.env.local`, never printed;
only the env-var name (`POSTGRES_URL_NON_POOLING`) appears below.

Entirely outside the repo:
```
$ ls /private/tmp/claude-501/-Users-johancito-Developer-Elibry/97ebd1c1-b8b5-4d51-921d-39df2d76ffd1/scratchpad/t03r3
baseline.sql  node_modules  package.json  pg_run.js  (+ this round's run1.jsonl/run2.jsonl/qa_full.log, all scratch-only)
```

---

## 2. Baseline BEFORE Run 1

```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
`count=1`, `max_id=15` — matches T1's recorded baseline.

---

## 3. RUN 1 — full file, live, read-only

```
$ node pg_run.js /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql > run1.jsonl
EXIT CODE: 0
$ wc -l run1.jsonl
50 run1.jsonl
```
50 lines = the expected shape (DROP/CREATE `_clientes_import`, `INSERT` of 1,231 rows, one
correlation-token `SELECT`, DROP/CREATE `_checks`, 42 individual `INSERT INTO _checks` rows, the
42-row `SELECT * FROM _checks` grid, and the final 1-row verdict `SELECT`). Zero SQL errors.

**Complete `_checks` grid, Run 1, verbatim, all 42 rows (ORDER BY name, as the file itself orders
it) — counts/booleans only, no client PII per ADR-0014:**

| name | expected | actual | resultado |
|---|---|---|---|
| Q1_acciones_ref_15_is_0 | 0 | 0 | PASS |
| Q1_audit_clientes_trigger_absent | true | true | PASS |
| Q1_cambios_prov_ref_15_known_dangling | 1 | 1 | PASS |
| Q1_check_constraints_present_5 | 5 | 5 | PASS |
| Q1_clientes_count_is_1 | 1 | 1 | PASS |
| Q1_clientes_max_id_is_15 | 15 | 15 | PASS |
| Q1_live_id_15_is_jrosa | true | true | PASS |
| Q1_not_null_columns_match | true | true | PASS |
| Q1_pagos_ref_15_is_0 | 0 | 0 | PASS |
| Q1_reserva_10_cliente_is_15 | 15 | 15 | PASS |
| Q1_reserva_10_codigo | RES-1787875561067 | RES-1787875561067 | PASS |
| Q1_reservas_count_is_1 | 1 | 1 | PASS |
| Q1_serial_sequence_resolvable | true | true | PASS |
| Q1_trigger_fecha_editado_present | true | true | PASS |
| Q2_staged_id_set_matches_expected | true | true | PASS |
| Q2_staged_row_count | 1231 | 1231 | PASS |
| Q3_compania_MARCA1_1010 | 1010 | 1010 | PASS |
| Q3_compania_MARCA2_221 | 221 | 221 | PASS |
| Q3_compania_other_values_0 | 0 | 0 | PASS |
| Q3_fecha_nacimiento_null_all_1231 | 1231 | 1231 | PASS |
| Q3_observacion_null_all_1231 | 1231 | 1231 | PASS |
| Q3_pais_literal_all_1231 | 1231 | 1231 | PASS |
| Q3_referido_por_never_contains_MARCA | 0 | 0 | PASS |
| Q3_status_ACTIVO_1228 | 1228 | 1228 | PASS |
| Q3_status_INACTIVO_3 | 3 | 3 | PASS |
| Q3_tipo_cliente_EMPRESA_229 | 229 | 229 | PASS |
| Q3_tipo_cliente_NORMAL_1002 | 1002 | 1002 | PASS |
| Q4_backfill_direccion_910 | 910 | 910 | PASS |
| Q4_backfill_email_599 | 599 | 599 | PASS |
| Q4_backfill_identificacion_15 | 15 | 15 | PASS |
| Q4_backfill_nombre_completo_15 | 15 | 15 | PASS |
| Q4_backfill_responsable_229 | 229 | 229 | PASS |
| Q4_backfill_sexo_402 | 402 | 402 | PASS |
| Q4_backfill_telefonos_255 | 255 | 255 | PASS |
| Q4_estado_registro_null_1_jrosa_deferred | 1 | 1 | PASS |
| Q4_estado_registro_permanente_1230 | 1230 | 1230 | PASS |
| Q4_registrado_por_na_all_1231 | 1231 | 1231 | PASS |
| Q5_dirty_email_count | 45 | 45 | PASS |
| Q5_dup_identificacion_<CEDULA-A>_is_2 | 2 | 2 | PASS |
| Q5_dup_identificacion_<CEDULA-B>_is_2 | 2 | 2 | PASS |
| Q6_sheet_1185_is_jrosa | true | true | PASS |
| Q6_sheet_15_is_melissa | true | true | PASS |

**Run 1 final verdict row, verbatim:**
```
{"veredicto_final":"PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.","fallas":"0"}
```

**Programmatic confirmation, Run 1** (not just eyeballing the table above):
```
$ node -e '... count rows, filter resultado!=="PASS" ...'
num check rows: 42
non-PASS rows: 0 []
```

**Baseline immediately after Run 1:**
```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
`count=1`, `max_id=15` — unchanged.

---

## 4. RUN 2 — literal second full run of the SAME unmodified file, live

Per this round's explicit instruction ("do the literal second full run this time"): the file was NOT
re-hashed/re-generated between runs, and no cross-channel substitute was used — this is a plain,
literal re-invocation of the identical on-disk file through the identical channel.

**Baseline immediately before Run 2:**
```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```

**Run 2 execution:**
```
$ node pg_run.js /Users/johancito/Developer/Elibry/docs/migracion/03-clientes-import-dry-run.sql > run2.jsonl
EXIT CODE: 0
$ wc -l run2.jsonl
50 run2.jsonl
```
Zero SQL errors, same 50-line shape as Run 1.

**Complete `_checks` grid, Run 2 — structurally diff-clean against Run 1 (see §5 below); not
re-pasted as a second full table since it is byte-for-byte the same 42 rows already shown in §3 —
per ADR-0014 the grid is the deliverable and it has already been pasted in full once above; the diff
in §5 is the proof of the second run's content, not a claim of "trust me".**

**Run 2 final verdict row, verbatim:**
```
{"veredicto_final":"PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.","fallas":"0"}
```

**Programmatic confirmation, Run 2:**
```
num check rows: 42
non-PASS rows: 0 []
```

**Baseline immediately after Run 2:**
```
$ node pg_run.js baseline.sql
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
`count=1`, `max_id=15` — unchanged.

---

## 5. Run 1 vs Run 2 — diff-identical, proven two ways

**(a) Structural diff of the parsed 42-row check arrays (JSON, pretty-printed for a stable diff):**
```
$ diff <(pretty-print run1_checks.json) <(pretty-print run2_checks.json)
IDENTICAL
```

**(b) Raw output diff of the two full JSONL captures, byte-for-byte:**
```
$ diff run1.jsonl run2.jsonl
(no output — files are identical)
```
This includes the one line most likely to vary between independent runs — the payload correlation
token (`payload_token`) — which is checked and found identical:
```
$ grep -o '"payload_token":"[^"]*"' run1.jsonl run2.jsonl
run1.jsonl:"payload_token":"9438b556aca020812b8ba80ac2b583fb"
run2.jsonl:"payload_token":"9438b556aca020812b8ba80ac2b583fb"
```
This confirms the token is a deterministic function of the staged payload (not a random/session
nonce), and that both runs staged byte-identical data. **Runs 1 and 2 are fully diff-identical** —
the script is genuinely re-runnable and stable, satisfying the task's AC 3 literally, not by
judgment-call substitution (unlike rounds 1-2, which substituted a differently-implemented run
because the file was deterministically broken; this round the file runs clean, so the literal
re-run was performed and shown).

---

## 6. Read-only proof — `count(*)`/`max(id)` at all four checkpoints

| Checkpoint | count(*) | max(id) |
|---|---|---|
| Before Run 1 | 1 | 15 |
| After Run 1 | 1 | 15 |
| Before Run 2 | 1 | 15 |
| After Run 2 | 1 | 15 |

Exactly `1` and `15` throughout every checkpoint, as required. No row was ever written to any real
table — the only DDL executed at any point was the file's own `pg_temp`-scoped
`CREATE TEMP TABLE`/`DROP TABLE IF EXISTS`, which vanishes on connection close.

---

## 7. Acceptance gate (plan T3 AC 4, non-negotiable) — MET

Every one of the 42 check rows reads `PASS` on both runs (§3, §5). The final `veredicto_final` reads
`PROCEED` on both runs (§3, §4). No row mismatched. No adjustment, no patching, no "close enough" —
the artifact is genuinely clean this round.

**Hashes re-checked one final time, after all live work this round, confirming zero drift caused by
this task's own execution:**
```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
Unchanged from §0.

---

## 8. The three/four prior fixes — confirmed holding live, in MY OWN run, quoted from my own captured grid

| Check | My Run 1 row | My Run 2 row |
|---|---|---|
| `Q1_not_null_columns_match` (round 3's `::text` cast fix — the `sql_identifier[]` vs `text[]` bug T3 round 1 found) | `{"name":"Q1_not_null_columns_match","expected":"true","actual":"true","resultado":"PASS"}` | identical (diff-clean, §5) |
| `Q1_audit_clientes_trigger_absent` (round 4's `NOT EXISTS(...)::text` operator-precedence fix — the bug T3 round 2 found) | `{"name":"Q1_audit_clientes_trigger_absent","expected":"true","actual":"true","resultado":"PASS"}` | identical |
| `Q4_backfill_sexo_402` (round 2's `sexo_was_blank` predicate, replacing the naive `sexo='N/A'` predicate that over-counted at 408) | `{"name":"Q4_backfill_sexo_402","expected":"402","actual":"402","resultado":"PASS"}` | identical |
| `Q5_dirty_email_count` (round 4's NBSP fix — `btrim(replace(email, chr(160), ' '))`, replacing a raw `email !~ ...` predicate that over-counted at 54) | `{"name":"Q5_dirty_email_count","expected":"45","actual":"45","resultado":"PASS"}` | identical |

All four confirmed PASS in this task's own independently-executed, independently-captured grid — not
inherited from T2 round 4's report, not retyped from any prior round's text.

---

## 9. `npm run qa` — full output (pure regression gate; no source file touched by this task)

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test


> my-v0-project@0.1.0 typecheck
> tsc --noEmit


> my-v0-project@0.1.0 lint
> eslint .

/Users/johancito/Developer/Elibry/app/clientes/balance-reserva/page.tsx
  83:6  warning  React Hook useEffect has a missing dependency: 'cargarDatos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/editar/page.tsx
  79:6  warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/ver/page.tsx
   27:6   warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array                                                                                                                                                react-hooks/exhaustive-deps
  187:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
  263:29  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/crm/casos/page.tsx
  232:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/fiscal/page.tsx
  162:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/voucher/page.tsx
  245:6  warning  React Hook useEffect has a missing dependency: 'fetchReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/page.tsx
  103:6  warning  React Hook useEffect has a missing dependency: 'verificarTablaYCargarCambios'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  761:6  warning  React Hook useEffect has a missing dependency: 'cargarEstadisticas'. Either include it or remove the dependency array            react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/page.tsx
  39:6  warning  React Hook useEffect has a missing dependency: 'cargarPagos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/ver/page.tsx
  67:6  warning  React Hook useEffect has a missing dependency: 'cargarPago'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/productos/editar/page.tsx
   84:6   warning  React Hook useEffect has missing dependencies: 'loadProducto' and 'router'. Either include them or remove the dependency array                                                                                                                                  react-hooks/exhaustive-deps
  602:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/registrar/page.tsx
  529:25  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/ver/page.tsx
   60:6   warning  React Hook useEffect has a missing dependency: 'cargarProducto'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  200:15  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/reservas/pendientes/page.tsx
  199:6  warning  React Hook useEffect has a missing dependency: 'cargarReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/seguimiento/page.tsx
  219:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/ver/[id]/page.tsx
  276:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/editar/page.tsx
   75:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  468:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/page.tsx
  50:6  warning  React Hook useEffect has a missing dependency: 'cargarSuplidores'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/registrar/page.tsx
  399:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/ver/page.tsx
   63:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  254:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/image-upload.tsx
  114:13  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/time-format-toggle.tsx
  24:6  warning  React Hook useEffect has a missing dependency: 'onChange'. Either include it or remove the dependency array. If 'onChange' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps

✖ 28 problems (0 errors, 28 warnings)


> my-v0-project@0.1.0 test
> vitest run

 RUN  v2.1.9 /Users/johancito/Developer/Elibry

 ✓ tests/voucher-data.test.ts (41 tests)
 ✓ tests/voucher-page.test.ts (52 tests)
 ✓ tests/voucher-html.test.ts (61 tests)
 ✓ tests/finance.test.ts (30 tests)
 ✓ tests/confirmacion-html.test.ts (55 tests)
 ✓ tests/confirmacion-data.test.ts (48 tests)
 ✓ tests/documentos-actions.test.ts (111 tests)
 ✓ tests/recibo-html.test.ts (31 tests)
 ✓ tests/productos.actions.test.ts (13 tests)
 ✓ tests/provisional-system.test.ts (14 tests)
 ✓ tests/mockup-census-stubs.test.ts (145 tests)
 ✓ tests/pagos.provisional.test.ts (9 tests)
 ✓ tests/reservas.provisional.test.ts (9 tests)
 ✓ tests/html-escape.test.ts (24 tests)
 ✓ tests/proforma-snapshot.test.ts (2 tests)
 ✓ tests/clientes.actions.test.ts (6 tests)
 ✓ tests/configuracion.actions.test.ts (7 tests)
 ✓ tests/audit-logs.test.ts (9 tests)
 ✓ tests/factura-numero-confirmacion.test.ts (7 tests)
 ✓ tests/crm.actions.test.ts (11 tests)
 ✓ tests/facturacion.helpers.test.ts (20 tests)
 ✓ tests/money-format.test.ts (34 tests)
 ✓ app/productos/constants.test.ts (17 tests)
 ✓ tests/proforma-page.test.ts (9 tests)
 ✓ tests/suplidores.actions.test.ts (8 tests)
 ✓ tests/utils.test.ts (27 tests)
 ✓ tests/supabase-client.test.ts (5 tests)
 ✓ tests/deep-link-reserva.test.ts (5 tests)
 ✓ tests/crm-casos-page.test.ts (4 tests)
 ✓ tests/penalties.test.ts (11 tests)

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  13:37:52
   Duration  5.33s (transform 3.30s, setup 5.75s, collect 3.30s, tests 1.41s, environment 10ms, prepare 6.80s)
```
Exit code `0`. `tsc --noEmit` clean (no output, 0 errors). `eslint .` 0 errors, 28 pre-existing
warnings (identical shape to every prior round, all in `app/**`/`components/**` files this task never
touches). `825/825` tests pass across 30 files. Interleaved intentional error-path console noise from
existing tests (mocked failure branches) omitted mid-log above for brevity, same as every prior
round's convention — every test file line ends `✓ ... passed`, full raw capture retained at
`/private/tmp/.../scratchpad/t03r3/qa_full.log` for this session.

---

## 10. Files touched — scope audit

```
$ git status --short   (before this task's work, and again after — identical)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
**8 of 8 entries unchanged.** This task's only new content is this report file
(`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev-r3.md`), which sits inside the
already-untracked sprint directory and adds no new top-level entry. The scratchpad ledger
(`docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md`) was read for context but **not
edited** by this task (per the task's instruction: "do not touch the scratchpad"). No SQL file
(`03-clientes-import-dry-run.sql` or `generate-clientes-import.py`) was edited — hash-proven
unchanged, §0 and §7. `docs/migracion/04-clientes-import-execute.sql` was not created, drafted, or
run at any point. No DDL was run against the `public` schema — only the file's own
`pg_temp`-scoped `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS` (gone on connection close).

All live-execution tooling (`pg_run.js`, `package.json`, `node_modules`, `baseline.sql`,
`run1.jsonl`, `run2.jsonl`, `run1_checks.json`, `run2_checks.json`, `qa_full.log`) lived entirely
under this session's private scratch directory
(`/private/tmp/claude-501/-Users-johancito-Developer-Elibry/.../scratchpad/t03r3/`), outside the
repository, confirmed absent from `git status --short` above.

---

## 11. Redaction check

No connection string, anon key, or service-role key appears anywhere above — only the env-var
*name* `POSTGRES_URL_NON_POOLING` is referenced; the actual connection string was read at runtime
from `.env.local` and never printed or logged. No client PII (names, emails, phones, cedulas,
`identificacion` values) appears above: every grid cell captured and pasted is a check name, a
count, a boolean, a fixed-format `reserva` code (`RES-1787875561067`, already a non-PII synthetic
code disclosed in T1/T2's own reports), or a `PASS`/`PROCEED` verdict string — none surface a client
name or identifier, so no redaction was needed.

```
$ grep -inE "@gmail|@hotmail|cedula|postgres://|postgresql://|SUPABASE_SERVICE_ROLE|password" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev-r3.md
(no output beyond this file's own prose references to the words "cedula"/"identificacion" as column
 names in the fix-description table above, e.g. "identificacion" as a column-name label — not an
 actual identification-number value)
```

---

## Commands run (consolidated)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql        → a5f74af3...42cc4, matches expected, before and after
$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql → 9664ee4e...932392, matches expected
$ node pg_run.js baseline.sql                                         → 1/15 (before Run 1)
$ node pg_run.js docs/migracion/03-clientes-import-dry-run.sql        → Run 1, exit 0, 50 lines, 42/42 PASS, PROCEED
$ node pg_run.js baseline.sql                                         → 1/15 (after Run 1)
$ node pg_run.js baseline.sql                                         → 1/15 (before Run 2)
$ node pg_run.js docs/migracion/03-clientes-import-dry-run.sql        → Run 2, exit 0, 50 lines, 42/42 PASS, PROCEED
$ node pg_run.js baseline.sql                                         → 1/15 (after Run 2)
$ diff run1_checks.json run2_checks.json (pretty-printed)             → IDENTICAL
$ diff run1.jsonl run2.jsonl                                          → no output, byte-identical
$ ls docs/migracion/04-clientes-import-execute.sql                    → does not exist
$ git status --short (before and after)                               → 8 entries, unchanged
$ npm run qa                                                          → 0 typecheck errors, 0 lint errors (28 pre-existing warnings), 825/825 tests
```

## Rollback

Read-only task; the live database was never written to (confirmed unchanged at 4 checkpoints — §6 —
across both full-file runs). Nothing to revert in the database. In the repo, reverting means deleting
this report file (`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev-r3.md`) — no git verb
needed, nothing else changed. No `docs/migracion/04-clientes-import-execute.sql` was created,
drafted, or run. No SQL file was edited.
