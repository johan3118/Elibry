# T6 — operator runbook (`docs/migracion/README-clientes-import.md`) — dev report

**Verdict: DONE.** New file only. No SQL file, no generator, no `README-cleanup.md`,
no app/lib/component/test file touched. Nothing was executed against the live
database this task — this was a documentation-only task; the only live-DB-adjacent
work was re-grepping the two already-generated `.sql` files for literal line numbers
and text to cite (read-only `grep`/`sed`/`wc` against files already on disk).

---

## 0. Files touched (scope)

```
$ git status --short   (before this task)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
                                                        (10 entries)

$ git status --short   (after this task)
 M CLAUDE.md
?? .DS_Store
?? .claude/rules/context-budget.md
?? docs/migracion-clientes.xlsx
?? docs/migracion/03-clientes-import-dry-run.sql
?? docs/migracion/04-clientes-import-execute.sql
?? docs/migracion/README-clientes-import.md              <- NEW (this task's deliverable)
?? docs/migracion/generate-clientes-import.py
?? docs/plans/clientes-xlsx-import-amendment-a.md
?? docs/plans/clientes-xlsx-import.md
?? docs/sprints/2026-09-22-clientes-xlsx-import/
                                                        (11 entries: 10 unchanged + 1 new)
```

**1 of 11** entries is this task's change: `docs/migracion/README-clientes-import.md`
(new). The `docs/sprints/2026-09-22-clientes-xlsx-import/` entry also gained this
report plus this task's own scratchpad row/handoff, but that entry already existed
as `??` before this task (per `git-diff-scope-excludes-untracked-files`, it is not
counted as a second new top-level entry). `docs/migracion/README-cleanup.md` was
read for format precedent only, per the task brief, and was **not edited or written
to** — confirmed absent from the diff below and from `git status --short` (it is
tracked and shows no `M` for it in either snapshot). No `.sql` file, the generator,
`CLAUDE.md`, `.claude/**`, or any `app/`/`lib/`/`components/`/`hooks/`/`tests/` file
was touched.

Files changed:
- `docs/migracion/README-clientes-import.md` (new)
- `docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-dev.md` (this file, new)
- `docs/sprints/2026-09-22-clientes-xlsx-import/scratchpad.md` (own row + own handoff)

---

## 1. Fact-checking done before writing (per this task's "READ FIRST" instruction)

Every pass/fail or line-number claim in the runbook was re-derived live against the
**current on-disk** `03`/`04` files and app source — not copied from memory of prior
reports:

```
$ wc -l docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
    1384 docs/migracion/03-clientes-import-dry-run.sql
    1363 docs/migracion/04-clientes-import-execute.sql

$ sed -n '1375,1384p' docs/migracion/03-clientes-import-dry-run.sql
... (confirms lines 1380-1383 are the CASE WHEN EXISTS ... THEN ABORT ... ELSE PROCEED ... END AS veredicto_final block)

$ grep -n "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
1296:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
1302:  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', (SELECT count(*) FROM _jrosa_preserva); END IF; END $$;
1361:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;
-- exactly 3, confirmed by count, quoted verbatim in the runbook §7

$ grep -n "^BEGIN;\|^COMMIT;" docs/migracion/04-clientes-import-execute.sql
7:BEGIN;
1363:COMMIT;

$ grep -n "^INSERT INTO clientes\|^UPDATE \|^DELETE \|^SELECT setval" docs/migracion/04-clientes-import-execute.sql
1305:INSERT INTO clientes (...) SELECT ... FROM _clientes_import WHERE id NOT IN (15, 1185);
1309:INSERT INTO clientes (...)              -- JROSA merge (multi-line, SELECT on 1312)
1313:UPDATE reservas SET cliente_id = 1185 WHERE id = 10;
1316:DELETE FROM clientes WHERE id = 15;
1319:INSERT INTO clientes (...) SELECT ... FROM _clientes_import WHERE id = 15;   -- MELISSA
1322:SELECT setval(pg_get_serial_sequence('clientes','id'), (SELECT max(id) FROM clientes), true);

$ grep -n "Companion (future tasks, not yet generated)" docs/migracion/03-clientes-import-dry-run.sql
7:-- Companion (future tasks, not yet generated): 04-clientes-import-execute.sql,
-- confirms the stale-header claim in runbook §10 is still live, not fixed

$ grep -n "cambios_prov_ref_15_known_dangling" docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
docs/migracion/03-clientes-import-dry-run.sql:1336:...('Q1_cambios_prov_ref_15_known_dangling', '1', ...)
docs/migracion/04-clientes-import-execute.sql:1260:...('Q1_cambios_prov_ref_15_known_dangling', '1', ...)

$ grep -n "maxIdData\|nextId" app/clientes/registrar/page.tsx
193:        const { data: maxIdData } = await supabase
199:        const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1
205:              id: nextId,

$ grep -n "maxIdData\|nextId" lib/provisional-system.ts
132:    const { data: maxIdData } = await supabase
138:    const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1
142:      id: nextId,
```

Both the app-source line ranges named in the task brief (`app/clientes/registrar/
page.tsx:193-199`, `lib/provisional-system.ts:132-142`) were confirmed to still
match exactly before being cited in runbook §4. All facts pulled from prior task
reports for the disclosure sections (§9/§10) — `audit_clientes` absence (T1 Q3/Q6),
the `cambios_provisionales id=69` dangling row (T1 Q2), the guard-rehearsal coverage
(T5 §9), and t04's §8e disclosed limitation — were traced to a literal source line
in those reports (t01-dev.md, t04-dev.md §8e at line 558, t05-dev.md §9), not
retyped from the scratchpad's condensed summaries.

---

## 2. Real diff (new file — `git diff --no-index` against `/dev/null`, since the
file is new/untracked; full content shown, no truncation)

```diff
diff --git a/docs/migracion/README-clientes-import.md b/docs/migracion/README-clientes-import.md
new file mode 100644
index 0000000..8477fca
--- /dev/null
+++ b/docs/migracion/README-clientes-import.md
@@ -0,0 +1,300 @@
+# Clientes XLSX import — operator runbook
+
+Read this whole file before running anything. It is written for the business owner
+running the real import against the live production database — you do not need to
+read the SQL files to follow it, but every claim below points at a literal line of
+those files so you can check it yourself if you want to.
+
+**Files in this directory relevant to this runbook:**
+- `03-clientes-import-dry-run.sql` — read-only, zero risk, run first.
+- `04-clientes-import-execute.sql` — writes real data, one real transaction, no
+  dry-run mode. This is the irreversible step.
+- `generate-clientes-import.py` — the generator that produced both files above from
+  the pinned workbook. You do not need to run this; it is here for traceability only.
+
+Spec: `docs/plans/clientes-xlsx-import.md`. Amendment: `docs/plans/clientes-xlsx-import-amendment-a.md`.
+
+---
+
+## 1. What this does, in plain language
+
+This imports **1,231 clients** from the pinned spreadsheet into the live `clientes`
+table, each at the exact `id` it has in the spreadsheet. One client already exists
+in the live database today at `id = 15` ("JROSA"), and the spreadsheet also has its
+own row 15 (a different client, "MELISSA") and its own row for JROSA at `id = 1185`.
+To avoid a collision, this import:
+
+1. Inserts all sheet rows except id 15 and id 1185.
+2. Inserts sheet row 1185 (JROSA), but keeps JROSA's own 17 existing operational
+   columns (things like its uploaded documents, image, and registration status) —
+   it does not overwrite them with blanks just because the spreadsheet doesn't carry
+   them.
+3. Repoints the one reservation that currently points at JROSA (`reservas.id = 10`)
+   to JROSA's new id, 1185.
+4. Deletes the old id-15 row (JROSA, now safely moved to 1185 and no longer
+   referenced by anything).
+5. Inserts the sheet's own row 15 (MELISSA) into the now-free id.
+6. Advances the database's internal id counter (the "sequence") past the highest id
+   used, so future new clients don't collide with anything just imported.
+
+After a successful run: `clientes` has exactly 1,231 rows, `reservas.id = 10` points
+at client 1185 (JROSA, with its old data intact), and client 15 is MELISSA.
+
+---
+
+## 2. Backup — do this first, before anything else
+
+Before touching anything else in this runbook, take a backup: in the Supabase
+dashboard, go to **Database → Backups → Create backup now** (or run `pg_dump` against
+the live connection string yourself if you prefer a local copy).
+
+**If you run Step 7 below (`04-clientes-import-execute.sql`) and it commits
+successfully, the only way to undo it is to restore this backup — there is no undo
+script.** Do not proceed past this step without a backup you have personally
+confirmed exists and is recent.
+
+---
+
+## 3. Which tool to run this through (read before you paste anything anywhere)
+
+This sprint spent real time on this, so follow it exactly:
+
+- **`supabase db query` (the Supabase CLI) CANNOT run either SQL file.** Both files
+  contain many SQL statements in one file, and `supabase db query` sends text over a
+  channel that only accepts one statement at a time. Attempting it fails with
+  `cannot insert multiple commands into a prepared statement`. This is a hard
+  Postgres wire-protocol limit, not an occasional glitch — it was hit and confirmed
+  independently three separate times this sprint. **Do not use it for these files.**
+- **The Supabase SQL editor (in the dashboard) DOES work.** Paste the whole file's
+  contents into it and run it.
+- **`psql` from a terminal DOES work**, and is the recommended channel for the real
+  execute step because it is a plain command line, not a browser tab you might
+  accidentally navigate away from mid-run. To set it up on a Mac that doesn't already
+  have it: `brew install libpq`, add it to your shell's `PATH` for that session
+  (e.g. `export PATH="/opt/homebrew/opt/libpq/bin:$PATH"`), then connect using your
+  project's own `POSTGRES_URL_NON_POOLING` value exactly as it already exists in
+  `.env.local` — do not modify or weaken it (no disabling SSL, no swapping the
+  connection string). Once connected, run a file with:
+  ```bash
+  psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/03-clientes-import-dry-run.sql
+  ```
+  (Never print the actual connection string — reference it by env-var name only.)
+
+**Bottom line: use the Supabase SQL editor or `psql`. Never `supabase db query`.**
+
+---
+
+## 4. Freeze client creation before you start (mandatory)
+
+Between running the dry run (Step 5) and running the execute script (Step 7), **do
+not create any new client through the app.**
+
+Why this matters: both places in the app that create a client compute its `id`
+themselves, as "the current highest id plus one" — not by asking the database for
+the next value from its own counter: `app/clientes/registrar/page.tsx:193-199` and
+`lib/provisional-system.ts:132-142`.
+
+Today the highest id is 15, so a client created through the app right now would get
+id 16 — which the spreadsheet also wants to use for one of its own rows. If that
+happens, the execute script's own safety guard will catch the collision and **abort
+the entire run without writing anything** — but it is still simpler and safer to just
+not create any new client in that window.
+
+To be clear: the "advance the sequence" step at the end (§1, step 6) is a
+belt-and-braces measure, not a fix for this — it does not stop the app from creating
+a colliding id, because the app never asks the database's sequence for a number in
+the first place, it always computes `MAX(id)+1` itself. The sequence-advance step
+only protects a hypothetical future write path that *does* consume the sequence. It
+isn't what makes the freeze safe to skip. Keep the freeze in place for the whole
+window between Step 5 and the end of Step 7.
+
+---
+
+## 5. Step — run the dry run (`03-clientes-import-dry-run.sql`)
+
+This file is **read-only** — it contains zero `INSERT`/`UPDATE`/`DELETE`/`ALTER`
+against any real table (its only `CREATE TABLE` is a session-local temp table that
+disappears when your connection closes). You can run it as many times as you want,
+in any order, safely.
+
+Run it through the Supabase SQL editor or `psql` (never `supabase db query`, §3).
+
+**How to read the output:** it produces two result grids. The first is a 42-row table,
+one row per named check, each with an `expected`, `actual`, and `resultado` column.
+The second is a single summary row with a `veredicto_final` column.
+
+**The exact pass condition — read this, don't guess at it:** the file's own logic
+(`03-clientes-import-dry-run.sql` lines 1380–1383) is:
+```sql
+CASE WHEN EXISTS (SELECT 1 FROM _checks WHERE expected <> actual)
+  THEN '*** ABORT *** ...'
+  ELSE 'PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.'
+END AS veredicto_final
+```
+In plain terms: **you must see all 42 rows in the first grid read `PASS` in their
+`resultado` column, AND the second grid's `veredicto_final` column must read exactly
+`PROCEED — every Q1-Q6 check above reads PASS...`.** If even one row reads
+`*** FAIL ***`, the summary will read `*** ABORT ***` instead — do not proceed to
+Step 7 if that happens; stop and get help.
+
+This dry run already ran live against production twice in a row this sprint with a
+clean 42/42 PASS / PROCEED result both times — but confirm it again with a fresh run
+before proceeding, since time has passed and the data may have changed.
+
+---
+
+## 6. Sign-off checklist before running the execute script
+
+Before you run Step 7, confirm all of the following:
+
+- [ ] You took a backup in Step 2 and have verified it exists.
+- [ ] You ran the dry run in Step 5 just now (not "a few days ago") and it showed
+      42/42 `PASS` and `veredicto_final = PROCEED`.
+- [ ] No new client has been created through the app since you ran the dry run, and
+      you will not create one until this whole process is finished (§4).
+- [ ] You are using the Supabase SQL editor or `psql` — not `supabase db query` (§3).
+- [ ] You understand that once you run Step 7 and it commits, the only way back is
+      the backup from Step 2 (§2, §8).
+
+---
+
+## 7. Step — run the execute script (`04-clientes-import-execute.sql`)
+
+**This step writes real data and cannot be undone except by restoring the Step 2
+backup.**
+
+The whole file is one transaction: it opens with `BEGIN;` (line 7) and closes with
+`COMMIT;` (line 1363). There is no `ROLLBACK` statement anywhere in the file — it
+either commits everything, or an error aborts the entire transaction and Postgres
+discards everything automatically, with nothing written.
+
+Run it through the Supabase SQL editor or `psql` (§3):
+```bash
+psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/04-clientes-import-execute.sql
+```
+
+**Messages you might see, and what each one means** (there are exactly 3
+`RAISE EXCEPTION` statements in the whole file — grep-confirmed, cited by line below):
+
+1. **Line 1296** — `ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.`
+   One or more of the same 42 checks the dry run ran came back different this time
+   (e.g. live data changed between your dry run and this run). Nothing was written.
+   Go back to Step 5, re-run the dry run, find out what changed, and only proceed
+   once it reads clean again.
+2. **Line 1302** — `ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.`
+   The script could not find exactly one existing client at id 15 right before
+   writing (it expects the live JROSA row still there, unchanged, when it captures
+   her data to preserve it). Nothing was written. Stop and investigate — someone or
+   something changed client id 15 between your dry run and this run.
+3. **Line 1361** — `ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.`
+   The script finished writing but one of its 33 after-the-fact checks (row count,
+   JROSA's preserved data, the reserva repoint, etc.) came back wrong. The whole
+   transaction is discarded automatically — nothing is actually committed, despite
+   the writes having happened earlier in the same transaction. Stop and get help.
+
+**Success** looks like the script running to completion with a normal `COMMIT` and no
+`ERROR` lines in the output.
+
+---
+
+## 8. Step — verify the result yourself, after a successful run
+
+Run these yourself (Supabase SQL editor or `psql`) and compare to the expected
+answer shown:
+
+```sql
+SELECT count(*) FROM clientes;
+-- expected: 1231
+
+SELECT id, nombre_comercial, razon_social, estado_registro, imagen_url, documentos_urls
+FROM clientes WHERE id = 1185;
+-- expected: this is JROSA, and estado_registro/imagen_url/documentos_urls (her old
+-- operational data) are intact, not blank
+
+SELECT id, nombre_completo FROM clientes WHERE id = 15;
+-- expected: this is MELISSA (the sheet's own row 15), not JROSA
+
+SELECT cliente_id FROM reservas WHERE id = 10;
+-- expected: 1185
+
+SELECT count(*) FROM reservas;
+-- expected: 1 (unchanged — this import never adds or removes a reserva, only
+-- repoints the existing one)
+```
+
+If any of these does not match, stop, do not attempt to fix it manually, and restore
+the Step 2 backup.
+
+---
+
+## 9. Side effects — disclosed, not hidden
+
+- **This import produces zero new rows in the `auditoria`/`audit_logs` tables from
+  the `clientes` side.** The plan originally assumed roughly 1,232 such rows (one
+  per insert, via a trigger named `audit_clientes`). That trigger **does not exist**
+  on the live `clientes` table — confirmed by direct inspection of live triggers.
+  So the 1,231 inserts, the JROSA relocation insert, and the id-15 delete write no
+  audit rows at all.
+- **The one real audit side effect** is a single new row in `audit_reservas`, caused
+  by the one `UPDATE reservas` statement (line 1313) that repoints reserva 10 to
+  JROSA's new id. That same `UPDATE` also rewrites `reservas.fecha_editado`, via the
+  existing trigger `trigger_update_reservas_fecha_editado` (fires on any `UPDATE` to
+  `reservas`). Expected, not a bug.
+- `clientes.fecha_editado` is **not** touched for anyone, including JROSA — the script
+  never runs an `UPDATE` against `clientes` (JROSA's relocation is delete-then-
+  reinsert, not update), so the trigger that rewrites it (`UPDATE`-only) never runs.
+
+---
+
+## 10. Known loose ends — disclosed, not resolved by this import
+
+- **A pre-existing, unrelated dangling record.** There is already a row in
+  `cambios_provisionales` (`id = 69`, `tabla_afectada = 'clientes'`,
+  `registro_id = 15`, `estado_cambio = 'PENDIENTE'`) that predates this import
+  entirely — a pending change request left over from before this sprint started.
+  This import does not touch or resolve it. After this import runs, that row's
+  `registro_id = 15` will point at whoever holds id 15 going forward — i.e.
+  **MELISSA, not JROSA** (JROSA has moved to 1185; this row is not updated to follow
+  her). If that pending change request is ever acted on later, whoever handles it
+  needs to know it now points at the wrong client.
+- **A harmless stale comment in `03-clientes-import-dry-run.sql`.** Its header (line
+  7) says "Companion (future tasks, not yet generated): 04-clientes-import-execute.sql"
+  — but `04` has already been generated and sits right next to it in this directory.
+  Leftover from when `03` was generated before `04` existed; cosmetic only (a
+  comment, not executable SQL), deliberately left as-is because touching `03`'s
+  bytes would invalidate the live, already-verified dry-run proof this sprint
+  recorded against its exact current contents. Harmless; recorded, not fixed.
+- **Some imported email addresses are not well-formed; this import does not clean
+  them up.** 45 rows have an email value that doesn't match a normal
+  `name@domain.tld` shape, and roughly 644 rows carry a placeholder or empty email.
+  This import backfills missing data — it does not clean existing dirty values. If
+  someone later opens one of these clients in `/clientes/editar` and tries to save
+  without fixing the email first, the form's own email validation will reject the
+  save until it's corrected. Accepted consequence of "backfill, don't clean."
+- **Not every individual safety check was fired live and watched abort on its own**
+  before this run. Two of the 42 pre-write checks and one of the 33 after-the-fact
+  checks were each individually proven this sprint to genuinely raise an error when
+  violated (tested both ways: real current data doesn't trigger them, a
+  deliberately-broken copy does). That proves the shared raise-on-mismatch mechanism
+  all 42+33 checks use — not every remaining check was fired individually.
+- **The full execute script has never been run end-to-end for real by anyone before
+  you.** It has been verified as thoroughly as possible without committing a real
+  run (its exact live SQL text read, its guard logic tested without letting it
+  write, its statements validated as well-formed without executing them for real) —
+  but no one has run it start to finish and watched it actually commit. You are the
+  first real run. Disclosed so you go in with accurate expectations, not because of
+  a known defect.
+
+---
+
+## 11. Rollback
+
+- **If Step 7 committed successfully:** the only way to undo it is to **restore the
+  backup you took in Step 2** — there is no undo script for a committed run of
+  `04-clientes-import-execute.sql`.
+- **If Step 7 aborted with any of the three messages in §7:** nothing was written —
+  Postgres discarded the whole transaction automatically. There is nothing to roll
+  back in the database.
+- **If Step 5 (the dry run) was run, for any reason:** nothing was ever written — it
+  is physically incapable of writing anything (§5). There is nothing to roll back.
+- **To remove this file from the repository, if ever needed:** `rm docs/migracion/README-clientes-import.md`.
```

---

## 3. File-size constraint

```
$ wc -l docs/migracion/README-clientes-import.md
     300 docs/migracion/README-clientes-import.md
```
Exactly at the 300-line ceiling for this file (per the sprint's file-size rule — the
650/1300-1600-line exemptions apply only to the generator and the two `.sql`
artifacts, neither of which applies here). Required content sections 1-11 all
present; trimmed for concision (several redundancy passes) to land at the ceiling
without cutting any required fact or citation.

---

## 4. `runbook-pass-condition-misdescribes-behavior` compliance — self-check

Every pass/fail claim traced to a literal line, re-verified in §1 above:
- §5's PROCEED/ABORT logic → `03` lines 1380-1383 (quoted verbatim).
- §7's three abort messages → `04` lines 1296, 1302, 1361 (quoted verbatim,
  `grep -c "RAISE EXCEPTION"` = 3, matching exactly).
- §7's "one transaction, no ROLLBACK" claim → `04` line 7 (`BEGIN;`), line 1363
  (`COMMIT;`), and the file-wide `ROLLBACK` grep (0 executable hits, 1 comment-only
  hit, matching the repo's own `02-cleanup-execute.sql` precedent).
- §4's freeze rationale → `app/clientes/registrar/page.tsx:193-199`,
  `lib/provisional-system.ts:132-142` (re-verified live, §1).
- §9's audit-side-effect claims → traced to T1's live trigger dump (`audit_clientes`
  absent; `audit_reservas` + `trigger_update_reservas_fecha_editado` present),
  reports/t01-dev.md Q3/Q6.

## 5. `destructive-op-named-in-rollback-note` compliance — self-check

- §2, §7, and §11 each state, in the same sentence as the reference to the execute
  command/step, that a committed run is undoable only by restoring the Step 2
  backup, and that there is no undo script.
- No destructive git verb anywhere (checked, §7 below): the only repo-level rollback
  instruction is `rm docs/migracion/README-clientes-import.md` for removing this
  file itself, matching the style already used in `reports/t01-dev.md` §AC9 and
  `reports/t05-dev.md`'s own rollback section.

---

## 6. Redaction / PII check

```
$ grep -inE "git checkout|reset --hard|clean -fd|stash drop|force-push|force push|git reset" docs/migracion/README-clientes-import.md
(no output — 0 hits)

$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/migracion/README-clientes-import.md
(no output — 0 hits)

$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/migracion/README-clientes-import.md
269:name@domain.tld
```
The one email-shaped match is the illustrative placeholder pattern `name@domain.tld`
used to describe what a well-formed email looks like — not a real client email. No
client name, phone, cedula/RNC/identificacion value, connection string, or key
appears anywhere in the file. `README-cleanup.md` was read but not edited or quoted
verbatim beyond its format (headings/step structure), which is not PII.

---

## 7. `npm run qa`

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
   Start at  16:42:04
   Duration  3.73s (transform 2.21s, setup 3.66s, collect 3.97s, tests 1.00s, environment 8ms, prepare 4.26s)
```
Exit code `0`. `tsc --noEmit` clean (0 errors). `eslint .` 0 errors (28 pre-existing
warnings, identical shape to every prior round, all in `app/**`/`components/**` files
this task never touches). `825/825` tests pass across 30 files — pure regression gate
holds; no `app/`, `lib/`, `components/`, `hooks/`, or `tests/` file was touched.

---

## 8. Out-of-scope changes

None. Only in-scope files were touched (§0). `README-cleanup.md` was read for format
precedent only, never written to. Neither `.sql` file nor the generator was edited.
No live database query beyond read-only `grep`/`sed`/`wc` against files already on
disk (no network call, no live DB connection opened this task).

## Rollback

`docs/migracion/README-clientes-import.md` is new and untracked: `rm docs/migracion/
README-clientes-import.md` removes it. No database was touched by this task (it read
only local files); nothing to restore there. No git verb is needed or implied.
