# Clientes XLSX import — operator runbook

Read this whole file before running anything. It is written for the business owner
running the real import against the live production database — you do not need to
read the SQL files to follow it, but every claim below points at a literal line of
those files so you can check it yourself if you want to.

**Files in this directory relevant to this runbook:**
- `03-clientes-import-dry-run.sql` — read-only, zero risk, run first.
- `04-clientes-import-execute.sql` — writes real data, one real transaction, no
  dry-run mode. This is the irreversible step.
- `generate-clientes-import.py` — the generator that produced both files above from
  the pinned workbook. You do not need to run this; it is here for traceability only.

Spec: `docs/plans/clientes-xlsx-import.md`. Amendment: `docs/plans/clientes-xlsx-import-amendment-a.md`.

---

## 1. What this does, in plain language

This imports **1,231 clients** from the pinned spreadsheet into the live `clientes`
table, each at the exact `id` it has in the spreadsheet. One client already exists
in the live database today at `id = 15` ("JROSA"), and the spreadsheet also has its
own row 15 (a different client, "MELISSA") and its own row for JROSA at `id = 1185`.
To avoid a collision, this import:

1. Inserts all sheet rows except id 15 and id 1185.
2. Inserts sheet row 1185 (JROSA), but keeps JROSA's own 17 existing operational
   columns (things like its uploaded documents, image, and registration status) —
   it does not overwrite them with blanks just because the spreadsheet doesn't carry
   them.
3. Repoints the one reservation that currently points at JROSA (`reservas.id = 10`)
   to JROSA's new id, 1185.
4. Deletes the old id-15 row (JROSA, now safely moved to 1185 and no longer
   referenced by anything).
5. Inserts the sheet's own row 15 (MELISSA) into the now-free id.
6. Advances the database's internal id counter (the "sequence") past the highest id
   used, so future new clients don't collide with anything just imported.

After a successful run: `clientes` has exactly 1,231 rows, `reservas.id = 10` points
at client 1185 (JROSA, with its old data intact), and client 15 is MELISSA.

---

## 2. Backup — do this first, before anything else

Before touching anything else in this runbook, take a backup: in the Supabase
dashboard, go to **Database → Backups → Create backup now** (or run `pg_dump` against
the live connection string yourself if you prefer a local copy).

**If you run Step 7 below (`04-clientes-import-execute.sql`) and it commits
successfully, the only way to undo it is to restore this backup — there is no undo
script.** Do not proceed past this step without a backup you have personally
confirmed exists and is recent.

---

## 3. Which tool to run this through (read before you paste anything anywhere)

This sprint spent real time on this, so follow it exactly:

- **`supabase db query` (the Supabase CLI) CANNOT run either SQL file.** Both files
  contain many SQL statements in one file, and `supabase db query` sends text over a
  channel that only accepts one statement at a time. Attempting it fails with
  `cannot insert multiple commands into a prepared statement`. This is a hard
  Postgres wire-protocol limit, not an occasional glitch — it was hit and confirmed
  independently three separate times this sprint. **Do not use it for these files.**
- **The Supabase SQL editor (in the dashboard) DOES work.** Paste the whole file's
  contents into it and run it.
- **`psql` from a terminal DOES work**, and is the recommended channel for the real
  execute step because it is a plain command line, not a browser tab you might
  accidentally navigate away from mid-run. To set it up on a Mac that doesn't already
  have it: `brew install libpq`, add it to your shell's `PATH` for that session
  (e.g. `export PATH="/opt/homebrew/opt/libpq/bin:$PATH"`), then connect using your
  project's own `POSTGRES_URL_NON_POOLING` value exactly as it already exists in
  `.env.local` — do not modify or weaken it (no disabling SSL, no swapping the
  connection string). Once connected, run a file with:
  ```bash
  psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/03-clientes-import-dry-run.sql
  ```
  (Never print the actual connection string — reference it by env-var name only.)

**Bottom line: use the Supabase SQL editor or `psql`. Never `supabase db query`.**

---

## 4. Freeze client creation before you start (mandatory)

Between running the dry run (Step 5) and running the execute script (Step 7), **do
not create any new client through the app.**

Why this matters: both places in the app that create a client compute its `id`
themselves, as "the current highest id plus one" — not by asking the database for
the next value from its own counter: `app/clientes/registrar/page.tsx:193-199` and
`lib/provisional-system.ts:132-142`.

Today the highest id is 15, so a client created through the app right now would get
id 16 — which the spreadsheet also wants to use for one of its own rows. If that
happens, the execute script's own safety guard will catch the collision and **abort
the entire run without writing anything** — but it is still simpler and safer to just
not create any new client in that window.

To be clear: the "advance the sequence" step at the end (§1, step 6) is a
belt-and-braces measure, not a fix for this — it does not stop the app from creating
a colliding id, because the app never asks the database's sequence for a number in
the first place, it always computes `MAX(id)+1` itself. The sequence-advance step
only protects a hypothetical future write path that *does* consume the sequence. It
isn't what makes the freeze safe to skip. Keep the freeze in place for the whole
window between Step 5 and the end of Step 7.

---

## 5. Step — run the dry run (`03-clientes-import-dry-run.sql`)

This file is **read-only** — it contains zero `INSERT`/`UPDATE`/`DELETE`/`ALTER`
against any real table (its only `CREATE TABLE` is a session-local temp table that
disappears when your connection closes). You can run it as many times as you want,
in any order, safely.

Run it through the Supabase SQL editor or `psql` (never `supabase db query`, §3).

**How to read the output:** it produces two result grids. The first is a 42-row table,
one row per named check, each with an `expected`, `actual`, and `resultado` column.
The second is a single summary row with a `veredicto_final` column.

**The exact pass condition — read this, don't guess at it:** the file's own logic
(`03-clientes-import-dry-run.sql` lines 1380–1383) is:
```sql
CASE WHEN EXISTS (SELECT 1 FROM _checks WHERE expected <> actual)
  THEN '*** ABORT *** ...'
  ELSE 'PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.'
END AS veredicto_final
```
In plain terms: **you must see all 42 rows in the first grid read `PASS` in their
`resultado` column, AND the second grid's `veredicto_final` column must read exactly
`PROCEED — every Q1-Q6 check above reads PASS...`.** If even one row reads
`*** FAIL ***`, the summary will read `*** ABORT ***` instead — do not proceed to
Step 7 if that happens; stop and get help.

This dry run already ran live against production twice in a row this sprint with a
clean 42/42 PASS / PROCEED result both times — but confirm it again with a fresh run
before proceeding, since time has passed and the data may have changed.

---

## 6. Sign-off checklist before running the execute script

Before you run Step 7, confirm all of the following:

- [ ] You took a backup in Step 2 and have verified it exists.
- [ ] You ran the dry run in Step 5 just now (not "a few days ago") and it showed
      42/42 `PASS` and `veredicto_final = PROCEED`.
- [ ] No new client has been created through the app since you ran the dry run, and
      you will not create one until this whole process is finished (§4).
- [ ] You are using the Supabase SQL editor or `psql` — not `supabase db query` (§3).
- [ ] You understand that once you run Step 7 and it commits, the only way back is
      the backup from Step 2 (§2, §8).

---

## 7. Step — run the execute script (`04-clientes-import-execute.sql`)

**This step writes real data and cannot be undone except by restoring the Step 2
backup.**

The whole file is one transaction: it opens with `BEGIN;` (line 7) and closes with
`COMMIT;` (line 1363). There is no `ROLLBACK` statement anywhere in the file — it
either commits everything, or an error aborts the entire transaction and Postgres
discards everything automatically, with nothing written.

Run it through the Supabase SQL editor or `psql` (§3):
```bash
psql "$POSTGRES_URL_NON_POOLING" -f docs/migracion/04-clientes-import-execute.sql
```

**Messages you might see, and what each one means** (there are exactly 3
`RAISE EXCEPTION` statements in the whole file — grep-confirmed, cited by line below):

1. **Line 1296** — `ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.`
   One or more of the same 42 checks the dry run ran came back different this time
   (e.g. live data changed between your dry run and this run). Nothing was written.
   Go back to Step 5, re-run the dry run, find out what changed, and only proceed
   once it reads clean again.
2. **Line 1302** — `ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.`
   The script could not find exactly one existing client at id 15 right before
   writing (it expects the live JROSA row still there, unchanged, when it captures
   her data to preserve it). Nothing was written. Stop and investigate — someone or
   something changed client id 15 between your dry run and this run.
3. **Line 1361** — `ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.`
   The script finished writing but one of its 33 after-the-fact checks (row count,
   JROSA's preserved data, the reserva repoint, etc.) came back wrong. The whole
   transaction is discarded automatically — nothing is actually committed, despite
   the writes having happened earlier in the same transaction. Stop and get help.

**Success** looks like the script running to completion with a normal `COMMIT` and no
`ERROR` lines in the output.

---

## 8. Step — verify the result yourself, after a successful run

Run these yourself (Supabase SQL editor or `psql`) and compare to the expected
answer shown:

```sql
SELECT count(*) FROM clientes;
-- expected: 1231

SELECT id, nombre_comercial, razon_social, estado_registro, imagen_url, documentos_urls
FROM clientes WHERE id = 1185;
-- expected: this is JROSA, and estado_registro/imagen_url/documentos_urls (her old
-- operational data) are intact, not blank

SELECT id, nombre_completo FROM clientes WHERE id = 15;
-- expected: this is MELISSA (the sheet's own row 15), not JROSA

SELECT cliente_id FROM reservas WHERE id = 10;
-- expected: 1185

SELECT count(*) FROM reservas;
-- expected: 1 (unchanged — this import never adds or removes a reserva, only
-- repoints the existing one)
```

If any of these does not match, stop, do not attempt to fix it manually, and restore
the Step 2 backup.

---

## 9. Side effects — disclosed, not hidden

- **This import produces zero new rows in the `auditoria`/`audit_logs` tables from
  the `clientes` side.** The plan originally assumed roughly 1,232 such rows (one
  per insert, via a trigger named `audit_clientes`). That trigger **does not exist**
  on the live `clientes` table — confirmed by direct inspection of live triggers.
  So the 1,231 inserts, the JROSA relocation insert, and the id-15 delete write no
  audit rows at all.
- **The one real audit side effect** is a single new row in `audit_reservas`, caused
  by the one `UPDATE reservas` statement (line 1313) that repoints reserva 10 to
  JROSA's new id. That same `UPDATE` also rewrites `reservas.fecha_editado`, via the
  existing trigger `trigger_update_reservas_fecha_editado` (fires on any `UPDATE` to
  `reservas`). Expected, not a bug.
- `clientes.fecha_editado` is **not** touched for anyone, including JROSA — the script
  never runs an `UPDATE` against `clientes` (JROSA's relocation is delete-then-
  reinsert, not update), so the trigger that rewrites it (`UPDATE`-only) never runs.

---

## 10. Known loose ends — disclosed, not resolved by this import

- **A pre-existing, unrelated dangling record.** There is already a row in
  `cambios_provisionales` (`id = 69`, `tabla_afectada = 'clientes'`,
  `registro_id = 15`, `estado_cambio = 'PENDIENTE'`) that predates this import
  entirely — a pending change request left over from before this sprint started.
  This import does not touch or resolve it. After this import runs, that row's
  `registro_id = 15` will point at whoever holds id 15 going forward — i.e.
  **MELISSA, not JROSA** (JROSA has moved to 1185; this row is not updated to follow
  her). If that pending change request is ever acted on later, whoever handles it
  needs to know it now points at the wrong client.
- **A harmless stale comment in `03-clientes-import-dry-run.sql`.** Its header (line
  7) says "Companion (future tasks, not yet generated): 04-clientes-import-execute.sql"
  — but `04` has already been generated and sits right next to it in this directory.
  Leftover from when `03` was generated before `04` existed; cosmetic only (a
  comment, not executable SQL), deliberately left as-is because touching `03`'s
  bytes would invalidate the live, already-verified dry-run proof this sprint
  recorded against its exact current contents. Harmless; recorded, not fixed.
- **Some imported email addresses are not well-formed; this import does not clean them
  up.** 45 rows fail the `name@domain.tld` shape (`Q5_dirty_email_count`); 599 have
  `email = 'N/A'` (`Q4_backfill_email_599`; 0 empty); combined: 644 (45+599) — a sum,
  not a check value. This import backfills missing data — it does not clean existing
  dirty values. If someone later opens one of these clients in `/clientes/editar` and
  tries to save without fixing the email first, the form's own email validation will
  reject the save until it's corrected. Accepted consequence of "backfill, don't clean."
- **Not every individual safety check was fired live and watched abort on its own**
  before this run. Two of the 42 pre-write checks and one of the 33 after-the-fact
  checks were each individually proven this sprint to genuinely raise an error when
  violated (tested both ways: real current data doesn't trigger them, a
  deliberately-broken copy does). That proves the shared raise-on-mismatch mechanism
  all 42+33 checks use — not every remaining check was fired individually.
- **The full execute script has never been run end-to-end for real by anyone before
  you.** It has been verified as thoroughly as possible without committing a real
  run (its exact live SQL text read, its guard logic tested without letting it
  write, its statements validated as well-formed without executing them for real) —
  but no one has run it start to finish and watched it actually commit. You are the
  first real run. Disclosed so you go in with accurate expectations, not because of
  a known defect.

---

## 11. Rollback

- **If Step 7 committed successfully:** the only way to undo it is to **restore the
  backup you took in Step 2** — there is no undo script for a committed run of
  `04-clientes-import-execute.sql`.
- **If Step 7 aborted with any of the three messages in §7:** nothing was written —
  Postgres discarded the whole transaction automatically. There is nothing to roll
  back in the database.
- **If Step 5 (the dry run) was run, for any reason:** nothing was ever written — it
  is physically incapable of writing anything (§5). There is nothing to roll back.
- **To remove this file from the repository, if ever needed:** `rm docs/migracion/README-clientes-import.md`.
