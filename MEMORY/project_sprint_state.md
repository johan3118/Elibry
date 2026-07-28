# Elibry — Project Sprint State
# as of 2026-07-27

---

## Completed sprints

### 2026-07-27 — geb-documents-real-data (T1–T16, wave 1 + wave 2 + T16 uncommitted)

**Plan:** `docs/plans/geb-documents-real-data.md` · **Slug:** `geb-documents-real-data`
**Commits:** `32e892b` "wave 1" (T1–T9) · `b3b22fd` "wave 2" (T10–T15) · **T16 is uncommitted** as of this entry.

#### 1. What shipped (user-facing)

Both fiscal-adjacent documents stopped being decorated placeholders and now render from real, validated data:

- **CONFIRMACIÓN DE SERVICIOS** (`/facturacion/proforma`): real client address, real passenger list (persisted), real totals (Σ `reserva_detalles`, no synthetic single-line fallback), `FACTURA #` looked up live and BLOCKS the document rather than rendering blank/fake when the lookup fails (HC-2), `BALANCE RESERVA`/`BALANCE GENERAL` computed by the same formula as `/clientes/balance` with silent-but-persisted discrepancy logging when the two bases disagree (HC-3), the four OQ2 policy paragraphs now render verbatim and are no longer user-editable, and every free-text field is HTML-escaped by default (HC-5) so a client name containing `<script>` renders literally instead of executing.
- **VOUCHER**: real, persisted `localizador` (no more random-number-never-saved), a repeatable room/occupancy-group editor (persisted, with a rebuilt passenger→room link on every save — HC-4), real hotel address/phone (fixing a legacy swap where the client's address and the agency's phone were printed instead), real régimen/pax breakdown, derived `noches`, and a **structurally money-free** voucher document (compile-time guarantee, `VoucherDocData` cannot carry an amount) with the same HC-5 escaping.
- Both documents' `.docx` fidelity was independently re-verified against the source files (T10 for CONFIRMACIÓN, T16 for VOUCHER), with source typos and quirks (`WHATAPP`, `OBERSACIONES`) deliberately reproduced and flagged in code comments rather than "helpfully" corrected.
- Two new RLS-protected tables (`reserva_pasajeros`, `reserva_ocupaciones`) plus five additive, nullable `reservas` columns, all reached exclusively through `"use server"` service-role actions (Elibry's browser client is unauthenticated `anon` — see Deferred/HC-1 below).

#### 2. Evidence (one line per task — gate command per plan §10 is `npm run qa`; DoD requires real diff + real command output + rollback note on every task)

- **T1** PASS (static review, 3 rounds) — `scripts/061` migration + RLS: table shape, `rowsecurity=true`, anon-probe (8/8 rejected) all verified by inspection/dump, `npm run qa` green.
- **T2** PASS (4 rounds) — server-action data layer for passengers/occupancies, offline + mutation-checked, `npm run qa` green.
- **T2b** PASS (2 rounds) — HC-4 re-link rule, mutation set M1–M6 RED→GREEN, `npm run qa` green.
- **T3** PASS (2 rounds) — proforma byte-freeze snapshot gate, `npm run qa` green.
- **T4** PASS — 3 finance helpers pinned to `/clientes/balance`'s formula, mutation-checked, `npm run qa` green.
- **T5** PASS — `ConfirmacionData` builder + HC-3 discrepancy logging to `auditoria` (exactly 1 row on mismatch, 0 on match), `npm run qa` green.
- **T6** PASS — `generateConfirmacionHTML` added, legacy `generateProformaHTML` byte-identical, `npm run qa` green.
- **T6b** PASS (HC-5) — `lib/html-escape.ts` tagged-template escaping shipped and applied to `generateConfirmacionHTML`; hostile fixture + accent-preservation mutation-checked (M7–M10 RED→GREEN), `npm run qa` green.
- **T7** PASS (2 rounds) — `FACTURA #` read-only lookup, BLOCKS with two distinct named messages on any failure (HC-2), `npm run qa` green.
- **T8** PASS (2 rounds) — `/facturacion/proforma` repointed to real data + `generateConfirmacionHTML`; HC-5 end-to-end `<script>` fixture evidenced; field-by-field manual walk; `npm run qa` green.
- **T9** PASS — `applyEditableProformaData` + old `escapeHtml` + policy-edit UI retired; re-ran `tests/confirmacion-html.test.ts` green before deleting (HC-5 precondition honored); `npm run qa` green.
- **T10** PASS (static) — CONFIRMACIÓN GEB.docx fidelity walk, all three known drifts named (WHATAPP, `<small>TITULAR>` orphan, BALANCE placement), `npm run qa` green.
- **T11** PASS (2 rounds) — `scripts/062` additive nullable `reservas` columns, no defaults, `npm run qa` green.
- **T12** PASS (2 rounds) — voucher server actions, `!== undefined` write guard mutation-checked, T2b's M1–M6 re-verified RED, anon-probe re-run, `npm run qa` green.
- **T13** PASS (2 rounds) — money-free `VoucherDocData` + builder, compile-time `@ts-expect-error` guarantee + provenance check (Risk R13), `npm run qa` green.
- **T14** PASS (blocked once on a genuine fork — Amended 4 sequencing call — then 1 round) — `generateVoucherDocHTML` added alongside untouched legacy `generateVoucherHTML`; `npx tsc --noEmit` proved the in-place rewrite would break `voucher/page.tsx:305/:358`, forcing the add-alongside split; all mutations RED→GREEN; `npm run qa` green including typecheck.
- **T15** PASS (1 round + a fix pass) — `/facturacion/voucher` wired to real data; legacy `generateVoucherHTML`/`VoucherData` retired in-task (grep-evidenced zero remaining references); HC-4 re-link outcome surfaced on screen; `npm run qa` green.
- **T16** PASS (2 rounds) — VOUCHER GEB-2.docx fidelity + money-leak proof. Round 1 FAILED on evidence only (two of three content fixes had zero test coverage, a false claim that reverting them would go RED, plus placeholder "full output" text and a wrong F6). Round 2: two new mutation-checked assertions added, code comment added flagging the OBERSACIONES typo, F6 corrected, real output pasted. QA independently re-ran the mutations from a clean copy (label-only revert → 2/61 RED; order-only revert → exactly 1/61 RED), invented and ran a third mutation (novel misspelling "OBSERVACIONNES") to rule out a tautological assertion (2/61 RED), re-extracted the `.docx` from scratch confirming F6's correction, verified the 496→498 test-count delta by stashing to baseline, ran its own money-leak and proforma-snapshot corruption/restore checks, confirmed via full-file diff against `b3b22fd` that both hunks are scoped entirely inside `generateVoucherDocHTML`. `npm run qa` green twice cold-cache: 23 files / 498 tests. **APPROVED** (see decision detail below). One process caveat raised (not a gate failure): the plan's T16 scope line names `tests/voucher-data.test.ts`, but the coverage lives in `tests/voucher-html.test.ts` (where every other `generateVoucherDocHTML` assertion already lives, per T14) — a stale filename in the plan, not a scope violation by the dev.

Two tasks were created mid-sprint because QA found gaps nobody had planned: **T2b** (HC-4, passenger/occupancy orphaning) and **T6b** (HC-5, missing HTML escaping).

**T16 decision (this entry, Part 1 of this consolidation):** APPROVE. Driving finding: QA's round-2 verification independently reproduced both discriminating mutations from a clean file copy (label-only revert → 2/61 RED; order-only revert → exactly 1/61 RED with the label assertion correctly staying GREEN), invented and ran a third, non-tautology-checking mutation, re-extracted the `.docx` from scratch to confirm the corrected F6 finding, and confirmed via full-file diff against `b3b22fd` that both hunks are scoped entirely inside `generateVoucherDocHTML` — real diff, real command output, no scope violation, rollback note present, no HARD GATE violated. Verdict string: `T16 — VOUCHER GEB-2.docx fidelity + money-leak proof — ROUND 2 — VERDICT: PASS — LEAD DECISION: APPROVE`.

#### 3. Deferred / unverified — stated bluntly

- `scripts/061`, `062`, `063` have **never been applied to any database**. Every RLS claim, every constraint claim, every anon-probe claim is designed and unit-tested, not run against Postgres.
- The production `comprobantes_fiscales` schema is still unknown. If it lacks `reserva_id` or `numero_factura`, **no CONFIRMACIÓN generates at all** — Risk R3, by design, not a bug.
- `scripts/061` requires Postgres 15+ (`ON DELETE SET NULL (col)`). On PG14 it now fails atomically thanks to its BEGIN/COMMIT wrapper, but the version has never been checked.
- T15's AC-1 (localizador survives a reload) and AC-13 (field-by-field walk against a real reserva) **could not be run** — no credentials.
- RLS is statically reviewed, never probed against a live database.
- **HC-1 stands unfixed and human-acknowledged: Elibry has NO authentication.** `lib/user-context.tsx` is a hardcoded array in `localStorage`, there is zero `supabase.auth` usage, the browser runs as PostgREST `anon`, and not one of the ~29 pre-existing tables has RLS. Anyone with the public anon key can read and write `clientes`, `reservas`, `pagos` and `comprobantes_fiscales` directly. **This sprint did not fix that and was never scoped to.**

#### 4. Rollback path (whole sprint)

- **T16** (uncommitted): `git checkout b3b22fd -- lib/document-generator.tsx tests/voucher-html.test.ts docs/plans/geb-documents-real-data.md`.
- **Wave 2** (T10–T15, commit `b3b22fd`): revert the commit to return to wave-1 state (post-T9). Each task within it also carries its own one-line rollback note per the plan's DoD.
- **Wave 1** (T1–T9, commit `32e892b`): revert to pre-sprint baseline. DB rollbacks are no-ops in practice since none of `scripts/061/062/063` have been applied to any database — but each carries a stated `-- ROLLBACK:` header for when they eventually are: drop `reserva_pasajeros`/`reserva_ocupaciones` (061), drop the five additive `reservas` columns (062), restore the narrower `auditoria.accion` CHECK (063).
- End-to-end: reverting both commits and the uncommitted T16 diff returns the repo to its exact pre-sprint state; no destructive DB operation was ever run, so there is nothing to unwind at the database layer.

#### 5. The honest part

- **Eleven send-backs this sprint, all from one defect class: something asserting a state that is not true.** Round-1 of T16 is the eleventh instance — this time the false claim was in the *evidence* (a claim that reverting two content fixes would go RED, when zero test coverage existed for either), not in the shipped code itself.
- **Three regressions this sprint caught that were never on the original task list:**
  1. A half-applied migration that would have failed silently on PG14 (`scripts/061`'s `ON DELETE SET NULL (col)` needs PG15+; now wrapped atomically in BEGIN/COMMIT, but the target Postgres version has still never been checked).
  2. An escaping hole **the plan itself was about to open**: T9 was scheduled to delete the only HTML escaping in the repo (`applyEditableProformaData`'s `escapeHtml`) with nothing replacing it, and the actual exposure window opened one task *earlier* than anyone thought — at T8, the moment the live page repointed to the unescaped `generateConfirmacionHTML`, not at T9 where the deletion happened. Caught and closed by inserting T6b ahead of T8.
  3. Client documents were found to be printing a **different company's** address, phone, email and Instagram handle than the template expected — same RNC, one legal entity, two brand identities in use. The human ruled which brand is current.
- **The workspace itself was not reliable this sprint. Seven incidents**, including: root-owned `.git` objects from the very first commit that later broke a subsequent commit and an agent's `git stash` (required a human `chown`); concurrent QA lenses contaminating each other's scratch files (the lead's own orchestration error); and a still-**unexplained** vitest false-negative — 24 spurious failures against md5-verified-clean source, surviving a `node_modules/.vite` clear, with five later runs green. **Do not treat any single test run in this environment as self-evidently authoritative** — rerun before trusting a red or a green that doesn't match expectations.

#### 6. Backlog carried forward

- **B-1** — `lib/document-generator.tsx` is now ~2000 lines (well past the 500-line healthy range). Split into `lib/templates/{confirmacion,voucher,recibo}.ts`. Now urgent.
- **B-9** — `app/actions/documentos-actions.ts` crossed 500 lines at T2b; split by concern.
- **B-12** — `generateReciboHTML` is still unescaped (pre-existing, customer-facing exposure). Apply the `html` tag as its own scoped task.
- **B-13** — `generateProformaHTML` is dead code (byte-freeze-protected) once T8 repointed the page; delete it with its snapshot test + fixture.
- **B-14** — fixture-strength sweep: audit other suites for the weakness (single-element fixtures, zero-instance paths) that let 3 of 5 HC-4 mutations survive on first pass.
- **B-15** — `normalizarTextoLibreONull` is missing a `typeof` guard.
- **B-16** — integer guard missing on **both** `pax_*` and `cantidad` — fix together, never `pax_*` alone (same defect class in two places).
- **B-17** — Proxy-harden `lib/supabase.ts`'s lazy client (B3-adjacent hardening, not yet scoped).

**Not fixed, explicitly out of scope, and must be surfaced again before any future sprint touches auth or RLS broadly:** HC-1 (no authentication, no RLS on ~29 pre-existing tables — R1).

---

## Remaining backlog (highest priority first)

_(see docs/plans/: feature-audit-sprint, module-audit-polish, crm-reservas-fixes,
test-suite-sprint1. Fiscal / NCF / e-CF work is high-stakes → senior + human-gated.
Also see the geb-documents-real-data sprint entry above for B-1, B-9, B-12 through
B-17, and the unresolved HC-1 / R1 authentication-and-RLS exposure.)_
