# Plan — `clientes` XLSX import (1,231 rows, original IDs, JROSA relocation)

Sprint dir: `docs/sprints/2026-09-22-clientes-xlsx-import/`
Spec: frozen in the sprint transcript (human-approved). This plan does not reopen any frozen decision.
Deliverable: a **reviewable, re-runnable SQL artifact set** — not a completed import. The real `COMMIT`
is a human action outside this sprint's gates.

---

## Architecture Reasoning (show your work)

**Invariants in play + the existing mechanism each follows**

1. **Data isolation.** Elibry is single-tenant with **no auth and no RLS** on `clientes`
   (ADR `0011-elibry-single-tenant-for-now`; `CLAUDE.md` project-contract row "Data isolation model").
   There is no org to scope to, so ADR-0006's "every new table gets an RLS policy" applies vacuously:
   **this sprint creates no table and no column.** The invariant is therefore *negative* and is enforced
   mechanically — both generated SQL files must contain **zero** `CREATE POLICY`, `ENABLE/DISABLE ROW
   LEVEL SECURITY`, `GRANT`, `REVOKE`, `ALTER TABLE ... ADD/DROP COLUMN`, `ALTER ... CONSTRAINT`,
   `CREATE ROLE` statements. That is an AC on T2/T4 with a literal grep.
2. **Fiscal surfaces untouched.** `comprobantes_fiscales` is supplier-only and unlinked to clients
   (ADR `0012`, corroborated by `docs/migracion/01-cleanup-dry-run.sql` QUERY 4). This work is
   fiscal-*adjacent*, not fiscal-gated: neither generated file may name `comprobantes_fiscales`,
   `comprobantes_disponibles`, or any NCF column. Grep-checked.
3. **Money math untouched.** No `pagos`, `reserva_detalles`, `balance_*`, `monto_pagado`, or
   `abonado_contabilidad` write anywhere. The single `reservas` write is `cliente_id` on `id = 10`.
4. **Write-path convention.** Both app write paths compute the primary key **client-side** as
   `MAX(id) + 1` — `app/clientes/registrar/page.tsx:193-199` (admin path) and
   `lib/provisional-system.ts:132-142` (provisional path). They do **not** use the sequence. The
   spec's sequence-advance AC is therefore belt-and-braces; the runbook must say so plainly rather
   than claim the sequence is what the app consumes (`runbook-pass-condition-misdescribes-behavior`).
5. **`estado_registro` read path.** `app/clientes/page.tsx:250` paints any row whose
   `estado_registro !== "PERMANENTE"` yellow, and `:293` badges it. Imported rows must carry
   `'PERMANENTE'` explicitly (same literal the admin path writes at
   `app/clientes/registrar/page.tsx:207`), except the relocated JROSA row which keeps its live value.
6. **Optimistic UI / realtime.** Not applicable: `CLAUDE.md` project contract says `Realtime | no`,
   and this sprint touches **zero** React files, so there is no optimistic mutation and no rollback
   handler to mirror. Stated explicitly so QA does not look for one.
7. **Trigger surface on `clientes`** (declared in `scripts/005-update-clientes-structure.sql:48-60`
   and `scripts/001-create-tables.sql:204-206, 242-244`): `trigger_update_clientes_fecha_editado`
   (BEFORE UPDATE → rewrites `NEW.fecha_editado`) and `audit_clientes` (AFTER INSERT/UPDATE/DELETE →
   writes a row into `auditoria`). Both are load-bearing for the design below. `scripts/` is **not**
   evidence about the live database (`schema-source-of-truth`) — T1 verifies both live.

**Approaches considered**

- **A — relocate JROSA with `UPDATE clientes SET id = 1185 WHERE id = 15`.** Rejected on two
  independent grounds. (i) `fk_reservas_cliente` is declared `ON DELETE SET NULL` with **no**
  `ON UPDATE` action (`scripts/021-fix-reservas-relationships.sql:54-56`), so the default `NO ACTION`
  applies and the `UPDATE` is rejected while `reservas.id = 10` still points at 15 — and the
  constraint is not `DEFERRABLE`, so `SET CONSTRAINTS` cannot rescue it. (ii) even if it worked, the
  BEFORE UPDATE trigger would overwrite `fecha_editado`, which an AC requires preserved. This is the
  exact tension raised in open question 3.
- **B — `DELETE` id 15 first, then insert everything.** Works, but the `ON DELETE SET NULL` FK nulls
  `reservas.id = 10.cliente_id` mid-transaction (a transient orphan), then a second `UPDATE` repoints
  it — two `reservas` mutations, two audit rows, and a window where the kept reserva has no client.
- **C — CHOSEN: insert-then-repoint-then-delete-then-backfill.** Capture id 15's seven non-sheet
  columns into a TEMP table → insert the 1,229 sheet rows that are neither 15 nor 1185 → insert sheet
  row **1185** as `INSERT … SELECT` combining sheet values with the captured columns → `UPDATE
  reservas SET cliente_id = 1185 WHERE id = 10` (guarded) → `DELETE FROM clientes WHERE id = 15` (now
  unreferenced, so the SET-NULL path never fires) → insert sheet row **15** (MELISSA) → advance the
  sequence → post-check → `COMMIT`.
  **Why it wins:** zero `UPDATE` on `clientes` ⇒ `trigger_update_clientes_fecha_editado` never fires
  for the relocated row ⇒ `fecha_editado` is preserved *structurally*, not by hoping a trigger is
  absent; the reserva is never orphaned at any instant; exactly one `reservas` mutation. It resolves
  open question 3 by making the trigger unreachable instead of arguing about it.

**Seam map (total file budget) and its complement**

Create (all new, all `??` in `git status --short` — see the evidence rule below):
- `docs/migracion/generate-clientes-import.py` — the committed generator (Python 3 **stdlib only**).
- `docs/migracion/03-clientes-import-dry-run.sql` — generated, read-only.
- `docs/migracion/04-clientes-import-execute.sql` — generated, one `BEGIN…COMMIT`.
- `docs/migracion/README-clientes-import.md` — operator runbook.
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` + `reports/t0N-{dev,qa}.md`.

Edit (surgical, one file, two spans):
- `docs/migracion/README-cleanup.md` — only the stale dead-credentials/521 claim.

Must **NOT** be touched by any task:
`app/**`, `lib/**`, `components/**`, `hooks/**`, `tests/**`, `scripts/**` (historical migrations —
read-only reference), `docs/migracion/01-cleanup-dry-run.sql`, `docs/migracion/02-cleanup-execute.sql`,
`docs/migracion/*.xlsx`, `CLAUDE.md`, `.claude/**` (including `rules/file-size.md` — the exemption is
documented *here*, not by editing the rule), `MEMORY/project_sprint_state.md` (lead/close only),
`.env.local` (never read into an artifact, never quoted), `package.json`, any other `docs/plans/*.md`.

**Negative space checked** — `~/Developer/CBrain/decisions` + `~/Developer/CBrain/mistakes`:
- ADR `0011` (single-tenant; org-scoped RLS **rejected**) — not re-proposed; no RLS/auth work at all.
- ADR `0012` (`comprobantes_fiscales` is supplier-only) — no fiscal surface touched; no fiscal gate.
- ADR `0014` (bounded evidence; "paste the full file" **rejected**) — **binding here**: the 1,231-row
  payload must NEVER be pasted whole as evidence. Every task's evidence is counts, greps, head/tail
  excerpts, and SHA-256 hashes.
- `schema-source-of-truth` — `scripts/*.sql` and `lib/supabase.ts`'s `interface Cliente` are **not**
  evidence. Note the live table demonstrably has columns no migration declares: `pais` (written at
  `app/clientes/registrar/page.tsx:181` + `app/clientes/editar/page.tsx:271`, read at
  `app/clientes/ver/page.tsx:238` — write-and-read corroboration, still not proof), plus
  `cedula_pasaporte` / `dependencias_ids` in the TS interface. T1 introspects live or the sprint stops.
- `destructive-op-named-in-rollback-note` — this plan contains **no** git verb in any rollback text,
  and neither may the runbook (T6) or any dev report; irreversibility is stated in the same sentence
  as the command that causes it.
- `runbook-pass-condition-misdescribes-behavior` — every pass/fail sentence in the runbook must be
  traced to the literal SQL that produces it (T6 AC).
- `git-diff-scope-excludes-untracked-files` — every new file this sprint is `??`; evidence must
  enumerate files and state **N of M against `git status --short`**, never rely on `git diff`.
- `redaction-discipline` — the generated SQL contains real client PII by necessity (it lives in this
  repo, which already holds the source `.xlsx`); **no PII may be copied into `reports/`, the
  scratchpad, or the CBrain vault**, and no credential/connection string may appear in any artifact.
  Dry-run grids are counts, booleans and MATCH/MISMATCH verdicts — never row dumps.
- `weak-backstop-guard` — the dry run's preview logic is copied **byte-for-byte** from the execute
  script's guard (same generator emits both), never retyped; it must be neither weaker nor stronger.
- `assertion-without-verification` / `unrun-command-claimed-green` — the dry run is **actually run
  live** this sprint; at least one guard is **actually fired** (T5), not asserted.
- `environment-reliability-incidents` — tasks are strictly sequential; never two write-capable agents
  on this tree.

**Pre-mortem — most drift-prone task + mitigation.** **T4 (execute script).** It is where "while I'm
here" edits land: dedup the two duplicate `identificacion` values, tidy the 45 dirty emails, reclassify
the 15 `rnc`-carrying NORMAL rows, recompute a balance, widen a CHECK. All are explicit spec non-goals.
Mitigation, baked into T4's ACs as mechanical greps rather than good intentions: (a) its file scope is
exactly two paths; (b) a **statement inventory** must be proven — exactly one `UPDATE` (on `reservas`),
exactly one `DELETE` (on `clientes`), three `INSERT INTO clientes`, zero DDL beyond `CREATE TEMP TABLE`,
zero occurrences of `pagos|comprobantes|productos|suplidores|balance|ALTER TABLE|CREATE POLICY|GRANT`;
(c) T4 must prove it did not perturb T2's artifact by re-showing the SHA-256 of
`03-clientes-import-dry-run.sql` captured in T2's report. Second-most drift-prone: **T2**, where a
generator "helpfully" normalizes data — countered by the verbatim spot-check ACs.

**Genuinely hard calls — flagged for the human, not papered over**

1. **HC-1 — VARCHAR overflow is an unresolved data risk.** `clientes` declares `telefonos
   VARCHAR(200)`, `email VARCHAR(200)`, `nombre_completo/razon_social/nombre_comercial/responsable
   VARCHAR(200)`, `rnc/identificacion VARCHAR(20)` (`scripts/005:10-27`, unverified live). The spec
   mandates byte-for-byte import including a cell holding three comma-separated emails. If any sheet
   value exceeds the live column length, the import **cannot** satisfy "verbatim" and "no schema
   change" simultaneously. T2 must detect this at generation time and **stop for a human ruling** —
   truncating silently is forbidden.
2. **HC-2 — unavoidable trigger side effects.** The one `UPDATE reservas` fires
   `trigger_update_reservas_fecha_editado` (rewrites `reservas.fecha_editado`) and `audit_reservas`;
   the 1,231 inserts + 1 delete fire `audit_clientes`, adding ~1,232 rows to `auditoria` (one of them
   holding the deleted row's PII in `datos_anteriores`). Avoiding these needs `ALTER TABLE … DISABLE
   TRIGGER`, i.e. a schema-level op requiring table ownership — out of scope and riskier than the
   side effect. **Disclosed and accepted, not hidden.** No AC protects `reservas.fecha_editado`.
3. **HC-3 — concurrency window.** Because both write paths compute `MAX(id)+1`, a client created in
   the app between the dry run and the execute takes id 16 — an id the sheet also owns — and the
   execute then aborts on a PK conflict (safe, but a wasted window). The execute guards
   `count(*) = 1 AND max(id) = 15` at run time. **The runbook must instruct the operator to stop
   client creation for the duration.**
4. **HC-4 — `pais` literal divergence.** The spec freezes `pais = 'REPUBLICA DOMINICANA'` (uppercase,
   unaccented) for all 1,231 rows, while the app writes `"República Dominicana"`
   (`app/clientes/registrar/page.tsx:39`). Imported rows and future app rows will differ in this
   column. Frozen by the spec; disclosed here and in the runbook; **not** to be "fixed".
5. **HC-5 — two candidate source workbooks.** Both `docs/migracion-clientes.xlsx` (untracked, `??`)
   and `docs/migracion/migracion-clientes.xlsx` (tracked) exist. The spec names the former. T1 pins
   exactly one by hash + row count; the generator hard-codes that one path and refuses others.

---

## 1. Technical approach (one paragraph)

A committed, deterministic Python-3-stdlib generator reads the pinned `.xlsx` (via `zipfile` +
`xml.etree` — `openpyxl` is not installed) and emits two self-contained SQL artifacts that mirror the
proven two-file shape of `docs/migracion/01-cleanup-dry-run.sql` / `02-cleanup-execute.sql`: a
**read-only dry run** that stages the 1,231 mapped rows into a `TEMP` table and prints preconditions,
expected-vs-actual distributions, every placeholder-backfill count, verbatim-data assertions, a
JROSA-relocation MATCH/MISMATCH preview and a loud abort-or-proceed verdict — writing to no business
table — and an **execute script** that is one `BEGIN … COMMIT` with hard `RAISE EXCEPTION` guards,
performing insert-then-repoint-then-delete-then-backfill so that `clientes` is never `UPDATE`d (which
is what structurally preserves JROSA's `fecha_editado` against
`trigger_update_clientes_fecha_editado`), then advancing the id sequence past 1240 and asserting every
acceptance criterion before committing. A hand-written runbook covers backup, how to read the dry run,
sign-offs, the concurrency freeze and a rollback note whose irreversibility is stated in the same
sentence as the command; the stale dead-credentials claim in `README-cleanup.md` is corrected from the
sprint's own live evidence. **Nothing under `app/`, `lib/`, `components/`, `tests/` or `scripts/` is
created or edited; no schema change of any kind is made.**

## 2. File map

| File | Action | What the change does |
|---|---|---|
| `docs/migracion/generate-clientes-import.py` | create (T2, extended T4) | Stdlib-only XLSX reader + column mapper + SQL emitter. Emits **both** artifacts deterministically (no timestamps, no usernames, no absolute paths in output). Validates every value against the T1-pinned live column types/lengths and **aborts generation** on overflow (HC-1). Prints the sheet→DB mapping table and the per-column longest value length to stdout. |
| `docs/migracion/03-clientes-import-dry-run.sql` | create (T2, generated) | Read-only preflight + staged-payload report. Sections Q1–Q7 (see §5). Writes only to `pg_temp`. |
| `docs/migracion/04-clientes-import-execute.sql` | create (T4, generated) | One transaction: guards → 1,229 inserts → JROSA row 1185 → reserva repoint → delete old 15 → insert sheet row 15 → sequence advance → post-check assertions → `COMMIT`. |
| `docs/migracion/README-clientes-import.md` | create (T6) | Operator runbook: backup, client-creation freeze, dry-run reading guide, sign-off checklist, rollback note. |
| `docs/migracion/README-cleanup.md` | edit (T7) | Correct **only** the stale "dead credentials / project no longer exists / 521" claim (the `Verification status` block at ~L11-17 and the Step-1 sentence at ~L36-40). Every other line untouched. |
| `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` | create (architect) | Sprint working memory. |
| `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t0N-*.md` | create (per task) | Evidence packets — bounded per ADR 0014, PII-free per `redaction-discipline`. |

### File-size rule — explicit, pre-decided exemption

`.claude/rules/file-size.md` sets a 500-line healthy ceiling and asks that any breach be **flagged in
the plan rather than done silently**. It is flagged here and **pre-approved for two files only**:
`03-clientes-import-dry-run.sql` and `04-clientes-import-execute.sql` will each run roughly
1,300–1,600 lines, dominated by a single multi-row `INSERT INTO pg_temp._clientes_import … VALUES`
statement at one sheet row per line. Rationale, in order:
1. The rule's purpose is a *refactor signal for hand-maintained code*. These files are **generated
   and never hand-edited** (enforced by a mandatory `DO NOT EDIT — regenerate with
   generate-clientes-import.py` header and by the regeneration-determinism check).
2. **Chunking was considered and rejected**: splitting the execute payload across files breaks the
   single-`BEGIN…COMMIT` atomicity guarantee the spec requires, and multiplies the divergence surface
   between dry run and execute.
3. **`COPY … FROM stdin` was considered and rejected**: it is a client-side `\copy` in `psql` and is
   not supported by the Supabase SQL editor, which `README-cleanup.md:99-100` already establishes as
   an acceptable channel. A `VALUES` list works in both.
4. The hand-maintained files stay well inside the ceiling: the generator (~300–450 lines) and the
   runbook (~200 lines) are both subject to the normal rule.
**QA must not fail T2/T4 on line count for those two files.** Any *other* file exceeding 500 lines is
still a defect.

### Where the generator lives, and why not the scratchpad

A working stdlib XLSX reader exists in this session's ephemeral scratchpad. It may be used as a
starting point, but the generator **must be committed** at `docs/migracion/generate-clientes-import.py`,
next to its outputs: the artifact's whole value is re-runnability, and a generator that dies with the
session makes the 1,231-row SQL unreproducible and therefore unreviewable. Stdlib only (`zipfile`,
`xml.etree.ElementTree`, `csv`/`decimal` as needed) — `openpyxl` is **not** installed and must not be
added (no dependency changes this sprint). `npm run qa` does not cover `.py`; the generator's gate is
**determinism** (regenerate → identical SHA-256) plus its own self-checks.

## 3. DB changes

**Schema changes: none.** No new table, no new column, no altered constraint, no new index, no
trigger change, no RLS/policy/grant change. Therefore **no new RLS policy is required or created** —
and because ADR 0011 leaves `clientes` without RLS in a single-tenant, no-auth deployment, the
isolation invariant here is *"do not change the isolation posture"*, enforced by the zero-DDL grep in
T2/T4's ACs. If a future sprint adds a table, ADR-0006's policy requirement applies then; it does not
apply to a data-only import.

**Data changes (execute script only, one transaction):**

| # | Statement | Target | Guarded by |
|---|---|---|---|
| 1 | `CREATE TEMP TABLE _jrosa_preserva AS SELECT <7 cols> FROM clientes WHERE id = 15` | `pg_temp` | G1: `clientes` has exactly 1 row and `max(id) = 15`; G2: that row's name MATCHes `%JROSA%ASESORA%VIAJES%` (pattern byte-identical to `01-cleanup-dry-run.sql:378`) |
| 2 | `CREATE TEMP TABLE _clientes_import(...)` + one multi-row `INSERT … VALUES` (1,231 rows) | `pg_temp` | G3: staged `count(*) = 1231`; G4: staged id-set equals the expected 1..1240-minus-9-gaps set |
| 3 | `INSERT INTO clientes (…) SELECT … FROM _clientes_import WHERE id NOT IN (15, 1185)` (1,229 rows) | `clientes` | G5: distribution guards (§5 Q3/Q4 numbers) all pass before any write |
| 4 | `INSERT INTO clientes (…) SELECT s.<sheet cols>, p.<7 preserved cols> FROM _clientes_import s CROSS JOIN _jrosa_preserva p WHERE s.id = 1185` | `clientes` | G6: `_jrosa_preserva` has exactly 1 row |
| 5 | `UPDATE reservas SET cliente_id = 1185 WHERE id = 10` | `reservas` | G7: exactly 1 reserva exists, its `id = 10`, its `codigo = 'RES-1787875561067'`, its current `cliente_id = 15` |
| 6 | *(conditional, T1-determined)* explicit repoints 15→1185 in `seguimiento_casos` / `cambios_provisionales` / `acciones_pendientes` / `documentos` | those tables | G8: if T1 found zero such rows, the script still **guards at run time** that zero exist and ABORTS if any appeared — it never assumes |
| 7 | `DELETE FROM clientes WHERE id = 15` | `clientes` | G9: zero rows in `pagos` (or any other FK child) reference `cliente_id = 15` — if any do, **ABORT** (a `pagos` mutation would violate an AC and needs a human ruling) |
| 8 | `INSERT INTO clientes (…) SELECT … FROM _clientes_import WHERE id = 15` (MELISSA) | `clientes` | — |
| 9 | `SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT max(id) FROM clientes), true)` | sequence | G10: `pg_get_serial_sequence(...)` IS NOT NULL, else ABORT (T1 pins serial-vs-identity; this call resolves both) |
| 10 | Post-check `DO` block: every spec AC asserted, `RAISE EXCEPTION` on any failure | — | aborts the whole transaction |

`fk_reservas_cliente` is `ON DELETE SET NULL` with no `ON UPDATE` action
(`scripts/021-fix-reservas-relationships.sql:54-56`) — statement 5 runs **before** statement 7
precisely so the SET-NULL path never fires and the reserva is never orphaned.

**Accepted, disclosed side effects:** `audit_clientes` adds ~1,232 rows to `auditoria`;
`audit_reservas` adds 1; `trigger_update_reservas_fecha_editado` rewrites `reservas.fecha_editado`
(HC-2). No AC forbids any of these; all three must be named in the runbook so the operator does not
read them as damage.

## 4. API / service changes

**None.** No Supabase client call, no PostgREST query, no server action, no route. `lib/supabase.ts`
is read-only reference (its `interface Cliente` is explicitly *not* schema evidence). Note for T1:
the anon PostgREST endpoint **cannot** introspect `information_schema`, so the live preflight must go
through `psql` with a connection string or the Supabase SQL editor — not the app's client.

## 5. Dry-run contents (`03-clientes-import-dry-run.sql`)

Mirrors `01-cleanup-dry-run.sql`'s conventions: a header proving read-only status, numbered result
grids, loud ABORT strings, and non-collapsing outcome states (`MATCH` / `MISMATCH (<reason>)`) per
ADR 0012's non-collapse rule. Writes only to `pg_temp`.

- **Q1 — live preconditions / loud verdict.** `clientes` row count and `max(id)`; id 15 present;
  JROSA name MATCH/MISMATCH; `reservas` count = 1 with `id = 10` and the expected `codigo`;
  `pagos` rows referencing 15; referencing-row counts in `seguimiento_casos`,
  `cambios_provisionales`, `acciones_pendientes`, `documentos` (via `to_regclass`, never a static
  `FROM` on a maybe-absent table — same discipline as `01`'s QUERY 4/5); presence of each constraint
  and trigger T1 pinned; `pg_get_serial_sequence` resolvable.
- **Q2 — payload staging.** Loads 1,231 rows into `pg_temp._clientes_import`; reports row count,
  id-set equality against the expected gap list (126, 444, 817, 878, 952, 953, 983, 1148, 1216), and
  an `md5(string_agg(...))` payload token **for correlation only**.
- **Q3 — expected vs actual distributions**, each row PASS/FAIL: `tipo_cliente` EMPRESA 229 /
  NORMAL 1002; `compania` `'MARCA 1'` 1010 / `'MARCA 2'` 221 / **any other value 0**; `status`
  ACTIVO 1228 / INACTIVO 3; `pais = 'REPUBLICA DOMINICANA'` 1231; `referido_por` literal ATEB/GEB
  only (0 rows containing `MARCA`); `observacion IS NULL` 1231; `fecha_nacimiento IS NULL` 1231.
- **Q4 — placeholder backfill counts**, expected vs actual: `responsable` 229, `direccion` 910,
  `email` 599, `telefonos` 255, `sexo` 402, `identificacion` 15, `nombre_completo` 15 — plus a check
  that **exactly one** placeholder literal (`'N/A'`) appears across all backfill sites and that no
  invented phone/email/address/name exists.
- **Q5 — verbatim-data assertions.** Both duplicate `identificacion` values appear on exactly 2
  distinct rows each; the dirty-email population is 45; per-column **max value length vs the live
  column length** (the HC-1 overflow report, computed live against `information_schema`).
- **Q6 — JROSA relocation preview.** MATCH/MISMATCH for: live id 15 is JROSA; sheet 1185 is JROSA;
  sheet 15 is MELISSA (`%MELISSA%PORTES%ROSIS%`); the 7 preserved columns are capturable. Reports
  presence/NULL-ness and lengths — **never the values** (`redaction-discipline`).
- **Q7 — final abort-or-proceed verdict**, one row, loud.

Every ILIKE pattern and every guard predicate in Q1/Q6 is emitted by the same generator function that
emits `04`'s guards, so the two are byte-identical by construction (`weak-backstop-guard`).

## 6. UI changes

**None.** No page, component, or style is touched. The only user-visible consequence is that
`/clientes` will list 1,231 rows after the human's commit; 15 rows will show `nombre_completo = 'N/A'`
(the `rnc`-carrying NORMAL rows) and 229 EMPRESA rows will show `responsable = 'N/A'` — a disclosed
consequence of the frozen "backfill, do not drop" ruling, to be named in the runbook so nobody
reports it as a bug.

## 7. Edge cases

- **Empty state / wrong state.** `clientes` not exactly 1 row, or `max(id) ≠ 15` → G1 aborts; the
  dry run says so first, loudly. Zero is a real answer, never a blank (ADR 0012 non-collapse).
- **Concurrent edits (HC-3).** An app-created client during the window takes id 16 and the execute
  aborts on PK conflict. Mitigation: guard + runbook freeze instruction.
- **Realtime races.** Cannot occur — no realtime subscriptions in this project.
- **Rollback.** Any guard or any error aborts the whole transaction and changes nothing. After a
  successful `COMMIT` the *only* undo is restoring the Step-1 backup, and the runbook must say that
  the restore is irreversible against everything written to production after the backup **in the same
  sentence as the restore command**. No git verb appears in any rollback text.
- **Re-running the dry run.** Must be byte-identical and leave `COUNT(*)` unchanged — proven by
  running it twice (T3), not asserted.
- **Re-running the execute after a successful commit.** G1 (`count(*) = 1`) fails immediately, so a
  double-run cannot duplicate rows. The runbook states this explicitly.
- **A table in the conditional repoint set that does not exist** (`documentos` is a Storage bucket,
  `lib/supabase.ts:68`) → `to_regclass` check, report `AUSENTE`, never a static `FROM`.
- **Trailing/odd sheet values** (the 3-email cell, embedded quotes/newlines) → generator escapes by
  doubling single quotes and emits `E''`-free plain literals; verbatim preservation is spot-checked.

## 8. Test plan (exact commands)

| What it proves | Command |
|---|---|
| No source regression (no app file touched) | `npm run qa` (= `tsc --noEmit && eslint . && vitest run`) |
| Sprint file scope, including untracked files | `git status --short` — enumerate every touched path, state **N of M** (`git-diff-scope-excludes-untracked-files`) |
| Generator determinism | `python3 docs/migracion/generate-clientes-import.py` twice; `shasum -a 256 docs/migracion/0{3,4}-clientes-import-*.sql` identical across runs and equal to the hash recorded in the producing task's report |
| Payload shape without dumping it (ADR 0014) | `grep -c "^(" docs/migracion/03-clientes-import-dry-run.sql` (row count), `head -40` / `tail -20` excerpts, never the whole file |
| Zero isolation/DDL/fiscal drift | `grep -nEi "create policy\|row level security\|grant \|revoke \|alter table\|create role\|comprobante\|pagos\|balance_" docs/migracion/0{3,4}-clientes-import-*.sql` → only the documented, expected hits |
| Dry run is read-only + re-runnable | run `03` live twice; `diff` the two captured outputs (byte-identical); `SELECT count(*) FROM clientes;` before and after (unchanged) |
| Guards actually abort (not asserted) | T5: run the real guard text with an inverted expectation, read-only, and capture the `RAISE EXCEPTION`; then in `psql` show a statement after the failed guard erroring with `current transaction is aborted` |
| Runbook safety | `grep -nEi "checkout\|reset --hard\|clean -fd\|stash drop\|force" docs/migracion/README-clientes-import.md` → 0 hits; irreversibility sentence present |
| No secret leaked | `grep -nEi "eyJ\|supabase\.co\|postgresql://[^<]" docs/migracion/README-clientes-import.md docs/migracion/0{3,4}-*.sql` → 0 real values (placeholders only) |
| No PII in sprint evidence | `grep -nEi "@|[0-9]{9,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/*.md` reviewed → no client names/emails/ids copied out |

## 9. Task list (strictly sequential — one write-capable agent at a time)

> Every task: bounded evidence only (ADR 0014 — the 1,231-row payload is NEVER pasted whole);
> file-scope evidence stated as **N of M against `git status --short`**, never `git diff`
> (`git-diff-scope-excludes-untracked-files`); no git verb in any rollback note
> (`destructive-op-named-in-rollback-note`); no client PII and no credentials in any report
> (`redaction-discipline`).

---

### T1 — Live preflight: pin the real schema and the real rows  [senior] · owner: senior-dev
**Depends on:** none.
**Files in scope:** `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md` (+ `t01-qa.md`).
**DB/isolation:** read-only. Zero writes. No DDL.
**Channel:** `psql` with a live connection string, or the Supabase SQL editor. The anon PostgREST
endpoint cannot read `information_schema`, so it is **not** an acceptable channel. If the host still
521s, hand the exact query text to the human and record their pasted output, labelled
`HUMAN-SUPPLIED, captured verbatim` (never reconstructed or paraphrased).
**Acceptance criteria (PASS/FAIL, each backed by verbatim captured output):**
1. **Q1 (spec)** — full live constraint inventory on `clientes` from `information_schema` /
   `pg_constraint`: every `NOT NULL`, every `CHECK` (including `chk_empresa_fields` and the `sexo`,
   `tipo_cliente`, `compania`, `status` CHECKs) quoted verbatim, with a PRESENT/ABSENT/MODIFIED
   verdict per constraint vs `scripts/005-update-clientes-structure.sql`.
2. **Q2 (spec)** — exact row counts referencing `cliente_id`/`registro_id` = 15 in
   `seguimiento_casos`, `cambios_provisionales`, `acciones_pendientes`, `documentos` **and** `pagos`,
   with `to_regclass` existence checked first for each. Zero is a valid, explicitly-stated answer.
3. **Q3 (spec)** — the FK from `reservas.cliente_id`: name, `confupdtype`/`confdeltype`, DEFERRABLE
   status, quoted from `pg_constraint`. Plus the live trigger list on `clientes` and `reservas`
   (`pg_trigger`), confirming whether `trigger_update_clientes_fecha_editado` is BEFORE **UPDATE**
   only and whether any BEFORE INSERT trigger exists on `clientes`. The report must state, in one
   sentence, that the plan's insert-then-delete design makes the `fecha_editado` tension moot **and**
   whether the live trigger set confirms it.
4. **Q4 (architect-added)** — the complete live column list of `clientes` (name, data type,
   character_maximum_length, is_nullable, column_default), confirming or refuting `pais`,
   `estado_registro`, `usuario_creacion`, `fecha_provisional`, `documentos_urls`, `imagen_url`,
   `cedula_pasaporte`, `dependencias_ids`. **The INSERT column list is derived from this, not from
   `scripts/` and not from `lib/supabase.ts` (`schema-source-of-truth`).**
5. **Q5 (architect-added)** — every live **index/unique constraint** on `clientes`. A UNIQUE index on
   `identificacion`, `rnc` or `email` would make the spec's "keep both duplicate `identificacion`
   values" impossible → escalate rather than proceed.
6. **Q6 (architect-added)** — `pg_get_serial_sequence('clientes','id')` value (serial vs identity vs
   neither) and `auditoria`'s existence + whether `audit_clientes` is live.
7. **Q7 (architect-added, HC-5)** — both candidate workbooks hashed (`shasum -a 256`) and row-counted;
   exactly one pinned as the source, by path, with its hash recorded.
8. Report is PII-free: counts, types, constraint text and booleans only — no client row values.
9. A one-line rollback note: read-only task, nothing to revert (no git verb).

---

### T2 — Generator + generated dry-run SQL  [senior] · owner: senior-dev
**Depends on:** T1.
**Files in scope:** `docs/migracion/generate-clientes-import.py`, `docs/migracion/03-clientes-import-dry-run.sql`, `reports/t02-dev.md`.
**DB/isolation:** none — offline generation only. No DB connection.
**Acceptance criteria:**
1. Generator is Python 3 **stdlib only** (no `openpyxl`, no new dependency, no `package.json` change);
   reads exactly the workbook pinned in T1-Q7 by hard-coded path; ≤500 lines.
2. Deterministic: two consecutive runs produce a byte-identical `03-…sql` (same `shasum -a 256`,
   shown twice). Output contains no timestamp, username, hostname or absolute path.
3. `03-…sql` stages exactly **1231** rows; its id set equals the expected 1..1240-minus-9-gaps set —
   proven by the generator's own printed summary **and** by a `grep -c` on the emitted VALUES lines.
4. Mapping fidelity, proven by bounded excerpts (never the whole payload):
   `compania` is `'MARCA 1'` (ATEB) / `'MARCA 2'` (GEB) with zero other values;
   `referido_por` holds the **literal original** ATEB/GEB (0 rows where it contains `MARCA`);
   `observacion` and `fecha_nacimiento` are emitted as bare `NULL`, never `'N/A'`;
   `pais` is the literal `'REPUBLICA DOMINICANA'` on all 1231;
   `estado_registro` is `'PERMANENTE'` for the 1230 non-JROSA rows.
5. Exactly **one** placeholder literal (`'N/A'`) is used at the six forced-backfill sites, with the
   counts 229/910/599/255/402/15(+15) reproduced by the generator's summary. **Zero** invented
   phone/email/address/name values — proven by a grep for digit-shaped or `@`-shaped placeholders.
6. Verbatim preservation spot-checked on: the 3-comma email cell, the 45 dirty emails (count), and
   both duplicate `identificacion` values (each on exactly 2 rows). No trimming, no case change, no
   reformatting.
7. **HC-1 gate:** the generator compares every value's length against the T1-Q4 live
   `character_maximum_length` and **exits non-zero with a loud message** if any would overflow. If it
   fires, the task STOPS and escalates to the human — truncation is forbidden.
8. Mapping table (sheet column → DB column, or "dropped, because …") printed in the dev report and as
   a comment block in the generated file header. No sheet column is silently dropped.
9. `03-…sql` header states: read-only, `DO NOT EDIT — generated`, the file-size exemption, and a
   `-- payload-sha256:` line.
10. `grep -nEi "create policy|row level security|grant |alter table|create role|comprobante|pagos|balance_"` on `03-…sql` → no hits (`CREATE TEMP TABLE` is the only DDL).
11. `npm run qa` run and shown green (regression: no source file touched).
12. Rollback note: this task creates new untracked files; reverting means deleting exactly those two
    paths — stated in prose, **no git verb**.

---

### T3 — Run the dry run live, twice, and capture it  [senior] · owner: senior-dev
**Depends on:** T2.
**Files in scope:** `reports/t03-dev.md` (+ `t03-qa.md`). **No SQL file may be edited in this task** —
if the dry run reveals a payload defect, the task FAILS back to T2 rather than patching in place.
**DB/isolation:** read-only. Must write nothing.
**Acceptance criteria:**
1. `03-clientes-import-dry-run.sql` is executed against the live database and its **complete output is
   captured verbatim** (not retyped, not reconstructed — `retyped-verification-quote-vs-pasted-output`).
2. `SELECT count(*) FROM clientes;` captured immediately before and immediately after: identical.
3. The script is run a **second** time and the two outputs are `diff`-identical (re-runnable, stable).
4. Q3/Q4 grids read PASS on every distribution and every backfill count, or the task reports FAIL
   loudly and stops — no "close enough".
5. Q5's overflow report shows every column's max length within the live limit (HC-1 closed), or
   escalates.
6. Q6 reads MATCH for all four relocation assertions.
7. Q7's final verdict is captured verbatim and quoted in the report.
8. The captured output contains no client PII beyond counts and MATCH/MISMATCH verdicts — if any grid
   would print a row value, that is a T2 defect, not something to redact by hand afterwards.
9. No credential, host or connection string appears anywhere in the report (`redaction-discipline`).
10. Rollback note: read-only, nothing to revert (no git verb).

---

### T4 — Generated execute script  [senior] · owner: senior-dev
**Depends on:** T3.
**Files in scope:** `docs/migracion/generate-clientes-import.py`, `docs/migracion/04-clientes-import-execute.sql`, `reports/t04-dev.md`.
**DB/isolation:** the script *contains* data writes but **is not run** in this task. No DDL, no policy,
no grant, no schema change.
**Acceptance criteria:**
1. The file is exactly one `BEGIN;` … `COMMIT;` with no `ROLLBACK` anywhere (same honest-transaction
   shape as `02-cleanup-execute.sql`, and for the reason `README-cleanup.md:19-30` records).
2. Guards G1–G10 from §3 are present, each `RAISE EXCEPTION` with a loud `ABORT:` message naming what
   failed and what to do. Every ILIKE pattern is **byte-identical** to the one in `03-…sql`
   (`weak-backstop-guard`) — proven by a `grep` showing the same literal in both files.
3. Statement inventory proven by grep: exactly **1** `UPDATE` (on `reservas`), exactly **1** `DELETE`
   (on `clientes`), exactly **3** `INSERT INTO clientes`, zero DDL other than `CREATE TEMP TABLE`,
   zero occurrences of `pagos|comprobante|productos|suplidores|balance_|ALTER TABLE|CREATE POLICY|GRANT`
   outside the guard/abort text that deliberately *checks* `pagos`.
4. Order is insert → repoint → delete → backfill (§3 table). No `UPDATE` against `clientes` anywhere —
   grep-proven — which is what preserves JROSA's `fecha_editado`.
5. The post-check `DO` block asserts every spec AC: count 1231; id-set equality; the four
   distributions; `referido_por` literal; `observacion`/`fecha_nacimiento` NULL; both duplicate
   `identificacion` pairs intact; JROSA's 7 preserved columns equal to `_jrosa_preserva`;
   `id = 15` is MELISSA; `reservas` count 1 with `cliente_id = 1185`; `pagos` count unchanged;
   `nextval` would exceed 1240. Any failure raises and aborts everything.
6. `03-clientes-import-dry-run.sql` is **unchanged** by this task — proven by re-showing its SHA-256
   and matching T2's recorded hash (it is untracked, so `git diff` cannot show this —
   `git-diff-scope-excludes-untracked-files`).
7. The `-- payload-sha256:` header literal in `04` equals the one in `03` (grep both, show both lines).
8. Header states `DO NOT EDIT — generated`, the file-size exemption, and that the script always really
   commits.
9. `npm run qa` green. Rollback note in prose, no git verb.

---

### T5 — Prove a guard actually aborts (live, read-only)  [senior] · owner: senior-dev
**Depends on:** T4.
**Files in scope:** `reports/t05-dev.md` (+ `t05-qa.md`). Scratch SQL lives in the session scratchpad,
**not** in the repo. No repo file is edited.
**DB/isolation:** read-only. The rehearsal must contain no `INSERT`/`UPDATE`/`DELETE` against any
business table — only the guard's own `SELECT` + `RAISE EXCEPTION`.
**Acceptance criteria:**
1. The **real guard text**, copied byte-for-byte out of `04-clientes-import-execute.sql` with **only
   its comparison literal inverted** (the inversion stated explicitly in the report), is executed live
   and its `RAISE EXCEPTION` output captured verbatim.
2. A second rehearsal demonstrates the abort-everything property: inside an explicit transaction, a
   statement issued *after* the failing guard is shown erroring with `current transaction is aborted,
   commands ignored until end of transaction block` — captured verbatim.
3. `SELECT count(*) FROM clientes;` before and after the rehearsals: identical (nothing was written).
4. The report states plainly which guard was rehearsed, what was altered, and that the remaining
   guards are **not** individually rehearsed — no blanket "all guards verified" claim
   (`assertion-without-verification`).
5. No credentials, no PII. Rollback note: read-only, nothing to revert (no git verb).

---

### T6 — Operator runbook  [senior] · owner: senior-dev
**Depends on:** T5.
**Files in scope:** `docs/migracion/README-clientes-import.md`, `reports/t06-dev.md`.
**DB/isolation:** none.
**Acceptance criteria:**
1. Sections: (a) backup **before anything**, with verification that the backup is restorable and newer
   than now; (b) **client-creation freeze** for the duration (HC-3), with the reason stated; (c) how to
   run and read the dry run — every grid Q1–Q7 described so the description **matches what the SQL
   actually prints** (`runbook-pass-condition-misdescribes-behavior`: each pass/fail sentence traced to
   the literal SQL line that produces it, cited in the dev report); (d) sign-off checklist; (e) how to
   run the execute script and what success/abort look like; (f) rollback.
2. Discloses, in the operator's words: the ~1,232 new `auditoria` rows and the rewritten
   `reservas.fecha_editado` (HC-2); the 15 `nombre_completo = 'N/A'` and 229 `responsable = 'N/A'`
   rows; the `pais` literal divergence from the app's accented default (HC-4); that the app computes
   ids as `MAX(id)+1` so the sequence advance is belt-and-braces, **not** the mechanism the app uses.
3. Rollback section: after a successful `COMMIT`, restoring the Step-1 backup is the only undo, **and
   the sentence naming the restore command also states, in that same sentence, that the restore is
   irreversible against anything written to production after the backup was taken**
   (`destructive-op-named-in-rollback-note` + `runbook-pass-condition-misdescribes-behavior`).
4. `grep -nEi "checkout|reset --hard|clean -fd|stash drop|force-push|sed -i"` on the file → **0 hits**.
5. `grep -nEi "eyJ|postgresql://[^<]|supabase\.co"` → 0 real values; placeholders only.
6. States that a second run of the execute script cannot duplicate rows (G1 fails) and that an aborted
   run needs no rollback.
7. ≤300 lines (the file-size exemption does **not** cover this hand-written file).
8. Rollback note in prose, no git verb.

---

### T7 — Correct the stale dead-credentials claim in `README-cleanup.md`  [junior] · owner: junior-dev
**Depends on:** T6 (and evidentially on T1/T3).
**Files in scope:** `docs/migracion/README-cleanup.md`, `reports/t07-dev.md`.
**DB/isolation:** none.
**Acceptance criteria:**
1. Only two spans change: the `Verification status` block (~L11-17) and the Step-1 dead-credentials
   sentence (~L36-40). Every other line is byte-identical — proven by a diff whose hunk count is 2.
2. The replacement wording claims **exactly** what T1/T3's captured evidence supports and no more: it
   names the channel that actually worked (psql / Supabase SQL editor / human-run) and the date, and
   it does **not** assert that `.env.local`'s credentials work unless T1 actually used them
   (`assertion-without-verification`). Cite the T1/T3 report paths.
3. The file's other still-accurate guidance — the two-file design note, the ROLLBACK-probe step, the
   `auditoria` lower-bound caveat, the RLS caveat, the KEEP set, the rollback section — is untouched.
4. No credential, host or key appears (`redaction-discipline`).
5. `npm run qa` green. Rollback note: restore the two spans by hand from the quoted original text in
   this report — prose, **no git verb**.

---

### T8 — Sprint-wide artifact audit  [senior] · owner: senior-dev
**Depends on:** T7.
**Files in scope:** `reports/t08-dev.md` (+ `t08-qa.md`). Read-only over the sprint's files.
**DB/isolation:** none.
**Acceptance criteria:**
1. Enumerates every sprint-touched file from `git status --short` (tracked **and** `??`) and states
   coverage as **N of M**; every check below is run against that explicit list, never via `git diff`
   (`git-diff-scope-excludes-untracked-files`).
2. Banned-verb grep over every rollback note written this sprint (all `reports/*.md`, the runbook, this
   plan) → 0 hits.
3. Isolation/DDL/fiscal grep over `03`/`04` → no unexpected hits; confirms no table was created, so no
   RLS policy is owed (ADR 0011/0006 reasoning restated in one line).
4. PII/credential grep over `reports/*.md` and `scratchpad.md` → no client names, emails, phone or id
   numbers copied out of the payload; no keys or connection strings.
5. SHA-256 of `03` and `04` re-shown and matched against T2/T4's recorded hashes.
6. `npm run qa` run once more, output shown green.
7. States explicitly that **the import has not been executed** and that no agent ran `04`; any claim
   that the import happened requires a human-supplied post-run query result.
8. Rollback note: read-only, nothing to revert (no git verb).

---

## 10. What "done" means

The sprint is done when T1–T8 pass QA and the four artifacts exist, with the dry run **proven run
live** and at least one guard **proven to fire**. The import itself is **not** done: the real `COMMIT`
is the human's separate action. No sprint summary may claim the import happened without a
human-supplied post-run query result.

PLAN_PATH: docs/plans/clientes-xlsx-import.md
