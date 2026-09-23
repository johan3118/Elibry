# Sprint summary — clientes-xlsx-import (2026-09-22)

## 1. What shipped, with evidence (highest round per task)

| Task | Verdict | Highest-round reports |
|---|---|---|
| T1 — live preflight | PASS | `reports/t01-dev.md`, `reports/t01-qa.md`, `reports/t01-lead.md` |
| T2 — generator + `03` dry-run SQL | PASS (round 4; 3 send-backs) | `reports/t02-dev-r4.md`, `reports/t02-qa-r4.md`, `reports/t02-lead-r4.md` |
| T3 — live dry run | PASS (round 3; 2 send-backs) | `reports/t03-dev-r3.md`, `reports/t03-qa-r3.md`, `reports/t03-lead-r3.md` |
| T4 — `04` execute SQL | PASS (round 2; 1 architect escalation → Amendment A) | `reports/t04-dev-r2.md`, `reports/t04-qa-r2.md`, `reports/t04-lead-r2.md` |
| T5 — guard firing | PASS | `reports/t05-dev.md`, `reports/t05-qa.md`, `reports/t05-lead.md` |
| T6 — operator runbook | PASS (round 3; process-integrity incident, §3b) | `reports/t06-dev-r3.md`, `reports/t06-qa-r3.md`, `reports/t06-lead-r3.md` |
| T7 — `README-cleanup.md` stale-claim fix | PASS (round 2; 1 send-back) | `reports/t07-dev-r2.md`, `reports/t07-qa-r2.md`, `reports/t07-lead-r2.md` |
| T8 — sprint-wide audit | PASS | `reports/t08-dev.md`, `reports/t08-qa.md`, `reports/t08-lead.md` |
| T9 — PII redaction (human-authorized mid-sprint) | PASS | `reports/t09-dev.md`, `reports/t09-qa.md`, `reports/t09-lead.md` |

Earlier-round reports are the send-back trail, superseded by the rounds above.

**Deferred:** none of the plan's own tasks — all nine shipped. What is deferred is the import itself (§2) and the follow-ups in §3/§4.

**Rollback path:** Nothing was written to the database — there is nothing to unwind there. Repo-level: delete the four new files (`docs/migracion/generate-clientes-import.py`, `docs/migracion/03-clientes-import-dry-run.sql`, `docs/migracion/04-clientes-import-execute.sql`, `docs/migracion/README-clientes-import.md`) and restore `README-cleanup.md`'s two edited spans from the original text quoted in `reports/t07-dev-r2.md`. Every sprint file is untracked, so no repository history needs unwinding.

## 2. THE SINGLE MOST IMPORTANT THING — THE IMPORT HAS NOT BEEN RUN

**`clientes` still holds exactly 1 row (id=15, JROSA). `reservas` still has exactly 1 row, pointing at `cliente_id=15`. `pagos` is empty. This sprint wrote nothing to the database.** What exists is a verified artifact set, not a completed import.

**PROVEN:**
- `03-clientes-import-dry-run.sql` runs live clean: 42/42 checks PASS, verdict PROCEED.
- Generator determinism (byte-identical regeneration, confirmed independently at T2, T4 and T8).
- Guard byte-parity: 42/42 identical between `03` and `04` (`weak-backstop-guard`), re-proven after the T4-round-2 docstring edit.
- Full statement inventory on `04` (3 `INSERT INTO clientes`, 1 `UPDATE`, 1 `DELETE`, DDL confined to `CREATE TEMP TABLE`, zero forbidden tokens outside the deliberate read-only `pagos` guards).
- Three real guards fired live at T5 (2 of the 42 pre-write guards + 1 of the 33 post-checks) and observed to actually abort, including the abort-everything transaction property.
- Read-only preserved throughout every task that touched the live DB (T1, T3, T5, T8) — row counts identical before and after every session.
- `npm run qa` green: 825/825 tests, 0 lint errors, clean `tsc`, re-run and re-confirmed at T8 and T9.

**NOT PROVEN, and unprovable without the human running it:**
- `04-clientes-import-execute.sql` has never been executed end-to-end by anyone.
- Only 2 of its 42 pre-write guards and 1 of its 33 post-checks were individually rehearsed live — the shared abort mechanism they all route through WAS proven, but the other 39 guards and 32 post-checks were validated only for syntax and type, not fired.
- Whatever `reports/t04-dev-r2.md` §8e disclosed as unprovable offline (the `Post_*` predicates that can only read pre-migration state until a real run happens) remains exactly as disclosed there.

## 3. The three incidents — recorded honestly

**(a) Three generated-SQL defects escaped Python-side verification and surfaced only on live execution.** A `sql_identifier[]` vs `text[]` type-comparison error; a `NOT ... ::text` operator-precedence bug (`::` binds tighter than `NOT`); and an NBSP-vs-`btrim()` mismatch in the dirty-email count. Each cost a full T2/T3 send-back cycle (3 cycles total). The fix was making a live full-file smoke run a mandatory pre-submission gate for T2, which then caught the third defect itself before T3 even started.

**(b) The T6 duplicate-dispatch incident (orchestrator error).** The orchestrator read a lower round number's reports, believed T6 was still at an earlier stage, and dispatched a duplicate round against work that was already approved. The dev that picked it up found the repo already in the post-approval state and overwrote the already-approved evidence file `reports/t06-dev-r2.md`; its original content is unrecoverable. Resolved forward via a genuine round 3 (independent re-derivation of every §10 figure from the raw payload a third time) rather than by reconstructing destroyed evidence. Recorded as an orchestrator process error, not a dev or QA failure.

**(c) Real client PII leaked into 12 report files (found by T8, fixed by T9).** Two real cédula (`identificacion`) values and several client email addresses leaked into reports across T1, T2, T3 and T6. Root cause: the orchestrator's own delegation prompts declared those two values "pre-cleared as non-secret," and every dev and QA agent correctly followed the instruction they were given. T8's sprint-wide audit found it — every earlier per-task sweep had checked email-shape, key and connection-string patterns but never bare numeric identifiers. T9, on explicit human authorization, redacted all 12 files to sentinels (`<CEDULA-A>`, `<CEDULA-B>`, `<CLIENT-EMAIL-n>`), independently re-verified by T9's QA with its own from-scratch sweeps. Note: the two real values legitimately remain inside the two hash-pinned `.sql` payload files — that is the actual import data, by design, and is unavoidable — and are also embedded verbatim in some SQL check-*name* identifiers there (a T2 generator design choice). That matters only if those `.sql` files are shared outside a trusted circle.

## 4. What the human must do to actually run the import

Read `docs/migracion/README-clientes-import.md` in full first. The load-bearing preconditions:
- **Take a backup first.** After a successful `COMMIT`, restoring that backup is the only undo, and that is irreversible against anything written to production after the backup was taken.
- **Freeze client creation** between running the dry run and running the execute script — a client created in the app in that window takes an id the sheet also owns (both write paths compute `MAX(id)+1`), and the execute script would abort (safely) on the conflict.
- **Use the Supabase SQL editor or `psql`, NOT `supabase db query`** — that channel cannot execute a multi-statement file. Discovered live during T3; the runbook names the working channels explicitly.
- Disclosed, accepted side effects the operator should expect and not mistake for damage: **zero new `auditoria` rows from the clientes side — T1 proved live that no `audit_clientes` trigger exists, correcting the plan's original HC-2 assumption; the only audit side effect is a single `audit_reservas` row from the one reserva repoint, plus a rewritten `reservas.fecha_editado` on that same row**; 15 rows landing with `nombre_completo = 'N/A'` and 229 with `responsable = 'N/A'` (the frozen "backfill, do not drop" ruling); and **`pais` imported as the accented literal `'República Dominicana'`, matching what the app itself writes — this was the human's HC-4 ruling, which overrode the spec's original unaccented `'REPUBLICA DOMINICANA'`**.

## 5. State entry

The state entry for this sprint was written by the lead directly to `MEMORY/project_sprint_state.md` (entry `### 2026-09-22 — clientes-xlsx-import`, 64 lines, placed before the "Remaining backlog" section), and the file's `as of` line was updated from 2026-08-18 to 2026-09-23. It is not duplicated here.

**Follow-ups flagged, not fixed:**
- The dangling `cambios_provisionales` row id=69 (PENDIENTE, references `registro_id=15`) will point at a different client after relocation.
- `03`'s known cosmetic header staleness (a stale "Companion (future tasks, not yet generated)" comment — harmless, hash-neutral, deliberately not fixed because changing `03`'s bytes would void its live-verified run).
- The 644 problem emails (599 placeholder `'N/A'` + 45 malformed) that will trip the edit form's validation once the import runs.
- The outstanding Supabase credential rotation — pre-existing, unrelated to this sprint, but the largest standing risk in the repo.
- `MEMORY/project_sprint_state.md` never received the preceding `db-cleanup-decisions-amend` sprint's entry — that backfill is still open.
