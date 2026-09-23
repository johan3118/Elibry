#!/usr/bin/env python3
"""
generate-clientes-import.py — deterministic generator for the `clientes` XLSX
import artifact set (sprint docs/sprints/2026-09-22-clientes-xlsx-import).
Reads the PINNED workbook (hash-verified below) and emits BOTH
docs/migracion/03-clientes-import-dry-run.sql — a READ-ONLY dry run that
stages all 1,231 mapped rows into a TEMP table and reports every guard,
distribution and backfill-count assertion the plan requires — and
docs/migracion/04-clientes-import-execute.sql — the write-capable execute
script, generated from the SAME `checks` list so both files' pre-write guard
predicates stay byte-identical (the `weak-backstop-guard` invariant). Neither
run of this generator itself writes to any business table — it only emits
SQL text. Python 3 STDLIB ONLY (zipfile + xml.etree) — no openpyxl, no new
dependency. Determinism: no timestamps/usernames/hostnames/absolute paths in
either OUTPUT file; two consecutive runs must be byte-identical for both.
`_jrosa_preserva` (T4, plan §3 statement 1; see PRESERVE_COLUMNS below) is
the 17 live `clientes` columns with no sheet source (T1 Q4's 35 columns
minus the 18 sheet-sourced ones) — a strict superset of the frozen spec's
7-col MUST-PRESERVE floor.

This file is exempted from the normal 500-line ceiling in
.claude/rules/file-size.md, up to 650 lines, for the life of this sprint's
artifacts only — see docs/plans/clientes-xlsx-import-amendment-a.md
(scope-limited, non-precedential).

The sheet-column -> DB-column mapping (plan T2 AC 8) is the MAPPING_TABLE
constant below, rendered verbatim into 03-...sql's header (never silently
dropped). The 15 live `clientes` columns with no sheet source and no forced
literal (fecha_creado, fecha_editado, editado_por, imagen_url,
usuario_creacion, fecha_provisional, dependencias_ids, telefonos_json,
emails_json, documentos, cedula_url, registro_mercantil_url,
documento_cedula_url, documento_registro_mercantil_url, documentos_urls) are
simply absent from the staged column list, taking the table's DEFAULT/NULL.
`cedula_pasaporte` does not exist live (T1 Q4, refuted) and is never used.
"""
import hashlib
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

# Pinned source (T1-Q7). Refuse to run on any hash mismatch.
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SOURCE_PATH = os.path.join(_SCRIPT_DIR, "..", "migracion-clientes.xlsx")
EXPECTED_SHA256 = "6a0eb8185926e92586ea8006df30a0195ffd37b78b3d089ee7cbfa7f95d3e2c8"
EXPECTED_MD5 = "f354298b2e0f92e718856d6cce38b7d5"
EXPECTED_ROW_COUNT = 1231
EXPECTED_ID_GAPS = {126, 444, 817, 878, 952, 953, 983, 1148, 1216}
OUTPUT_PATH = os.path.join(_SCRIPT_DIR, "03-clientes-import-dry-run.sql")

# Live column length limits (T1 Q4). direccion/observacion are unbounded `text`, excluded.
COLUMN_LIMITS = {
    "tipo_cliente": 20, "compania": 50, "rnc": 20, "razon_social": 200,
    "nombre_comercial": 200, "responsable": 200, "identificacion": 20,
    "nombre_completo": 200, "sexo": 20, "telefonos": 200, "email": 200,
    "referido_por": 200, "registrado_por": 200, "status": 20,
    "estado_registro": 20, "pais": 100,
}

# Guard-predicate single source of truth (weak-backstop-guard mistake note):
# a future T4 change must import/reuse these constants verbatim, never retype.
PAT_JROSA = "%JROSA%ASESORA%VIAJES%"
PAT_MELISSA = "%MELISSA%PORTES%ROSIS%"
RESERVA_CODIGO = "RES-1787875561067"
PAIS_LITERAL = "República Dominicana"  # human ruling override, not the sheet value
COMPANIA_MAP = {"ATEB": "MARCA 1", "GEB": "MARCA 2"}
VALID_TIPO = {"NORMAL", "EMPRESA"}
VALID_SEXO = {"FEMENINO", "MASCULINO", "OTROS", "N/A"}
VALID_STATUS = {"ACTIVO", "INACTIVO"}
JROSA_ID = 1185
MELISSA_ID = 15
EXPECTED_NOT_NULL_COLS = ["id", "tipo_cliente", "compania", "telefonos", "email", "direccion", "registrado_por", "status"]

DB_COLUMNS = [
    "id", "tipo_cliente", "compania", "rnc", "razon_social", "nombre_comercial",
    "responsable", "identificacion", "nombre_completo", "sexo", "sexo_was_blank",
    "fecha_nacimiento", "telefonos", "email", "direccion", "observacion", "referido_por",
    "registrado_por", "status", "estado_registro", "pais",
]; _BOOLEAN_DB_COLUMNS = {"sexo_was_blank"}  # diagnostic-only provenance col (round-2 fix), not a live `clientes` col; T4 must not select it
# Sheet column -> DB column mapping (plan T2 AC 8); "pais" maps to a forced literal (human ruling), listed as mapped not dropped.
MAPPING_TABLE = [
    ("ID_CLIENTE", "id", "verbatim (integer), also the staged PK"),
    ("tipo_cliente", "tipo_cliente", "verbatim; validated against NORMAL/EMPRESA"),
    ("compania", "compania", "mapped ATEB->'MARCA 1', GEB->'MARCA 2' (clientes_compania_check allows only these two; any other value aborts generation)"),
    ("rnc", "rnc", "verbatim; blank -> NULL"),
    ("razon_social", "razon_social", "verbatim; blank -> NULL"),
    ("nombre_comercial", "nombre_comercial", "verbatim; blank -> NULL"),
    ("responsable", "responsable", "verbatim if present; blank+EMPRESA -> 'N/A' (chk_empresa_fields); blank+NORMAL -> NULL"),
    ("identificacion", "identificacion", "verbatim if present; blank+NORMAL -> 'N/A' (chk_empresa_fields); blank+EMPRESA -> NULL"),
    ("nombre_completo", "nombre_completo", "verbatim if present; blank+NORMAL -> 'N/A'; blank+EMPRESA -> NULL"),
    ("sexo", "sexo", "verbatim if present (validated FEMENINO/MASCULINO/OTROS/N/A); blank+NORMAL -> 'N/A'; blank+EMPRESA -> NULL"),
    ("fecha_nacimiento", "fecha_nacimiento", "dropped as a value source (100% blank, verified) -> always bare NULL; generator ABORTS on any non-blank cell"),
    ("telefonos", "telefonos", "verbatim if present; blank -> 'N/A' (NOT NULL, both types)"),
    ("email", "email", "verbatim if present; blank -> 'N/A' (NOT NULL, both types)"),
    ("direccion", "direccion", "verbatim if present; blank -> 'N/A' (NOT NULL, both types)"),
    ("pais", "pais", "forced literal 'República Dominicana' on ALL rows per human ruling (supersedes the sheet's own 'REPUBLICA DOMINICANA' and the plan's original unaccented literal) — not a passthrough"),
    ("observacion", "observacion", "dropped as a value source (100% blank, verified) -> always bare NULL"),
    ("referido_por", "referido_por", "verbatim; sheet column verified 0% blank -> no backfill applied; holds the literal original ATEB/GEB"),
    ("status", "status", "verbatim; validated against ACTIVO/INACTIVO"),
    ("(no sheet column)", "registrado_por", "'N/A' for all rows (NOT NULL, no sheet source; app sets this from the logged-in user, absent for a bulk import)"),
    ("(no sheet column)", "estado_registro", "'PERMANENTE' for 1230 rows; NULL for the single staged row id=1185 (sheet JROSA row) — real value DEFERRED to T4's JROSA-preservation merge"),
]
OUTPUT_PATH_04 = os.path.join(_SCRIPT_DIR, "04-clientes-import-execute.sql")
# T4 decision: _jrosa_preserva = every live `clientes` column NOT sourced
# from the sheet (T1 Q4's 35 cols minus the 18 sheet-sourced ones below) --
# a strict superset of the frozen spec's 7-col MUST-PRESERVE floor
# (estado_registro, documentos_urls, imagen_url, registrado_por,
# fecha_creado, fecha_editado, editado_por).
PRESERVE_COLUMNS = [
    "registrado_por", "fecha_creado", "fecha_editado", "editado_por", "imagen_url",
    "estado_registro", "usuario_creacion", "fecha_provisional", "dependencias_ids",
    "telefonos_json", "emails_json", "documentos", "cedula_url",
    "registro_mercantil_url", "documento_cedula_url",
    "documento_registro_mercantil_url", "documentos_urls",
]
INSERT_COLUMNS = [c for c in DB_COLUMNS if c not in _BOOLEAN_DB_COLUMNS]  # 20 real `clientes` cols
SHEET_ONLY_COLUMNS = [c for c in INSERT_COLUMNS if c not in PRESERVE_COLUMNS]  # 18, JROSA merge `s.` side
_NS = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main", "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships"}

def _colnum(ref):
    s = re.match(r"[A-Z]+", ref).group(0)
    n = 0
    for c in s:
        n = n * 26 + ord(c) - 64
    return n - 1
def load_sheet(path, sheet_name):
    """Stdlib-only XLSX reader (zipfile + xml.etree). Returns list-of-rows."""
    with zipfile.ZipFile(path) as z:
        shared = []
        if "xl/sharedStrings.xml" in z.namelist():
            root = ET.fromstring(z.read("xl/sharedStrings.xml"))
            for si in root.findall("m:si", _NS):
                shared.append("".join(t.text or "" for t in si.iter("{%s}t" % _NS["m"])))
        wb = ET.fromstring(z.read("xl/workbook.xml"))
        rels = ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        relmap = {r.get("Id"): r.get("Target") for r in rels}
        target = None
        for sh in wb.find("m:sheets", _NS):
            if sh.get("name") == sheet_name:
                rid = sh.get("{%s}id" % _NS["r"])
                tgt = relmap[rid]
                target = tgt if tgt.startswith("xl/") else "xl/" + tgt.lstrip("/")
        if target is None:
            sys.exit(f"ABORT: sheet {sheet_name!r} not found in {path}")
        root = ET.fromstring(z.read(target))
        rows = []
        for row in root.iter("{%s}row" % _NS["m"]):
            cells = {}
            for c in row.findall("m:c", _NS):
                t = c.get("t")
                v = c.find("m:v", _NS)
                isel = c.find("m:is", _NS)
                if t == "inlineStr" and isel is not None:
                    val = "".join(x.text or "" for x in isel.iter("{%s}t" % _NS["m"]))
                elif v is None:
                    continue
                elif t == "s":
                    val = shared[int(v.text)]
                else:
                    val = v.text
                cells[_colnum(c.get("r"))] = val
            if cells:
                w = max(cells) + 1
                rows.append([cells.get(i, "") for i in range(w)])
        return rows
def sql_str(v):
    return "NULL" if v is None else "'" + str(v).replace("'", "''") + "'"
def blank(v):
    return v is None or str(v).strip() == ""

def transform(sheet_row, idx):
    """Map one sheet row to a dict of DB_COLUMNS values, plus backfill flags."""
    get = lambda name: sheet_row[idx[name]] if not blank(sheet_row[idx[name]]) else None
    id_cliente = int(sheet_row[idx["ID_CLIENTE"]])
    tipo = get("tipo_cliente")
    if tipo not in VALID_TIPO:
        sys.exit(f"ABORT: id {id_cliente} has unexpected tipo_cliente {tipo!r}")
    compania_raw = get("compania")
    if compania_raw not in COMPANIA_MAP:
        sys.exit(f"ABORT: id {id_cliente} has unexpected compania {compania_raw!r}")

    out = {"id": id_cliente, "tipo_cliente": tipo, "compania": COMPANIA_MAP[compania_raw],
           "rnc": get("rnc"), "razon_social": get("razon_social"),
           "nombre_comercial": get("nombre_comercial")}
    flags = {}
    def normal_field(name, applies_to):
        v = get(name)
        if v is not None:
            return v, False
        return ("N/A", True) if tipo == applies_to else (None, False)

    out["responsable"], flags["responsable"] = normal_field("responsable", "EMPRESA")
    out["identificacion"], flags["identificacion"] = normal_field("identificacion", "NORMAL")
    out["nombre_completo"], flags["nombre_completo"] = normal_field("nombre_completo", "NORMAL")
    out["sexo"], flags["sexo"] = normal_field("sexo", "NORMAL"); out["sexo_was_blank"] = flags["sexo"]  # round-2 fix: provenance flag
    if out["sexo"] is not None and out["sexo"] not in VALID_SEXO:
        sys.exit(f"ABORT: id {id_cliente} has unexpected sexo {out['sexo']!r}")
    fn = get("fecha_nacimiento")
    if fn is not None:
        sys.exit(f"ABORT: id {id_cliente} has non-blank fecha_nacimiento {fn!r}")
    out["fecha_nacimiento"] = None
    for name in ("telefonos", "email", "direccion"):
        v = get(name)
        out[name], flags[name] = (v, False) if v is not None else ("N/A", True)

    obs = get("observacion")
    if obs is not None:
        sys.exit(f"ABORT: id {id_cliente} has non-blank observacion {obs!r}")
    out["observacion"] = None
    out["referido_por"] = get("referido_por")
    out["registrado_por"] = "N/A"
    flags["registrado_por"] = True
    status = get("status")
    if status not in VALID_STATUS:
        sys.exit(f"ABORT: id {id_cliente} has unexpected status {status!r}")
    out["status"] = status
    out["estado_registro"] = None if id_cliente == JROSA_ID else "PERMANENTE"
    out["pais"] = PAIS_LITERAL
    return out, flags

def check_overflow(mapped):
    """HC-1 gate: measure every value's length against its live column limit."""
    max_len = {c: 0 for c in COLUMN_LIMITS}
    overflow = []
    for row in mapped:
        for col, limit in COLUMN_LIMITS.items():
            v = row.get(col)
            if v is None:
                continue
            n = len(str(v))
            if n > max_len[col]:
                max_len[col] = n
            if n > limit:
                overflow.append((row["id"], col, n, limit))
    return max_len, overflow
def find_duplicates(mapped, col, exclude=("N/A",)):
    """DETECTION-only whitespace/NBSP-normalized grouping (one of the two
    duplicate identificacion cells carries a trailing U+00A0); the stored
    value is never altered. `exclude` drops the backfill placeholder itself
    from being reported as a false "duplicate"."""
    seen = {}
    for row in mapped:
        v = row.get(col)
        if v is None or v in exclude:
            continue
        key = v.replace("\xa0", " ").strip()
        seen.setdefault(key, []).append((row["id"], v))
    return {k: ids for k, ids in seen.items() if len(ids) > 1}
_EMAIL_RE = re.compile(r"^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$")
def count_dirty_emails(mapped):
    n = 0
    for row in mapped:
        v = row["email"]
        if v is not None and v != "N/A" and not _EMAIL_RE.match(v.strip()):
            n += 1
    return n

def build_values_lines(mapped):
    lines = []
    for row in sorted(mapped, key=lambda r: r["id"]):
        vals = [row["id"] if col == "id" else ("true" if row[col] else "false") if col in _BOOLEAN_DB_COLUMNS else sql_str(row[col]) for col in DB_COLUMNS]
        lines.append("  (" + ", ".join(str(v) for v in vals) + ")")
    return lines

def build_checks(mapped, max_len, dup_iden, dirty_email_count, expected_ids):
    """(name, expected, actual_sql_expr) triples: the single source of truth for
    every guard/distribution/backfill/verbatim assertion. Q1 hits live tables;
    the rest hit the staged `_clientes_import` payload, so T3's live run
    re-verifies staging, not just this generator's own Python arithmetic."""
    nn = ",".join(f"'{c}'" for c in sorted(EXPECTED_NOT_NULL_COLS))
    c = [
        # --- Q1: live preconditions (G1/G2/G7/G8/G9/G10 previews) ---
        ("Q1_clientes_count_is_1", "1", "(SELECT count(*)::text FROM clientes)"),
        ("Q1_clientes_max_id_is_15", "15", "(SELECT coalesce(max(id)::text,'NULL') FROM clientes)"),
        ("Q1_live_id_15_is_jrosa", "true",
         f"(SELECT (coalesce(nombre_completo,'') ILIKE '{PAT_JROSA}' OR coalesce(razon_social,'') ILIKE '{PAT_JROSA}' "
         f"OR coalesce(nombre_comercial,'') ILIKE '{PAT_JROSA}')::text FROM clientes WHERE id = 15)"),
        ("Q1_reservas_count_is_1", "1", "(SELECT count(*)::text FROM reservas)"),
        ("Q1_reserva_10_codigo", RESERVA_CODIGO, "(SELECT codigo FROM reservas WHERE id = 10)"),
        ("Q1_reserva_10_cliente_is_15", "15", "(SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10)"),
        ("Q1_pagos_ref_15_is_0", "0", "(SELECT count(*)::text FROM pagos WHERE cliente_id = 15)"),
        ("Q1_cambios_prov_ref_15_known_dangling", "1",
         "(SELECT count(*)::text FROM cambios_provisionales WHERE tabla_afectada='clientes' AND registro_id=15)"),
        ("Q1_acciones_ref_15_is_0", "0",
         "(SELECT count(*)::text FROM acciones_pendientes WHERE tabla_objetivo='clientes' AND registro_id=15)"),
        ("Q1_not_null_columns_match", "true",
         f"(SELECT (array_agg(column_name::text ORDER BY column_name::text) = ARRAY[{nn}]::text[])::text "
         "FROM information_schema.columns WHERE table_schema='public' AND table_name='clientes' AND is_nullable='NO')"),
        ("Q1_check_constraints_present_5", "5",
         "(SELECT count(*)::text FROM pg_constraint WHERE conrelid='public.clientes'::regclass AND contype='c' "
         "AND conname IN ('chk_empresa_fields','clientes_compania_check','clientes_sexo_check','clientes_status_check','clientes_tipo_cliente_check'))"),
        ("Q1_trigger_fecha_editado_present", "true",
         "(SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
         "AND tgname='trigger_update_clientes_fecha_editado' AND NOT tgisinternal)::text)"),
        ("Q1_audit_clientes_trigger_absent", "true",
         "(SELECT (NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.clientes'::regclass "
         "AND tgname ILIKE '%audit%' AND NOT tgisinternal))::text)"),
        ("Q1_serial_sequence_resolvable", "true",
         "((pg_get_serial_sequence('public.clientes','id') IS NOT NULL)::text)"),
        # --- Q2: payload staging ---
        ("Q2_staged_row_count", str(EXPECTED_ROW_COUNT), "(SELECT count(*)::text FROM _clientes_import)"),
        ("Q2_staged_id_set_matches_expected", "true",
         f"(SELECT (array_agg(id ORDER BY id) = ARRAY{expected_ids}::int[])::text FROM _clientes_import)"),
        # --- Q3: expected-vs-actual distributions ---
        ("Q3_tipo_cliente_EMPRESA_229", "229", "(SELECT count(*)::text FROM _clientes_import WHERE tipo_cliente='EMPRESA')"),
        ("Q3_tipo_cliente_NORMAL_1002", "1002", "(SELECT count(*)::text FROM _clientes_import WHERE tipo_cliente='NORMAL')"),
        ("Q3_compania_other_values_0", "0",
         "(SELECT count(*)::text FROM _clientes_import WHERE compania NOT IN ('MARCA 1','MARCA 2'))"),
        ("Q3_compania_MARCA1_1010", "1010", "(SELECT count(*)::text FROM _clientes_import WHERE compania='MARCA 1')"),
        ("Q3_compania_MARCA2_221", "221", "(SELECT count(*)::text FROM _clientes_import WHERE compania='MARCA 2')"),
        ("Q3_status_ACTIVO_1228", "1228", "(SELECT count(*)::text FROM _clientes_import WHERE status='ACTIVO')"),
        ("Q3_status_INACTIVO_3", "3", "(SELECT count(*)::text FROM _clientes_import WHERE status='INACTIVO')"),
        ("Q3_pais_literal_all_1231", str(EXPECTED_ROW_COUNT),
         f"(SELECT count(*)::text FROM _clientes_import WHERE pais = '{PAIS_LITERAL}')"),
        ("Q3_referido_por_never_contains_MARCA", "0",
         "(SELECT count(*)::text FROM _clientes_import WHERE referido_por ILIKE '%MARCA%')"),
        ("Q3_observacion_null_all_1231", str(EXPECTED_ROW_COUNT),
         "(SELECT count(*)::text FROM _clientes_import WHERE observacion IS NULL)"),
        ("Q3_fecha_nacimiento_null_all_1231", str(EXPECTED_ROW_COUNT),
         "(SELECT count(*)::text FROM _clientes_import WHERE fecha_nacimiento IS NULL)"),
        # --- Q4: placeholder-backfill counts (the six sheet-conditional sites,
        # plus registrado_por/estado_registro which are unconditional/JROSA-deferred) ---
        ("Q4_backfill_responsable_229", "229",
         "(SELECT count(*)::text FROM _clientes_import WHERE responsable = 'N/A')"),
        ("Q4_backfill_direccion_910", "910",
         "(SELECT count(*)::text FROM _clientes_import WHERE direccion = 'N/A')"),
        ("Q4_backfill_email_599", "599",
         "(SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A')"),
        ("Q4_backfill_telefonos_255", "255",
         "(SELECT count(*)::text FROM _clientes_import WHERE telefonos = 'N/A')"),
        ("Q4_backfill_sexo_402", "402",  # round-2 fix: provenance flag, not `sexo = 'N/A'` (that's 408 — 6 rows are legitimately literal 'N/A')
         "(SELECT count(*)::text FROM _clientes_import WHERE sexo_was_blank)"),
        ("Q4_backfill_identificacion_15", "15",
         "(SELECT count(*)::text FROM _clientes_import WHERE identificacion = 'N/A')"),
        ("Q4_backfill_nombre_completo_15", "15",
         "(SELECT count(*)::text FROM _clientes_import WHERE nombre_completo = 'N/A')"),
        ("Q4_registrado_por_na_all_1231", str(EXPECTED_ROW_COUNT),
         "(SELECT count(*)::text FROM _clientes_import WHERE registrado_por = 'N/A')"),
        ("Q4_estado_registro_permanente_1230", "1230",
         "(SELECT count(*)::text FROM _clientes_import WHERE estado_registro = 'PERMANENTE')"),
        ("Q4_estado_registro_null_1_jrosa_deferred", "1",
         "(SELECT count(*)::text FROM _clientes_import WHERE estado_registro IS NULL)"),
        # --- Q5: verbatim-data assertions (HC-1 overflow report is separate,
        # computed and gated at GENERATION time in Python — see header) ---
        # NOTE: matched on a whitespace/NBSP-normalized key, NOT a raw
        # equality — id=941 carries a verified trailing NBSP on
        # identificacion, preserved verbatim in the stored value; only this
        # check expression normalizes (mirrors find_duplicates() above).
        ("Q5_dup_identificacion_22500078831_is_2", "2",
         "(SELECT count(*)::text FROM _clientes_import WHERE btrim(replace(identificacion, chr(160), ' ')) = '22500078831')"),
        ("Q5_dup_identificacion_22900113527_is_2", "2",
         "(SELECT count(*)::text FROM _clientes_import WHERE btrim(replace(identificacion, chr(160), ' ')) = '22900113527')"),
        # round-4 fix: mirrors count_dirty_emails()'s v.strip() (NBSP is Python whitespace, not ASCII-only btrim()).
        ("Q5_dirty_email_count", str(dirty_email_count),
         r"(SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A' AND "
         r"btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$')"),
        # --- Q6: JROSA-relocation sheet-side preview. NOTE: the "7 preserved
        # columns are capturable" sub-check from plan §5 Q6 is DEFERRED to T4
        # (`_jrosa_preserva`, plan §3 statement 1) — it needs an architectural
        # decision on the exact preserved-column set that is out of T2's
        # scope (see this task's dev report for the reasoning). Only the two
        # sheet-side name-pattern assertions are checked here. ---
        ("Q6_sheet_1185_is_jrosa", "true",
         f"(SELECT bool_or(razon_social ILIKE '{PAT_JROSA}' OR nombre_comercial ILIKE '{PAT_JROSA}')::text "
         f"FROM _clientes_import WHERE id = {JROSA_ID})"),
        ("Q6_sheet_15_is_melissa", "true",
         f"(SELECT bool_or(nombre_completo ILIKE '{PAT_MELISSA}')::text FROM _clientes_import WHERE id = {MELISSA_ID})"),
    ]
    return c

_POST_SKIP = {"Q4_backfill_sexo_402", "Q4_estado_registro_null_1_jrosa_deferred", "Q4_registrado_por_na_all_1231"}
def build_post_checks(checks, expected_ids):
    """T4 post-write assertions: every Q2-Q6 payload check from `checks`
    re-targeted at the real `clientes` table (weak-backstop-guard -- same
    predicate text, only `_clientes_import` swapped for `clientes`, never
    retyped). Q1 live-precondition checks are superseded, not repeated.
    Three checks whose meaning changes once JROSA's real preserved values
    land are skipped and replaced below by corrected equivalents:
    sexo_was_blank doesn't exist on `clientes`; estado_registro/
    registrado_por are no longer NULL/'N/A' for JROSA post-merge."""
    post = []
    for name, expected, actual in checks:
        if name.startswith("Q1_") or name in ("Q2_staged_row_count", "Q2_staged_id_set_matches_expected") or name in _POST_SKIP:
            continue
        post.append((f"Post_{name}", expected, actual.replace("_clientes_import", "clientes")))
    preserve_eq = " AND ".join(f"c.{col} IS NOT DISTINCT FROM p.{col}" for col in PRESERVE_COLUMNS)
    post += [
        ("Post_clientes_count_1231", str(EXPECTED_ROW_COUNT), "(SELECT count(*)::text FROM clientes)"),
        ("Post_clientes_id_set_matches_expected", "true", f"(SELECT (array_agg(id ORDER BY id) = ARRAY{expected_ids}::int[])::text FROM clientes)"),
        ("Post_jrosa_preserved_cols_intact", "true", f"(SELECT ({preserve_eq})::text FROM clientes c, _jrosa_preserva p WHERE c.id = {JROSA_ID})"),
        ("Post_id_15_is_melissa", "true", f"(SELECT (nombre_completo ILIKE '{PAT_MELISSA}')::text FROM clientes WHERE id = {MELISSA_ID})"),
        ("Post_reservas_count_is_1", "1", "(SELECT count(*)::text FROM reservas)"),
        ("Post_reserva_10_cliente_is_1185", str(JROSA_ID), "(SELECT coalesce(cliente_id::text,'NULL') FROM reservas WHERE id = 10)"),
        ("Post_pagos_ref_15_unchanged_0", "0", "(SELECT count(*)::text FROM pagos WHERE cliente_id = 15)"),
        ("Post_registrado_por_na_1230", "1230", "(SELECT count(*)::text FROM clientes WHERE registrado_por = 'N/A')"),
        ("Post_estado_registro_deferred_resolved_0", "0", "(SELECT count(*)::text FROM clientes WHERE estado_registro IS NULL)"),
        ("Post_sequence_advanced_past_1240", "true", "(SELECT (pg_sequence_last_value(pg_get_serial_sequence('clientes','id')::regclass) >= 1240)::text)"),
    ]
    return post

def render_sql(mapped, checks, values_lines, max_len, dup_iden, payload_sha256):
    len_report = "\n".join(
        f"--   {col}: measured max {n} chars vs live limit {COLUMN_LIMITS[col]}"
        + (" *** OVERFLOW ***" if n > COLUMN_LIMITS[col] else " OK")
        for col, n in sorted(max_len.items())
    )
    dup_report = "\n".join(
        f"--   {key!r} (normalized): {len(pairs)} row(s) -> " + ", ".join(f"id={i} raw={raw!r}" for i, raw in pairs)
        for key, pairs in sorted(dup_iden.items())
    ) or "--   (none)"
    checks_sql = "\n".join(
        f"INSERT INTO _checks(name, expected, actual) VALUES ({sql_str(name)}, {sql_str(expected)}, {actual});"
        for name, expected, actual in checks
    )
    values_block = ",\n".join(values_lines)
    db_columns_csv = ", ".join(DB_COLUMNS)
    mapping_report = "\n".join(
        f"--   {sheet_col:<20} -> {db_col:<16} {note}" for sheet_col, db_col, note in MAPPING_TABLE
    )

    return f"""-- =============================================================================
-- 03-clientes-import-dry-run.sql — READ-ONLY. DO NOT EDIT — generated by
-- generate-clientes-import.py (regenerate: `python3
-- docs/migracion/generate-clientes-import.py`; stdlib only, no dependency).
-- =============================================================================
-- Elibry — `clientes` XLSX import (1,231 rows, original IDs, JROSA relocation)
-- Companion (future tasks, not yet generated): 04-clientes-import-execute.sql,
-- README-clientes-import.md. Spec: docs/plans/clientes-xlsx-import.md
--
-- This file contains ZERO INSERT / UPDATE / DELETE / ALTER against any
-- business table. The only DDL is `CREATE TEMP TABLE`, session-local pg_temp,
-- gone when the connection closes. Safe to run any number of times, in any
-- order, against the live database — nothing here can change a real row.
--
-- File-size exemption (pre-approved, .claude/rules/file-size.md, plan §2):
-- generated, never hand-edited; dominated by one multi-row VALUES list
-- (1,231 rows). Chunking was rejected (plan §2) — do not flag line count.
--
-- payload-sha256: {payload_sha256}
--   (sha256 of the exact VALUES-lines text below, computed at generation
--   time; a future 04-...sql sharing this payload must quote the same line.)
--
-- HC-1 overflow report (measured at generation time against T1's live
-- information_schema.character_maximum_length; direccion/observacion are
-- unbounded `text` and excluded):
{len_report}
--
-- Duplicate identificacion values (spec: keep both, no dedup — no live
-- UNIQUE constraint blocks this, T1 Q5):
{dup_report}
--
-- Sheet-column -> DB-column mapping (plan T2 AC 8 — no sheet column is
-- silently dropped; the 15 non-sheet, non-forced DB columns take the live
-- table's own DEFAULT/NULL and are not in the staged column list below):
{mapping_report}
-- =============================================================================

-- =============================================================================
-- SECTION Q2 — Stage the mapped payload (read-only: pg_temp only).
-- =============================================================================
DROP TABLE IF EXISTS pg_temp._clientes_import;
CREATE TEMP TABLE _clientes_import (
  id integer, tipo_cliente varchar(20), compania varchar(50), rnc varchar(20),
  razon_social varchar(200), nombre_comercial varchar(200), responsable varchar(200),
  identificacion varchar(20), nombre_completo varchar(200), sexo varchar(20), sexo_was_blank boolean, -- round-2 fix: diagnostic-only, not a live `clientes` col; T4's INSERT must not select it
  fecha_nacimiento date, telefonos varchar(200), email varchar(200), direccion text,
  observacion text, referido_por varchar(200), registrado_por varchar(200),
  status varchar(20), estado_registro varchar(20), pais varchar(100)
);
INSERT INTO _clientes_import ({db_columns_csv}) VALUES
{values_block};

SELECT 'correlation_token_only, not an identity check' AS nota,
  md5(string_agg(id::text || '|' || coalesce(tipo_cliente,'') || '|' || coalesce(compania,''), ',' ORDER BY id)) AS payload_token
FROM _clientes_import;

-- =============================================================================
-- SECTIONS Q1, Q3, Q4, Q5, Q6 — every guard/distribution/backfill/verbatim
-- assertion, expected-vs-actual, one row each. Loud, non-collapsing PASS/FAIL
-- (a real 0 or a real count is never blank — ADR 0012 non-collapse rule).
-- =============================================================================
DROP TABLE IF EXISTS pg_temp._checks;
CREATE TEMP TABLE _checks (name text, expected text, actual text);
{checks_sql}

SELECT name, expected, actual,
  CASE WHEN expected = actual THEN 'PASS' ELSE '*** FAIL ***' END AS resultado
FROM _checks ORDER BY name;

-- =============================================================================
-- SECTION Q7 — final loud abort-or-proceed verdict.
-- =============================================================================
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM _checks WHERE expected <> actual)
    THEN '*** ABORT *** at least one check above FAILed — investigate before writing any execute script.'
    ELSE 'PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.'
  END AS veredicto_final,
  (SELECT count(*) FROM _checks WHERE expected <> actual) AS fallas;
"""

def _checks_block(checks, table):
    ddl = f"DROP TABLE IF EXISTS pg_temp.{table};\nCREATE TEMP TABLE {table} (name text, expected text, actual text);"
    rows = "\n".join(
        f"INSERT INTO {table}(name, expected, actual) VALUES ({sql_str(name)}, {sql_str(expected)}, {actual});"
        for name, expected, actual in checks
    )
    return ddl, rows

def render_execute_sql(checks, post_checks, values_lines, payload_sha256):
    """T4: one BEGIN...COMMIT (plan §3 approach C -- insert-then-repoint-
    then-delete-then-backfill; `clientes` is never UPDATEd, so
    trigger_update_clientes_fecha_editado, BEFORE UPDATE only, cannot fire
    for the relocated JROSA row). Guard predicates are the SAME `checks`
    list 03 reports (weak-backstop-guard); never retyped."""
    values_block = ",\n".join(values_lines)
    db_columns_csv = ", ".join(DB_COLUMNS)
    guard_ddl, guard_rows = _checks_block(checks, "_checks")
    post_ddl, post_rows = _checks_block(post_checks, "_post_checks")
    plain_cols = ", ".join(INSERT_COLUMNS)
    jrosa_cols = ", ".join(SHEET_ONLY_COLUMNS + PRESERVE_COLUMNS)
    jrosa_select = ", ".join([f"s.{c}" for c in SHEET_ONLY_COLUMNS] + [f"p.{c}" for c in PRESERVE_COLUMNS])
    preserve_csv = ", ".join(PRESERVE_COLUMNS)
    return f"""-- 04-clientes-import-execute.sql -- DO NOT EDIT -- generated by generate-clientes-import.py.
-- Elibry `clientes` import EXECUTE script. Companion: 03-clientes-import-dry-run.sql (same guard predicates, weak-backstop-guard).
-- WRITES clientes + reservas. One transaction; always really COMMITs or ABORTs whole -- no ROLLBACK statement in this file.
-- File-size exemption (.claude/rules/file-size.md, plan §2): generated, never hand-edited, same 1,231-row payload as 03.
-- payload-sha256: {payload_sha256}
-- _jrosa_preserva columns (T4 decision, non-sheet superset of the 7-col floor): {preserve_csv}
BEGIN;

-- Stage payload (identical to 03 Q2) + run every 03 check as a pre-write guard (G1-G5,G7-G10).
DROP TABLE IF EXISTS pg_temp._clientes_import;
CREATE TEMP TABLE _clientes_import (
  id integer, tipo_cliente varchar(20), compania varchar(50), rnc varchar(20),
  razon_social varchar(200), nombre_comercial varchar(200), responsable varchar(200),
  identificacion varchar(20), nombre_completo varchar(200), sexo varchar(20), sexo_was_blank boolean,
  fecha_nacimiento date, telefonos varchar(200), email varchar(200), direccion text,
  observacion text, referido_por varchar(200), registrado_por varchar(200),
  status varchar(20), estado_registro varchar(20), pais varchar(100)
);
INSERT INTO _clientes_import ({db_columns_csv}) VALUES
{values_block};
{guard_ddl}
{guard_rows}
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;

-- G6: capture JROSA's (id=15) non-sheet columns before any write touches clientes.
DROP TABLE IF EXISTS pg_temp._jrosa_preserva;
CREATE TEMP TABLE _jrosa_preserva AS SELECT {preserve_csv} FROM clientes WHERE id = 15;
DO $$ BEGIN IF (SELECT count(*) FROM _jrosa_preserva) <> 1 THEN
  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', (SELECT count(*) FROM _jrosa_preserva); END IF; END $$;

-- Insert the 1,229 sheet rows that are neither 15 nor {JROSA_ID}.
INSERT INTO clientes ({plain_cols}) SELECT {plain_cols} FROM _clientes_import WHERE id NOT IN (15, {JROSA_ID});

-- Insert sheet row {JROSA_ID} (JROSA), merging sheet columns with the preserved columns.
-- clientes is never UPDATEd anywhere in this file, so trigger_update_clientes_fecha_editado cannot fire for this row.
INSERT INTO clientes ({jrosa_cols})
SELECT {jrosa_select} FROM _clientes_import s CROSS JOIN _jrosa_preserva p WHERE s.id = {JROSA_ID};

-- Repoint the one live reserva BEFORE the delete (fk_reservas_cliente ON DELETE SET NULL never fires).
UPDATE reservas SET cliente_id = {JROSA_ID} WHERE id = 10;

-- Delete the old id=15 row (now unreferenced by any reserva).
DELETE FROM clientes WHERE id = 15;

-- Insert the sheet's own row 15 (MELISSA), now that the id is free.
INSERT INTO clientes ({plain_cols}) SELECT {plain_cols} FROM _clientes_import WHERE id = 15;

-- Advance the sequence past 1240 (belt-and-braces; app write paths compute MAX(id)+1 client-side).
SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT max(id) FROM clientes), true);

-- Post-condition assertions; any failure raises and aborts everything.
{post_ddl}
{post_rows}
DO $$ DECLARE v int; BEGIN SELECT count(*) INTO v FROM _post_checks WHERE expected <> actual;
  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;

COMMIT;
"""

def main():
    if not os.path.isfile(SOURCE_PATH):
        sys.exit(f"ABORT: pinned source not found at {SOURCE_PATH}")
    with open(SOURCE_PATH, "rb") as f:
        data = f.read()
    sha256 = hashlib.sha256(data).hexdigest()
    md5 = hashlib.md5(data).hexdigest()
    if sha256 != EXPECTED_SHA256 or md5 != EXPECTED_MD5:
        sys.exit(f"ABORT: workbook hash mismatch. expected sha256={EXPECTED_SHA256} md5={EXPECTED_MD5}; "
                  f"actual sha256={sha256} md5={md5}")
    rows = load_sheet(SOURCE_PATH, "clientes")
    idx = {h: i for i, h in enumerate(rows[0])}
    data_rows = rows[1:]
    if len(data_rows) != EXPECTED_ROW_COUNT:
        sys.exit(f"ABORT: expected {EXPECTED_ROW_COUNT} data rows, found {len(data_rows)}")
    mapped, flag_counts = [], {}
    for r in data_rows:
        out, flags = transform(r, idx)
        mapped.append(out)
        for k, v in flags.items():
            if v:
                flag_counts[k] = flag_counts.get(k, 0) + 1
        # generator-time invariant: every backfilled cell is exactly 'N/A' —
        # no invented phone/email/address/name is ever possible by construction.
        for k, was_backfilled in flags.items():
            if was_backfilled and out[k] != "N/A":
                sys.exit(f"ABORT: internal invariant broken — id {out['id']} field {k} backfilled to {out[k]!r}, not 'N/A'")
    max_len, overflow = check_overflow(mapped)
    if overflow:
        sys.exit("ABORT (HC-1): the following values exceed their live column length — "
                  "human ruling required, truncation forbidden:\n" +
                  "\n".join(f"  id={i} col={c} len={n} limit={lim}" for i, c, n, lim in overflow))
    dup_iden = find_duplicates(mapped, "identificacion")
    dirty_email_count = count_dirty_emails(mapped)
    expected_ids = sorted(set(range(1, 1241)) - EXPECTED_ID_GAPS)
    values_lines = build_values_lines(mapped)
    payload_sha256 = hashlib.sha256("\n".join(values_lines).encode("utf-8")).hexdigest()
    checks = build_checks(mapped, max_len, dup_iden, dirty_email_count, expected_ids)
    sql_text = render_sql(mapped, checks, values_lines, max_len, dup_iden, payload_sha256)
    with open(OUTPUT_PATH, "w", encoding="utf-8", newline="\n") as f:
        f.write(sql_text)
    print(f"OK: wrote {OUTPUT_PATH}")
    print(f"  rows staged: {len(mapped)} (expected {EXPECTED_ROW_COUNT})")
    print(f"  id set matches expected: {sorted(r['id'] for r in mapped) == expected_ids}")
    print(f"  backfill counts: {flag_counts}")
    print(f"  duplicate identificacion values: {dup_iden}")
    print(f"  dirty email count: {dirty_email_count}")
    print(f"  max lengths vs limits: {max_len}")
    print(f"  payload-sha256: {payload_sha256}")
    print(f"  output sha256: {hashlib.sha256(sql_text.encode('utf-8')).hexdigest()}")

    post_checks = build_post_checks(checks, expected_ids)
    exec_sql_text = render_execute_sql(checks, post_checks, values_lines, payload_sha256)
    with open(OUTPUT_PATH_04, "w", encoding="utf-8", newline="\n") as f:
        f.write(exec_sql_text)
    print(f"OK: wrote {OUTPUT_PATH_04}")
    print(f"  guard checks: {len(checks)}, post-checks: {len(post_checks)}")
    print(f"  execute output sha256: {hashlib.sha256(exec_sql_text.encode('utf-8')).hexdigest()}")

if __name__ == "__main__":
    main()
