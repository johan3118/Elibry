# t02 dev report — Guard 3, the three-entity name-assertion guard

Task: add Guard 3 to `docs/migracion/02-cleanup-execute.sql`, immediately after
Guard 2 (line 74) and before Section 1 / the first `DELETE FROM`. Pure
addition. Owns the three canonical ILIKE literals.

## Files changed

- `docs/migracion/02-cleanup-execute.sql` (only file touched)

## What was added

A new `DO $$ ... END $$;` block ("GUARD 3") inserted at lines 76-232 (block
body starts at line 102), between Guard 2's `END $$;` (line 74, byte-identical
to pre-task) and the pre-existing `-- SECTION 1 —` header comment (now at line
234, was line 76 before this task).

Guard 3:
1. Re-resolves `cliente_id`/`producto_id` directly from
   `reservas WHERE codigo = 'RES-1787875561067'` — **not** from `_keep_reserva`,
   because that temp table does not exist yet at this point in the file (it is
   created in Section 1, which runs *after* Guard 3). This mirrors Guards 1-2's
   own pattern of querying `reservas` directly.
2. For cliente, producto, and suplidor (suplidor resolved via
   `productos.suplidor_id` off the already-resolved producto), it self-detects
   which candidate name column(s) exist on the target table via
   `information_schema.columns WHERE table_schema = 'public' AND table_name =
   ... AND column_name = ...` (same idiom the file already uses at the FISCAL
   GATE, line ~199/331 post-edit) — never a hardcoded single column.
3. For each existing candidate column, fetches the value with a dynamic
   `EXECUTE format('SELECT %I FROM <table> WHERE id = $1', v_col) INTO v_val
   USING <id>` and checks it with `ILIKE` against the canonical pattern.
4. Raises one of four **distinct** exceptions per entity (never a collapsed
   generic "MISMATCH"):
   - `(cliente|producto|suplidor, no-candidate-column)` — none of the
     candidate columns exist on the table at run time.
   - `(cliente|producto|suplidor, name-null-or-empty)` — candidate column(s)
     exist but every value is NULL or empty after `btrim`.
   - `(cliente|producto|suplidor, no-match)` — a non-empty value exists but
     none of the candidate columns match the ILIKE pattern.
   - `(suplidor, suplidor-id-null)` — `productos.suplidor_id IS NULL` for the
     kept producto, checked *before* even querying `suplidores`, so no
     suplidor row can be resolved at all (Guard 2 only checks `cliente_id`/
     `producto_id`, not `suplidor_id` — this state is reachable today).

Candidate column lists (exactly as specified in plan §7):
- `clientes`: `nombre_completo`, `razon_social`, `nombre_comercial`
- `productos`: `nombre_producto`, `nombre_original`
- `suplidores`: `razon_social`, `nombre_comercial`

Canonical ILIKE literals (owned here, verbatim, exactly as the plan mandates):
- cliente: `'%JROSA%ASESORA%VIAJES%'`
- producto: `'%BAHIA PRINCIPE%EXPLORE%LEGEND%'`
- suplidor: `'%OPERAHOTEL%'`

## AC8 — written substitution argument (in my own words)

- **`%JROSA%ASESORA%VIAJES%`** — `JROSA` is not a real word or common
  abbreviation; it only makes sense as a coined/compressed brand token (e.g.
  a contraction of a person's name). The pattern also requires `ASESORA` and
  `VIAJES` to appear, **in that order**, after it. A plausible different real
  travel agency such as `VIAJES CARIBE SRL` fails immediately — it has
  neither `JROSA` nor `ASESORA`. A more adversarial near-miss like
  `ASESORES DE VIAJES DEL ESTE` also fails: it has `ASESORA`-adjacent and
  `VIAJES` tokens but is missing `JROSA` entirely, and even a company that
  *did* contain the substring `JROSA` (e.g. `JROSA CONSTRUCTORA`) still fails
  because it lacks `ASESORA` and `VIAJES` after it. The three-token,
  in-order requirement is what makes this strict, not any single token.
- **`%BAHIA PRINCIPE%EXPLORE%LEGEND%`** — deliberately does *not* stop at the
  hotel chain's own name, because `BAHIA PRINCIPE` alone would match every
  property in the chain. A sibling property in the same chain, e.g.
  `BAHIA PRINCIPE GRAND PUNTA CANA` or `BAHIA PRINCIPE LUXURY AMBAR`, matches
  `BAHIA PRINCIPE` but has neither `EXPLORE` nor `LEGEND` after it, so the
  pattern correctly rejects it. This is the pattern I'd worry about most in a
  real tour-operator DB, since a dozen different Bahia Principe products are
  entirely plausible — narrowing past the chain name to the specific
  sub-brand tier is what keeps it from over-matching.
- **`%OPERAHOTEL%`** — a single token, but it is a coined compound (no space)
  that does not correspond to any normal Spanish or English phrase. A
  plausible different real supplier such as `OPERADORA HOTELERA SRL` (a
  generic "hotel operator" company) fails because the contiguous substring
  `OPERAHOTEL` never occurs — `OPERADORA` and `HOTELERA` are separate words
  with extra letters between them. Likewise `HOTEL OPERA` (reversed word
  order) and `OPERA TOURS SRL` both fail for the same reason: no contiguous
  `OPERAHOTEL` substring. A bare `%SRL%` or `%HOTEL%` would match a large
  fraction of any supplier table and is explicitly what this pattern avoids
  by requiring the exact coined compound.

## Position proof (AC7b)

```
$ rg -n "^DO \$\$" docs/migracion/02-cleanup-execute.sql | head -5
40:DO $$
60:DO $$
102:DO $$
312:DO $$
379:DO $$

$ rg -n "DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -1
266:-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE

$ rg -n "^DELETE FROM" docs/migracion/02-cleanup-execute.sql | head -1
268:DELETE FROM seguimiento_comentarios;                    -- CASCADE child of casos (036:34); explicit anyway
```

Guard 3's block (comment header 76, `DO $$` at 102) is well before line 268,
the file's first executable `DELETE FROM`. (40 = Guard 1, 60 = Guard 2, 102 =
Guard 3, 312/379 = pre-existing later blocks in Section A/the fiscal gate,
unrelated to this task.)

## AC7c — self-detection proof

```
$ rg -n "information_schema" docs/migracion/02-cleanup-execute.sql
85:-- below is checked against information_schema.columns at run time
123:      SELECT 1 FROM information_schema.columns
146:      SELECT 1 FROM information_schema.columns
174:      SELECT 1 FROM information_schema.columns
316:      SELECT 1 FROM information_schema.columns
```
(Lines 123/146/174 are Guard 3's three per-entity self-detect checks, one per
entity, inside the `FOREACH` loop over each candidate-column array. Line 316
is the pre-existing, untouched FISCAL GATE check.)

## AC8 literal-exactness proof

```
$ grep -no "'%[A-Z% ]*%'" docs/migracion/02-cleanup-execute.sql | sort -u
130:'%JROSA%ASESORA%VIAJES%'
153:'%BAHIA PRINCIPE%EXPLORE%LEGEND%'
181:'%OPERAHOTEL%'
90:'%JROSA%ASESORA%VIAJES%'
91:'%BAHIA PRINCIPE%EXPLORE%LEGEND%'
92:'%OPERAHOTEL%'
```
(90-92 = header comment restating the patterns; 130/153/181 = the executable
`ILIKE` comparisons. Both sets match exactly.)

## AC7d — four-state non-collapse proof

```
$ rg -n "GUARD 3" docs/migracion/02-cleanup-execute.sql
77:-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
135:    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-candidate-column) — ...
137:    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, name-null-or-empty) — ...
139:    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-match) — ...
158:    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-candidate-column) — ...
160:    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, name-null-or-empty) — ...
162:    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-match) — ...
168:    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, suplidor-id-null) — ...
186:    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-candidate-column) — ...
188:    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, name-null-or-empty) — ...
190:    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-match) — ...
```
10 distinct, tagged exception messages: 3 states × 3 entities (no-candidate-
column / name-null-or-empty / no-match) plus the suplidor-only `suplidor-id-
null` state = the four abort states from plan §7, never collapsed into a
generic "MISMATCH".

## AC7e — Guards 1-2 byte-identical proof

```
$ git diff -- docs/migracion/02-cleanup-execute.sql | head -5
diff --git a/docs/migracion/02-cleanup-execute.sql b/docs/migracion/02-cleanup-execute.sql
index 5e2c0fd..a2af5c6 100644
--- a/docs/migracion/02-cleanup-execute.sql
+++ b/docs/migracion/02-cleanup-execute.sql
@@ -73,13 +73,141 @@ BEGIN
   END IF;
```

The first hunk's old-file starting line is 73 — meaning lines 1-72 have **zero**
diff, and lines 73-74 (`  END IF;` / `END $$;`, the tail of Guard 2) appear
only as unchanged context before the insertion begins. Direct read confirms
the blank separator line 75 is preserved and Guard 3's header starts cleanly
at line 76:

```
$ sed -n '70,77p' docs/migracion/02-cleanup-execute.sql
  END IF;
  IF v_producto_id IS NULL THEN
    RAISE EXCEPTION 'ABORT: reserva RES-1787875561067 has producto_id IS NULL. Cannot resolve a product to keep. Refusing to proceed (SET NULL hazard, see file header).';
  END IF;
END $$;

-- =============================================================================
-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
```

Guards 1-2 (lines 40-74) are byte-identical to the pre-t02 state (which is
itself byte-identical to the pre-t01 state — t01's dev/QA reports already
proved this, and t01 made no edits above line 76 either).

## No UPDATE statements introduced (scope constraint)

```
$ rg -n "^\s*UPDATE " docs/migracion/02-cleanup-execute.sql
(no output)
```

## Regression greps (AC10, AC11 — re-run in full on the post-t02 file)

```
$ rg -n "TRUNCATE|DROP TABLE|DROP VIEW|DROP POLICY|session_replication_role|RESTART WITH|CREATE POLICY|DISABLE ROW LEVEL SECURITY" docs/migracion/02-cleanup-execute.sql
24:--   - SET session_replication_role = replica;  (056:8 — disables FK/trigger
26:--   - ALTER SEQUENCE ... RESTART WITH ...       (056:91-141 — fatal here because
29:--   - TRUNCATE, DROP TABLE, DROP VIEW, DROP POLICY, ALTER ... DISABLE ROW LEVEL
30:--     SECURITY, CREATE POLICY
266:-- set is genuinely empty (plan §4) -> bare DELETE FROM, chosen over TRUNCATE
324:    RAISE NOTICE 'comprobantes_fiscales does not exist (matches 039:2 DROP TABLE ... CASCADE) — nothing to do.';
378:-- keep set -> bare DELETE, chosen over TRUNCATE to stay in this transaction.
448:-- Rows survive in most tables, so ALTER SEQUENCE ... RESTART WITH 1 (the
465:-- permitted form here — never RESTART WITH 1, since another future run of this
```
Every hit is inside a `--` comment (the file's own banned-pattern header and
rationale prose). Zero executable occurrences. Same shape as t01's baseline.

```
$ head -35 docs/migracion/02-cleanup-execute.sql | grep -n "^BEGIN;"
33:BEGIN;
$ tail -3 docs/migracion/02-cleanup-execute.sql
-- This is a real commit. Nothing above this line was a dry run.
-- =============================================================================
COMMIT;
$ rg -n "^\s*ROLLBACK;" docs/migracion/02-cleanup-execute.sql
(no output)
```
File still opens `BEGIN;`, ends `COMMIT;`, no `ROLLBACK;`.

```
$ grep -n "comprobantes_disponibles" docs/migracion/02-cleanup-execute.sql
420:-- comprobantes_disponibles holds LIVE DGII NCF SEQUENCE STATE: numero_actual
443:-- DELETE FROM comprobantes_disponibles; -- COMPLIANCE EVENT — see warning above. Requires fiscal sign-off.
473:--   - v_comprobantes_disponibles (scripts/039:35) and v_comprobantes_fiscales
```
0 uncommented `DELETE FROM` against `comprobantes_disponibles` (Section B).
The undischarged fiscal gate is untouched — no diff hunk falls in Sections
B/C/D or the FISCAL GATE block.

## Line-budget flag (HC-2, `.claude/rules/file-size.md`)

```
$ wc -l docs/migracion/02-cleanup-execute.sql
579 docs/migracion/02-cleanup-execute.sql
```

**FLAG: refactor signal.** File was 461 lines after t01 (already under the
500 ceiling); Guard 3 alone adds 118 lines, landing the file at **579 lines**,
past the ceiling *before T3 has even run*. Per plan HC-2, splitting a file
that is one `BEGIN;`…`COMMIT;` transaction would create a second commit
trigger (`mistakes/confirm-gate-false-commit`), which the plan explicitly
forbids. **The file is NOT split.** This is flagged here and is already
tracked at the sprint's §3 close-queue as Hard call HC-2 (the human-facing
flag for the whole T1+T2+T3 stack). T3's dev must re-flag this with the final
post-T3 line count, per its own AC12.

## Files changed

- `docs/migracion/02-cleanup-execute.sql`

## git diff (full, cumulative since sprint open at `3faa20c` — includes t01,
already reviewed and PASSed; t02's own contribution is the `GUARD 3` block,
lines 76-232 in the new file, everything else below is t01's already-approved
work, shown here only because the working tree has not been committed
between tasks)

```diff
diff --git a/docs/migracion/02-cleanup-execute.sql b/docs/migracion/02-cleanup-execute.sql
index 5e2c0fd..a2af5c6 100644
--- a/docs/migracion/02-cleanup-execute.sql
+++ b/docs/migracion/02-cleanup-execute.sql
@@ -73,13 +73,141 @@ BEGIN
   END IF;
 END $$;
 
+-- =============================================================================
+-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight three-entity name
+-- assertion. Resolves the kept reserva's cliente name, producto name, and
+-- that producto's suplidor name, and aborts unless all three match a
+-- canonical pattern, case-insensitively (ILIKE). Purpose: Guards 1-2 only
+-- prove a reserva with this exact codigo exists and has non-NULL FKs — they
+-- cannot tell a wrong-DB/wrong-seed run apart from the real one. This guard
+-- can, by checking who those FKs actually point to.
+-- Name columns are NEVER hardcoded to a single column — each candidate list
+-- below is checked against information_schema.columns at run time
+-- (mistakes/schema-source-of-truth: the live DB is unreachable this sprint,
+-- scripts/*.sql is corroboration only, so this file self-detects or refuses).
+-- Canonical ILIKE patterns (owned here — 01's preview report, T5, copies
+-- these verbatim; they must never drift, plan §7):
+--   cliente:  '%JROSA%ASESORA%VIAJES%'
+--   producto: '%BAHIA PRINCIPE%EXPLORE%LEGEND%'
+--   suplidor: '%OPERAHOTEL%'
+-- Four distinct abort states, never collapsed into one generic "MISMATCH"
+-- (decisions/0012-elibry-confirmacion-without-factura-numero):
+--   (a) a candidate name value is present but does not match the pattern
+--   (b) every candidate name column exists but is NULL/empty
+--   (c) no candidate name column exists on that table at run time
+--   (d) suplidor only: productos.suplidor_id IS NULL, so no suplidor row can
+--       even be resolved (Guard 2 checks cliente_id/producto_id, not
+--       suplidor_id — this state is reachable today).
+-- =============================================================================
+DO $$
+DECLARE
+  v_cliente_id    integer;
+  v_producto_id   integer;
+  v_suplidor_id   integer;
+  v_col           text;
+  v_val           text;
+  v_cols_found    integer;
+  v_any_nonnull   boolean;
+  v_matched       boolean;
+  v_cliente_cols  text[] := ARRAY['nombre_completo', 'razon_social', 'nombre_comercial'];
+  v_producto_cols text[] := ARRAY['nombre_producto', 'nombre_original'];
+  v_suplidor_cols text[] := ARRAY['razon_social', 'nombre_comercial'];
+BEGIN
+  SELECT cliente_id, producto_id INTO v_cliente_id, v_producto_id
+  FROM reservas WHERE codigo = 'RES-1787875561067';
+
+  -- CLIENTE ---------------------------------------------------------------
+  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
+  FOREACH v_col IN ARRAY v_cliente_cols LOOP
+    IF EXISTS (
+      SELECT 1 FROM information_schema.columns
+      WHERE table_schema = 'public' AND table_name = 'clientes' AND column_name = v_col
+    ) THEN
+      v_cols_found := v_cols_found + 1;
+      EXECUTE format('SELECT %I FROM clientes WHERE id = $1', v_col) INTO v_val USING v_cliente_id;
+      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
+        v_any_nonnull := true;
+        IF v_val ILIKE '%JROSA%ASESORA%VIAJES%' THEN v_matched := true; END IF;
+      END IF;
+    END IF;
+  END LOOP;
+  IF v_cols_found = 0 THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-candidate-column) — clientes has none of the candidate name columns (nombre_completo, razon_social, nombre_comercial) at run time. Cannot verify cliente identity. Refusing to proceed.';
+  ELSIF NOT v_any_nonnull THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, name-null-or-empty) — clientes.id = % has every candidate name column NULL or empty. Cannot verify cliente identity. Refusing to proceed.', v_cliente_id;
+  ELSIF NOT v_matched THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (cliente, no-match) — clientes.id = % name does not match expected pattern %%JROSA%%ASESORA%%VIAJES%%. This does not look like the intended cliente to keep. Refusing to proceed.', v_cliente_id;
+  END IF;
+
+  -- PRODUCTO --------------------------------------------------------------
+  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
+  FOREACH v_col IN ARRAY v_producto_cols LOOP
+    IF EXISTS (
+      SELECT 1 FROM information_schema.columns
+      WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = v_col
+    ) THEN
+      v_cols_found := v_cols_found + 1;
+      EXECUTE format('SELECT %I FROM productos WHERE id = $1', v_col) INTO v_val USING v_producto_id;
+      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
+        v_any_nonnull := true;
+        IF v_val ILIKE '%BAHIA PRINCIPE%EXPLORE%LEGEND%' THEN v_matched := true; END IF;
+      END IF;
+    END IF;
+  END LOOP;
+  IF v_cols_found = 0 THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-candidate-column) — productos has none of the candidate name columns (nombre_producto, nombre_original) at run time. Cannot verify producto identity. Refusing to proceed.';
+  ELSIF NOT v_any_nonnull THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, name-null-or-empty) — productos.id = % has every candidate name column NULL or empty. Cannot verify producto identity. Refusing to proceed.', v_producto_id;
+  ELSIF NOT v_matched THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (producto, no-match) — productos.id = % name does not match expected pattern %%BAHIA PRINCIPE%%EXPLORE%%LEGEND%%. This does not look like the intended producto to keep. Refusing to proceed.', v_producto_id;
+  END IF;
+
+  -- SUPLIDOR ----------------------------------------------------------------
+  SELECT suplidor_id INTO v_suplidor_id FROM productos WHERE id = v_producto_id;
+  IF v_suplidor_id IS NULL THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, suplidor-id-null) — productos.id = % (the kept producto) has suplidor_id IS NULL. No suplidor row can be resolved to verify. Refusing to proceed.', v_producto_id;
+  END IF;
+
+  v_cols_found := 0; v_any_nonnull := false; v_matched := false;
+  FOREACH v_col IN ARRAY v_suplidor_cols LOOP
+    IF EXISTS (
+      SELECT 1 FROM information_schema.columns
+      WHERE table_schema = 'public' AND table_name = 'suplidores' AND column_name = v_col
+    ) THEN
+      v_cols_found := v_cols_found + 1;
+      EXECUTE format('SELECT %I FROM suplidores WHERE id = $1', v_col) INTO v_val USING v_suplidor_id;
+      IF v_val IS NOT NULL AND btrim(v_val) <> '' THEN
+        v_any_nonnull := true;
+        IF v_val ILIKE '%OPERAHOTEL%' THEN v_matched := true; END IF;
+      END IF;
+    END IF;
+  END LOOP;
+  IF v_cols_found = 0 THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-candidate-column) — suplidores has none of the candidate name columns (razon_social, nombre_comercial) at run time. Cannot verify suplidor identity. Refusing to proceed.';
+  ELSIF NOT v_any_nonnull THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, name-null-or-empty) — suplidores.id = % has every candidate name column NULL or empty. Cannot verify suplidor identity. Refusing to proceed.', v_suplidor_id;
+  ELSIF NOT v_matched THEN
+    RAISE EXCEPTION 'ABORT: GUARD 3 (suplidor, no-match) — suplidores.id = % name does not match expected pattern %%OPERAHOTEL%%. This does not look like the intended suplidor to keep. Refusing to proceed.', v_suplidor_id;
+  END IF;
+END $$;
+
 -- =============================================================================
 -- SECTION 1 — Materialise the entire KEEP set BEFORE any DELETE.
--- Why materialise (not inline CTEs per statement): _keep_cliente reads `pagos`.
--- If `pagos` were deleted before `clientes`, a re-evaluated inline CTE could
--- return a SMALLER client set on a later statement and the kept client could
--- be deleted. Materialising first makes delete order irrelevant to what the
--- keep set contains. ON COMMIT DROP — these never outlive this transaction.
+-- Materialising first makes delete order irrelevant to what the keep set
+-- contains, regardless of which tables have already been touched.
+-- ON COMMIT DROP — these never outlive this transaction.
+--
+-- AMENDMENT (db-cleanup-decisions-amend, T1): `pagos` has NO keep set anymore
+-- — every row is destroyed unconditionally (Step 3 below), so `_keep_cliente`
+-- no longer reads `pagos` at all; it is built from `_keep_reserva.cliente_id`
+-- alone. The old rationale that used to live here ("materialise because
+-- _keep_cliente reads pagos") is factually dead and has been removed.
+-- Deliberate behaviour consequence: previously, a `pagos.cliente_id` that
+-- diverged from `reservas.cliente_id` was protected via a UNION with
+-- `_keep_pago`, so that client survived even though it was not the kept
+-- reserva's own client. That protection is gone — such a client is now
+-- deleted like any other non-kept client. This is intentional, not a bug
+-- (plan §8 edge cases).
 -- =============================================================================
 CREATE TEMP TABLE _keep_reserva ON COMMIT DROP AS
   SELECT id, cliente_id, producto_id FROM reservas WHERE codigo = 'RES-1787875561067';
@@ -92,13 +220,12 @@ CREATE TEMP TABLE _keep_suplidor ON COMMIT DROP AS
   FROM productos p
   WHERE p.id IN (SELECT id FROM _keep_producto) AND p.suplidor_id IS NOT NULL;
 
-CREATE TEMP TABLE _keep_pago ON COMMIT DROP AS
-  SELECT id, cliente_id FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva);
+-- _keep_pago temp table REMOVED (db-cleanup-decisions-amend, T1): `pagos` has
+-- no keep set — every row is destroyed unconditionally (Step 3). See the
+-- Section 1 header comment above for the deliberate behaviour consequence.
 
 CREATE TEMP TABLE _keep_cliente ON COMMIT DROP AS
-  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL
-  UNION
-  SELECT cliente_id AS id FROM _keep_pago WHERE cliente_id IS NOT NULL;
+  SELECT cliente_id AS id FROM _keep_reserva WHERE cliente_id IS NOT NULL;
 
 CREATE TEMP TABLE _keep_detalle ON COMMIT DROP AS
   SELECT id FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva);
@@ -121,7 +248,11 @@ SELECT
   (SELECT count(*) FROM _keep_detalle)    AS n_detalles,
   (SELECT count(*) FROM _keep_pasajero)   AS n_pasajeros,
   (SELECT count(*) FROM _keep_ocupacion)  AS n_ocupaciones,
-  (SELECT count(*) FROM _keep_pago)       AS n_pagos;
+  -- AMENDMENT (T1): repurposed. This is no longer a "before" count to compare
+  -- against an "after" count — pagos has no keep set. It counts payments that
+  -- WILL be destroyed by Step 3's unconditional DELETE, sourced directly from
+  -- `pagos` (the removed `_keep_pago` temp table no longer exists).
+  (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos_a_destruir;
 
 -- =============================================================================
 -- SECTION A — business-data deletes, leaf-first. Ordered so no FK is violated
@@ -139,8 +270,9 @@ DELETE FROM seguimiento_casos;
 
 -- Step 3 — pagos MUST precede reservas and clientes: both its FKs are NO
 -- ACTION (scripts/025-fix-pagos-table.sql:106,110) and would block those
--- deletes otherwise.
-DELETE FROM pagos WHERE id NOT IN (SELECT id FROM _keep_pago);
+-- deletes otherwise. AMENDMENT (T1): unconditional — pagos has no keep set,
+-- ALL rows are destroyed, including any belonging to the kept reserva.
+DELETE FROM pagos;
 
 -- Step 4 — reserva_pasajeros before reserva_ocupaciones, to avoid pointless
 -- ON DELETE SET NULL (ocupacion_id) churn (scripts/061:84-86) on rows about to
@@ -219,7 +351,8 @@ WHERE NOT (
   OR (cp.tabla_afectada = 'clientes'            AND cp.registro_id IN (SELECT id FROM _keep_cliente))
   OR (cp.tabla_afectada = 'productos'           AND cp.registro_id IN (SELECT id FROM _keep_producto))
   OR (cp.tabla_afectada = 'suplidores'          AND cp.registro_id IN (SELECT id FROM _keep_suplidor))
-  OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
+  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
+  -- OR (cp.tabla_afectada = 'pagos'               AND cp.registro_id IN (SELECT id FROM _keep_pago))
   OR (cp.tabla_afectada = 'reserva_detalles'    AND cp.registro_id IN (SELECT id FROM _keep_detalle))
   OR (cp.tabla_afectada = 'reserva_pasajeros'   AND cp.registro_id IN (SELECT id FROM _keep_pasajero))
   OR (cp.tabla_afectada = 'reserva_ocupaciones' AND cp.registro_id IN (SELECT id FROM _keep_ocupacion))
@@ -231,7 +364,8 @@ WHERE NOT (
   OR (ap.tabla_objetivo = 'clientes'            AND ap.registro_id IN (SELECT id FROM _keep_cliente))
   OR (ap.tabla_objetivo = 'productos'           AND ap.registro_id IN (SELECT id FROM _keep_producto))
   OR (ap.tabla_objetivo = 'suplidores'          AND ap.registro_id IN (SELECT id FROM _keep_suplidor))
-  OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
+  -- AMENDMENT (T1): always false — no pago row ever survives the full wipe.
+  -- OR (ap.tabla_objetivo = 'pagos'               AND ap.registro_id IN (SELECT id FROM _keep_pago))
   OR (ap.tabla_objetivo = 'reserva_detalles'    AND ap.registro_id IN (SELECT id FROM _keep_detalle))
   OR (ap.tabla_objetivo = 'reserva_pasajeros'   AND ap.registro_id IN (SELECT id FROM _keep_pasajero))
   OR (ap.tabla_objetivo = 'reserva_ocupaciones' AND ap.registro_id IN (SELECT id FROM _keep_ocupacion))
@@ -411,8 +545,11 @@ BEGIN
   IF v_n_ocupaciones <> v_before.n_ocupaciones THEN
     RAISE EXCEPTION 'POST-CHECK FAILED: reserva_ocupaciones count for kept reserva changed from % to %. Aborting.', v_before.n_ocupaciones, v_n_ocupaciones;
   END IF;
-  IF v_n_pagos <> v_before.n_pagos THEN
-    RAISE EXCEPTION 'POST-CHECK FAILED: pagos count for kept reserva changed from % to %. Aborting.', v_before.n_pagos, v_n_pagos;
+  -- AMENDMENT (T1): strictly stronger than the old "before vs after equality"
+  -- check — pagos has no keep set, so the ONLY correct count after the
+  -- unconditional wipe is exactly 0, for every reserva including this one.
+  IF v_n_pagos <> 0 THEN
+    RAISE EXCEPTION 'POST-CHECK FAILED: expected 0 pagos rows for kept reserva after the unconditional wipe, found %. Aborting, nothing will be committed.', v_n_pagos;
   END IF;
 
   RAISE NOTICE 'All post-condition assertions passed. reserva RES-1787875561067 (id=%) is intact: cliente_id=%, producto_id=%, detalles=%, pasajeros=%, ocupaciones=%, pagos=%.',
@@ -430,6 +567,9 @@ SELECT
   (SELECT producto_id FROM reservas WHERE codigo = 'RES-1787875561067') AS producto_id,
   (SELECT count(*) FROM reserva_detalles WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_detalles,
   (SELECT count(*) FROM reserva_pasajeros WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pasajeros,
+  -- n_pagos is 0 by construction (AMENDMENT T1): this SELECT runs after Step
+  -- 3's unconditional `DELETE FROM pagos;`, so no pago row can exist here
+  -- regardless of reserva_id.
   (SELECT count(*) FROM pagos WHERE reserva_id IN (SELECT id FROM _keep_reserva)) AS n_pagos,
   current_user, session_user, current_database();
```

Every hunk after the Guard 3 insertion (`_keep_pago` removal, `_before_snapshot`,
Section A Step 3, the two polymorphic OR-lists, the post-condition, the final
report grid) is t01's already-PASSed work — unchanged by t02. t02's own diff
contribution is exactly the `+GUARD 3 ... +END $$;` block (117 added lines,
0 removed lines — a pure addition, as required).

## UNVERIFIED runtime claims

Every claim above about what Guard 3 "does at run time" (raises an exception,
matches a pattern, self-detects a column) is **literally UNVERIFIED** — this
SQL has never been executed against a live database. `db.jznchzgpaovmgjezvdwo.
supabase.co` has no DNS answer / REST returns 521 (per scratchpad §0). All
reasoning above is static code review plus PL/pgSQL language-rule knowledge
(`FOREACH ... IN ARRAY`, `EXECUTE format(...) USING`, `RAISE EXCEPTION` %/%%
escaping), not execution evidence.

## Commands run

```
$ npx tsc --noEmit
(no output — clean, exit 0, part of `npm run qa` below)

$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test

> my-v0-project@0.1.0 typecheck
> tsc --noEmit

> my-v0-project@0.1.0 lint
> eslint .

[... 28 pre-existing react-hooks/exhaustive-deps + @next/next/no-img-element
warnings across app/clientes, app/crm, app/facturacion, app/page.tsx,
app/pagos, app/productos, app/reservas — identical set to t01's baseline,
zero new warnings introduced by this task since it touches no app/lib file ...]

✖ 28 problems (0 errors, 28 warnings)

> my-v0-project@0.1.0 test
> vitest run

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  07:09:22
   Duration  1.91s (transform 1.01s, setup 1.68s, collect 1.80s, tests 422ms, environment 4ms, prepare 2.29s)
```

Exit code: 0 for the full `npm run qa` chain (`typecheck && lint && test`).
tsc: clean, 0 errors. eslint: 0 errors, 28 warnings (pre-existing, same count
and same files as t01's baseline — no app/lib/tests file is in this task's
scope, so this had to be identical). vitest: 30/30 files, 825/825 tests
passing — identical to t01's baseline.

```
$ git status --porcelain
 M docs/migracion/02-cleanup-execute.sql
?? docs/plans/db-cleanup-decisions-amend.md
?? docs/sprints/
```
Only the one in-scope file is modified. The two `??` entries are pre-existing
untracked sprint artifacts (the plan amendment and this sprint's own
`docs/sprints/` directory) — not touched or created by this task's edit, and
outside `docs/migracion/`.

```
$ git diff --stat -- docs/
 docs/migracion/02-cleanup-execute.sql | 174 ++++++++++++++++++++++++++++++----
 1 file changed, 157 insertions(+), 17 deletions(-)
```
(Cumulative t01+t02 stat against `HEAD=3faa20c`; t01's dev/QA reports already
established their own portion of this stat as PASS.)

## Rollback

The file's state at the **start of t02** (i.e., immediately after t01 landed)
was 461 lines, with Guard 3 absent and the `-- SECTION 1 —` header comment
beginning at line 76. To roll back t02 only: remove the inserted block that
starts at the line `-- GUARD 3 (db-cleanup-decisions-amend, T2) — preflight
three-entity name assertion.` and ends at the `END $$;` immediately before the
restored `-- SECTION 1 —` header comment (currently lines 76-232 inclusive of
the blank line before `-- SECTION 1`), leaving everything else (t01's already-
landed changes) untouched.

## Verdict: DONE

Report path: `docs/sprints/2026-09-22-db-cleanup-decisions-amend/reports/t02-dev.md`
