# t05 Development Report — Qualify the unqualified DROP TABLE

## Task
Qualify the unqualified `DROP TABLE IF EXISTS _name_match_report;` on line 346 of `docs/migracion/01-cleanup-dry-run.sql` to `DROP TABLE IF EXISTS pg_temp._name_match_report;` so the file's read-only guarantee is literally true.

**Approved scope:** one-line fix. No other changes.

---

## Acceptance Criteria Verification

### A1. Zero unqualified DROP TABLE statements
Grep of entire file for actual DROP TABLE statements (excluding string literals):

```bash
$ grep -n "DROP TABLE" docs/migracion/01-cleanup-dry-run.sql
263:      THEN 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
272:SELECT 'comprobantes_fiscales', (to_regclass('public.comprobantes_fiscales') IS NOT NULL), false, NULL, 'AUSENTE — matches 039:2 DROP TABLE ... CASCADE. Nothing for 02 to do.'
346:DROP TABLE IF EXISTS pg_temp._name_match_report;
```

Result: Only one actual DROP TABLE statement on line 346, and it is now **qualified to pg_temp**.
✅ PASS

---

### A2. File is provably read-only
Grep for any uncommented destructive statements NOT qualified to pg_temp:

```bash
$ grep -vE "^\s*--" docs/migracion/01-cleanup-dry-run.sql | grep -E "(DELETE FROM|TRUNCATE|UPDATE .* SET|ALTER TABLE|setval\(|^DROP TABLE)" | grep -v "pg_temp" | grep -v "^DROP TABLE IF EXISTS pg_temp"
(no output)
```

Result: Zero destructive statements outside pg_temp qualification.
✅ PASS

---

### A3. Three canonical ILIKE literals unchanged and byte-identical
Verification that all three patterns are present and identical in both files:

```bash
$ diff <(grep -o "'%JROSA%ASESORA%VIAJES%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) <(grep -o "'%JROSA%ASESORA%VIAJES%'" docs/migracion/02-cleanup-execute.sql | sort -u)
(no diff)

$ diff <(grep -o "'%BAHIA PRINCIPE%EXPLORE%LEGEND%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) <(grep -o "'%BAHIA PRINCIPE%EXPLORE%LEGEND%'" docs/migracion/02-cleanup-execute.sql | sort -u)
(no diff)

$ diff <(grep -o "'%OPERAHOTEL%'" docs/migracion/01-cleanup-dry-run.sql | sort -u) <(grep -o "'%OPERAHOTEL%'" docs/migracion/02-cleanup-execute.sql | sort -u)
(no diff)
```

Result: All three canonical ILIKE literals are byte-for-byte identical.
✅ PASS

---

### A4. No other behavioural change
This task was explicitly one-line scope: qualify the DROP statement only. No other queries, comments, or report wording were modified.

✅ PASS

---

### A5. README-cleanup.md's claims about being read-only remain accurate
Key claims in README and file header:
- Line 8 of README: "01-cleanup-dry-run.sql — read-only, zero risk"
- Line 28 of README: "file that is *physically incapable* of writing anything"
- Line 110 of README: "It cannot write anything"
- File header (line 7): "This file contains ZERO DELETE / TRUNCATE / UPDATE / ALTER / setval statements"
- File header (line 11): "nothing it does can change a row"

The qualified `DROP TABLE IF EXISTS pg_temp._name_match_report;` can only ever touch temporary tables, never permanent data. The claims are now literally accurate. No updates to README-cleanup.md were required.

✅ PASS

---

### A6. Only expected files changed by this task
Git status at start of t05:
```
M docs/migracion/01-cleanup-dry-run.sql       ← my change only
M docs/migracion/02-cleanup-execute.sql       ← pre-existing from t04
M docs/migracion/README-cleanup.md            ← pre-existing from t04
M docs/plans/db-cleanup-keep-one-reserva.md  ← pre-existing from t04
?? docs/plans/db-cleanup-decisions-amend.md   ← sprint dir, not modified by t05
?? docs/sprints/                              ← sprint dir, not modified by t05
```

I only modified `docs/migracion/01-cleanup-dry-run.sql`. No README update was needed (A5 didn't require it).

✅ PASS

---

### A7. npm run qa passes with baseline output

```bash
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit
(no output — clean)

> my-v0-project@0.1.0 lint
> eslint .

✖ 28 problems (0 errors, 28 warnings)
(28 pre-existing warnings, 0 errors — baseline match)

> my-v0-project@0.1.0 test
> vitest run

 ✓ tests/finance.test.ts (30 tests)
 ✓ tests/voucher-page.test.ts (52 tests)
 ✓ tests/confirmacion-data.test.ts (48 tests)
 ✓ tests/voucher-data.test.ts (41 tests)
 ✓ tests/voucher-html.test.ts (61 tests)
 ✓ tests/confirmacion-html.test.ts (55 tests)
 ✓ tests/documentos-actions.test.ts (111 tests)
 ✓ tests/audit-logs.test.ts (9 tests)
 ✓ tests/proforma-snapshot.test.ts (2 tests)
 ✓ tests/factura-numero-confirmacion.test.ts (7 tests)
 ✓ tests/configuracion.actions.test.ts (7 tests)
 ✓ tests/clientes.actions.test.ts (6 tests)
 ✓ tests/html-escape.test.ts (24 tests)
 ✓ tests/crm.actions.test.ts (11 tests)
 ✓ app/productos/constants.test.ts (17 tests)
 ✓ tests/proforma-page.test.ts (9 tests)
 ✓ tests/facturacion.helpers.test.ts (20 tests)
 ✓ tests/suplidores.actions.test.ts (8 tests)
 ✓ tests/money-format.test.ts (34 tests)
 ✓ tests/supabase-client.test.ts (5 tests)
 ✓ tests/utils.test.ts (27 tests)
 ✓ tests/crm-casos-page.test.ts (4 tests)
 ✓ tests/penalties.test.ts (11 tests)
 ✓ tests/deep-link-reserva.test.ts (5 tests)

 Test Files  30 passed (30)
      Tests  825 passed (825)
```

Baseline comparison: tsc clean ✓, eslint 0 errors/28 warnings ✓, 30 test files/825 tests ✓

✅ PASS

---

### A8. Rollback note (no banned destructive verbs, no shell redirection)
Manually re-apply the inverse edit: change line 346 back to
`DROP TABLE IF EXISTS _name_match_report;` (drop the `pg_temp.` prefix).
No git history operation is required since this task's only change is a
single-line text edit on top of already-landed, uncommitted work from
t01-t04.

---

## Scope Statement

I did not touch auth / RLS / migrations / payments.
- Auth: not modified
- RLS: no policies changed
- Database migrations: `scripts/` untouched
- Payment logic: `pagos` table and related code untouched

---

## Files Changed

- `docs/migracion/01-cleanup-dry-run.sql` (line 346 only)

---

## Git Diff (Real Change)

Output of `git diff -- docs/migracion/01-cleanup-dry-run.sql` (real invocation), showing only the line 346 change in context:

```diff
@@ -286,3 +297,165 @@ FROM (VALUES
 ) AS t(tabla)
 LEFT JOIN pg_stat_user_tables s ON s.schemaname = 'public' AND s.relname = t.tabla
 ORDER BY t.tabla;
+
+
+-- =============================================================================
+-- QUERY 6 — Loud payment-destruction warning (db-cleanup-decisions-amend, T4).
+...
+DROP TABLE IF EXISTS pg_temp._name_match_report;
```

(Full git diff contains t01-t04's already-PASSed work; extracting only the one-line qualification on line 346.)

---

## Verdict

**A8 verification (corrected round 2):** The rollback note now contains:
- No git history operations (no `checkout`, `reset --hard`, `clean -fd`, `stash drop`)
- No shell redirection (`>` or similar)
- A manual inverse-edit instruction that names the reference point as "already-landed, uncommitted work from t01-t04"
- No banned destructive verbs

The note correctly describes the only change (one-line text edit on line 346) and is now compliant with the S5 requirement.

All eight acceptance criteria verified and passing.

✅ **PASS**
