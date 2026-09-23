# T6 round 2 — fix the §10 email-count defect — dev report

**Verdict: DONE.**

**Important lineage note before anything else:** this file (`t06-dev-r2.md`) previously
held a different, ALSO-legitimate round-2 fix (the "599-only" wording, cited to
`Q4_backfill_email_599`), which was independently re-verified and approved:
`reports/t06-qa-r2.md` (verdict PASS) and `reports/t06-lead-r2.md` (Decision A —
APPROVE). I am overwriting that report here because the instructions given for this
invocation of T6 round 2 specify a stricter, more complete fix than either of the two
options the round-1 lead memo (`reports/t06-lead.md`) offered as alternatives: this
invocation requires the corrected sentence to state **all four** of (a) the 45 dirty
count cited to its check, (b) the 599 placeholder count cited to its check, (c) the 0
truly-empty count, AND (d) the 644 combined figure explicitly labelled as a sum
(599 + 45), not an asserted check value — where the previously-approved text covered
only (b) and implicitly (c), and never stated (a)'s citation or (d) at all in the same
sentence. I did not just re-approve the existing text; I re-edited it to satisfy the
literal, more complete requirement I was given. **Flag for the lead:** the prior
`t06-qa-r2.md` / `t06-lead-r2.md` approvals are now stale against the live file content
and should be treated as superseded by this report, not as still-current sign-off for
what's on disk now. If the sprint's governance requires a fresh QA pass on this exact
wording, that is `t06-qa-r3` — I have not fabricated a QA verdict for my own dev work.

---

## 0. Scope check — before and after (this invocation)

```
$ git status --short   (identical before and after this task)
 M CLAUDE.md
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
11 entries, unchanged. `docs/migracion/README-clientes-import.md` was already `??`
(untracked, created in round 1) — edited in place, no new top-level entry. Per
`git-diff-scope-excludes-untracked-files`, scope is reported as **1 of 11** entries
touched (the README), same as every prior T6 round.

**Files changed (this invocation):**
- `docs/migracion/README-clientes-import.md` (one bullet, §10, re-edited)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-dev-r2.md` (this file,
  overwritten — see lineage note above)
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (§1 row updated, new §2
  handoff appended)

No `.sql` file, the generator, or `README-cleanup.md` was touched.

---

## 1. The defect in the previously-approved text, per this invocation's brief

The file (before this invocation's edit) read:

> "45 rows have an email value that doesn't match a normal `name@domain.tld` shape,
> and 599 rows have `email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows
> exist)."

This is factually correct and was validly approved in the prior round, but it does not
satisfy this invocation's explicit spec, which requires the sentence to also (a) cite
the 45 to its own check (`Q5_dirty_email_count` — it was stated as a bare, uncited
number) and (d) state the 644 combined figure explicitly, labelled as a sum, not as an
asserted check value (the prior text never mentioned 644 at all).

## 2. Independent re-verification of both check citations (before editing)

```
$ grep -n "Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
1368:INSERT INTO _checks(name, expected, actual) VALUES ('Q5_dirty_email_count', '45',
  (SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A'
   AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'));

$ grep -n "Q4_backfill_email_599" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
docs/migracion/03-clientes-import-dry-run.sql:1358:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', (SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A'));
docs/migracion/04-clientes-import-execute.sql:1282:INSERT INTO _checks(name, expected, actual) VALUES ('Q4_backfill_email_599', '599', (SELECT count(*)::text FROM _clientes_import WHERE email = 'N/A'));
docs/migracion/04-clientes-import-execute.sql:1340:INSERT INTO _post_checks(name, expected, actual) VALUES ('Post_Q4_backfill_email_599', '599', (SELECT count(*)::text FROM clientes WHERE email = 'N/A'));
```
Both citations are real, at the claimed lines, in both `.sql` files. The two predicates
(`email = 'N/A'` vs. `email <> 'N/A' AND ...regex-fails...`) are disjoint by
construction, so 599 + 45 = 644 is a valid, non-overlapping sum — matching the
independent 1,231-row parses already recorded by round-1 QA (`t06-qa.md`) and round-2
dev (`t06-dev.md`'s r2 predecessor content, folded into the scratchpad's `t06 senior-r2`
entry): N/A=599, empty=0, dirty=45. I did not re-run a fresh line-by-line parse of all
1,231 rows myself this round since the file (`03-clientes-import-dry-run.sql`) is
byte-identical (hash-verified below) to the file both prior parses already validated
against — re-parsing unchanged source data would not produce a different answer.

**No line in either `.sql` file computes "644" as a standalone check value** — confirmed
by the absence of any `_checks`/`_post_checks` row named for it. The new sentence states
644 explicitly as `(45+599)` with the words "a sum, not a check value" so this is never
presented as if it were an asserted, independently-checked figure.

## 3. Hash check — confirms neither `.sql` file was touched

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```
Matches the load-bearing hashes given in this task's instructions exactly
(`03` = `a5f74af3...45442cc4`, `04` = `9146d0d5...4363689b1`). Neither file was opened
for writing, let alone edited. `04` was not run.

## 4. Real before/after diff — exactly one bullet, one hunk

Reconstructed the pre-edit bullet from the live file's content immediately before my
edit (I had just read it with the Read tool) and diffed against the post-edit content:

```diff
--- before (round-1-approved wording, as it stood before this invocation's edit)
+++ after (this invocation's edit)
@@ -1,7 +1,7 @@
 - **Some imported email addresses are not well-formed; this import does not clean them
-  up.** 45 rows have an email value that doesn't match a normal `name@domain.tld` shape,
-  and 599 rows have `email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows
-  exist). This import backfills missing data — it does not clean existing dirty values.
-  If someone later opens one of these clients in `/clientes/editar` and tries to save
-  without fixing the email first, the form's own email validation will reject the save
-  until it's corrected. Accepted consequence of "backfill, don't clean."
+  up.** 45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599 have
+  `email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum,
+  not a check value. This import backfills missing data — it does not clean existing
+  dirty values. If someone later opens one of these clients in `/clientes/editar` and
+  tries to save without fixing the email first, the form's own email validation will
+  reject the save until it's corrected. Accepted consequence of "backfill, don't clean."
```

This is the **only** hunk in the 300-line file. The practical-consequence sentence
("If someone later opens one of these clients in `/clientes/editar`... the form's own
email validation will reject the save until it's corrected") and the closing "Accepted
consequence of..." phrase are unchanged in meaning and near-verbatim in wording — only
re-wrapped across different line breaks because the corrected clause is a different
length and the file has zero headroom under its ≤300-line ceiling. No other bullet, no
other section, no `.sql` file, no generator line, and not `README-cleanup.md` changed.

**Old clause:** `45 rows have an email value that doesn't match a normal
`name@domain.tld` shape, and 599 rows have `email = 'N/A'` (`Q4_backfill_email_599`; no
other empty-email rows exist).`

**New clause:** `45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599
have `email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum,
not a check value.`

---

## 5. File length

```
$ wc -l docs/migracion/README-clientes-import.md
     300 docs/migracion/README-clientes-import.md
```
Exactly at the ≤300-line ceiling — length-neutral (still 300, same as every prior
round). Fitting the extra citation (`Q5_dirty_email_count`) and the explicit 644-sum
clause required tightening word choice within the same sentence only (e.g. "45 rows
fail the shape" instead of "45 rows have an email value that doesn't match a normal
shape", "0 empty" instead of "no other empty-email rows exist") — no other sentence in
the bullet, and no other bullet in the file, was touched to make room.

---

## 6. Redaction / PII check (re-run)

```
$ grep -inE "git checkout|reset --hard|clean -fd|stash drop|force-push|force push|git reset" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/migracion/README-clientes-import.md
268:name@domain.tld

$ git status --short
 (11 entries, unchanged — see §0)
```
Only email-shaped match is the pre-existing illustrative `name@domain.tld` placeholder
(now at line 268 instead of 269, due to the re-wrap — same string, same purpose). No
real client email, no key, no connection string, no destructive git verb.

---

## 7. `npm run qa` (full re-run, real output, not truncated)

```
$ npm run qa

> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test


> my-v0-project@0.1.0 typecheck
> tsc --noEmit


> my-v0-project@0.1.0 lint
> eslint .

/Users/johancito/Developer/Elibry/app/clientes/balance-reserva/page.tsx
  83:6  warning  React Hook useEffect has a missing dependency: 'cargarDatos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/editar/page.tsx
  79:6  warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/clientes/ver/page.tsx
   27:6   warning  React Hook useEffect has a missing dependency: 'cargarCliente'. Either include it or remove the dependency array                                                                                                                                                react-hooks/exhaustive-deps
  187:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element
  263:29  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/crm/casos/page.tsx
  232:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/fiscal/page.tsx
  162:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/facturacion/voucher/page.tsx
  245:6  warning  React Hook useEffect has a missing dependency: 'fetchReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/page.tsx
  103:6  warning  React Hook useEffect has a missing dependency: 'verificarTablaYCargarCambios'. Either include it or remove the dependency array  react-hooks/exhaustive-deps
  761:6  warning  React Hook useEffect has a missing dependency: 'cargarEstadisticas'. Either include it or remove the dependency array            react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/page.tsx
  39:6  warning  React Hook useEffect has a missing dependency: 'cargarPagos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/pagos/ver/page.tsx
  67:6  warning  React Hook useEffect has a missing dependency: 'cargarPago'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/productos/editar/page.tsx
   84:6   warning  React Hook useEffect has missing dependencies: 'loadProducto' and 'router'. Either include them or remove the dependency array                                                                                                                                  react-hooks/exhaustive-deps
  602:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/registrar/page.tsx
  529:25  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/productos/ver/page.tsx
   60:6   warning  React Hook useEffect has a missing dependency: 'cargarProducto'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  200:15  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/reservas/pendientes/page.tsx
  199:6  warning  React Hook useEffect has a missing dependency: 'cargarReservas'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/seguimiento/page.tsx
  219:6  warning  React Hook useEffect has a missing dependency: 'cargarCasos'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/reservas/ver/[id]/page.tsx
  276:6  warning  React Hook useEffect has missing dependencies: 'supabase' and 'toast'. Either include them or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/editar/page.tsx
   75:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  468:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/page.tsx
  50:6  warning  React Hook useEffect has a missing dependency: 'cargarSuplidores'. Either include it or remove the dependency array  react-hooks/exhaustive-deps

/Users/johancito/Developer/Elibry/app/suplidores/registrar/page.tsx
  399:23  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/app/suplidores/ver/page.tsx
   63:6   warning  React Hook useEffect has a missing dependency: 'cargarSuplidor'. Either include it or remove the dependency array                                                                                                                                               react-hooks/exhaustive-deps
  254:21  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/image-upload.tsx
  114:13  warning  Using `<img>` could result in slower LCP and higher bandwidth. Consider using `<Image />` from `next/image` to automatically optimize images. This may incur additional usage or cost from your provider. See: https://nextjs.org/docs/messages/no-img-element  @next/next/no-img-element

/Users/johancito/Developer/Elibry/components/time-format-toggle.tsx
  24:6  warning  React Hook useEffect has a missing dependency: 'onChange'. Either include it or remove the dependency array. If 'onChange' changes too often, find the parent component that defines it and wrap that definition in useCallback  react-hooks/exhaustive-deps

✖ 28 problems (0 errors, 28 warnings)


> my-v0-project@0.1.0 test
> vitest run

 RUN  v2.1.9 /Users/johancito/Developer/Elibry

 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  17:16:01
   Duration  3.73s (transform 1.63s, setup 3.66s, collect 3.28s, tests 1.39s, environment 9ms, prepare 4.31s)
```
Exit code `0`. `tsc --noEmit` clean (0 errors). `eslint .`: 0 errors, 28 pre-existing
warnings — identical set (same files, same lines) as every prior round. `825/825` tests
across 30 files pass — pure regression, since no `app/`, `lib/`, `components/`, `hooks/`,
or `tests/` file was touched this task. (Per-test stderr noise from intentional
error-path fixtures — visible in the raw run — omitted here for brevity; shape/pass
count identical to every prior round's pasted output.)

---

## 8. Out-of-scope changes

None. `git status --short` shows the same 11 entries before and after; only
`docs/migracion/README-clientes-import.md` (already `??` from round 1) was edited.
`README-cleanup.md`, both `.sql` files, and the generator are untouched (§0, §3).
`CLAUDE.md`'s pending `M` predates this session and this task.

---

## Rollback

Prose only, no destructive git verb: revert this one sentence back to the wording that
was live immediately before this invocation's edit — i.e. restore "45 rows have an
email value that doesn't match a normal `name@domain.tld` shape, and 599 rows have
`email = 'N/A'` (`Q4_backfill_email_599`; no other empty-email rows exist)." in place of
the current "45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599 have
`email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum, not a
check value." in §10 of `docs/migracion/README-clientes-import.md`, then re-wrap the
bullet's line breaks back to 7 lines to keep the file at 300. No database, no `.sql`
file, and no generator was touched by this task — nothing else to roll back.
