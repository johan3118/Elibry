# t01 — Lead decision record

**Decision: A — APPROVE**

(Authored by the lead agent; persisted to disk by a junior-dev scribe per the standing project rule that the lead does not author per-task record files itself.)

**Task:** T1 — Live preflight (7 verification questions against the live DB, read-only)

**What shipped:** T1's dev report (`reports/t01-dev.md`) captures live, verbatim Postgres introspection evidence for all 7 required questions (Q1 constraint inventory, Q2 row counts vs client id=15, Q3 FK+trigger set, Q4 full 35-column shape, Q5 index/unique inventory, Q6 sequence+audit-trigger check, Q7 workbook hash-and-pin), plus the two plan-mandated meta-ACs (AC8 PII-free self-attest, AC9 rollback note). Every query is shown with its SQL text, captured JSON output, and a per-call boundary/liveness token. QA (`reports/t01-qa.md`) independently re-derived several cross-checks from the same evidence (Q1 vs Q5 zero-unique-constraint agreement, Q3 vs Q6 trigger-dump agreement, Q4's 35-row table matching its own header claim) and ran its own greps for scope/PII/secrets. Verdict: PASS, all 9 plan ACs individually confirmed against plan lines 354–380.

**Hard-gate check (all clear for this task type — read-only DB introspection, zero code/DDL):**
- Real diff / real evidence: satisfied — verbatim captured query output + boundary tokens, not summarized.
- Tests/lint/typecheck run: `npm run qa` correctly marked N/A by QA, with proof (zero files changed under `app/lib/components/hooks/tests/scripts` per `git status --short`) — not a fabricated pass, not a silent skip.
- No new table / RLS: N/A — ADR 0011 (single-tenant, no RLS), no DDL run, correctly noted by both dev and QA.
- No RLS weakened: N/A, nothing touched.
- Rollback note: present — "read-only, zero writes, zero DDL, nothing to revert, no git verb applies" (AC9).
- No AC marked FAIL: confirmed — all 9 ACs PASS.
- Out-of-scope files: none — QA verified via `git status --short` diff-from-session-start and a directory listing; only `reports/t01-dev.md` + `scratchpad.md` (declared scope) changed.
- Optimistic UI: N/A, no UI code touched.
- Auth/payment/destructive DB op not in plan: none — zero writes, zero DDL.

**On QA's disclosed residual limitation:** QA (credential-less) cannot independently re-run the live SELECTs and states plainly it cannot rule out a wholesale-fabricated transcript — it substituted rigorous internal-consistency cross-checks across independently-queried catalogs (pg_constraint vs pg_indexes, Q3's unfiltered trigger dump vs Q6's targeted one) instead. This is disclosed, not hidden, explicitly does not block PASS per QA's own statement, and is consistent with the plan's channel note (psql/SQL editor is the dev's channel; nothing in the plan requires QA to hold live DB credentials). Not a hard-gate violation.

**Two new findings surfaced (correctly flagged as findings, not defects, not scope creep):**
1. HC-2 correction: `audit_clientes` trigger does not exist live — the sprint brief's assumption of "~1,232 new auditoria rows" is wrong; actual auditoria/audit_logs impact from the clientes-side import is zero. Dev did not act on this (out of scope for T1); correctly carried into the scratchpad handoff for T2/T3/T4.
2. Pre-existing dangling `cambios_provisionales` row (`id=69`, `registro_id=15`, `tabla_afectada='clientes'`, `estado_cambio='PENDIENTE'`) predates this sprint. Not resolved in T1 (correctly out of scope); flagged for T3's runbook/backlog.

Both are read-only discoveries, PII-free, and were correctly threaded through the scratchpad (§2 t01 handoff, §3 close queue) for downstream tasks to consume — no scope violation.

**Escalation checks:** Q5's UNIQUE-constraint escalation trigger (identificacion/rnc/email) was checked and did NOT fire — no escalation needed, duplicate-identificacion design remains viable.

**Human rulings correctly inherited:** the pais amendment (accented `'República Dominicana'`, not the plan's original `'REPUBLICA DOMINICANA'`) and the HC-5 workbook pin (`docs/migracion-clientes.xlsx`, sha256 `6a0eb818...5d3e2c8`) are both folded into the dev report's closing summary and the scratchpad handoff for T2 to consume.

**Conclusion:** No hard gate violated. QA verdict PASS is well-supported by evidence and by QA's own independent cross-checks. T1 is APPROVED — proceed to T2.
