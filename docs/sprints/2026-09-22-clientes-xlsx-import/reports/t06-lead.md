# T6 — operator runbook — lead decision

**Decision: B — SEND BACK TO DEV**

## Basis

- Sprint plan for this task requires the runbook's every disclosed fact to trace to a
  literal SQL/data source (`runbook-pass-condition-misdescribes-behavior`), per t06-dev.md
  §4 and t06-qa.md's stated governing rule.
- QA verdict is **FAIL** (`docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-qa.md`,
  line 3), which alone triggers a non-A decision under the HARD GATES
  ("Acceptance criterion marked FAIL → B").
- The specific finding (t06-qa.md, "Independent numeric audit" section, and AC item 10):
  runbook §10 states *"45 rows have an email value that doesn't match a normal
  `name@domain.tld` shape, and roughly 644 rows carry a placeholder or empty email."*
  QA independently parsed all 1,231 rows of `_clientes_import` in
  `docs/migracion/03-clientes-import-dry-run.sql` and found:
  - `email = 'N/A'` (placeholder): 599
  - empty email: 0
  - non-N/A regex-mismatch ("dirty"): 45 (matches the SQL's own `Q5_dirty_email_count` check, validating QA's parser)
  - 599 + 45 = 644
  So 644 is the **combined** total, not a disjoint placeholder-only bucket on top of the
  45 already named in the same sentence. As written, the sentence implies two separate
  problem-email populations (45 + ~644 ≈ 689) when the true combined total is 644
  (45 + 599). No line in either `.sql` file computes "644" as a standalone figure — QA
  confirmed there is no `_checks` row for it.
- Nothing else is in question: QA confirms (t06-qa.md, "Commands run" + AC list) that all
  3 `RAISE EXCEPTION` citations, the PROCEED/ABORT logic (lines 1380–1383), the
  BEGIN(7)/COMMIT(1363)/no-ROLLBACK claim, the two app-source freeze citations, channel
  guidance, redaction/PII sweep, scope (`git status --short`), file length (300/300), and
  `npm run qa` (0 errors, 825/825 tests, exit 0) all independently re-verified and PASS.
  This is a single-sentence numeric correction, not a rewrite.
- No HARD GATE beyond the FAIL criterion is implicated: no RLS/table change, no
  auth/payment/destructive-DB scope creep, no out-of-scope files (dev report §0 and QA's
  `git status --short` both confirm only `docs/migracion/README-clientes-import.md` is new),
  rollback note is present (t06-dev.md §11 / "Rollback"). This does not rise to C
  (no design/architecture question — it's an arithmetic/wording error in a doc) or D
  (no auth/payment/destructive-DB-op/product-fork question — the destructive-step
  safety language itself is unaffected, per QA's own note: "This does not affect the
  safety of the destructive execute step").

## Exact instructions to dev

In `docs/migracion/README-clientes-import.md` §10 ("Known loose ends"), the
malformed/placeholder-email bullet currently reads:

> "...45 rows have an email value that doesn't match a normal `name@domain.tld` shape,
> and roughly 644 rows carry a placeholder or empty email."

Replace the second clause so the numbers are correct and unambiguous. Use one of QA's
two suggested fixes (t06-qa.md, "Suggested fixes"), your choice, either is acceptable:

1. State the placeholder-only figure directly:
   `"...and 599 rows have email = 'N/A' (no other empty-email rows exist)."`
2. Or make the combined math explicit:
   `"...for a combined 644 rows (45 + 599) with either a malformed or a placeholder email."`

Whichever you pick, add a one-clause note on how the number was derived (e.g. "counted
directly from the 1,231-row payload; not itself a dry-run `_checks` row"), since — unlike
the 45, which is sourced to `Q5_dirty_email_count` — the 599/644 figures are not computed
by any check in either `.sql` file, and this document's own stated premise is that every
claim traces to a literal source.

Do not touch any other section, any `.sql` file, or the generator — this is confined to
one sentence in §10. Re-run `npm run qa` and re-paste the full output (no HARD GATE
issue there today, but the gate requires it to be re-shown for this round). Re-confirm
file length is still ≤300 lines (it is currently exactly 300; this edit should be
length-neutral or a net trim). Resubmit as t06-dev-r2 / expect t06-qa-r2.
