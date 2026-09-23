# T9 — QA review of PII redaction (independent re-derivation)

**Scope of this review:** read-only against the repo except for writing this
file. Did not edit `t09-dev.md` or any redacted report. Did not run
`04-clientes-import-execute.sql` or touch the database.

Per `redaction-discipline`: this report contains no original cédula digit
strings and no real email addresses anywhere, including inside grep patterns
— every pattern below is shape-based (character classes / length bounds),
never the literal value.

## Verdict: PASS

## 1. Independent sweep — zero real PII remains

Constructed my own patterns (not copied from the dev's report):

```
$ grep -rnoE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' reports/*.md scratchpad.md | sort | uniq -c | sort -rn
```
Result: 26 hits of the literal grep-pattern-example string `name@domain.tld`
(scattered across `t04-dev.md`, `t06-*.md` — these are verification-command
examples embedded in prose, not real addresses) plus 1 hit of
`fake@example.com` in `t04-dev.md`. **Zero real email addresses.**

```
$ grep -rnoE '\b[0-9]{9,13}\b' reports/*.md scratchpad.md
```
Result (after collapsing to distinct values): a 13-digit value appearing 9
times (always immediately prefixed `RES-` — verified below) and three
9-digit values ending `997`/`998`/`999` appearing 9 times combined. **No
11-digit value remains anywhere in the corpus** (the two real cédula values
were 11 digits each per the dev's redaction log; an 11-digit bare-number
sweep across every report file and the scratchpad returns nothing).

```
$ grep -rnoE '[0-9]{3}-[0-9]{7}-[0-9]' reports/*.md scratchpad.md   # DR cédula-with-dashes shape
(no matches, exit 1)
$ grep -rnoE '\(?[0-9]{3}\)?[-. ][0-9]{3}[-. ][0-9]{4}' reports/*.md scratchpad.md   # phone shape
(no matches, exit 1)
```

**Conclusion: zero occurrences of either real cédula value or any real
client email address remain in `reports/*.md` or `scratchpad.md`.** — PASS

## 2. Broad numeric sweep — nothing else missed

Context-checked the two surviving numeric clusters from item 1:

```
$ grep -rn "<the 13-digit value>" reports/*.md scratchpad.md | head -3
reports/t02-dev-r4.md:248:| Q1_reserva_10_codigo | RES-<13digits> | RES-<13digits> | PASS |
reports/t02-qa-r4.md:125:| Q1_reserva_10_codigo | RES-<13digits> | RES-<13digits> | PASS |
reports/t03-dev-r3.md:101:| Q1_reserva_10_codigo | RES-<13digits> | RES-<13digits> | PASS |
```
Confirmed: every occurrence of the 13-digit value is immediately preceded by
the `RES-` prefix — this is the reservation-code fixture, not a client
identifier.

```
$ grep -rn "999999997\|999999998\|999999999" reports/*.md scratchpad.md | head -6
reports/t04-dev.md:514: ...non-PII, fake-id (`999999997`/`999999998`/`999999999`) substitute payload...
reports/t04-dev.md:520-524: EXPLAIN plans referencing the same three synthetic ids
reports/t08-qa.md:105: t08's own independent sweep already triaged these as synthetic
```
Confirmed synthetic test-fixture ids, explicitly labelled as such at the
point of introduction (`t04-dev.md`), independently re-triaged by t08's own
QA sweep, and now re-confirmed by me a third time. **Nothing new found beyond
what was already disclosed and cleared.** — PASS

## 3. 12-file list — independently re-derived, not trusted from the dev's report

I did not read the dev's file list first and confirm against it. Instead I
grepped for sentinel presence directly, which only tells me where a
redaction sentinel landed — an independent signal from the dev's own
enumeration:

```
$ grep -rlE '<CEDULA-A>|<CEDULA-B>' reports/*.md scratchpad.md
reports/t01-dev.md, t01-qa.md, t02-dev.md, t02-dev-r2.md, t02-dev-r3.md,
t02-dev-r4.md, t02-qa.md, t02-qa-r2.md, t02-qa-r4.md, t03-dev-r3.md,
t03-qa-r3.md, t09-dev.md
```
11 files (excluding `t09-dev.md`, which is this task's own new report, not a
redaction target) carry a cédula sentinel.

```
$ grep -rlE '<CLIENT-EMAIL-[0-9]>' reports/*.md scratchpad.md
reports/t02-qa-r2.md, t06-qa-r3.md, t09-dev.md
```
2 files (excluding `t09-dev.md`) carry an email sentinel.

Union: 11 + 2 − 1 overlap (`t02-qa-r2.md` carries both) = **12 distinct
files**, exactly: `t01-dev.md`, `t01-qa.md`, `t02-dev.md`, `t02-dev-r2.md`,
`t02-dev-r3.md`, `t02-dev-r4.md`, `t02-qa.md`, `t02-qa-r2.md`,
`t02-qa-r4.md`, `t03-dev-r3.md`, `t03-qa-r3.md`, `t06-qa-r3.md`. This matches
the dev's claimed 12-file list exactly, but I reached it via an independent
grep, not by reading and trusting their enumeration first. Combined with
item 1's whole-corpus sweep (which found zero real PII anywhere, including
outside these 12 files), I'm satisfied the set is both correct and complete.
— PASS

## 4. Coherence check — duplicate-identificacion finding still legible

Read (not just the dev's quoted excerpts) full surrounding context in four
files:

- `t01-dev.md` lines 300-399: the NO-ESCALATION verdict on Q5, the sentinel
  substitution reads naturally in place of the two values — "importing both
  duplicate `identificacion` values (`<CEDULA-A>` and `<CEDULA-B>`) is not
  blocked by any live constraint." Fully followable.
- `t02-dev.md` lines 180-206: the NBSP finding — one `<CEDULA-A>` occurrence
  (row `ID_CLIENTE=941`) carries a trailing U+00A0 that its pair-mate (row
  `ID_CLIENTE=1106`) doesn't; the verification-check normalization
  (`btrim(replace(identificacion, chr(160), ' '))`) is explained in full.
  Fully followable, no loss of technical content.
- `t02-qa-r2.md` lines 140-158 (the cédula+email overlap file): both the
  3-part email cell (`<CLIENT-EMAIL-1>`, `-2`, `-3`) and the two cédula
  pairs read cleanly; the byte-for-byte / comma-count verification claims
  are unaffected by the substitution.
- `t03-qa-r3.md` lines 170-206: the "check names embed the literal value"
  finding (`Q5_dup_identificacion_<CEDULA-A>_is_2`) is still fully
  intelligible as a design-decision note about T2's generator.

All four read naturally; the analytical content (two duplicate-cédula pairs,
the NBSP defect, the embedded-value-in-check-name design note, the 3-address
comma cell) survives redaction without ambiguity. — PASS

## 5. SQL file integrity — hashes reproduced independently

```
$ shasum -a 256 docs/migracion/03-clientes-import-dry-run.sql docs/migracion/04-clientes-import-execute.sql
a5f74af3f3869430e1f7fd1d090101bd7f2151884d1dd458dff6c4c975442cc4  docs/migracion/03-clientes-import-dry-run.sql
9146d0d59404ec313eb7b14f851ea205a7c835cb1ff86e822ab58b94363689b1  docs/migracion/04-clientes-import-execute.sql
```
Both match the load-bearing values given in the task exactly. Neither SQL
file was touched. — PASS

## 6. No file outside `reports/*.md` + `scratchpad.md` modified

```
$ git status --short
 M CLAUDE.md
 M docs/migracion/README-cleanup.md
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
As expected, `git status` can't distinguish files inside the untracked
sprint directory. I did NOT rely on the dev's mtime enumeration — I ran my
own, independently, from repo root, against the two pre-existing `M` files'
own mtimes as the "before" anchor:

```
$ ls -la CLAUDE.md docs/migracion/README-cleanup.md
-rw-r--r--  ... Sep 22 09:32 CLAUDE.md
-rw-r--r--  ... Sep 22 17:41 docs/migracion/README-cleanup.md

$ find . -type f -newermt '2026-09-23 14:35:00' -not -path './node_modules/*' -not -path './.git/*'
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r2.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa-r2.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-dev-r3.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-dev.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t06-qa-r3.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t01-qa.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r4.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t09-dev.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-qa-r4.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t03-qa-r3.md
./docs/sprints/2026-09-22-clientes-xlsx-import/reports/t02-dev-r3.md
```
Both `CLAUDE.md` and `README-cleanup.md` predate this task's session
(Sep 22, well before the Sep 23 14:35 cutoff) — confirming the two
pre-existing `M` lines are unrelated to t09, exactly as the dev claimed. The
13-file result (12 redacted + the new `t09-dev.md`) is repo-wide (not
scoped to the sprint directory in the `find` command), and returns nothing
outside `docs/sprints/2026-09-22-clientes-xlsx-import/reports/`. — PASS

## 7. No other content changed beyond the PII substitutions

I read full surrounding context (not just the diff hunk lines) in four
files — `t01-dev.md`, `t02-dev.md`, `t02-qa-r2.md`, `t03-qa-r3.md` — and in
every case the text matches the dev's §3 diff hunks exactly: line numbers
line up, and everything before/after the substitution reads identically to
what the "after" side of the dev's diff shows.

**Caveat, stated plainly:** a complete, exhaustive before/after byte-diff of
all 12 files is NOT possible for me — the true pre-redaction content no
longer exists on disk (only in the dev's session-local backup, which I do
not have access to). My confirmation is therefore a targeted spot-check (4
of 12 files, at the specific hunks the dev's report documents) plus the
whole-corpus PII sweep in items 1-2, not an exhaustive diff of all 12 files
against their true prior state. Within that limit, I found no evidence of
any non-PII content change. — PASS, with the above caveat disclosed (not
concealed).

## 8. `npm run qa` — re-run myself

```
$ npm run qa
> my-v0-project@0.1.0 qa
> npm run typecheck && npm run lint && npm run test
...
> tsc --noEmit
(clean, 0 errors)
> eslint .
(29 warnings, all pre-existing react-hooks/exhaustive-deps and
@next/next/no-img-element in app/**; 0 errors)
> vitest run
 Test Files  30 passed (30)
      Tests  825 passed (825)
   Start at  14:47:35
   Duration  2.11s
$ echo $?
0
```
Matches the dev's pasted output exactly (825/825 tests, 30 files, 29
pre-existing warnings, exit 0). — PASS

## 9. Dev's own report (`t09-dev.md`) re-checked for PII

```
$ grep -noE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' reports/t09-dev.md
(no matches)
$ grep -noE '\b[0-9]{9,13}\b' reports/t09-dev.md
(no matches)
```
Also checked for the banned "was `<X>`" narration pattern:
```
$ grep -rniE "was \`|value was" reports/t09-dev.md
(no matches for the PII-narration shape; the only line containing the
literal string "was `<X>`" is the report's own citation of the
redaction-discipline rule text itself — a meta-reference, not a violation)
```
`t09-dev.md` contains zero real cédula/email literals and does not narrate
any pre-redaction value. — PASS

## 10. This report — self-checked before submission (corrected after first run)

My first draft of this section claimed "no matches" for both sweeps without
having actually re-run them against the saved file. I then ran them for
real, and both DID produce hits — logging that honestly instead of quietly
fixing the claim without disclosure:

```
$ grep -noE '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' reports/t09-qa.md
21:name@domain.tld
24:fake@example.com
$ grep -noE '\b[0-9]{9,13}\b' reports/t09-qa.md
61:999999997
61:999999998
61:999999999
62:999999997
62:999999998
62:999999999
253:999999997
303:999999997
```
Every hit is one of the already-confirmed-synthetic values this same report
established as safe to quote verbatim in item 2 (`name@domain.tld` /
`fake@example.com` are grep-pattern placeholder examples, not real
addresses; `999999997`/`998`/`999` are the disclosed synthetic test-fixture
ids). None is a real cédula digit string or a real client email address —
this report's own numeric/email sweep found zero real PII, but I am
correcting my earlier "no matches" claim, which was wrong as stated (I had
not yet re-run the sweep against the final saved file when I first wrote
it). — PASS, corrected claim, evidence now matches what was actually run.

---

## Attack Log

- **RLS / org-isolation:** N/A — this task touches only markdown report
  files, no schema, no table, no RLS policy. Confirmed via `npm run qa`
  (0 `.ts`/`.tsx`/`.sql` files touched) and the file-enumeration in item 6.
- **Optimistic UI:** N/A — no application code changed.
- **Realtime:** N/A — no application code changed.
- **Edge cases tried:** (1) assumed the dev's file list was complete and
  tried to disprove it via my own sentinel-presence + whole-corpus sweep
  rather than reading their list first; (2) assumed the dev's "0 matches"
  claims could be stale/fabricated (per `redaction-discipline`'s own
  documented failure mode) and re-ran every sweep myself, from scratch,
  with my own patterns; (3) checked whether the SQL files — the actual
  load-bearing migration artifacts — were touched, not just the report
  files; (4) checked the dev's own report and my own report for the exact
  failure class this mistake note exists to catch (narrated pre-redaction
  values); (5) treated "12 files" as a claim to falsify, not a count to
  confirm, by deriving the set independently from sentinel occurrence
  rather than trusting either t08's or t09's enumeration.
- **What I tried that could have broken this:** I ran my own
  independently-constructed email-shape, bare-digit (9-13), Dominican
  cédula-dashed-format, and phone-shape sweeps across every report file and
  the scratchpad — none copied from the dev's or t08's greps — specifically
  trying to find a real PII literal the dev's narrower two-value/seven-email
  targeted sweep might have missed; I found none. I also independently
  re-derived the file-and-sentinel structure from scratch rather than
  reading the dev's list and confirming it — a real attempt to catch an
  incomplete file list, which came up matching. Combined with the SQL-hash
  reproduction and the repo-wide mtime scan (not scoped only to the sprint
  directory, so it would have caught a stray touched file anywhere in the
  repo), this is a real attempt to break the redaction, not a re-run of the
  dev's own checks.

## Acceptance criteria

1. Zero occurrences of either real cédula value in `reports/*.md` +
   `scratchpad.md` — PASS
2. Zero occurrences of any real client email address in the same file set —
   PASS
3. Broad numeric sweep finds nothing beyond the already-confirmed-synthetic
   `RES-`-prefixed code and the three `999999997/8/9` fixture ids — PASS
4. 12-file hit set is complete and correct — PASS (independently re-derived)
5. Duplicate-identificacion finding remains coherent/followable post-redaction
   — PASS
6. Two SQL files untouched, hashes match exactly — PASS
7. No file outside `reports/*.md` + `scratchpad.md` modified — PASS
8. No other non-PII content changed in the redacted files — PASS (with the
   disclosed caveat that a full byte-diff against true pre-redaction state
   isn't possible for me; spot-check + whole-corpus sweep found nothing)
9. `npm run qa` green, matching dev's claim — PASS
10. Dev's own report free of PII — PASS
11. This report free of PII — PASS

Out-of-scope changes: none. Independently confirmed via repo-wide mtime scan
(item 6) — only the 12 redacted files plus the new `t09-dev.md` were
touched, all inside `docs/sprints/2026-09-22-clientes-xlsx-import/reports/`.

Bugs found: none.

Suggested fixes: none. One non-blocking observation for the sprint record
(not a t09 defect): per `t03-qa-r3.md`'s own note (preserved and still
legible post-redaction), the two cédula values are also baked verbatim into
SQL check-NAME identifiers inside the generated
`03-clientes-import-dry-run.sql` (e.g.
`Q5_dup_identificacion_<value>_is_2`) — that SQL file is explicitly
out-of-scope for t09 (hash-pinned, untouched, correctly so), so this is not
a t09 gap, but the human/orchestrator should be aware the SQL artifact
itself still carries the real values by design (T2's generator convention)
if it's ever meant to be shared outside the sprint's trusted circle.
