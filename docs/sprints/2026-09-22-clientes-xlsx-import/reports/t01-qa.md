# T1 — QA report (Live preflight)

**Task nature:** DB-introspection-only, read-only against live Postgres. No app/lib/component/hook/test/scripts file is in scope. Reviewer (this QA agent) has **no live DB credentials** — this review audits the dev report's internal evidence consistency and completeness, and the repo's scope/redaction discipline, per the task brief. It does **not** independently re-run the live SELECTs.

Verdict: PASS

---

## Commands run

```
$ git status --short
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
```
Identical to the conversation-start snapshot — nothing new was introduced at the top level by t01 beyond what t00 (architect) had already staged.

```
$ find docs/sprints/2026-09-22-clientes-xlsx-import -type f | sort
docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md
```
Exactly the two files the plan declares as T1's scope ("Files in scope: `reports/t01-dev.md` (+ `t01-qa.md`)" — this QA report is the `+`).

```
$ for d in app lib components hooks tests scripts; do echo "$d: $(git status --short -- $d | wc -l) changed entries"; done
app: 0 changed entries
lib: 0 changed entries
components: 0 changed entries
hooks: 0 changed entries
tests: 0 changed entries
scripts: 0 changed entries
```

```
$ ls docs/migracion/
01-cleanup-dry-run.sql   02-cleanup-execute.sql   README-cleanup.md
migracion-clientes.xlsx  migracion-productos.xlsx
```
All timestamps predate this session (Sep 22 07:25–08:37 or Aug 17) — no new file was dropped in the protected `docs/migracion/` directory by t01.

```
$ grep -nEi "eyJ[A-Za-z0-9_-]{10,}|supabase\.co|postgres(ql)?://|service_role|SUPABASE_SERVICE" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
(no output, exit 1 — zero matches)

$ grep -nEi "[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
(no output, exit 1 — zero matches)

$ grep -nE "[0-9]{9,}" docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
69:Boundary: `8311045be887634204c290a7374ac118`
313:...(`<CEDULA-A>` and `<CEDULA-B>`)...
323:Boundary: `1b0cb6563326210e6080ca6e32601504`
362:MD5 (docs/migracion/migracion-clientes.xlsx) = e6fca844ab79529551195597156a6a7b
367:...md5 `e6fca844ab79529551195597156a6a7b`...
396:...(`<CEDULA-A>`, `<CEDULA-B>`)...
```
Only the two pre-cleared `identificacion` values, hex boundary tokens, and file hashes/md5s match a 9+-digit pattern. No email, no phone-shaped number, no other client identifier.

```
$ grep -n "Boundary" reports/t01-dev.md | wc -l
15
$ awk '/^\| # \|/,/^Q5/' reports/t01-dev.md | grep -cE '^\| [0-9]+ \|'
35
```
15 distinct query blocks each carry their own boundary token (no reused/copy-pasted token detected by inspection); the Q4 column table enumerates exactly 35 rows, matching its own "35 columns" claim.

```
$ sed -n '1,20p' package.json | grep -A3 '"qa"'
"qa": "npm run typecheck && npm run lint && npm run test"
```

**`npm run qa` (tsc/eslint/vitest): NOT RUN — explicitly N/A for this task.** Confirmed via the scope check above that zero files under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/` were touched by t01; the only diffs are two docs files inside the sprint's own `reports/`/scratchpad scope. Per this task's own brief, running the suite here would be "a run against nothing" — I am stating this explicitly rather than fabricating a pass or silently skipping the gate. (Pre-existing repo state — e.g. the already-modified `CLAUDE.md` from before this session — is out of t01's scope and not this report's concern.)

**Live DB re-verification: COULD NOT RUN — no live Supabase/Postgres credentials available to this QA agent.** Per the task brief this is expected; the review below substitutes internal-consistency and completeness auditing of the dev's captured evidence for a live re-run.

---

## Acceptance criteria (plan lines 354–380)

1. **Q1 — full constraint inventory** — PASS. `pg_constraint` dump (6 rows: 5 CHECK + 1 PK) and `information_schema.columns` NOT-NULL dump (8 columns) are both quoted verbatim as JSON, each with its own SQL text and boundary token, plus a PRESENT/ABSENT/MODIFIED verdict table cross-referenced against `scripts/005-update-clientes-structure.sql`. Not paraphrased — real constraint definition strings (Postgres-canonicalized `= ANY(ARRAY[...])` form) are shown.
2. **Q2 — row counts referencing id=15** — PASS. `to_regclass` existence check run first for all 5 tables (all true), followed by a column-shape discovery query (correctly caught that the plan's assumed `cliente_id`/`registro_id` naming doesn't hold uniformly), then the final count query with real JSON output. Zero is explicitly stated for 4 of 5 counts; the one nonzero (`cambios_provisionales`, `registro_id=15` → 1) is flagged as a new finding, not glossed over.
3. **Q3 — FK + trigger list** — PASS. FK quoted with `conname`, `confupdtype='a'`, `confdeltype='n'`, `condeferrable=false`, `condeferred=false`, and full `pg_get_constraintdef` text (`ON DELETE SET NULL`). Trigger dump lists all 3 live triggers across both tables with `pg_get_triggerdef` text. The required one-sentence verdict on the insert-then-delete design making the `fecha_editado` tension moot is present and explicitly grounded in the trigger dump (no BEFORE INSERT trigger on `clientes`).
4. **Q4 — complete column list** — PASS. 35-column `information_schema.columns` dump reproduced in full as a table (verified independently above: table has exactly 35 numbered rows). All 8 named columns (`pais`, `estado_registro`, `usuario_creacion`, `fecha_provisional`, `documentos_urls`, `imagen_url`, `cedula_pasaporte`, `dependencias_ids`) are individually confirmed or refuted; `cedula_pasaporte` is correctly flagged REFUTED with the nearest real columns named.
5. **Q5 — index/unique inventory + escalation check** — PASS, and independently sanity-checked (see below): `pg_indexes` dump lists all 10 live indexes verbatim; only `clientes_pkey` says `CREATE UNIQUE INDEX`, the other 9 (including `idx_clientes_identificacion`, `idx_clientes_rnc`, `idx_clientes_email`) say plain `CREATE INDEX`. Cross-referencing Q1's `pg_constraint` dump confirms zero `contype='u'` rows. The two data sources are mutually consistent, so "NO ESCALATION" is not a bare assertion — it is corroborated by two independently-queried system catalogs shown in the same report.
6. **Q6 — sequence + audit trigger check** — PASS. `pg_get_serial_sequence` returns `public.clientes_id_seq`; `auditoria`/`audit_logs` existence both true; a targeted `pg_trigger ... tgname ILIKE '%audit%'` query on `clientes` returns `[]`, which is independently corroborated by Q3's unfiltered, exhaustive 3-row trigger dump (which lists no audit trigger on `clientes` either). Two independent queries, consistent result.
7. **Q7 — workbook pin** — PASS. Both candidate files hashed with both `shasum -a 256` and `md5`, real command+output pairs shown, row-counted via raw `xl/worksheets/sheet1.xml` structure (not cell values — stays PII-free), exactly one file pinned by path with its hash recorded.
8. **AC8 — PII-free** — PASS. Independently grep-verified above: no key/connection-string pattern, no email pattern, and the only 9+-digit strings in the file are the two explicitly pre-cleared `identificacion` values, boundary hex tokens, and file hashes. The report's self-attestation matches what is actually in the file.
9. **AC9 — rollback note** — PASS. States read-only/zero-writes/zero-DDL, "nothing to revert; no git verb applies" — correctly contains no destructive git verb, consistent with the sprint's `destructive-op-named-in-rollback-note` rule.

---

## Out-of-scope changes

None. Verified via `git status --short` (unchanged from the conversation-start snapshot) and a direct file listing of the sprint directory: only `reports/t01-dev.md` and `scratchpad.md` exist under `docs/sprints/2026-09-22-clientes-xlsx-import/`. Zero changes in `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`, or `docs/migracion/`. The pre-existing `CLAUDE.md` modification and other untracked files (`.DS_Store`, `.claude/rules/context-budget.md`, `docs/migracion-clientes.xlsx`, `docs/plans/clientes-xlsx-import.md`) all predate this task (present in the session's opening git snapshot, produced by t00/earlier setup, not by t01).

## RLS / org isolation

N/A — read-only introspection task, no table created, no row written, no DDL executed. Per ADR 0011 (single-tenant, no RLS by design), this task doesn't touch the isolation posture at all; the dev report itself notes zero `CREATE POLICY`/`ROW LEVEL SECURITY`/`GRANT`/`ALTER TABLE` statements were run (all queries shown are `SELECT`-only, consistent with the plan's "DB/isolation: read-only. Zero writes. No DDL." requirement).

## Disclosed corrections (informational — not defects)

Both flagged clearly, not buried:
- Q3/Q6: the sprint brief's HC-2 assumption ("~1,232 new `auditoria` rows via `audit_clientes`") is corrected — no `audit_clientes` trigger exists live; the report calls this out explicitly under its own "Additional finding" heading and again in the closing "Summary of load-bearing findings" list (item 4), and the scratchpad §2 t01 handoff repeats it under its own bullet ("Q6 correction to HC-2").
- Q2: the dangling `cambios_provisionales` row (`id=69`, `registro_id=15`) is flagged under its own "Finding requiring T2/T3 awareness" heading, explicitly marked out-of-scope/not-resolved-here, and repeated in both the closing summary (item 5) and the scratchpad handoff.
- Both are framed as new facts discovered during T1's own read-only work, not as failures of T1's task — correctly scoped.

## Scratchpad checks

- §1 ledger t01 row exists (`status: done`, `dev report: reports/t01-dev.md`); qa/verdict columns were blank pending this review — now updated below.
- §2 t01 handoff is present, non-empty, and correctly carries forward the pais-amendment ruling ("imported `pais` must be the literal `'República Dominicana'`... NOT `'REPUBLICA DOMINICANA'`") for T2/T3/T4 to consume, plus all six Q-level findings summarized concisely.
- §3 close queue also carries a matching one-line note on the `pais` divergence — consistent, no contradiction between §2 and §3.

## Residual limitation (does not block PASS, noted for the record)

This QA pass has no way to detect a wholesale-fabricated transcript — the "boundary" liveness tokens are self-generated by the same process that would have to fabricate the answers, so they prove liveness to nobody but the original operator. What this review *can* and did check — cross-catalog internal consistency (Q1 vs Q5 zero-unique-constraint agreement; Q3 vs Q6 trigger-dump agreement; Q4's row count matching its own header claim), correct use of Postgres catalog semantics (`confupdtype`/`confdeltype` codes, `is_identity` vs `SERIAL`), and completeness against every plan AC — all pass with no contradiction found anywhere in the document. Treat this as the ceiling of what a credential-less review can establish, not proof of live execution.

---

Bugs found: none.

Suggested fixes: none — the report meets every plan AC with real, internally-consistent, cross-corroborated evidence, stays inside its declared file scope, and contains no PII/secrets beyond the two pre-cleared identificacion values.

Verdict: PASS
