# T9 — Redact leaked client PII from sprint report files (dev report)

**Authorization:** human-authorized follow-up to T8's audit finding, explicitly
scoped to removing PII from report files belonging to already-approved tasks
(t01, t02, t03, t06). No other content in those files was touched.

## 1. Re-derived hit set (independent of T8's list)

I did not copy T8's file list. I re-ran a full sweep across `reports/*.md` and
`scratchpad.md` from scratch:

- Email-shape sweep: `grep -rnoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'
  reports/*.md scratchpad.md`, then triaged every distinct domain. Two domains
  are grep-pattern examples embedded in verification commands elsewhere in the
  sprint (a `.tld` placeholder domain and `example.com`) — not real, left
  untouched. Three domains (a `gmail.com`-family address seen 5 times, plus
  one `hotmail.com` address and one institutional `.edu.do` address, 1 hit
  each) are real client addresses — 7 unique real email strings in total,
  each appearing exactly once, confined to two files.
- Bare-numeric sweep: `grep -rnoE '\b[0-9]{9,13}\b' reports/*.md scratchpad.md`.
  Result: exactly two distinct 11-digit values recur at high frequency (36 and
  33 occurrences respectively) across the T1/T2/T3 report family — these are
  the two real `identificacion` (cédula) values behind the sprint's
  duplicate-identificacion finding. Everything else the sweep turned up is
  confirmed synthetic: a 13-digit reservation code with an `RES-` prefix (9
  hits, not a client identifier), and three 9-digit test-fixture ids ending
  in `997`/`998`/`999` (9 hits combined) that T8's QA already confirmed as
  synthetic. I independently re-confirm that triage — nothing new.
- Phone-number sweep (`\(?[0-9]{3}\)?[-. ][0-9]{3}[-. ][0-9]{4}` and Dominican
  cédula-with-dashes `[0-9]{3}-[0-9]{7}-[0-9]`): zero hits anywhere.
- `scratchpad.md`: zero hits for any of the above. Confirmed clean, matching
  every prior task's claim — not touched by this task.
- Conclusion: **T8's 12-file, two-cédula/seven-email hit set is confirmed
  complete.** I found nothing beyond it.

**Exact file list redacted (12):**
- `reports/t01-dev.md`
- `reports/t01-qa.md`
- `reports/t02-dev.md`
- `reports/t02-dev-r2.md`
- `reports/t02-dev-r3.md`
- `reports/t02-dev-r4.md`
- `reports/t02-qa.md`
- `reports/t02-qa-r2.md` (cédula + email overlap file)
- `reports/t02-qa-r4.md`
- `reports/t03-dev-r3.md`
- `reports/t03-qa-r3.md`
- `reports/t06-qa-r3.md` (email-only file)

## 2. Sentinel scheme chosen

Used the suggested scheme as-is:
- `<CEDULA-A>` for the first cédula value (the one carrying the extra
  NBSP-trailing-space defect discussed in T2), `<CEDULA-B>` for the second —
  applied identically in every one of the 11 files that reference either
  value, so the cross-file correlation (same two clients, same duplicate
  pair, referenced across T1/T2/T3's independent re-derivations) is fully
  preserved.
- `<CLIENT-EMAIL-1>` through `<CLIENT-EMAIL-7>`, assigned in order of first
  appearance in the file set (1-3 in `t02-qa-r2.md`'s three-address comma cell
  at `ID_CLIENTE=890`; 4-7 in `t06-qa-r3.md`'s two slash-separated dual-address
  examples). Each email string is unique across the corpus (no email repeats
  across files), so no further correlation was needed for these — each got
  its own number so a reader can still see "3 addresses in one dirty cell" vs
  "2 pairs of 2 addresses each" without the literal text.

## 3. Diff evidence (all 12 files)

Below are unified diff hunks for every changed file. The "before" side is
never the real value — it is a masked placeholder token
(`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`,
`[[PRE-REDACTION-EMAIL]]`) substituted into a throw-away backup copy purely so
the diff can be shown at all without reproducing the leak. The "after" side is
the real, current file content (the sentinel).

```diff
=================== reports/t01-dev.md ===================
@@ -310,7 +310,7 @@
 btree indexes (confirmed by the absence of the word `UNIQUE` in their `indexdef`, and independently
 by the `pg_constraint` dump in Q1 showing zero `contype='u'` rows). There is **no live UNIQUE
 constraint or unique index on `identificacion`, `rnc`, or `email`** — importing both duplicate
-`identificacion` values (`[[PRE-REDACTION-CEDULA-A]]` and `[[PRE-REDACTION-CEDULA-B]]`) is not blocked by any live constraint.
+`identificacion` values (`<CEDULA-A>` and `<CEDULA-B>`) is not blocked by any live constraint.
 The Q5 escalation trigger does **not** fire.
 
 ---
@@ -393,7 +393,7 @@
 row-level fact quoted (the `cambios_provisionales` row referencing client id 15) is limited to its
 numeric id, a status enum value, and a change-type enum value — no `datos_anteriores`/
 `datos_nuevos` JSON payload (which could contain a PII snapshot) was read or quoted. The two
-identificacion values named in the Q5 section (`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`) are explicitly
+identificacion values named in the Q5 section (`<CEDULA-A>`, `<CEDULA-B>`) are explicitly
 pre-cleared as non-secret by the frozen spec (per this task's instructions) and are quoted only to
 state the escalation-check outcome, not fetched from a fresh query. `scripts/005-...sql` was read
 only for its DDL/constraint text (used as a comparison target, not as live evidence) — its bundled

=================== reports/t01-qa.md ===================
@@ -52,11 +52,11 @@
 
 $ grep -nE "[0-9]{9,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
 69:Boundary: `8311045be887634204c290a7374ac118`
-313:...(`[[PRE-REDACTION-CEDULA-A]]` and `[[PRE-REDACTION-CEDULA-B]]`)...
+313:...(`<CEDULA-A>` and `<CEDULA-B>`)...
 323:Boundary: `1b0cb6563326210e6080ca6e32601504`
 362:MD5 (docs/migracion/migracion-clientes.xlsx) = e6fca844ab79529551195597156a6a7b
 367:...md5 `e6fca844ab79529551195597156a6a7b`...
-396:...(`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`)...
+396:...(`<CEDULA-A>`, `<CEDULA-B>`)...
 ```
 Only the two pre-cleared `identificacion` values, hex boundary tokens, and file hashes/md5s match a 9+-digit pattern. No email, no phone-shaped number, no other client identifier.

=================== reports/t02-dev.md ===================
@@ -190,8 +190,8 @@
 - **Both duplicate `identificacion` values, each on exactly 2 rows** (these two exact
   numeric values are pre-cleared as non-secret by this task's own binding inputs,
   matching T1's precedent — not fetched fresh, just re-verified):
-  `'[[PRE-REDACTION-CEDULA-A]]'` and `'[[PRE-REDACTION-CEDULA-B]]'`, each 2 rows. **Genuine finding surfaced by this
-  task:** one of the two `'[[PRE-REDACTION-CEDULA-A]]'` cells (sheet `ID_CLIENTE=941`) carries a
+  `'<CEDULA-A>'` and `'<CEDULA-B>'`, each 2 rows. **Genuine finding surfaced by this
+  task:** one of the two `'<CEDULA-A>'` cells (sheet `ID_CLIENTE=941`) carries a
   **trailing U+00A0 (non-breaking space)** that the other (`ID_CLIENTE=1106`) does not.
   Per the "no trimming" AC, the generator does **not** strip it — the stored value is
   preserved byte-for-byte, so the two rows are not literally identical strings in the

=================== reports/t02-dev-r2.md ===================
@@ -132,7 +132,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -143,7 +143,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -252,14 +252,14 @@
 Unchanged from round 1 — none of these checks were touched:
 - 3-comma email cell at sheet `ID_CLIENTE=890`: still present, unaffected.
 - 45 dirty emails: `Q5_dirty_email_count` still expects `'45'`, predicate unchanged.
-- Both duplicate `identificacion` values (`'[[PRE-REDACTION-CEDULA-A]]'`, `'[[PRE-REDACTION-CEDULA-B]]'`, each 2 rows),
+- Both duplicate `identificacion` values (`'<CEDULA-A>'`, `'<CEDULA-B>'`, each 2 rows),
   including the NBSP-normalized comparison (`Q5_dup_identificacion_*`) — predicate
   unchanged, still normalizes via `btrim(replace(identificacion, chr(160), ' '))`.
   Reconfirmed present in this round's regenerated file:
 ```
 $ grep -n "chr(160)" docs/migracion/03-clientes-import-dry-run.sql
-1366: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-A]]'
-1367: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-B]]'
+1366: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'
+1367: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'
 ```

=================== reports/t02-dev-r3.md ===================
@@ -104,7 +104,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -115,7 +115,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -462,12 +462,12 @@
 Unchanged from round 2 — none of these checks were touched by this fix:
 ```
 $ grep -n "chr(160)\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
-1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-A]]'...
-1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-B]]'...
+1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'...
+1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'...
 1368:...Q5_dirty_email_count', '45', ...
 ```
 3-comma email cell (sheet `ID_CLIENTE=890`) and both duplicate `identificacion` values
-(`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`, each 2 rows, NBSP-normalized comparison) — unaffected,
+(`<CEDULA-A>`, `<CEDULA-B>`, each 2 rows, NBSP-normalized comparison) — unaffected,
 predicates byte-identical to round 2.

=================== reports/t02-dev-r4.md ===================
@@ -273,8 +273,8 @@
 | Q4_estado_registro_permanente_1230 | 1230 | 1230 | PASS |
 | Q4_registrado_por_na_all_1231 | 1231 | 1231 | PASS |
 | Q5_dirty_email_count | 45 | 45 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-A]]_is_2 | 2 | 2 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-B]]_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-A>_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-B>_is_2 | 2 | 2 | PASS |
 | Q6_sheet_1185_is_jrosa | true | true | PASS |
 | Q6_sheet_15_is_melissa | true | true | PASS |
 
@@ -333,7 +333,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -344,7 +344,7 @@
   rows staged: 1231 (expected 1231)
   id set matches expected: True
   backfill counts: {'email': 599, 'direccion': 910, 'registrado_por': 1231, 'sexo': 402, 'responsable': 229, 'identificacion': 15, 'nombre_completo': 15, 'telefonos': 255}
-  duplicate identificacion values: {'[[PRE-REDACTION-CEDULA-A]]': [(941, '[[PRE-REDACTION-CEDULA-A]]\xa0'), (1106, '[[PRE-REDACTION-CEDULA-A]]')], '[[PRE-REDACTION-CEDULA-B]]': [(970, '[[PRE-REDACTION-CEDULA-B]]'), (1194, '[[PRE-REDACTION-CEDULA-B]]')]}
+  duplicate identificacion values: {'<CEDULA-A>': [(941, '<CEDULA-A>\xa0'), (1106, '<CEDULA-A>')], '<CEDULA-B>': [(970, '<CEDULA-B>'), (1194, '<CEDULA-B>')]}
   dirty email count: 45
   max lengths vs limits: {'tipo_cliente': 7, 'compania': 7, 'rnc': 11, 'razon_social': 65, 'nombre_comercial': 65, 'responsable': 3, 'identificacion': 13, 'nombre_completo': 46, 'sexo': 9, 'telefonos': 36, 'email': 72, 'referido_por': 4, 'registrado_por': 3, 'status': 8, 'estado_registro': 10, 'pais': 20}
   payload-sha256: 9664ee4e10b9fd2d8d001b312965398d885210465ea21f36a579770f8e932392
@@ -634,15 +634,15 @@
 ### AC 6 — verbatim preservation
 ```
 $ grep -n "chr(160)\|Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
-1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-A]]'...
-1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-B]]'...
+1366:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'...
+1367:...WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'...
 1368:...Q5_dirty_email_count', '45', ... btrim(replace(email, chr(160), ' ')) !~ ...
 ```
 Comma-delimited multi-address email cell (sheet `ID_CLIENTE=890`, 3 addresses,
 2-comma-delimited — verified via a comma-count-only grep, no PII quoted) and both
-duplicate `identificacion` values (`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`, each exactly 2 rows,
+duplicate `identificacion` values (`<CEDULA-A>`, `<CEDULA-B>`, each exactly 2 rows,
 NBSP-normalized comparison) — all confirmed live PASS this round (§2 grid:
-`Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-A]]_is_2`, `_[[PRE-REDACTION-CEDULA-B]]_is_2`, `Q5_dirty_email_count`, all
+`Q5_dup_identificacion_<CEDULA-A>_is_2`, `_<CEDULA-B>_is_2`, `Q5_dirty_email_count`, all
 PASS). No trimming, no case change, no reformatting of the STORED value at any point — the
 NBSP normalization added this round is check-predicate-only (matching the file's own
 established `find_duplicates()`/`Q5_dup_identificacion_*` convention), never applied to

=================== reports/t02-qa.md ===================
@@ -135,15 +135,15 @@
 **NBSP (U+00A0) finding — verified real:**
 ```
 python3: total NBSP occurrences in file: 26
-'[[PRE-REDACTION-CEDULA-A]]' cell at ID_CLIENTE=941: has_nbsp=True (trailing U+00A0)
-'[[PRE-REDACTION-CEDULA-A]]' cell at ID_CLIENTE=1106: has_nbsp=False
+'<CEDULA-A>' cell at ID_CLIENTE=941: has_nbsp=True (trailing U+00A0)
+'<CEDULA-A>' cell at ID_CLIENTE=1106: has_nbsp=False
 ```
 Confirmed present, exactly as the dev reported. Verification-check
 normalization confirmed real, not decorative:
 ```
 $ grep -n "chr(160)" docs/migracion/03-clientes-import-dry-run.sql
-1366: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-A]]'
-1367: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '[[PRE-REDACTION-CEDULA-B]]'
+1366: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-A>'
+1367: ... WHERE btrim(replace(identificacion, chr(160), ' ')) = '<CEDULA-B>'
 ```
 The dup-identificacion checks normalize the NBSP before comparing, so they
 will not silently mis-detect the duplicate pair as non-matching. Dev's claim
@@ -154,7 +154,7 @@
 $ grep -nEi "@[a-z0-9.]+\.(com|net|org)" reports/t02-dev.md scratchpad.md
 (no hits)
 $ grep -nE "[0-9]{9,}" reports/t02-dev.md | grep -viE "sha256|md5|payload-sha|boundary"
-193/194: the two identificacion values '[[PRE-REDACTION-CEDULA-A]]'/'[[PRE-REDACTION-CEDULA-B]]'
+193/194: the two identificacion values '<CEDULA-A>'/'<CEDULA-B>'
 ```
 Those two values are explicitly pre-cleared as non-secret by this task's own
 binding inputs (same precedent T1 used) — not a violation. No email, phone,

=================== reports/t02-qa-r2.md ===================
@@ -147,12 +147,12 @@
   known gaps `{126,444,817,878,952,953,983,1148,1216}` → exact match, 1231 distinct
   ids, no duplicates.
 - **Verbatim preservation:** the 3-comma email cell at `ID_CLIENTE=890` — pulled the raw
-  cell from the pinned `.xlsx` directly (`'[[PRE-REDACTION-EMAIL]],
-  [[PRE-REDACTION-EMAIL]], [[PRE-REDACTION-EMAIL]]'`) and confirmed it appears
+  cell from the pinned `.xlsx` directly (`'<CLIENT-EMAIL-1>,
+  <CLIENT-EMAIL-2>, <CLIENT-EMAIL-3>'`) and confirmed it appears
   byte-for-byte identical in the generated SQL's row `(890, ...)`. 45 dirty emails —
   independently recomputed with a fresh parser using the same regex the check uses
   (`^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$`) against the parsed VALUES data → 45, matches.
-  Both duplicate `identificacion` pairs (`'[[PRE-REDACTION-CEDULA-A]]'`, `'[[PRE-REDACTION-CEDULA-B]]'`, each 2 rows)
+  Both duplicate `identificacion` pairs (`'<CEDULA-A>'`, `'<CEDULA-B>'`, each 2 rows)
   independently re-derived from the raw sheet with NBSP-aware grouping — matches the
   emitted `Q5_dup_identificacion_*` checks' normalization (`btrim(replace(...,
   chr(160), ' '))`), confirmed present in the current file (line 1366-1367).

=================== reports/t02-qa-r4.md ===================
@@ -150,8 +150,8 @@
 | Q4_estado_registro_permanente_1230 | 1230 | 1230 | PASS |
 | Q4_registrado_por_na_all_1231 | 1231 | 1231 | PASS |
 | Q5_dirty_email_count | 45 | 45 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-A]]_is_2 | 2 | 2 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-B]]_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-A>_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-B>_is_2 | 2 | 2 | PASS |
 | Q6_sheet_1185_is_jrosa | true | true | PASS |
 | Q6_sheet_15_is_melissa | true | true | PASS |

=================== reports/t03-dev-r3.md ===================
@@ -126,8 +126,8 @@
 | Q4_estado_registro_permanente_1230 | 1230 | 1230 | PASS |
 | Q4_registrado_por_na_all_1231 | 1231 | 1231 | PASS |
 | Q5_dirty_email_count | 45 | 45 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-A]]_is_2 | 2 | 2 | PASS |
-| Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-B]]_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-A>_is_2 | 2 | 2 | PASS |
+| Q5_dup_identificacion_<CEDULA-B>_is_2 | 2 | 2 | PASS |
 | Q6_sheet_1185_is_jrosa | true | true | PASS |
 | Q6_sheet_15_is_melissa | true | true | PASS |

=================== reports/t03-qa-r3.md ===================
@@ -181,8 +181,8 @@
 ```
 No credential, connection string, or email address leaked anywhere in the sprint
 directory. **One pre-existing, previously-reviewed characteristic noted, not a new t03
-defect:** the two duplicate `identificacion` values (`[[PRE-REDACTION-CEDULA-A]]`, `[[PRE-REDACTION-CEDULA-B]]`) appear
-as literal digit strings inside check *names* (`Q5_dup_identificacion_[[PRE-REDACTION-CEDULA-A]]_is_2`,
+defect:** the two duplicate `identificacion` values (`<CEDULA-A>`, `<CEDULA-B>`) appear
+as literal digit strings inside check *names* (`Q5_dup_identificacion_<CEDULA-A>_is_2`,
 etc.) baked into the generated SQL by T2's generator, and are therefore quoted verbatim in
 every dev/QA report from T2 round 1 onward, including this one and the dev's r3 report.
 This is a T2-generator design decision (check names embed the actual value), already

=================== reports/t06-qa-r3.md ===================
@@ -63,9 +63,9 @@
 my parser:
 ```
 '.'
-'[[PRE-REDACTION-EMAIL]] / [[PRE-REDACTION-EMAIL]]'
+'<CLIENT-EMAIL-4> / <CLIENT-EMAIL-5>'
 'REFERIDO POR CAROLIN ESPOSA VITINI WHATAPP'
-'[[PRE-REDACTION-EMAIL]] / [[PRE-REDACTION-EMAIL]]'
+'<CLIENT-EMAIL-6> / <CLIENT-EMAIL-7>'
 '.'
 ```
```

(`git diff` shows nothing for any of these — every report file is untracked
(`??`) at the directory level; see §6 for the enumeration used instead.)

## 4. Redaction log (field path / sentinel / length — no original values)

| File | Sentinel class | Occurrences | Field | Length of redacted value |
|---|---|---|---|---|
| t01-dev.md | `<CEDULA-A>` | 2 | `clientes.identificacion` | 11 digits |
| t01-dev.md | `<CEDULA-B>` | 2 | `clientes.identificacion` | 11 digits |
| t01-qa.md | `<CEDULA-A>` | 2 | `clientes.identificacion` | 11 digits |
| t01-qa.md | `<CEDULA-B>` | 2 | `clientes.identificacion` | 11 digits |
| t02-dev.md | `<CEDULA-A>` | 2 | `clientes.identificacion` | 11 digits |
| t02-dev.md | `<CEDULA-B>` | 1 | `clientes.identificacion` | 11 digits |
| t02-dev-r2.md | `<CEDULA-A>` | 8 | `clientes.identificacion` | 11 digits |
| t02-dev-r2.md | `<CEDULA-B>` | 8 | `clientes.identificacion` | 11 digits |
| t02-dev-r3.md | `<CEDULA-A>` | 8 | `clientes.identificacion` | 11 digits |
| t02-dev-r3.md | `<CEDULA-B>` | 8 | `clientes.identificacion` | 11 digits |
| t02-dev-r4.md | `<CEDULA-A>` | 10 | `clientes.identificacion` | 11 digits |
| t02-dev-r4.md | `<CEDULA-B>` | 10 | `clientes.identificacion` | 11 digits |
| t02-qa.md | `<CEDULA-A>` | 4 | `clientes.identificacion` | 11 digits |
| t02-qa.md | `<CEDULA-B>` | 2 | `clientes.identificacion` | 11 digits |
| t02-qa-r2.md | `<CEDULA-A>` | 1 | `clientes.identificacion` | 11 digits |
| t02-qa-r2.md | `<CEDULA-B>` | 1 | `clientes.identificacion` | 11 digits |
| t02-qa-r2.md | `<CLIENT-EMAIL-1>` | 1 | `clientes.email` (row `ID_CLIENTE=890`, comma-cell part 1/3) | 22 chars |
| t02-qa-r2.md | `<CLIENT-EMAIL-2>` | 1 | `clientes.email` (row `ID_CLIENTE=890`, comma-cell part 2/3) | 24 chars |
| t02-qa-r2.md | `<CLIENT-EMAIL-3>` | 1 | `clientes.email` (row `ID_CLIENTE=890`, comma-cell part 3/3) | 22 chars |
| t02-qa-r4.md | `<CEDULA-A>` | 1 | `clientes.identificacion` | 11 digits |
| t02-qa-r4.md | `<CEDULA-B>` | 1 | `clientes.identificacion` | 11 digits |
| t03-dev-r3.md | `<CEDULA-A>` | 1 | `clientes.identificacion` | 11 digits |
| t03-dev-r3.md | `<CEDULA-B>` | 1 | `clientes.identificacion` | 11 digits |
| t03-qa-r3.md | `<CEDULA-A>` | 2 | `clientes.identificacion` | 11 digits |
| t03-qa-r3.md | `<CEDULA-B>` | 1 | `clientes.identificacion` | 11 digits |
| t06-qa-r3.md | `<CLIENT-EMAIL-4>` | 1 | `clientes.email` (dual-address row, part 1/2) | 18 chars |
| t06-qa-r3.md | `<CLIENT-EMAIL-5>` | 1 | `clientes.email` (dual-address row, part 2/2) | 22 chars |
| t06-qa-r3.md | `<CLIENT-EMAIL-6>` | 1 | `clientes.email` (dual-address row, part 1/2) | 21 chars |
| t06-qa-r3.md | `<CLIENT-EMAIL-7>` | 1 | `clientes.email` (dual-address row, part 2/2) | 19 chars |

Totals: `<CEDULA-A>` = 41 occurrences across 11 files; `<CEDULA-B>` = 37
occurrences across 11 files; `<CLIENT-EMAIL-n>` = 7 occurrences across 2
files (n=1..7, one occurrence each). No original cédula digit string or
email string appears anywhere in this table, in this report, or in any
diff hunk above.

## 5. Coherence check — duplicate-identificacion finding survives redaction

Quoted verbatim from the redacted `reports/t01-dev.md` (lines 310-314):

> There is **no live UNIQUE constraint or unique index on `identificacion`,
> `rnc`, or `email`** — importing both duplicate `identificacion` values
> (`<CEDULA-A>` and `<CEDULA-B>`) is not blocked by any live constraint.

And from `reports/t02-dev.md` (lines 190-194):

> **Both duplicate `identificacion` values, each on exactly 2 rows** ...
> `'<CEDULA-A>'` and `'<CEDULA-B>'`, each 2 rows. **Genuine finding surfaced
> by this task:** one of the two `'<CEDULA-A>'` cells (sheet `ID_CLIENTE=941`)
> carries a **trailing U+00A0 (non-breaking space)** that the other
> (`ID_CLIENTE=1106`) does not.

A reader can still fully follow: two distinct cédula values are each shared
by exactly two client rows, both rows of each pair are preserved (not
deduplicated) by the import, and one specific occurrence of `<CEDULA-A>`
carries a byte-level NBSP defect distinguishing it from its pair-mate. The
finding is completely legible without ever seeing the real digits.

## 6. SQL file integrity (untouched, load-bearing)

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```

Both match the load-bearing values given in the task exactly
(`03` = `...42cc4`, `04` = `...689b1`). Neither file was opened for editing
by this task; the SQL payload was never touched.

## 7. Scope verification

```
$ git status --short
 M CLAUDE.md
 M docs/migracion/README-cleanup.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/README-clientes-import.md
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```

This is byte-identical to the pre-task snapshot: the entire sprint directory
was already untracked (`??`) as a unit before this task started, so `git
status` cannot show individual file changes inside it (per the sprint's own
`git-diff-scope-excludes-untracked-files` rule) — the two pre-existing `M`
lines (`CLAUDE.md`, `README-cleanup.md`) predate this task and were not
touched by it.

To prove scope, I enumerated every file under `reports/` and `scratchpad.md`
by modification time against a timestamp taken immediately before I started
editing:

```
$ find reports scratchpad.md -type f -newermt '2026-09-23 14:35:00'
reports/t01-dev.md
reports/t01-qa.md
reports/t02-dev-r2.md
reports/t02-dev-r3.md
reports/t02-dev-r4.md
reports/t02-dev.md
reports/t02-qa-r2.md
reports/t02-qa-r4.md
reports/t02-qa.md
reports/t03-dev-r3.md
reports/t03-qa-r3.md
reports/t06-qa-r3.md
```

**12 of 12 redacted files are exactly `reports/*.md` matching the hit-set in
§1, nothing else** — plus this new file, `reports/t09-dev.md`, created (not
modified) by this task. `scratchpad.md` has no PII and was not touched.
**13 of 13 files changed by this task (12 redacted + 1 new report) are
exactly `docs/sprints/2026-09-22-clientes-xlsx-import/reports/*.md`; nothing
outside that directory was touched.**

No `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`, `MEMORY/`,
`.claude/`, `CLAUDE.md`, `.env.local`, `docs/migracion/*`, or plan/amendment
file was opened for writing.

## 8. `npm run qa`

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test


> my-v0-project@0.1.0 typecheck
> tsc --noEmit


> my-v0-project@0.1.0 lint
> eslint .

(29 pre-existing react-hooks/exhaustive-deps and @next/next/no-img-element
warnings in app/**, all pre-existing, none introduced by this task — this
task touched zero .ts/.tsx/.py/.sql files)

> my-v0-project@0.1.0 test
> vitest run

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  14:42:36
   Duration  2.02s

$ echo $?
0
```

Exit code 0. 825/825 tests pass, 0 lint errors (warnings only, all
pre-existing in files this task never touched), tsc clean. This task edits
only markdown report files, so this is a pure regression gate — expected and
confirmed green.

## 9. Self-check of this report

Before submitting, I grepped this file itself for every PII literal (the two
cédula digit strings and all seven email strings) — zero hits, confirmed
with the same greps used in §1. This report only contains sentinels
(`<CEDULA-A>`, `<CEDULA-B>`, `<CLIENT-EMAIL-1..7>`) and length/count
metadata, per the `redaction-discipline` mistake note's binding rule against
"was `<X>`" phrasing.

## 10. Root cause note (orchestrator framing error, not a dev/QA failure)

Per the task's own framing, restated here for the record: T1's delegation
prompt (and every later task that discussed the duplicate-`identificacion`
finding) declared the two cédula values "pre-cleared as non-secret." That
framing is visible verbatim inside the redacted `t01-dev.md` passage quoted
in §5 above ("...are explicitly pre-cleared as non-secret by the frozen
spec (per this task's instructions)..."). Every dev and QA agent that
touched this finding correctly followed the instruction they were given —
the leak is a consequence of what the orchestrator told them was true, not
a lapse in their own PII discipline. T8's audit (dev + QA) correctly
identified this as a sprint-wide defect and, independently, as an
orchestrator-level error rather than a dev/QA one; this task's own
re-derivation confirms the same root cause and does not re-litigate it.

## Rollback

A byte-for-byte backup of all 12 original (pre-redaction) files was made to
a session-local scratch directory before any edit; restoring means copying
each backed-up file back over its `reports/` counterpart (no destructive git
operation is needed or was used, since these files are untracked and this
task made no commit).
