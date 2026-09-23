# T4 round 2 — lead decision record

**Verdict: APPROVE**

### What shipped
The stale, false docstring text in `docs/migracion/generate-clientes-import.py` (lines 1-26) — which claimed the generator "produces ONLY the dry run" and that `04`/`_jrosa_preserva` were "T4's job … DEFERRED" — is corrected to state the generator emits BOTH `03` and `04` from one `checks` list, describes `_jrosa_preserva` as the 17 non-sheet columns, and cites the amendment (path + 650-line ceiling). Zero functional/code lines changed; both output artifacts (`03`, `04`) are byte-identical to their previously-approved hashes.

### (a) Amendment scope confirmation — CONFIRMED, quoted verbatim
File exists at `docs/plans/clientes-xlsx-import-amendment-a.md`. The exemption is recorded as scope-limited and non-precedential:

> "This exemption covers **exactly one path**: `docs/migracion/generate-clientes-import.py`, at **≤650 lines**, for the life of the `2026-09-22-clientes-xlsx-import` sprint and its artifacts." (lines 68-70)

> "It may **not** be cited for: anything under `app/`, `lib/`, `components/`, `hooks/`, `tests/`, `scripts/`; any file with more than one importer; any file that will be edited in a later sprint; any React component, server action, route, or data-layer helper; or any file whose only justification is 'splitting it is awkward'. For those the 500-line rule is unamended and a split remains its own scoped task, exactly as `.claude/rules/file-size.md` says." (lines 79-83)

This satisfies the requirement: exactly one path, ≤650 lines, life-of-sprint scope, and explicit non-citability for app/lib/components/hooks/tests/scripts or any file with >1 importer.

### (b) CBrain filing candidate — recorded
Flagging for sprint close: **"generator file-size exemption, scope-limited, non-precedential"** as a CBrain filing candidate, alongside flowcrm's unformalised 754-line runbook exception. This is already referenced in the amendment's Reasoning point 4 ("The precedent exists and is already an open brain item... `flowcrm-default-pipeline-window-disclosure` shipped `docs/plans/default-pipeline-deploy.md` at 754 lines... that sprint's own close flagged '[it] should be formalized in `.claude/rules/file-size.md` — open policy question, flagged for the architect'") and the amendment's T8 addendum ("the sprint close records 'generator file-size exemption granted, scope-limited, non-precedential' as a CBrain filing candidate alongside flowcrm's unformalised 754-line deploy-runbook exception"). This is a second data point in the same unformalised class and should be filed together at sprint close (candidate home: `patterns/` or a mistakes/decisions cross-reference, per the two open brain items already logged in scratchpad §3).

### Specific checks requested

**Hash neutrality — independently confirmed by QA, not just dev.** QA report §AC4 shows QA running the generator twice itself: `03` = `a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4`, `04` = `9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1`, identical both runs, matching the required pre-edit values exactly. This is QA's own independently-run command output, not a copy of the dev's numbers.

**Docstring confinement to lines 1-26, given the untracked-file limitation — adequate, not a gap.** QA disclosed the genuine limitation (file is `??`, no git base, no other on-disk copy via `git log --all` / `git stash list`) and did not paper over it. Three corroborations were used, and I assessed them as jointly sufficient given the actual risk surface:
1. A third-party quote of the stale docstring text, written *before* this round existed (the architect's own amendment ruling, lines 96-98) — independent evidence the "ONLY the dry run"/"DEFERRED to T4" language really was present pre-edit, not just the dev's say-so.
2. Independent line-count arithmetic computed by QA itself (635 total − 26 docstring = 609 code lines pre-edit; 644 total − 35 docstring = 609 code lines post-edit) — proves structurally that nothing outside the docstring span changed length, without relying on the dev's reverse-substitution reconstruction.
3. A real adversarial mutation test (not a re-run of the dev's claim): mutating the docstring in an isolated scratch copy left both output hashes unchanged; mutating a real data-affecting constant (`PAIS_LITERAL`) as a negative control changed both hashes. This directly addresses the actual stake — whether docstring content can affect the two high-stakes SQL artifacts — and proves it cannot, by construction, with a negative control ruling out a vacuous test.
Given the actual risk (client-PII-writing SQL output) is proven unaffected by the docstring by an adversarial test with a negative control, and the structural "nothing else changed" claim is proven by independent arithmetic rather than trust in the dev's reconstruction, this is adequate corroboration for a prose-only, non-interpolated docstring edit. Not a gap; send-back not warranted on this point.

**File scope — accounted for, N of M against `git status --short`.** Both dev and QA show the identical 9-entry `git status --short` snapshot (matches the conversation's starting git-status snapshot). 1 of 9 hand-edited (`generate-clientes-import.py`, lines 1-26 only); 2 of 9 regenerated as output with byte-identical hashes to pre-edit (`03`, `04` — no functional diff); 1 of 9 is the sprint report dir gaining this round's report + own scratchpad handoff (in scope); the remaining 5 (`CLAUDE.md`, `.DS_Store`, `.claude/rules/context-budget.md`, `docs/migracion-clientes.xlsx`, `docs/plans/clientes-xlsx-import.md`) predate this round and are confirmed untouched — QA additionally ran `git diff CLAUDE.md` itself and confirmed that pre-existing tracked modification is unrelated content. No scope creep beyond the three declared files plus the two byte-identical regenerated outputs.

**`npm run qa` — actually run by both, real green output pasted.** Dev: tsc clean, 0 lint errors (28 pre-existing warnings), 825/825 tests, exit implied 0. QA: same, independently re-run, exit code 0 explicitly echoed. Both real, both pasted, both match.

**No PII/credentials/connection strings** — both dev (AC9, targeted grep) and QA (AC9, broader grep across dev report + scratchpad span) confirm none present; the one grep "hit" in each case is the report's own descriptive sentence, not a leaked value.

**Rollback note** — prose-only ("restore lines 1-26 ... to the 'BEFORE' text shown ... then re-run ... and re-confirm both hashes"), no git verb. QA additionally ran a targeted grep for destructive git verbs (`checkout|reset --hard|clean -fd|stash drop|force-push`) against the dev report — zero hits.

**Absolute prohibition (never execute `04` for real writes)** — honored by both. Dev report and QA report both state `04` was only regenerated as output and inspected via `grep`/`diff`; QA grepped the dev report for `BEGIN;|COMMIT;|psql.*04-clientes` — no hits. No live DB connection was opened by QA this round.

### Hard-gate check (all clear, no B/D triggers)
- Real diff produced — yes (AC1, hunk `@@ -2,17 +2,26 @@` pasted in full).
- Tests actually run with pasted output — yes, both dev and QA.
- New table without RLS — N/A, no table created; ADR 0011 (no RLS anywhere in Elibry) reconfirmed by grep for `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` (zero hits) — isolation posture unchanged.
- Existing RLS weakened/bypassed — N/A, none exists to weaken.
- Missing rollback note — present, adequate.
- Any AC marked FAIL — none; all 10 ACs PASS in both dev and QA reports.
- Optimistic UI without rollback — N/A, no UI touched.
- Auth/payment/destructive DB change not in plan — N/A; `04` not executed, absolute prohibition upheld.
- Out-of-scope files changed — none found; scope fully accounted for against `git status --short`.

### Next step per scratchpad
T5 may proceed (T4 round 2's own handoff and QA's own summary both note T3 round 4 is not required — `03`'s bytes are unchanged from the already-approved t03 round-3 live run).
