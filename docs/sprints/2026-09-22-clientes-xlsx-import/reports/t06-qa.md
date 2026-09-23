# T6 — operator runbook QA report

**Verdict: FAIL**

One disclosed data-quality figure in §10 of the runbook is numerically wrong and
internally inconsistent with a number quoted one clause earlier in the very same
sentence. Everything else independently re-derived (dry-run PROCEED/ABORT logic, the
3 RAISE EXCEPTION sites and their exact text, the BEGIN/COMMIT/no-ROLLBACK claim, the
app-source freeze citations, scope, redaction, destructive-git-verb sweep, file
length, `npm run qa`) checks out byte-for-byte. The one mismatch is enough to fail
this task under its own governing rule (`runbook-pass-condition-misdescribes-behavior`
— every claim must trace to the literal SQL/data; this one doesn't).

---

## Commands run

```
$ wc -l docs/migracion/README-clientes-import.md
     300 docs/migracion/README-clientes-import.md
```

```
$ wc -l docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
    1384 docs/migracion/03-clientes-import-dry-run.sql
    1363 docs/migracion/04-clientes-import-execute.sql
```

```
$ sed -n '1370,1384p' docs/migracion/03-clientes-import-dry-run.sql
...
SELECT
  CASE WHEN EXISTS (SELECT 1 FROM _checks WHERE expected <> actual)
    THEN '*** ABORT *** at least one check above FAILed — investigate before writing any execute script.'
    ELSE 'PROCEED — every Q1-Q6 check above reads PASS. Still a human decision to run any execute script.'
  END AS veredicto_final,
  (SELECT count(*) FROM _checks WHERE expected <> actual) AS fallas;
```
`awk` confirmed the exact line numbers: 1380 (`CASE WHEN EXISTS...`), 1381 (`THEN
'*** ABORT ***...`), 1382 (`ELSE 'PROCEED...`), 1383 (`END AS veredicto_final,`).
**Matches runbook §5 verbatim, lines 1380–1383 as cited.** PASS.

```
$ grep -n "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
1296:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % pre-write guard(s) failed -- see _checks. Nothing written.', v; END IF; END $$;
1302:  RAISE EXCEPTION 'ABORT (G6): _jrosa_preserva must have exactly 1 row, found %.', (SELECT count(*) FROM _jrosa_preserva); END IF; END $$;
1361:  IF v > 0 THEN RAISE EXCEPTION 'ABORT: % post-condition(s) failed -- see _post_checks. Rolling back.', v; END IF; END $$;

$ grep -c "RAISE EXCEPTION" docs/migracion/04-clientes-import-execute.sql
3
```
All 3 quoted messages in runbook §7 match verbatim at the cited lines (1296, 1302,
1361). **PASS.**

```
$ grep -n "^BEGIN;\|^COMMIT;" docs/migracion/04-clientes-import-execute.sql
7:BEGIN;
1363:COMMIT;

$ grep -n "ROLLBACK" docs/migracion/04-clientes-import-execute.sql
3:-- WRITES clientes + reservas. One transaction; always really COMMITs or ABORTs whole -- no ROLLBACK statement in this file.
```
Only hit is a comment; zero executable `ROLLBACK`. Runbook §7's "one transaction,
BEGIN(7)…COMMIT(1363), no ROLLBACK" claim — **PASS.**

```
$ cat -n app/clientes/registrar/page.tsx | sed -n '190,206p'
   193	        const { data: maxIdData } = await supabase
   194	          .from("clientes")
   195	          .select("id")
   196	          .order("id", { ascending: false })
   197	          .limit(1)
   198	        
   199	        const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1

$ cat -n lib/provisional-system.ts | sed -n '128,144p'
   132	    const { data: maxIdData } = await supabase
   133	      .from(tabla)
   134	      .select("id")
   135	      .order("id", { ascending: false })
   136	      .limit(1)
   137	    
   138	    const nextId = (maxIdData && maxIdData.length > 0 ? maxIdData[0].id : 0) + 1
```
Both citations in runbook §4 (`app/clientes/registrar/page.tsx:193-199`,
`lib/provisional-system.ts:132-142`) hold exactly, live, today. **PASS.**

```
$ grep -inE "git checkout|reset --hard|clean -fd|stash drop|force-push|force push|git reset" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -inE "postgres://|postgresql://|service_role|anon_key|eyJ|sslmode=require&|@.*\.supabase\.co" docs/migracion/README-clientes-import.md
(no output, exit 1 — 0 hits)

$ grep -noE "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}" docs/migracion/README-clientes-import.md
269:name@domain.tld

$ grep -noE "[0-9]{6,}" docs/migracion/README-clientes-import.md
(no output — no cedula/RNC/phone-shaped digit strings)
```
No destructive git verb, no connection string/key, no real PII beyond the two
already-precedented identifiers. **PASS.**

```
$ grep -rl "JROSA" docs/sprints/2026-09-22-clientes-xlsx-import/reports/
t02-dev.md t04-dev-r2.md t04-dev.md t04-qa-r2.md t05-dev.md t05-lead.md t05-qa.md t06-dev.md
$ grep -rl "MELISSA" docs/sprints/2026-09-22-clientes-xlsx-import/reports/
t04-dev.md t05-dev.md t06-dev.md
```
Both names are pre-existing precedent in this sprint's own reports (T2/T4/T5), not a
fresh leak introduced by T6. **PASS.**

```
$ git status --short
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
`docs/migracion/README-cleanup.md` shows no `M`/`??` (tracked, unmodified). Neither
`.sql` file nor the generator was touched (both pre-existing `??`, `git diff` shows no
diff possible since untracked and byte-identical per prior rounds' recorded hashes —
consistent with dev's claim). `CLAUDE.md`'s `M` predates this session (was already
modified per the session's opening git-status snapshot, unrelated to T6). **Scope:
PASS — out-of-scope changes: none.**

```
$ npm run qa
> tsc --noEmit    (clean, 0 errors)
> eslint .        (28 pre-existing warnings, 0 errors — identical set to prior rounds)
> vitest run      Test Files  30 passed (30) / Tests  825 passed (825)
Exit code: 0
```
Full output re-run independently, matches dev's pasted output exactly (same 28
warning lines, same file list, same 825/825). Pure regression gate — no `app/`,
`lib/`, `components/`, `hooks/`, or `tests/` file touched this task. **PASS.**

`psql` is not installed in this QA sandbox (`which psql` → not found), so the `psql`
channel itself was not re-executed live by me this round. I did not attempt to
re-trigger `supabase db query`'s multi-statement failure live either, because doing so
requires live production credentials (`--linked`/`--db-url`) and this task's own
project memory (`elibry-supabase-521-is-transient`) plus sprint brief
(`environment-reliability-incidents`) counsel against an unplanned agent-initiated
live-DB touch outside a scoped task. **COULD NOT RUN: live psql/`supabase db query`
re-trigger** (no `psql` binary here; live CLI re-trigger against production is out of
this QA task's scope). Substituted with cross-report consistency check instead (below),
which is what the task brief asked for as the fallback.

```
$ grep -rln "cannot insert multiple commands" docs/sprints/2026-09-22-clientes-xlsx-import/reports/
t03-qa-r2.md  t06-dev.md  t03-dev-r3.md  t03-dev-r2.md  t03-lead.md  t03-dev.md
t02-qa-r4.md  t03-qa.md
```
The "hard wire-protocol limit, confirmed independently 3 separate times" claim is
corroborated across at least 7 prior reports (T2 r4, T3 base/r2/r3, T3 lead/qa/qa-r2),
well past the "3 times" the runbook states — **PASS, consistent.**

```
$ sed -n '56,90p' docs/sprints/2026-09-22-clientes-xlsx-import/reports/t05-dev.md
```
Confirms `psql` via `brew install libpq` against the **unmodified**
`POSTGRES_URL_NON_POOLING` (no TLS weakening, no `ssl:{rejectUnauthorized:false}`) is
the real, working, TLS-safe channel T6 carries forward. Runbook §3 matches this
exactly (no SSL-disabling instruction, references the env var only, never prints the
string). **PASS.**

---

## Independent numeric audit (data-quality disclosure, §10)

Runbook §10 states: *"45 rows have an email value that doesn't match a normal
`name@domain.tld` shape, and roughly 644 rows carry a placeholder or empty email."*

The `45` is directly SQL-sourced and correct:
```
$ grep -n "Q5_dirty_email_count" docs/migracion/03-clientes-import-dry-run.sql
INSERT INTO _checks(name, expected, actual) VALUES ('Q5_dirty_email_count', '45',
  (SELECT count(*)::text FROM _clientes_import WHERE email <> 'N/A'
   AND btrim(replace(email, chr(160), ' ')) !~ '^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$'));
```

But there is **no SQL check anywhere in either file for a "644" figure** — it is not
traceable to any literal line. I independently parsed all 1,231 data tuples out of
`03-clientes-import-dry-run.sql`'s `_clientes_import` INSERT block (field 14 = email,
verified against the file's own column list) with a quote-aware tokenizer, and
reproduced the SQL's own dirty-email predicate exactly to validate the parser first:

```
total rows: 1231
email == 'N/A' (placeholder): 599
email == '' (empty): 0
non-N/A regex-mismatch ("dirty"): 45   <- matches Q5_dirty_email_count exactly (validates parser)
599 (placeholder) + 45 (dirty) = 644
```

**The actual placeholder/empty-email count is 599, not "roughly 644."** The number
644 the runbook quotes is the *sum* of the placeholder count (599) and the already-
separately-disclosed dirty count (45) — i.e. the runbook accidentally states the
combined total as if it were the placeholder-only subcategory, in the same sentence
that also names the 45 separately. Read literally, the sentence implies two disjoint
buckets (45 + ~644 = ~689 problem emails); the true total is 644 (45 + 599). This is
exactly the failure mode this task's own governing rule targets: a runbook stating a
figure that does not match what the shipped SQL/data actually produces, uncited to
any literal source because no such literal source exists for "644" as a placeholder
count.

This does not affect the safety of the destructive execute step (backup, freeze,
channel, abort messages, transaction semantics are all correct) — it is a data-quality
disclosure aimed at helping the operator set expectations for later manual
`/clientes/editar` cleanup. But it is a factual inaccuracy in a document whose entire
premise (line 5-6) is "every claim below points at a literal line of those files so
you can check it yourself" — this claim doesn't, and is wrong when checked.

---

## Acceptance criteria (against task brief's 11 required sections)

1. Plain-language description (§1) — PASS
2. Mandatory backup step, irreversibility in same sentence (§2) — PASS
3. Channel guidance, no TLS weakening, no printed connection string (§3) — PASS
4. Client-creation freeze incl. "sequence-advance is belt-and-braces, not a fix" (§4) — PASS
5. Dry-run step with cited, verbatim pass condition (§5) — PASS
6. Sign-off checklist (§6) — PASS
7. Execute step with exactly 3 quoted, verbatim abort messages (§7) — PASS
8. Post-run verification queries (§8) — PASS
9. Disclosed side effects: `audit_clientes` absence, `audit_reservas`, `fecha_editado` (§9) — PASS
10. Disclosed loose ends: dangling `cambios_provisionales id=69`, stale header comment,
    malformed emails, partial guard rehearsal, t04 §8e disclosure (§10) — **FAIL**
    (the malformed/placeholder-email sub-bullet contains a wrong, unsourced number —
    see numeric audit above; the other four loose-end bullets in §10 are all
    independently verified correct)
11. Rollback section, no destructive git verb, irreversibility named in same sentence
    as the causing command (§11) — PASS

File length: 300 lines, at but not over the 300-line ceiling — PASS.

---

## Out-of-scope changes

None. `git status --short` shows exactly one new file (`docs/migracion/
README-clientes-import.md`) plus this task's own report/scratchpad edits inside the
already-`??` sprint directory. `README-cleanup.md`, both `.sql` files, and the
generator are untouched. `CLAUDE.md`'s pending `M` predates this session and this task.

## Bugs found

**§10, malformed-email disclosure bullet: "roughly 644 rows carry a placeholder or
empty email" is wrong.** The real count of rows with `email = 'N/A'` (the only
placeholder value used) or a truly empty email is **599**, independently verified by
parsing all 1,231 `_clientes_import` rows out of `03-clientes-import-dry-run.sql`.
`644` is actually `599 (placeholder) + 45 (already-disclosed dirty count)` — the
runbook states this combined total as if it were the placeholder-only figure, in the
same sentence that also cites the 45 separately, which (read literally) implies two
disjoint categories totaling ~689 rather than the true 644. No line in either SQL file
computes or checks a "644" value — it is unsourced/untraceable, violating this task's
own `runbook-pass-condition-misdescribes-behavior` standard.

## Suggested fixes

In `docs/migracion/README-clientes-import.md` §10, change:
> "...and roughly 644 rows carry a placeholder or empty email."

to either:
- "...and 599 rows have `email = 'N/A'` (no other empty-email rows exist)." (the
  correct placeholder-only figure), or
- "...for a combined 644 rows (45 + 599) with either a malformed or a placeholder
  email." (if the intent was to state the combined total, make the arithmetic
  explicit instead of presenting 644 as a second, disjoint bucket).
Either fix should cite how the number was derived (e.g. "counted directly from the
1,231-row payload; not itself a dry-run check") since, unlike the 45, no dry-run
`_checks` row computes this number.

---

## Attack Log (adversarial QA required output)

- RLS: N/A — this task touches no table, no policy, no app code. Confirmed no
  `CREATE POLICY|ROW LEVEL SECURITY|GRANT|ALTER TABLE` appears in either SQL file
  (carried over from T1/architect's ADR 0011 finding; not re-litigated as it is
  outside this task's diff).
- Optimistic UI: N/A — documentation-only task, no UI code touched.
- Realtime: N/A — no subscriber-facing code touched.
- Edge cases tried: independently re-derived every cited line number and every quoted
  string against the live SQL files rather than trusting the dev's grep output;
  independently parsed the full 1,231-row payload to check a disclosed count instead
  of accepting it at face value; checked JROSA/MELISSA "already used, not fresh PII"
  claim by grepping actual prior reports rather than trusting the dev's assertion;
  checked the "confirmed 3 times" claim by grepping for the actual error string across
  all reports instead of trusting the count.
- What I tried that could have broken this: independently recomputed every numeric
  disclosure in §9/§10 from the raw SQL data rather than re-reading the dev's citations
  — this caught the one number (§10's "roughly 644") that does not match the data,
  which a re-run of the dev's own grep commands would never have caught since the dev
  never ran a check that computes 644 in the first place.

---

Rollback note (this QA task itself): this report and the scratchpad update are new/
appended-only; `rm docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-qa.md`
removes this report. No source file was edited by QA.
