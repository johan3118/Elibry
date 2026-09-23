# T4 — Generated execute script (`04-clientes-import-execute.sql`) — dev report

**Verdict: BLOCKED** (one dimension only — file-size ceiling on the generator; see §7).
Everything else (mechanical inventory, determinism, weak-backstop-guard byte-identity,
`03` unchanged, `npm run qa`, live read-only validation of everything that can be
validated without running `04`) is green and evidenced below. `04` was built and is
functionally complete; the blocker is process/policy (`.claude/rules/file-size.md`
applies to the generator, and the pre-approved exemption explicitly does **not** cover
it), not a correctness defect.

`04-clientes-import-execute.sql` was **not executed** — not with `COMMIT`, not inside
`BEGIN`/`ROLLBACK`. Only its read-only guard predicates (staging + all 42 pre-write
checks, literally extracted from the on-disk file via `sed`) and `EXPLAIN`-only
(non-executing) plans of its 5 real-table-mutating statements were run live, per this
task's explicit allowance.

---

## 0. Files touched (scope)

```
$ git status --short   (before this task)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
                                                        (8 entries)

$ git status --short   (after this task)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql        <- NEW (this task's deliverable)
?? docs/migracion/generate-clientes-import.py            <- MODIFIED (extended, not replaced)
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
                                                        (9 entries: 8 unchanged + 1 new)
```

**9 of 9** entries accounted for. Only in-scope files touched:
`docs/migracion/generate-clientes-import.py` (edited), `docs/migracion/04-clientes-import-execute.sql`
(new), `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own row + own handoff
only), `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev.md` (this file).
`docs/migracion/03-clientes-import-dry-run.sql` shows as `??` because it already existed
(untracked, from T2) — its **content is byte-identical** to the pre-existing, QA-approved
version (proven in §5). No other file was touched.

Files changed:
- `docs/migracion/generate-clientes-import.py`
- `docs/migracion/04-clientes-import-execute.sql` (new)
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own row + own handoff)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev.md` (this file)

---

## 1. The `_jrosa_preserva` column-set decision (made explicitly in this task)

The plan's frozen spec named a 7-column MUST-PRESERVE **floor** (`estado_registro`,
`documentos_urls`, `imagen_url`, `registrado_por`, `fecha_creado`, `fecha_editado`,
`editado_por`) but did not pin the exact set — that decision was assigned to this task.

**Rule applied:** preserve every live `clientes` column that is **not** sourced from the
sheet. Sheet-sourced columns (18, per this task's brief, cross-checked against T1 Q4's
35-column list): `id, tipo_cliente, compania, rnc, razon_social, nombre_comercial,
responsable, identificacion, nombre_completo, sexo, fecha_nacimiento, telefonos, email,
direccion, pais, observacion, referido_por, status`.

**35 (T1 Q4 total) − 18 (sheet-sourced) = 17 preserved columns**, in T1 Q4 ordinal order:

```
registrado_por, fecha_creado, fecha_editado, editado_por, imagen_url, estado_registro,
usuario_creacion, fecha_provisional, dependencias_ids, telefonos_json, emails_json,
documentos, cedula_url, registro_mercantil_url, documento_cedula_url,
documento_registro_mercantil_url, documentos_urls
```

This is a **strict superset** of the frozen 7-column floor (all 7 floor columns are in
this list) and is consistent with the spec's stated intent ("JROSA's operational
metadata must not be lost"). Per this task's explicit note, JROSA's live
`estado_registro='PROVISIONAL'` value is preserved as-is (not normalized to
`'PERMANENTE'`) — the merge selects it verbatim from `_jrosa_preserva`, never from a
literal.

This constant (`PRESERVE_COLUMNS`) is defined once in the generator and used for both
the `_jrosa_preserva` capture and the JROSA-row INSERT's preserved-column list — see the
diff below.

---

## 2. Real diff (generator is untracked — `git diff` shows nothing for it; this is a
literal `diff -u` against a reconstructed pre-edit copy, saved before any edit this task
made, per `git-diff-scope-excludes-untracked-files`)

The diff is **100% additive** — zero existing lines were changed (confirmed: the closing
`]` of the pre-existing `MAPPING_TABLE` list is the only "moved" context line, an
artifact of insertion, not a content change). This is why `03`'s output is byte-identical
to the pre-existing, QA-approved file (§5).

```diff
--- generator_before.py (reconstructed pre-edit copy, 500 lines, matches T2r4/T3r3-approved content)
+++ docs/migracion/generate-clientes-import.py (this task's result, 635 lines)
@@ -91,7 +91,22 @@
     ("status", "status", "verbatim; validated against ACTIVO/INACTIVO"),
     ("(no sheet column)", "registrado_por", "'N/A' for all rows (NOT NULL, no sheet source; app sets this from the logged-in user, absent for a bulk import)"),
     ("(no sheet column)", "estado_registro", "'PERMANENTE' for 1230 rows; NULL for the single staged row id=1185 (sheet JROSA row) — real value DEFERRED to T4's JROSA-preservation merge"),
+]
+OUTPUT_PATH_04 = os.path.join(_SCRIPT_DIR, "04-clientes-import-execute.sql")
+# T4 decision: _jrosa_preserva = every live `clientes` column NOT sourced
+# from the sheet (T1 Q4's 35 cols minus the 18 sheet-sourced ones below) --
+# a strict superset of the frozen spec's 7-col MUST-PRESERVE floor
+# (estado_registro, documentos_urls, imagen_url, registrado_por,
+# fecha_creado, fecha_editado, editado_por).
+PRESERVE_COLUMNS = [
+    "registrado_por", "fecha_creado", "fecha_editado", "editado_por", "imagen_url",
+    "estado_registro", "usuario_creacion", "fecha_provisional", "dependencias_ids",
+    "telefonos_json", "emails_json", "documentos", "cedula_url",
+    "registro_mercantil_url", "documento_cedula_url",
+    "documento_registro_mercantil_url", "documentos_urls",
 ]
+INSERT_COLUMNS = [c for c in DB_COLUMNS if c not in _BOOLEAN_DB_COLUMNS]  # 20 real `clientes` cols
+SHEET_ONLY_COLUMNS = [c for c in INSERT_COLUMNS if c not in PRESERVE_COLUMNS]  # 18, JROSA merge `s.` side
 _NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

 def _colnum(ref):
@@ -345,6 +360,36 @@
     ]
     return c

+_POST_SKIP = {"Q4_backfill_sexo_402", "Q4_estado_registro_null_1_jrosa_deferred", "Q4_registrado_por_na_all_1231"}
+def build_post_checks(checks, expected_ids):
+    """T4 post-write assertions: every Q2-Q6 payload check from `checks`
+    re-targeted at the real `clientes` table (weak-backstop-guard -- same
+    predicate text, only `_clientes_import` swapped for `clientes`, never
+    retyped). Q1 live-precondition checks are superseded, not repeated.
+    Three checks whose meaning changes once JROSA's real preserved values
+    land are skipped and replaced below by corrected equivalents:
+    sexo_was_blank doesn't exist on `clientes`; estado_registro/
+    registrado_por are no longer NULL/'N/A' for JROSA post-merge."""
+    post = []
+    for name, expected, actual in checks:
+        if name.startswith("Q1_") or name in ("Q2_staged_row_count", "Q2_staged_id_set_matches_expected") or name in _POST_SKIP:
+            continue
+        post.append((f"Post_{name}", expected, actual.replace("_clientes_import", "clientes")))
+    preserve_eq = " AND ".join(f"c.{col} IS NOT DISTINCT FROM p.{col}" for col in PRESERVE_COLUMNS)
+    post += [
+        ("Post_clientes_count_1231", str(EXPECTED_ROW_COUNT), "(SELECT count(*)::text FROM clientes)"),
+        ("Post_clientes_id_set_matches_expected", "true", f"(SELECT (array_agg(id ORDER BY id) = ARRAY{expected_ids}::int[])::text FROM clientes)"),
+        ("Post_jrosa_preserved_cols_intact", "true", f"(SELECT ({preserve_eq})::text FROM clientes c, _jrosa_preserva p WHERE c.id = {JROSA_ID})"),
+        ("Post_id_15_is_melissa", "true", f"(SELECT (nombre_completo ILIKE '{PAT_MELISSA}')::text FROM clientes WHERE id = {MELISSA_ID})"),
+        ("Post_reservas_count_is_1", "1", "(SELECT count(*)::text FROM reservas)"),
+        ("Post_reserva_10_cliente_is_1185", str(JROSA_ID), "(SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10)"),
+        ("Post_pagos_ref_15_unchanged_0", "0", "(SELECT count(*)::text FROM pagos WHERE cliente_id = 15)"),
+        ("Post_registrado_por_na_1230", "1230", "(SELECT count(*)::text FROM clientes WHERE registrado_por = 'N/A')"),
+        ("Post_estado_registro_deferred_resolved_0", "0", "(SELECT count(*)::text FROM clientes WHERE estado_registro IS NULL)"),
+        ("Post_sequence_advanced_past_1240", "true", "(SELECT (pg_sequence_last_value(pg_get_serial_sequence('clientes','id')::regclass) >= 1240)::text)"),
+    ]
+    return post
+
 def render_sql(mapped, checks, values_lines, max_len, dup_iden, payload_sha256):
     len_report = "\n".join(
         f"--   {col}: measured max {n} chars vs live limit {COLUMN_LIMITS[col]}"
@@ -445,6 +490,88 @@
   (SELECT count(*) FROM _checks WHERE expected <> actual) AS fallas;
 """

+def _checks_block(checks, table):
+    ddl = f"DROP TABLE IF EXISTS pg_temp.{table};\nCREATE TEMP TABLE {table} (name text, expected text, actual text);"
+    rows = "\n".join(
+        f"INSERT INTO {table}(name, expected, actual) VALUES ({sql_str(name)}, {sql_str(expected)}, {actual});"
+        for name, expected, actual in checks
+    )
+    return ddl, rows
+
+def render_execute_sql(checks, post_checks, values_lines, payload_sha256):
+    """T4: one BEGIN...COMMIT (plan §3 approach C -- insert-then-repoint-
+    then-delete-then-backfill; `clientes` is never UPDATEd, so
+    trigger_update_clientes_fecha_editado, BEFORE UPDATE only, cannot fire
+    for the relocated JROSA row). Guard predicates are the SAME `checks`
+    list 03 reports (weak-backstop-guard); never retyped."""
+    values_block = ",\n".join(values_lines)
+    db_columns_csv = ", ".join(DB_COLUMNS)
+    guard_ddl, guard_rows = _checks_block(checks, "_checks")
+    post_ddl, post_rows = _checks_block(post_checks, "_post_checks")
+    plain_cols = ", ".join(INSERT_COLUMNS)
+    jrosa_cols = ", ".join(SHEET_ONLY_COLUMNS + PRESERVE_COLUMNS)
+    jrosa_select = ", ".join([f"s.{c}" for c in SHEET_ONLY_COLUMNS] + [f"p.{c}" for c in PRESERVE_COLUMNS])
+    preserve_csv = ", ".join(PRESERVE_COLUMNS)
+    return f"""-- 04-clientes-import-execute.sql -- DO NOT EDIT -- generated by generate-clientes-import.py.
+-- Elibry `clientes` import EXECUTE script. Companion: 03-clientes-import-dry-run.sql (same guard predicates, weak-backstop-guard).
+-- WRITES clientes + reservas. One transaction; always really COMMITs or ABORTs whole -- no ROLLBACK statement in this file.
+-- File-size exemption (.claude/rules/file-size.md, plan §2): generated, never hand-edited, same 1,231-row payload as 03.
+-- payload-sha256: {payload_sha256}
+-- _jrosa_preserva columns (T4 decision, non-sheet superset of the 7-col floor): {preserve_csv}
+BEGIN;
+
+-- Stage payload (identical to 03 Q2) + run every 03 check as a pre-write guard (G1-G5,G7-G10).
+DROP TABLE IF EXISTS pg_temp._clientes_import;
+CREATE TEMP TABLE _clientes_import (
+  id integer, tipo_cliente varchar(20), compania varchar(50), rnc varchar(20),
+  razon_social varchar(200), nombre_comercial varchar(200), responsable varchar(200),
+  identificacion varchar(20), nombre_completo varchar(200), sexo varchar(20), sexo_was_blank boolean,
+  fecha_nacimiento date, telefonos varchar(200), email varchar(200), direccion text,
+  observacion text, referido_por varchar(200), registrado_por varchar(200),
+  status varchar(20), estado_registro varchar(20), pais varchar(100)
+);
+INSERT INTO _clientes_import ({db_columns_csv}) VALUES
+{values_block};
+{guard_ddl}
+{guard_rows}
+DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
+  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
+
+-- G6: capture JROSA's (id=15) non-sheet columns before any write touches clientes.
+DROP TABLE IF EXISTS pg_temp._jrosa_preserva;
+CREATE TEMP TABLE _jrosa_preserva AS SELECT {preserve_csv} FROM clientes WHERE id = 15;
+DO $$ BEGIN IF (SELECT count(*) FROM _jrosa_preserva) <> 1 THEN
+  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', (SELECT count(*) FROM _jrosa_preserva); END IF; END $$;
+
+-- Insert the 1,229 sheet rows that are neither 15 nor {JROSA_ID}.
+INSERT INTO clientes ({plain_cols}) SELECT {plain_cols} FROM _clientes_import WHERE id NOT IN (15, {JROSA_ID});
+
+-- Insert sheet row {JROSA_ID} (JROSA), merging sheet columns with the preserved columns.
+-- clientes is never UPDATEd anywhere in this file, so trigger_update_clientes_fecha_editado cannot fire for this row.
+INSERT INTO clientes ({jrosa_cols})
+SELECT {jrosa_select} FROM _clientes_import s CROSS JOIN _jrosa_preserva p WHERE s.id = {JROSA_ID};
+
+-- Repoint the one live reserva BEFORE the delete (fk_reservas_cliente ON DELETE SET NULL never fires).
+UPDATE reservas SET cliente_id = {JROSA_ID} WHERE id = 10;
+
+-- Delete the old id=15 row (now unreferenced by any reserva).
+DELETE FROM clientes WHERE id = 15;
+
+-- Insert the sheet's own row 15 (MELISSA), now that the id is free.
+INSERT INTO clientes ({plain_cols}) SELECT {plain_cols} FROM _clientes_import WHERE id = 15;
+
+-- Advance the sequence past 1240 (belt-and-braces; app write paths compute MAX(id)+1 client-side).
+SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT max(id) FROM clientes), true);
+
+-- Post-condition assertions; any failure raises and aborts everything.
+{post_ddl}
+{post_rows}
+DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _post_checks WHERE expected <> actual;
+  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;
+
+COMMIT;
+"""
+
 def main():
     if not os.path.isfile(SOURCE_PATH):
         sys.exit(f"ABORT: pinned source not found at {SOURCE_PATH}")
@@ -496,5 +623,13 @@
     print(f"  payload-sha256: {payload_sha256}")
     print(f"  output sha256: {hashlib.sha256(sql_text.encode('utf-8')).hexdigest()}")

+    post_checks = build_post_checks(checks, expected_ids)
+    exec_sql_text = render_execute_sql(checks, post_checks, values_lines, payload_sha256)
+    with open(OUTPUT_PATH_04, "w", encoding="utf-8", newline="\n") as f:
+        f.write(exec_sql_text)
+    print(f"OK: wrote {OUTPUT_PATH_04}")
+    print(f"  guard checks: {len(checks)}, post-checks: {len(post_checks)}")
+    print(f"  execute output sha256: {hashlib.sha256(exec_sql_text.encode('utf-8')).hexdigest()}")
+
 if __name__ == "__main__":
     main()
```

---

## 3. Statement-order design (matches plan §3 approach C exactly)

1. Stage `_clientes_import` (identical to `03`'s Q2 section) → run all 42 of `03`'s
   Q1–Q6 checks as pre-write guards (G1–G5, G7–G10) via a `DO $$ ... RAISE EXCEPTION $$`
   block.
2. `CREATE TEMP TABLE _jrosa_preserva AS SELECT <17 cols> FROM clientes WHERE id = 15` +
   G6 guard (exactly 1 row).
3. `INSERT INTO clientes` — the 1,229 sheet rows that are neither 15 nor 1185.
4. `INSERT INTO clientes` — sheet row 1185 (JROSA), merging 18 sheet columns (`s.*`)
   with the 17 preserved columns (`p.*`).
5. `UPDATE reservas SET cliente_id = 1185 WHERE id = 10` — **before** the delete, so
   `fk_reservas_cliente`'s `ON DELETE SET NULL` path never fires (T1 Q3: `confupdtype='a'`,
   `confdeltype='n'`, not deferrable).
6. `DELETE FROM clientes WHERE id = 15`.
7. `INSERT INTO clientes` — sheet's own row 15 (MELISSA), now that the id is free.
8. `SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT max(id) FROM clientes), true)`.
9. Post-condition `DO` block (33 assertions) → `RAISE EXCEPTION` on any failure.
10. `COMMIT;` — no `ROLLBACK` statement anywhere.

`clientes` is never the target of an `UPDATE` anywhere in this file, so
`trigger_update_clientes_fecha_editado` (BEFORE UPDATE only, per T1 Q3) is structurally
unreachable for the relocated row — `fecha_editado` survives by construction, and the
17-column `Post_jrosa_preserved_cols_intact` check verifies this after the fact.

---

## 4. Mechanical statement inventory (task's lock on this task) — grep-proven

```
$ grep -c "^INSERT INTO clientes" docs/migracion/04-clientes-import-execute.sql
3
$ grep -cE "^UPDATE " docs/migracion/04-clientes-import-execute.sql
1
$ grep -cE "^DELETE " docs/migracion/04-clientes-import-execute.sql
1
$ grep -nE "^(CREATE|DROP|ALTER)" docs/migracion/04-clientes-import-execute.sql
10:DROP TABLE IF EXISTS pg_temp._clientes_import;
11:CREATE TEMP TABLE _clientes_import (
1251:DROP TABLE IF EXISTS pg_temp._checks;
1252:CREATE TEMP TABLE _checks (name text, expected text, actual text);
1299:DROP TABLE IF EXISTS pg_temp._jrosa_preserva;
1300:CREATE TEMP TABLE _jrosa_preserva AS SELECT registrado_por, fecha_creado, fecha_editado, editado_por, imagen_url, estado_registro, usuario_creacion, fecha_provisional, dependencias_ids, telefonos_json, emails_json, documentos, cedula_url, registro_mercantil_url, documento_cedula_url, documento_registro_mercantil_url, documentos_urls FROM clientes WHERE id = 15;
1325:DROP TABLE IF EXISTS pg_temp._post_checks;
1326:CREATE TEMP TABLE _post_checks (name text, expected text, actual text);
```
All 8 DDL lines are `CREATE TEMP TABLE`/`DROP TABLE IF EXISTS pg_temp.*` — zero other DDL.

```
$ grep -nEi "alter table|create policy|row level security|grant |revoke |create role|comprobante|balance_|monto_pagado|abonado_contabilidad|productos|suplidores" docs/migracion/04-clientes-import-execute.sql
(no output — 0 hits)

$ grep -n "pagos" docs/migracion/04-clientes-import-execute.sql
1259:INSERT INTO _checks(name, expected, actual) VALUES ('Q1_pagos_ref_15_is_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
1356:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_pagos_ref_15_unchanged_0', '0', (SELECT count(*)::text FROM pagos WHERE cliente_id = 15));
```
Both `pagos` references are read-only guard `SELECT count(*)` expressions — no write.

```
$ grep -n "^ROLLBACK" docs/migracion/04-clientes-import-execute.sql
(no output)
$ grep -n "ROLLBACK" docs/migracion/04-clientes-import-execute.sql
3:-- WRITES clientes + reservas. One transaction; always really COMMITs or ABORTs whole -- no ROLLBACK statement in this file.
```
The only occurrence of the word "ROLLBACK" is in the header comment explaining its
absence — same convention as the repo's own precedent (`02-cleanup-execute.sql:2,14,15,20`
also mentions "ROLLBACK" only in comments explaining why there is none).

```
$ grep -cE "^BEGIN;" docs/migracion/04-clientes-import-execute.sql
1
$ grep -cE "^COMMIT;" docs/migracion/04-clientes-import-execute.sql
1
```
Exactly one `BEGIN;` ... `COMMIT;`, matching the plan's "one transaction" requirement and
the `02-cleanup-execute.sql` honest-transaction precedent.

---

## 5. `03` unchanged / `weak-backstop-guard` byte-identity

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
```
**Matches T2r4/T3r3's approved hash exactly** (`a5f74af3...42cc4`) — `03` did not
legitimately change (my diff to the generator never touches `build_checks`, `transform`,
or `render_sql`), so per this task's instruction I did **not** need to re-run `03` live.

```
$ grep -n "payload-sha256" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
docs/migracion/03-clientes-import-dry-run.sql:19:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
docs/migracion/04-clientes-import-execute.sql:5:-- payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
```
Identical payload-sha256 in both files — same generator, same staged payload.

```
$ grep "^INSERT INTO _checks" docs/migracion/03-clientes-import-dry-run.sql > 03_checks.txt
$ grep "^INSERT INTO _checks" docs/migracion/04-clientes-import-execute.sql > 04_checks.txt
$ diff 03_checks.txt 04_checks.txt && echo IDENTICAL
IDENTICAL
$ wc -l 03_checks.txt 04_checks.txt
      42 03_checks.txt
      42 04_checks.txt
```
All **42 of 42** guard-predicate `INSERT` lines (including every `ILIKE` pattern —
`%JROSA%ASESORA%VIAJES%`, `%MELISSA%PORTES%ROSIS%` — the `Q1_not_null_columns_match`
cast fix, the `Q1_audit_clientes_trigger_absent` precedence fix, and the
`Q5_dirty_email_count` NBSP fix) are **byte-for-byte identical** between `03` and `04`.
`weak-backstop-guard` is satisfied by construction, not by inspection: both files are
rendered from the exact same Python `checks` list object.

---

## 6. Determinism (both files, two independent runs)

```
$ python3 docs/migracion/generate-clientes-import.py
OK: wrote .../03-clientes-import-dry-run.sql
  ... payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
  output sha256: a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4
OK: wrote .../04-clientes-import-execute.sql
  guard checks: 42, post-checks: 33
  execute output sha256: 9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1

$ python3 docs/migracion/generate-clientes-import.py   # second, independent run
(identical printed summary and both hashes)

$ shasum -a 256 run1_03.sql run2_03.sql run1_04.sql run2_04.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  run1_03.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  run2_03.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  run1_04.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  run2_04.sql

$ diff run1_03.sql run2_03.sql && echo "03 IDENTICAL"
03 IDENTICAL
$ diff run1_04.sql run2_04.sql && echo "04 IDENTICAL"
04 IDENTICAL
```
Both generated files are byte-identical across two independent runs. No timestamp,
username, hostname, or absolute path appears in either output (checked via
`grep -nE "/Users/"` — 0 hits beyond the header, which contains no filesystem path).

---

## 7. **BLOCKER — generator file-size ceiling**

```
$ wc -l docs/migracion/generate-clientes-import.py
     635 docs/migracion/generate-clientes-import.py
```

**635 lines — 135 over the 500-line ceiling (+27%).** The generator was already at
exactly 500 lines before this task (T2 round 4, QA-approved) — none of that slack was
available. This task's addition (§2 diff) is **165 diff-lines / +135 net source lines**:
`PRESERVE_COLUMNS`/`INSERT_COLUMNS`/`SHEET_ONLY_COLUMNS` (+15), `build_post_checks()`
(+29), `_checks_block()` + `render_execute_sql()` (+84, most of it the irreducible
8-step transaction SQL template), `main()` wiring (+8).

**This task's own instructions require STOPping and reporting this as a blocker rather
than silently exceeding the rule** — the pre-approved generated-file exemption
(`.claude/rules/file-size.md`, plan §2) explicitly covers `03`/`04` (both `.sql`
artifacts, ~1,300–1,600 lines expected) but **not** the generator itself (plan's own
estimate: "~300–450 lines", already broken by T2's live-bug-fix rounds before this task
even started).

**Compaction attempted, not sufficient:** every SQL comment in the new template is a
single terse line (vs. `render_sql`'s multi-line paragraph style for `03`); checks are
reused via string substitution (`build_post_checks`) rather than retyped; no blank-line
padding. The irreducible cost is structural: `weak-backstop-guard` requires the 42
guard predicates to be emitted from the *same* `checks` list (not a smaller hand-picked
subset), the mechanical inventory requires exactly 3 separate `INSERT INTO clientes`
statements (not 1–2 combined ones), and 33 post-checks are needed to assert the AC5 list
(count, id-set, 4 distributions, `referido_por`, NULL columns, both dup-`identificacion`
pairs, the **17**-column JROSA-preserved-column equality, `id=15` is MELISSA, `reservas`
repoint, `pagos` unchanged, sequence advance). None of these can be cut without either
weakening a named guard or reintroducing the "retype the guard" risk the plan explicitly
rejects.

**Recommendation to the lead (pick one, this task does not decide):**
1. Extend the existing generated-file exemption to the generator too (precedent: the
   same rationale — "generated structure driven by data/requirements, not
   hand-maintained bloat" — doesn't literally apply since the generator *is*
   hand-maintained, but the requirement to reuse `checks` verbatim for two files is a
   comparable structural driver), or
2. Authorize a follow-up **scoped split task** (per `.claude/rules/file-size.md`'s own
   guidance: "prefer extracting a module over growing the file... splitting a file is
   itself a scoped task — never bundle it into a feature task") to move `render_sql`/
   `render_execute_sql`/`build_checks`/`build_post_checks` into a second stdlib module,
   which this task's file-scope (`generate-clientes-import.py` only) does not authorize
   me to do unilaterally.

I did **not** guess at either option — this is exactly the "architectural decision the
plan did not make" class of blocker.

---

## 8. Live read-only validation (everything that CAN be proven without running `04`)

**Channel:** Node + `pg` (simple query protocol), built fresh in this session's private
scratch dir, modeled on the same pattern T2/T3 used (`supabase db query` cannot run
multi-statement SQL — re-confirmed, not re-litigated). Connection string read from
`.env.local` at runtime, never printed.

### 8a. Baseline, start and end of this task

```
$ node myrun.js -e "SELECT count(*) AS cnt, max(id) AS max_id FROM clientes;"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
Identical (`count=1, max_id=15`) at the start of this task, after every live query run
during this task, and at the very end — **nothing was ever written to a real table**.

### 8b. Pre-write staging + all 42 guards, run from the literal on-disk `04` file (via `sed` extraction, not retyped)

```
$ sed -n '9,1303p' docs/migracion/04-clientes-import-execute.sql > step0_step1.sql
$ (append: SELECT count(*) checks_total, count(*) FILTER (WHERE expected<>actual) checks_failed FROM _checks;
            SELECT count(*) jrosa_preserva_rows FROM _jrosa_preserva;
            SELECT count(*) cnt, max(id) max_id FROM clientes;)
$ node myrun.js step0_step1.sql
{"command":"INSERT","rowCount":1231,"rows":[]}            <- staging (same 1231 rows as 03)
... (42 individual INSERT INTO _checks, all succeed)
{"command":"DO","rowCount":null,"rows":[]}                 <- pre-write guard DO block: did NOT raise
{"command":"DO","rowCount":null,"rows":[]}                 <- G6 DO block: did NOT raise
{"command":"SELECT","rowCount":1,"rows":[{"checks_total":"42","checks_failed":"0"}]}
{"command":"SELECT","rowCount":1,"rows":[{"jrosa_preserva_rows":"1"}]}
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}
```
**42/42 guard checks PASS, G6 (exactly 1 preserved row) PASS, both `RAISE EXCEPTION`
blocks correctly did not fire, baseline unchanged.** This is the literal file content
(extracted via `sed`, not reconstructed), so this is a real live proof of `04`'s STEP 0
+ STEP 1, not an inference from `03`'s prior runs (even though the predicate text is
provably identical per §5).

### 8c. `EXPLAIN`-only (non-executing) validation of all 5 real-table-mutating statements

`EXPLAIN` (without `ANALYZE`) plans an `INSERT`/`UPDATE`/`DELETE` without executing it —
this validates column existence, type compatibility, and JOIN correctness with **zero
risk of a write**, confirmed by the unchanged baseline immediately after. A small,
non-PII, fake-id (`999999997`/`999999998`/`999999999`) substitute payload was staged
locally (not the real 1231-row data) to avoid re-deriving PII into scratch, using the
same column list/types as the real `_clientes_import`/`_jrosa_preserva`:

```
$ node myrun.js explain_check.sql
... EXPLAIN INSERT (1229-others shape)  -> "Insert on clientes ... Seq Scan on _fake_import ... Filter: (id = 999999997)"
... EXPLAIN INSERT (JROSA-merge shape)  -> "Insert on clientes ... Nested Loop ... Seq Scan on _fake_import s ... Seq Scan on _fake_preserve p"
... EXPLAIN UPDATE reservas             -> "Update on reservas ... Index Scan using reservas_pkey ... Index Cond: (id = 10)"
... EXPLAIN DELETE FROM clientes        -> "Delete on clientes ... Index Scan using clientes_pkey ... Index Cond: (id = 999999999)"
... EXPLAIN INSERT (MELISSA shape)      -> "Insert on clientes ... Seq Scan on _fake_import ... Filter: (id = 999999997)"
... EXPLAIN SELECT setval(...)          -> "Result ... InitPlan ... Index Only Scan Backward using clientes_pkey"
{"command":"SELECT","rowCount":1,"rows":[{"cnt":"1","max_id":15}]}   <- unchanged
```
All 5 statements (and the sequence-advance `SELECT`) plan with **zero SQL errors** —
this is exactly the bug class (type mismatch / column-not-found / JOIN incompatibility)
that this sprint's prior live-only defects (`Q1_not_null_columns_match`'s
`sql_identifier[]` vs `text[]`, the `NOT EXISTS(...)::text` precedence bug) belong to.
`EXPLAIN` does **not** execute a volatile function (`setval`), confirmed by the
unchanged baseline.

### 8d. All 10 new `Post_*` predicates individually live-tested for syntax/type validity

```
$ node myrun.js -e "SELECT (SELECT count(*)::text FROM clientes);"                                    -> "1"    (Post_clientes_count_1231's actual-expr)
$ node myrun.js -e "SELECT (SELECT (array_agg(id ORDER BY id) = ARRAY[15]::int[])::text FROM clientes);" -> "true" (same array-literal PATTERN as Post_clientes_id_set_matches_expected)
$ node myrun.js -e "SELECT (SELECT (c.registrado_por IS NOT DISTINCT FROM p.registrado_por AND ... 17 cols ... )::text FROM clientes c, (SELECT <17 cols> FROM clientes WHERE id=15) p WHERE c.id = 15);" -> "true"
$ node myrun.js -e "SELECT (SELECT (nombre_completo ILIKE '%MELISSA%PORTES%ROSIS%')::text FROM clientes WHERE id = 15);" -> null (JROSA is still id=15, expected false pre-migration)
$ node myrun.js -e "SELECT (SELECT count(*)::text FROM reservas);"                                     -> "1"
$ node myrun.js -e "SELECT (SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10);"    -> "15"  (still JROSA pre-migration, expected 1185 post)
$ node myrun.js -e "SELECT (SELECT count(*)::text FROM pagos WHERE cliente_id = 15);"                  -> "0"
$ node myrun.js -e "SELECT (SELECT count(*)::text FROM clientes WHERE registrado_por = 'N/A');"        -> "0"   (pre-migration; expected 1230 post)
$ node myrun.js -e "SELECT (SELECT count(*)::text FROM clientes WHERE estado_registro IS NULL);"       -> "0"
$ node myrun.js -e "SELECT (pg_sequence_last_value(pg_get_serial_sequence('clientes','id')::regclass) >= 1240)::text;" -> null
```
Every predicate is **syntactically valid** (zero SQL errors), including the 17-column
`IS NOT DISTINCT FROM` chain across `jsonb` (`telefonos_json`, `emails_json`,
`documentos`) and `ARRAY` (`documentos_urls`) types — the one predicate class most likely
to hit a type-compatibility error. The `pg_sequence_last_value` check returns SQL `NULL`
pre-migration because `clientes_id_seq` has never had `nextval()`/`setval()` called on it
in this cluster's history (`is_called=false`) — consistent with the plan's own note that
both app write paths compute ids client-side and never consume the sequence; this
resolves to a real `true`/`false` only after `04`'s own `setval()` call actually runs.

### 8e. Disclosed limitation (stated plainly, per this task's explicit instruction)

**What remains genuinely unproven without running `04` for real:** the **expected
post-migration values** of every `Post_*` check (count=1231, id-set over the real
table, `registrado_por='N/A'` count=1230, `estado_registro IS NULL` count=0,
`reserva.cliente_id=1185`, sequence `>=1240`) can only be confirmed true by an actual
run — today they correctly read the **pre-migration** state (1 row, JROSA still at 15,
sequence never called), which is expected and not a defect. Additionally, a
value-level semantic defect in the *data* (the NBSP/`btrim()`-class bug this sprint hit
twice before) cannot be excluded for a check on data that does not yet exist — the 23
substituted `Post_*` checks reuse `03`'s own already-live-proven-clean predicates
verbatim (§5), so that class of risk is already retired for those; the 10 brand-new
`Post_*` predicates were checked for **syntax/type** correctness only (§8c/§8d), not for
producing the literally-expected value against real post-migration data, because that
data cannot exist without running `04`, which is prohibited in this task.

---

## 9. `npm run qa`

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test


> my-v0-project@0.1.0 typecheck
> tsc --noEmit


> my-v0-project@0.1.0 lint
> eslint .

... (28 pre-existing warnings, 0 errors, identical set to every prior round, all in
     app/**/components/** files this task never touches — full list omitted here per
     ADR-0014 bounded evidence; unchanged from t02-dev-r4.md/t03-dev-r3.md's pasted list)

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
```
Exit code `0`. `tsc --noEmit` clean (0 errors). `eslint .` 0 errors (28 pre-existing
warnings, identical shape to every prior round). `825/825` tests pass across 30 files —
pure regression gate holds (no `app/`, `lib/`, `components/`, `hooks/`, `tests/` file
touched).

---

## 10. Redaction / PII check

```
$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev.md
(no output)
$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t04-dev.md
(no output, excluding the literal `fake@example.com` used in the non-real EXPLAIN
 substitute payload — clearly marked FAKE, not client data)
```
No client PII (name, email, phone, identificación) appears anywhere in this report —
every live query result quoted above is a count, a boolean/`true`/`null`, a fixed
non-PII reserva code (`RES-1787875561067`, already disclosed in T1/T2/T3 reports), or a
hash. `04-clientes-import-execute.sql` itself holds real client PII by necessity (same
as `03`, per ADR-0014) and stays in the repo; no row value from it was ever quoted here.

---

## 11. Out-of-scope changes

None beyond the declared scope. `git status --short` before/after (§0): 8 → 9 entries,
the +1 being exactly this task's deliverable (`04-clientes-import-execute.sql`). No
`__pycache__` or other byproduct left behind (checked and removed). All live-DB tooling
(`myrun.js`, `explain_check.sql`, `step0_step1.sql`, hash/determinism scratch copies)
lives entirely under this session's private scratch directory, outside the repo.

## Backlog notes for the lead (not actioned here, per "implement only the assigned task")

- The file-size blocker (§7) needs a decision before this task can be marked done.
- CBrain filing candidate: `EXPLAIN`-only validation of INSERT/UPDATE/DELETE statements
  is a safe, zero-write way to catch type/column-existence defects in an unexecuted
  execute script — worth a `patterns/` note given this sprint's history of live-only
  defects slipping past pure Python re-derivation.
- T5 (prove a guard actually aborts) can reuse this task's `myrun.js` pattern directly.

## Rollback

- `docs/migracion/04-clientes-import-execute.sql` (new, untracked): `rm docs/migracion/04-clientes-import-execute.sql`.
- `docs/migracion/generate-clientes-import.py` (edited, untracked, no git history to restore from):
  revert by deleting the additive blocks shown in §2's diff (everything after
  `OUTPUT_PATH_04 = ...` through `SHEET_ONLY_COLUMNS = ...`; the `build_post_checks`
  function; the `_checks_block`/`render_execute_sql` functions; and the `post_checks`/
  `exec_sql_text` wiring in `main()`), restoring it to the T2r4/T3r3-approved 500-line
  state — the reconstructed pre-edit copy used for §2's diff is available at
  `/private/tmp/claude-501/-Users-johancito-Developer-Elibry/97ebd1c1-b8b5-4d51-921d-39df2d76ffd1/scratchpad/t04pg/generator_before.py`
  for exact byte-for-byte restoration if needed.
- No database was touched: every live statement this task ran was read-only (`SELECT`,
  `EXPLAIN` without `ANALYZE`, or `pg_temp`-scoped `CREATE TEMP TABLE`/`INSERT`, all gone
  on connection close) — confirmed by the identical `count(*)=1, max(id)=15` baseline at
  the start of this task, mid-task, and at the very end (§8a). No git verb is needed or
  implied.
