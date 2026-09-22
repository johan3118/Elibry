# Mockup Census — Hide-or-Build Disposition (all HIDE)

Architect plan for the APPROVED, FROZEN spec "Mockup Census: Hide-or-Build Disposition".
Sprint intent: replace 18 fabricated-data screens with one honest "not available" stub,
remove every navigation entry point that reaches them, ship ZERO new data builds.

**Grounding date:** 2026-08-18. Every path, line number and symbol below was read from the
working tree at HEAD `3b551fe`, not from `CLAUDE.md`.

> **AMENDMENT 1 — 2026-08-18 (architect, on lead escalation of T7 after three QA send-backs).**
> T7's acceptance criterion #2 as originally written was **not achievable by static source
> scanning** — a plan-level defect, mine, not the dev's. The per-shape regex guards are hereby
> **DEMOTED to explicitly best-effort heuristics**, no further widening is required or permitted,
> and a binding **stopping rule** is added so this cannot be reopened. See
> **[RULING R1 — T7 mechanism demotion](#ruling-r1--t7-mechanism-demotion-2026-08-18)** below,
> the rewritten Test-plan block, and T7's amended ACs #2/#7/#8.
> Consequence for the sprint digest: `[[relocated-coverage-gap]]` is **PARTIALLY**, not fully,
> closed by this sprint.

---

## Architecture Reasoning (show your work)

### Invariants in play + existing mechanism each follows

| Invariant | Mechanism in THIS codebase | Effect of this sprint |
|---|---|---|
| Org isolation / RLS | **There is none.** Zero RLS across the ~29 tables ([[0011-elibry-single-tenant-for-now]]). The browser runs as PostgREST `anon` via `lib/supabase.ts:57` (`export const createClient = () => supabaseProxy`). | **Zero DDL, zero new tables, zero RLS statements.** This sprint only *removes* reads, so exposure can only shrink. ADR-0011 status is unchanged and no line of this plan may claim otherwise. |
| Fiscal integrity (NCF) | `app/facturacion/comprobantes/registrar/page.tsx:91` is the only live writer into `comprobantes_disponibles`. `comprobantes_fiscales` is a **supplier**-invoice table; no client invoice has ever been issued ([[0012-elibry-confirmacion-without-factura-numero]]). | Two routes fabricate NCFs today (`app/configuracion/page.tsx:58` → `"B0100000025"`; `app/facturacion/comprobantes/page.tsx:50-159` → six invented blocks incl. `"B0404000001"`). Their removal is **senior + HUMAN GATE**, own task (T6). No change to the registrar insert. |
| Optimistic UI + rollback | `lib/crm-casos-logic.ts` `buildCierreOptimista` is the repo's rollback precedent. | **N/A — this sprint adds and changes zero mutations.** No task may introduce one. |
| Realtime subscriptions | **None exist.** No `.channel(` / `.subscribe(` anywhere in the repo. | Nothing to keep payload-compatible. |
| Auth gating | `middleware.ts:4-18` performs **no** role check (it returns `NextResponse.next()` for everything). `components/auth-guard.tsx` only checks logged-in. `isAdmin` (`lib/user-context.tsx:81`) is used for *rendering*, never for route access. | Unchanged. See HARD CALL D — the spec's "non-admin cannot reach /admin by URL" AC is already false and stays false. |
| File size ≤ 500 (`.claude/rules/file-size.md`) | — | Every stub shrinks its file. `app/dashboard/page.tsx` (562 lines) stays over 500 after T9; its split remains backlog, **never bundled**. |

### Approaches considered

**A1 — 18 hand-written stubs, no shared component.**
Smallest conceptual surface (no new file), but 18 near-identical bodies means 18 chances to
drift into a different wording, and nothing prevents a future edit from re-adding a fabricated
array to one of them. Rejected: duplication with no forcing function.

**A2 — a `route.ts` redirect / `notFound()` on each of the 18.**
Would make the routes 404. Rejected: the spec requires an *honest empty state*, not a broken
link, and 404ing `/facturacion/comprobantes` would break `registrar`'s back/cancel links and its
post-submit `router.push` (`registrar/page.tsx:107,131,334`) — explicitly out of scope to patch.

**A3 (CHOSEN) — one shared presentational component + a source-scanning test that mechanically
forces all 18 routes through it.**
`components/modulo-no-disponible.tsx`, a plain function component with **no `"use client"`, no
hooks, no Supabase import** — so it composes into both the server-component pages
(`app/configuracion/usuarios/page.tsx`, `app/reportes/page.tsx`, `app/configuracion/parametros/page.tsx`,
`app/configuracion/colaboradores/page.tsx`, `app/configuracion/tipos-productos/page.tsx`) and the
`"use client"` pages (the other 13). The forcing function is `tests/mockup-census-stubs.test.ts`
(see Test plan). Chosen because it is the smallest change surface that satisfies the spec **and**
pins all 18 call sites to the shared component, which is the part of [[relocated-coverage-gap]]
that a source scan can actually close (**see RULING R1 for the part it cannot**).

### Seam map (total file budget — 24 files)

**New (2):**
- `components/modulo-no-disponible.tsx` — the shared stub.
- `tests/mockup-census-stubs.test.ts` — the forcing function.

**Rewritten to the stub (18 route files), exact paths:**
`app/configuracion/page.tsx` · `app/configuracion/usuarios/page.tsx` ·
`app/configuracion/parametros/page.tsx` · `app/configuracion/colaboradores/page.tsx` ·
`app/configuracion/maestros/page.tsx` · `app/configuracion/tipos-productos/page.tsx` ·
`app/reportes/page.tsx` · `app/proyectos/page.tsx` · `app/proyectos/pagos/page.tsx` ·
`app/proyectos/facturas/page.tsx` · `app/proyectos/buscar-pagos/page.tsx` ·
`app/facturacion/buscar/page.tsx` · `app/facturacion/comprobantes/page.tsx` ·
`app/pagos/copias/page.tsx` · `app/logs/page.tsx` · `app/logs/auditoria/page.tsx` ·
`app/logs/rendimiento/page.tsx` · `app/admin/page.tsx`

**Navigation-entry-point edits (4):**
- `components/app-sidebar.tsx` — `menuItems` (lines 57-152) + `adminItems` (154-163).
- `app/facturacion/page.tsx` — the single `<Link href="/facturacion/comprobantes">` block, lines 324-333.
- `app/dashboard/page.tsx` — 15 `path:` entries in the `modulos` array (lines 300-306, 310-346, 348-363, 365-394, 396-445).
- `app/page.tsx` — 2 `path:` entries inside `UserDashboard`'s `modulos` array (lines 1003-1018 `/reportes`, 1020-1035 `/configuracion`). **NOT in the spec's AC file list — see HARD CALL B.**

**Not needed, despite being named in the spec's AC list:** `app/configuracion/page.tsx`'s hub cards
(lines 83-126), `app/configuracion/maestros/page.tsx`'s cards (lines 114-142) and
`app/logs/page.tsx`'s Auditoría button (line 249) require **no separate edit** — those three files
are themselves stubbed in T2/T5/T6, so their outbound links disappear with the file body. Listing
them as separate edits would double-count the budget.

### MUST NOT TOUCH (the complement)

- `lib/admin-actions.ts` — **zero diff lines**, verified by `git diff --stat -- lib/admin-actions.ts`.
- `tests/pagos.provisional.test.ts` **and `tests/configuracion.actions.test.ts`** — both import
  `lib/admin-actions` (`pagos.provisional.test.ts:19`, `configuracion.actions.test.ts:18`). The spec
  named only the first; both stay untouched.
- `app/facturacion/comprobantes/registrar/page.tsx` — insert logic (line 91), back/cancel links
  (131, 334) and post-submit redirect (107) all unchanged.
- `lib/user-context.tsx`, `middleware.ts`, `components/auth-guard.tsx` — no auth work (ADR-0011).
- `app/proyectos/facturas/crear` — the pre-existing broken link at `app/proyectos/facturas/page.tsx:99`
  dies with the stub; **no route is created**. Flagged only.
- Every live module: `clientes`, `productos`, `suplidores`, `reservas`, `pagos` (except `copias`),
  `crm`, `facturacion/{fiscal,proforma,voucher}`, `lib/finance.ts`, `lib/document-generator.tsx`.
- `app/page.tsx`'s `AdminPanel` (lines 80-744) — the REAL approval queue over `cambios_provisionales`.
  T10 touches only `UserDashboard`'s two tiles (lines 1003-1035).
- All SQL under `scripts/`. No migration is written this sprint.
- **(Amendment 1)** `vitest.config.ts` — unchanged; no `jsdom`/RTL environment is introduced by T7
  under any revision. B-23 stays out of this sprint.

### Negative space checked

Grepped `~/Developer/CBrain/decisions` and `~/Developer/CBrain/mistakes` for
mock/fabricated/hardcoded/placeholder/empty-state before choosing an approach.
Re-grepped 2026-08-18 for regex/static-analysis/heuristic/AST before issuing RULING R1.

- **[[0012-elibry-confirmacion-without-factura-numero]]** rejected *"fabricate or placeholder a
  fiscal number"*. Not re-proposed — the opposite: T6 **deletes** the two fabricated-NCF surfaces.
  The ADR's live-DB finding (`comprobantes_fiscales` is a supplier table, `comprobantes_disponibles`
  is a real 8-row NCF-block set that is never linked to a reserva) is the reason `/facturacion/comprobantes`
  cannot simply be wired to real data this sprint — that is a BUILD, and BUILD is a non-goal.
- **[[0011-elibry-single-tenant-for-now]]** rejected *retrofitting org_id/RLS ahead of real auth*
  and *building user management before real auth*. Not re-proposed: zero DDL, zero RLS,
  `/configuracion/usuarios` is stubbed rather than built.
- **[[stockin-zero-price]]** ("block, never default"): the stub states the absence honestly and
  substitutes **nothing** — no `0`, no `"N/A"`, no plausible-sounding sample row. This is the same
  rule applied to a whole screen instead of a field.
- **[[relocated-coverage-gap]]** (5th instance, "extraction proves nothing unless something forces
  callers through it"): **partially** answered by T7 — see RULING R1 §Q2. B-23's jsdom/RTL harness
  is **out of scope**, and that note's own prevention rule already says the honest response to
  "the only closure needs a harness we don't have" is to *name the residual gap as still open*,
  not to score the extraction as if it closed it. RULING R1 does exactly that.
- **[[0014-bounded-evidence-rule]]** is the governing precedent for RULING R1: an enforcement rule
  that is **unsatisfiable by construction** is a *rule* defect, not a dev defect, and escalating it
  a fifth time fixes nothing. There, "paste the full file" scaled adversarially with file size;
  here, "make every fabrication shape RED with source regexes" scales adversarially with the
  infinite syntax of JavaScript. Same shape, same remedy: replace the unsatisfiable bar with a
  **bounded, always-satisfiable** one. Not a re-litigation — a direct application.
- **[[blind-write-partial-read]]**: every stub task rewrites a whole file → each task's ACs require
  reading the file to EOF in the same turn before writing.
- **[[schema-source-of-truth]]**: no task asserts anything about a table's shape; the only DB-adjacent
  claim (`acciones_pendientes` is read by `app/admin/page.tsx:89`) was read from source, and no code
  depends on it after T5.
- **[[assertion-without-verification]] / [[unrun-command-claimed-green]]** (14 instances): every task
  AC below demands **pasted verbatim output**, never a paraphrase.
- **[[fake-green-tests]]**: T7's test is written to be red before its dependencies land — the QA step
  requires demonstrating it fails on a deliberately-reverted stub. (Verified in round 3: RED at
  1 failed / 144 passed, GREEN at 145.)
- **[[unrequested-hardening-regression]]**: applies in reverse to T7 now — widening the heuristics
  further is unrequested hardening of a mechanism already ruled non-load-bearing.

### Pre-mortem — most drift-prone task + mitigation

**T9 (`app/dashboard/page.tsx` + `app/facturacion/page.tsx`) is the drift risk.**
`app/dashboard/page.tsx` is 562 lines and already breaches the file-size rule; removing 15 of its
tiles empties three whole `modulos` groups ("Proyectos", "Logs del Sistema", and all of
"Configuración"), which invites a dev to "tidy up" the array shape, drop now-unused `lucide-react`
imports beyond the required ones, or start the ≤500-line split. **Mitigations:** (a) T9's file list
is exactly two files; (b) its AC forbids any structural refactor — remove whole group objects when
they become empty, remove only the imports that ESLint reports as unused, nothing else; (c) the
≤500 split is explicitly declared backlog and out of scope; (d) T9 is [senior].

Secondary risk: **T5**, where a dev could "preserve" `/admin`'s Supabase query by relocating it to
`lib/`. Its AC forbids creating any new file and requires `git status --porcelain` to show no
untracked additions.

**(Amendment 1) The pre-mortem missed the task that actually drifted: T7.** Not by file scope —
T7's diff was exactly 1 new file in all three rounds — but by **effort**: an unbounded acceptance
criterion turned a one-file test into three rounds of send-backs. Recorded so the lesson is not
lost: *a task whose AC names a property that cannot be decided by the task's mechanism is
unbounded even when its file list is a single file.* Scope locks bound the diff; they do not bound
an unsatisfiable criterion. RULING R1 supplies the missing bound.

### Genuinely hard calls — flagged for the human

**HARD CALL A — `components/app-sidebar.tsx` is never rendered.** `AppSidebar` has **zero importers
repo-wide**; `SidebarProvider` appears only inside `components/ui/sidebar.tsx` itself, and
`app/layout.tsx` renders no sidebar. The spec's "sidebar, all users" reachability label on routes
#1, #4, #5, #7, #8, #9, #10, #12, #15, #18 is therefore **inaccurate** — those routes are actually
reached from `app/page.tsx`'s `UserDashboard` grid and `app/dashboard/page.tsx`'s grid. Cleaning the
sidebar (T8) is still correct and is a literal spec AC, but it is **dead-code hygiene, not a
reachability fix**. No one should sign off believing T8 removed a live entry point.

**HARD CALL B — `app/page.tsx` is a live entry point the spec's AC list omits.** `app/page.tsx:1014`
(`/reportes`) and `:1031` (`/configuracion`) are tiles on the **non-admin landing page**. The spec's
final AC restricts the diff to five hub files that do not include `app/page.tsx`, while SCOPE item 2
demands *every* entry point go — and the spec's own RISKS section warns that sidebar-only fixes are a
PARTIAL FIX. I resolve in favour of the goal and put it in its own task (**T10**) so the orchestrator
can surface it and, if the human declines, drop exactly one task without touching anything else.

**HARD CALL C — stubbing `/facturacion/comprobantes` orphans the only UI entrance to the real
DB-writing fiscal flow.** `app/facturacion/comprobantes/page.tsx:269` is the *sole* link to
`/facturacion/comprobantes/registrar` anywhere in the repo. After stubbing, that live insert into
`comprobantes_disponibles` is reachable by typed URL only. **Proposed resolution (T6):** the
comprobantes stub keeps ONE link to `/facturacion/comprobantes/registrar`. That target is a real,
working page, not a hidden route, so SCOPE item 2 does not forbid it, and it costs zero BUILD. This
is a fiscal-surface decision → it rides the same human gate as T6.

**HARD CALL D — a human-owed AC in the spec cannot pass, before or after this sprint.** "Non-admin
session cannot reach `/admin` or `/logs` by direct URL" is **false today**: `middleware.ts` does no
role check, `components/auth-guard.tsx` checks only login, and neither page checks `isAdmin`. This
sprint does not regress it (after stubbing, both pages show nothing), but it must **not** be signed
off as PASS. Real route-level admin gating is a separate, auth-dependent task (ADR-0011).

**HARD CALL E (new, Amendment 1) — "no fabricated data in this file" is not decidable by a source
scan, and T7's original AC asked for it.** Ruled below as RULING R1. Surfaced to the human because
it changes what this sprint may claim to have closed.

---

## RULING R1 — T7 mechanism demotion (2026-08-18)

**Escalated by:** the lead, decision C, after three rounds on `tests/mockup-census-stubs.test.ts`.
**Chosen option: (b) DEMOTE THE MECHANISM.** Option (a) — "bound the target by enumerating a closed
set of declaration forms" — is **rejected**; reasons below.

### Why (a) was rejected

Option (a) asks me to draw a line through an open set and declare one side in scope. Any such line
is **arbitrary**: there is no principle that admits `const {a} = {...}` and excludes
`class C { x = {...} }`, other than "QA demonstrated the first one and not yet the second". A
boundary whose only justification is *what has been demonstrated so far* is not a stopping rule —
it is the treadmill with a fence painted on it, and it re-arms the exact failure the lead already
identified: the boundary moves every time someone looks harder. It also asks the dev to ship a
mechanism whose stated commitment ("we catch these two forms, on purpose, and no others") reads as
a decision procedure while being a coin toss between syntax variants of one and the same thing.
Per [[0014-bounded-evidence-rule]], when a rule has produced three send-backs for structurally the
same claim, the defect is in the **rule**. Escalating the enumeration a fourth time repeats
alternative (i) that ADR already rejected.

### The ruling

1. **The forcing function is the set of checks that have held clean and uncontested for three
   rounds.** Those are load-bearing and stay exactly as they are:
   - `PATHS.length === 18`
   - file exists
   - source contains `ModuloNoDisponible` — **this is the caller pin**, and it is complete over
     the 18 routes by construction
   - no `createClient`, no `.from(`
   - no array-of-objects literal (`=\s*\[\s*\{`) — the shape all 18 real mockups used
   - none of the 11 `FORBIDDEN_LITERALS`
   - `<= 30` lines
2. **`OBJECT_LITERAL_DECLARATION` and `CURRENCY_OR_PERCENT_LITERAL` are DEMOTED** to explicitly
   best-effort, permanently-documented-as-non-exhaustive heuristics. They are **kept** — they are
   free, they have zero false positives against all 18 real stubs, and they do catch the shapes
   observed so far. Keep the round-3 `const|let|var` widening; **do not remove it, do not widen it
   further.**
3. **No further widening is required of the dev**, regardless of what shape QA demonstrates next,
   provided the load-bearing checks in (1) still hold and the header carries the wording in §Exact
   header wording below.
4. **The honesty criterion is met by stating the gap as a CLASS, not as a list.** This is the real
   defect behind round 3's FAIL. An enumerated RESIDUAL GAP implies completeness, so every newly
   demonstrated shape is by construction "undocumented" — the doc format itself guaranteed a FAIL.
   A universally-quantified statement ("assume the heuristics catch nothing beyond the exact shapes
   named in them; any other syntactic form defeats them") is true, unfalsifiable-by-new-example,
   and is what honesty actually requires here.

### Exact header wording (the dev must ship this block, wording load-bearing)

Replace the current "EXACTLY WHAT IS ENFORCED" + "RESIDUAL GAP" sections of
`tests/mockup-census-stubs.test.ts` with the following. Prose may be reflowed; the **claims and the
labels** may not be softened, strengthened, or dropped. The three-round send-back narrative at the
top of the file may be compressed to two lines or removed — it is history, not contract.

```
// WHAT THIS FILE IS THE FORCING FUNCTION FOR — and what it is NOT.
// Architect RULING R1, 2026-08-18, docs/plans/mockup-census-hide.md.
//
// LOAD-BEARING (these are the assertions T7 exists for; they are complete
// over the 18 paths by construction, and T7 passes or fails on them):
//   1. PATHS.length === 18 — a silently-shortened list fails here.
//   2. the file exists and its source contains `ModuloNoDisponible` — this
//      is the [[relocated-coverage-gap]] CALLER PIN. Bypassing the shared
//      component and hand-rolling a page is RED for all 18 routes. T1's
//      extraction is not merely offered; every call site is held to it.
//   3. no `createClient`, no `.from(` — zero-BUILD proof. Re-adding a live
//      Supabase read to a stubbed route is RED.
//   4. no array-of-objects literal (`= [` then `{`) — the shape all 18 of
//      the original mockups actually used.
//   5. none of the 11 exact FORBIDDEN_LITERALS — re-adding any known
//      fabricated NCF or figure by name is RED.
//   6. <= 30 lines. This bounds the VOLUME of anything sitting next to the
//      stub: reintroducing a mockup of the ORIGINAL SCALE (the pre-stub
//      files ran to several hundred lines of tables, filter forms and stat
//      grids) is impossible. It does NOT make a one- or two-line
//      fabrication impossible and is NOT claimed to.
//
// BEST-EFFORT, NON-EXHAUSTIVE HEURISTICS (demoted by RULING R1):
//   OBJECT_LITERAL_DECLARATION (`const`/`let`/`var` + name + `=` + `{`) and
//   CURRENCY_OR_PERCENT_LITERAL (`$1,234` / `+15.3%`) catch the fabrication
//   shapes observed so far — the original /reportes bug and QA's const/let/
//   var proofs-of-concept. They are kept because they are free and cost
//   zero false positives across all 18 real stubs. They are NOT a decision
//   procedure for "this file contains fabricated data", they are NOT
//   claimed to be complete, and NO FURTHER WIDENING OF THEM IS REQUIRED OR
//   PERMITTED.
//
// RESIDUAL GAP — stated as a CLASS, not as a list. (The enumerated form of
// this paragraph was itself a defect in earlier revisions: enumerating
// implies completeness, so every newly demonstrated shape read as an
// undocumented hole.)
//   *** A SOURCE-TEXT SCAN CANNOT DECIDE WHETHER A FILE RENDERS FABRICATED
//   DATA. JavaScript can produce and render a value in unboundedly many
//   syntactic forms; therefore ANY finite set of source-shape regexes is
//   defeatable by some form outside the set. Assume the two heuristics
//   above catch NOTHING beyond the exact shapes named in them. ***
//   Worked examples of the class — illustrative only, never a to-do list:
//   destructuring or class-field initializers, computed keys, IIFEs,
//   `Object.assign` / `.push()` / declare-then-assign, `JSON.parse` of a
//   literal string, `useState({...})`, indexed assignment, a bare
//   fabricated number or string with no `$`/`%` marker
//   (`<p>2350 clientes</p>`), or a value imported from another module.
//   Demonstrating a further member of this class is NOT a defect of this
//   file — it is this paragraph being true.
//   Only two mechanisms decide this class, and neither is this file's job:
//   (a) PARSING instead of scanning — an AST pass asserting zero
//       ObjectLiteral/ArrayLiteral nodes collapses the whole syntactic set
//       into one node kind (Elibry backlog, NOT this sprint); and
//   (b) RENDERED-OUTPUT assertions — [[compile-time-omission-guard]]'s
//       known hole and B-23's (jsdom/RTL) job, explicitly OUT OF SCOPE.
//
// This file pins PRESENCE and STRUCTURE via `readFileSync` — the in-repo
// convention for source-scanning tests (tests/voucher-data.test.ts:350-382,
// tests/recibo-html.test.ts:259, tests/confirmacion-data.test.ts:556) —
// never rendered output, never provenance. No jsdom, no RTL, no browser.
```

### Stopping rule (binding on QA and on any future send-back)

- T7 is PASS/FAIL on: the seven load-bearing assertions present and green over all 18 paths; the
  header carrying the block above; the anti-fake-green RED→GREEN demonstration; `git diff --stat`
  = exactly 1 new file with no page file and no `vitest.config.ts` modified; `npm run qa` exit 0
  pasted verbatim.
- **A demonstration that some fabrication shape passes the heuristics is EXPECTED and
  PRE-DOCUMENTED. It is not a T7 defect and must not produce a FAIL.** Record it in the QA report
  and the sprint digest as a confirming instance of the residual class; if it is a genuinely new
  *category* (not a syntactic variant), file it against the backlog item — never as a T7 send-back.
- On the heuristic axis, exactly two things can still FAIL T7: (i) a **false positive** — a
  heuristic firing on one of the 18 real stub files; (ii) the header **not** carrying the required
  claims/labels.
- Widening `OBJECT_LITERAL_DECLARATION` or `CURRENCY_OR_PERCENT_LITERAL` in this sprint is
  **out of scope** ([[unrequested-hardening-regression]]).

### Rejected alternative, recorded so it is not re-proposed in a round 5

**Per-file line budgets** (e.g. 10 lines for the 17 simple stubs, 20 for `comprobantes`) instead of
a single `<= 30`. Considered seriously, because a volume bound *is* a closed property — a number,
not an open set of shapes — and it is the only lever that shrinks the fabrication budget without a
regex. **Rejected**, for three reasons: (i) it still does not close the class — a one-line
`<p>1,234 clientes</p>` fits inside any budget that admits the real files; (ii) it is brittle in a
self-defeating way — any legitimate reformat turns a file RED and the natural "fix" is to bump the
number, which silently dismantles the guard; (iii) it is a fourth round of mechanism work on a
mechanism just ruled non-load-bearing. Also recorded: **no single global bound can both admit the
legitimate 17-line `app/facturacion/comprobantes/page.tsx` (HARD CALL C) and reject QA's 12-line
PoC appended to a 5-line stub** (5 + 12 = 17). That arithmetic, not opinion, is why `<= 30` is
described above as a bound on *scale*, not on *existence*.

### Direct answers to the lead's three questions

**Q1 — Is AC #2 as originally written achievable by static source-scanning at all? NO.**
Plainly: no. AC #2 said the import assertion plus the line bound "together make … 'import the stub
and also render a fabricated table' RED". The *table* half is defensible as a scale bound; the way
the criterion was read in practice — and the way I wrote the supporting "Pins" bullet in the Test
plan — extended it to *any* fabricated data, which is undecidable by source text. **This is a
plan-level defect and it is mine, not the dev's.** Three rounds of send-backs were spent chasing a
criterion that no implementation of the chosen mechanism could have satisfied. Corrected here.

**Q2 — Does this change T7's value as the closure for [[relocated-coverage-gap]]? YES — record it
as PARTIALLY closed.**
What T7 genuinely closes, and this is real and is more than any of the five prior instances bought:
mutation (a) from that note's prevention rule — *"what happens if the caller stops calling the
helper"* — is **RED for all 18 call sites**, mechanically, by name, with the list length itself
pinned. Instances 1–5 had **zero** caller pins; this sprint has 18. What T7 does **not** close:
mutation (b) — *"the caller calls it and also does something else / ignores it"* — which here is
"imports `ModuloNoDisponible` **and also** renders fabricated content". That is the same
presence-not-provenance boundary already recorded in [[compile-time-omission-guard]] as ATTACK C1.
So the sprint digest and the state file must say, in the same sentence that reports the extraction
(as that note's prevention rule demands):
> `[[relocated-coverage-gap]]` is **partially** closed by this sprint — all 18 call sites are pinned
> to `ModuloNoDisponible` by `tests/mockup-census-stubs.test.ts` (mutation (a) is RED); rendered
> output and provenance remain **open** (mutation (b) stays green), deferred to **B-23**, which is
> the standing blocker and must be scoped as the next task in this family, not a sixth extraction.
Anyone who writes "T7 closes relocated-coverage-gap" without the word *partially* is overclaiming.

**Q3 — Is the `<= 30`-line bound doing real work, or hiding how weak the literal guards are? Both,
honestly.**
It does real work: the 18 pre-stub files were mockups of several hundred lines — tables, filter
forms, stat-card grids — and none of that can be reintroduced inside a 30-line budget while the
`ModuloNoDisponible` import and the array-of-objects guard also hold. That is a genuine, permanent
bound on the *scale* of any regression. But it has also been carrying more weight than it can: the
real stubs are 5 lines each (17 lines for `comprobantes`), so the bound leaves roughly **25 lines
of unpoliced headroom**, which is exactly why all three of QA's ~12-line PoCs sailed through. Every
send-back landed on the literal guards precisely because the line bound could not stop the PoC
either. So yes — quoting "≤ 30 lines" alongside "the guards" made the pair sound tighter than it
is. The header wording above and the amended AC #2 state the bound as what it is: a limit on
volume, not a detector of fabrication. And per the rejected alternative above, it cannot be
tightened without breaking a legitimate file.

---

## Technical approach

Every one of the 18 routes is reduced to a ~10-line file whose default export renders the shared
`<ModuloNoDisponible titulo="…" />` — a plain presentational component (no `"use client"`, no hooks,
no `createClient`, no `.from(`) that prints one honest sentence stating the module is not available
and that no real data is being shown. All fabricated arrays, dead forms, non-functional Save/Export
buttons, and `/admin`'s live `acciones_pendientes` query are deleted outright with the file bodies;
nothing is relocated to `lib/`. A new source-scanning vitest file (`tests/mockup-census-stubs.test.ts`,
following the established `readFileSync`-on-source convention already used at
`tests/voucher-data.test.ts:350-382`, `tests/recibo-html.test.ts:259`, `tests/confirmacion-data.test.ts:556`)
iterates the 18 exact paths and asserts each one imports the shared component, contains no
`createClient`/`.from(`/object-array literal and none of the known fabricated literals, and stays
under a hard line bound — which is what mechanically forces the routes through the shared stub
rather than merely offering it, **within the limits set out in RULING R1**. Navigation entry points
are then removed from the four files that still render after the stubbing
(`components/app-sidebar.tsx`, `app/facturacion/page.tsx`, `app/dashboard/page.tsx`, `app/page.tsx`);
the outbound links inside `/configuracion`, `/configuracion/maestros` and `/logs` need no separate
edit because those files are themselves stubbed.

## DB changes

**NONE.** Zero DDL, zero new tables, zero new columns, zero RLS policies, zero migrations under
`scripts/`. No table is dropped and no row is deleted — `acciones_pendientes` keeps whatever it
holds; only its reader UI goes away. Because no table is created, the "every new table gets an RLS
policy" invariant has nothing to bind to; RLS exposure strictly **shrinks** (18 screens' worth of
`anon` reads removed). ADR-0011's status is unchanged.

## API / service changes

**NONE.** No Server Action, no route handler, no `lib/` module is created, edited, or deleted.
`lib/admin-actions.ts` keeps its zero-importer wrappers and its two test files.

## UI changes

1. New `components/modulo-no-disponible.tsx`.
2. 18 route files reduced to the stub.
3. `components/app-sidebar.tsx`: 8 `menuItems` sub-entries removed, `adminItems` removed entirely
   (both children hidden → the empty "Administración" group must not render), and the now-empty
   "Proyectos" (lines 126-134) and "Reportes"→"Estadísticas" handled per T8's AC.
4. `app/facturacion/page.tsx`: one tile removed.
5. `app/dashboard/page.tsx`: 15 tiles removed; groups left empty are removed whole.
6. `app/page.tsx`: 2 tiles removed from `UserDashboard`; groups left empty are removed whole.

## Edge cases

- **Empty states** — the whole sprint *is* the empty state. The stub says the module is unavailable
  and shows no numbers, names, NCFs, or counts ([[stockin-zero-price]]).
- **Empty nav groups** — T8/T9/T10 each carry an explicit AC: a group object whose `items` array
  becomes empty is deleted, not left rendering a label with no children.
- **Concurrent edits / realtime races** — cannot occur: no mutations, no subscriptions, no shared
  mutable state introduced.
- **Rollback of optimistic UI** — N/A, no optimistic UI added. Any task that adds a mutation is
  automatically out of scope and must FAIL QA.
- **`/facturacion/comprobantes/registrar` post-submit** — after T6, `router.push("/facturacion/comprobantes")`
  lands on the stub. The insert still succeeds and the success toast still fires
  (`registrar/page.tsx:103-107`); only the confirmation *screen* is plainer. Human-owed verification.
- **Server vs. client components** — 5 of the 18 have no `"use client"`; the stub must remain
  hook-free so both kinds compile. T1's AC pins this.
- **Unused imports after stubbing** — the stub files are full rewrites, so no orphan imports remain;
  in the nav-edit files only ESLint-reported unused imports may be removed.
- **`.next/types` interference** — a prior `next build` makes `tsc --noEmit` fail for pages that
  export helpers (known open item). If `npm run qa` fails on `.next/types/**`, QA must delete `.next`
  and re-run, and paste both runs. This is a known environment condition, not a task failure.
- **(Amendment 1) A future legitimate stub that needs a JSX-prop object literal** — e.g.
  `style={{ … }}`, as `app/facturacion/comprobantes/page.tsx:10` already carries. The demoted
  heuristic does not fire on JSX props (it requires a `const`/`let`/`var` declaration), verified at
  zero false positives across all 18 stubs. If a future edit ever does trip a heuristic on a
  legitimate stub, that is a **false positive and a real T7 failure** — fix the heuristic or drop
  it; never loosen a load-bearing assertion to accommodate it.

## Test plan

**Commands (every task):**
```
npm run qa            # = tsc --noEmit && eslint . && vitest run  — output pasted VERBATIM
git diff --stat       # proves the file list
git status --porcelain
```

**Per-task grep proofs** (mechanically checkable, run from repo root):
```
# fabricated-data identifiers — must be ZERO across the 18 files after T2–T6
rg -n 'mockData|datosEjemplo|mockLogs|auditLogs' app/
rg -n 'const (usuarios|datosMaestros|parametros|recibos|documentos|facturas|proyectos) = \[' app/

# fabricated literals — must be ZERO repo-wide after T6/T3
rg -n '\$45,231|B0404000001|B0100000025|100 disponibles' .

# zero BUILD proof — must be ZERO across the 18 files
rg -n 'createClient|\.from\(' app/configuracion app/reportes app/proyectos app/logs app/admin \
  app/facturacion/buscar/page.tsx app/facturacion/comprobantes/page.tsx app/pagos/copias/page.tsx

# admin-actions untouched
git diff --stat -- lib/admin-actions.ts     # must print nothing
```

**New automated test — `tests/mockup-census-stubs.test.ts` (T7).**
**Rewritten 2026-08-18 by RULING R1.** It is *not* theater, and here is exactly what it pins and
what it does not:
- **Pins (load-bearing, complete over the 18 paths):** for each of the 18 hard-coded paths — the
  file exists; its source contains `ModuloNoDisponible`; it contains no `createClient`, no
  `.from(`, no array-of-objects literal (`= [` followed by `{`), none of the 11 forbidden literals;
  and the file is **≤ 30 lines**. Plus `PATHS.length === 18`.
- **Best-effort only (demoted, NON-EXHAUSTIVE):** `OBJECT_LITERAL_DECLARATION`
  (`const`/`let`/`var` + name + `= {`) and `CURRENCY_OR_PERCENT_LITERAL`. Kept, never widened
  further, never described as complete.
- **Why it is the forcing function:** per [[relocated-coverage-gap]], extracting a shared component
  proves nothing unless something makes callers use it. The import assertion makes bypassing the
  component RED for all 18 routes — that is the caller pin, and it is the part of that mistake this
  sprint actually closes. The ≤30-line bound makes reintroducing a mockup **at the original scale**
  (several-hundred-line tables and stat grids) RED. Neither makes an arbitrary two-line fabrication
  RED, and **no source scan can** — see RULING R1 §Q1.
- **Does NOT pin:** rendered output, provenance, or the existence of fabricated data in general. It
  follows [[compile-time-omission-guard]]'s known hole — presence, not provenance. No browser, no
  jsdom. B-23 (the RTL harness) is **out of scope this sprint** and must not be folded in.
- **Anti-fake-green proof required at QA:** temporarily revert one stub (e.g. restore
  `app/reportes/page.tsx` from `git show HEAD:app/reportes/page.tsx`), run
  `vitest run tests/mockup-census-stubs.test.ts`, paste the RED output, then restore and paste the
  GREEN output. (Satisfied in round 3: 1 failed / 144 passed, then 145 passed.)
- **Zero-false-positive proof required at QA:** the full suite green over all 18 *real* stubs,
  including `app/facturacion/comprobantes/page.tsx`'s legitimate `style={{ … }}` JSX prop.

**Human-owed, cannot be agent-verified in this workspace** (no browser automation, no network path
to the real Supabase project — state these, never fake them):
1. Browser render of each of the 18 stubs — no blank page, no client-side error.
2. `app/page.tsx` (non-admin) and `/dashboard` show no dead-end tiles; no empty nav group renders.
3. `/facturacion/comprobantes/registrar` still inserts into `comprobantes_disponibles` and redirects
   cleanly to the stub.
4. **FISCAL SIGN-OFF** by a human with fiscal authority on T6 (routes #1 and #13) **before merge**
   — CLAUDE.md mandatory fiscal gate + [[0012-elibry-confirmacion-without-factura-numero]].
5. HARD CALL D: the "non-admin cannot reach /admin by direct URL" AC is **already false** and must
   be recorded as NOT VERIFIED, not signed off.
6. **(Amendment 1)** HARD CALL E / RULING R1: the human should be told this sprint pins the caller
   but not the rendered output, and that B-23 is the standing blocker.

---

## Task list

Ordering rationale (spec decision #3): **stubs first (T2–T6), navigation last (T8–T10).**
Stubbing removes the actual harm — the fabricated data — immediately; a nav entry pointing at an
honest stub is merely redundant, never harmful. The reverse order would leave fabricated pages live
and reachable by bookmark, browser history and typed URL while the app *looked* fixed, and if the
sprint were cut short mid-way it would have reduced nothing. With stub-first, every completed task
strictly reduces fabricated exposure.

Grouping rationale (spec decision #2): the 18 routes are grouped **by module family and by risk
tier**, not by count. Each group is one reviewable concern (one sidebar section / one URL prefix),
each is independently greppable and QA-able, and the two risk tiers that need a senior — `/admin`'s
real Supabase code (T5) and the two fiscal screens (T6) — are isolated into their own tasks so
neither can be waved through inside a bulk junior diff.

---

### T1 — Shared honest empty-state component
- **Owner:** junior-dev
- **Depends on:** none
- **Files in scope (exact):** `components/modulo-no-disponible.tsx` (new — this file only)
- **DB/RLS:** none
- **What it does:** creates `export function ModuloNoDisponible({ titulo, children }: { titulo: string; children?: React.ReactNode })`.
  Renders the module title and one honest sentence — module not available, no real data to show.
  Optional `children` exists for exactly one caller (T6's link to the real registrar page).
- **Acceptance criteria (PASS/FAIL):**
  1. File contains **no** `"use client"`, no React hook (`useState`/`useEffect`/`useRouter`), no
     `createClient`, no `.from(`. `rg -n '"use client"|use[A-Z]|createClient|\.from\(' components/modulo-no-disponible.tsx`
     returns zero matches — output pasted.
  2. File is ≤ 40 lines (`wc -l`, pasted). Per `.claude/rules/file-size.md`.
  3. Component text invents **no** figure, name, count, date or NCF — this is the
     [[stockin-zero-price]] "block, never default" rule applied to a whole screen: state the absence,
     substitute nothing.
  4. No aesthetic polish (no illustration/branding) — spec non-goal.
  5. `npm run qa` exits 0, output pasted **verbatim** ([[unrun-command-claimed-green]] — a command
     that "would" pass but was not run is a FAIL).
- **Rollback:** `git revert <sha>` / `rm components/modulo-no-disponible.tsx`.

---

### T2 — Stub the five non-fiscal Configuración routes
- **Owner:** junior-dev
- **Depends on:** T1
- **Files in scope (exact):** `app/configuracion/usuarios/page.tsx` · `app/configuracion/parametros/page.tsx` ·
  `app/configuracion/colaboradores/page.tsx` · `app/configuracion/maestros/page.tsx` ·
  `app/configuracion/tipos-productos/page.tsx`
- **DB/RLS:** none
- **Notes:** `maestros` currently holds `datosEjemplo` (line 62) and the hub cards at lines 114-142
  that link to `tipos-productos`/`colaboradores` — both link blocks die with the file body, so no
  separate hub edit is needed. `colaboradores`/`tipos-productos`/`maestros` map to REAL tables
  (`colaboradores`, `tipos_productos`, `datos_maestros`) — **flag as higher BUILD priority for a
  future schema-verified sprint**; building them now is a spec non-goal.
- **Acceptance criteria (PASS/FAIL):**
  1. Each of the 5 files renders only `<ModuloNoDisponible …/>`; `rg -n 'datosEjemplo|= \[' <the 5 files>`
     returns zero matches — pasted.
  2. `rg -n 'createClient|\.from\(' <the 5 files>` returns zero matches — proves ZERO BUILD.
  3. `git diff --stat` lists exactly these 5 files, nothing else.
  4. **[[blind-write-partial-read]]:** each file was read to EOF in the same turn before being
     rewritten — state this per file. A `Write` over unread content is an automatic FAIL.
  5. `npm run qa` exits 0, output pasted **verbatim**.
- **Rollback:** `git revert <sha>`.

---

### T3 — Stub Reportes + the four Proyectos routes
- **Owner:** junior-dev
- **Depends on:** T1
- **Files in scope (exact):** `app/reportes/page.tsx` · `app/proyectos/page.tsx` ·
  `app/proyectos/pagos/page.tsx` · `app/proyectos/facturas/page.tsx` · `app/proyectos/buscar-pagos/page.tsx`
- **DB/RLS:** none
- **Notes:** `/reportes` carries the literal `$45,231.89` / `+20.1%` (lines 22-23) and duplicates the
  real `/dashboard`. `app/proyectos/facturas/page.tsx:99` links to `/proyectos/facturas/crear`, a
  route that does not exist — **pre-existing broken link, OUT OF SCOPE**; it disappears with the
  stub and **no `crear` route may be created**.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n '\$45,231|\+20\.1%|const (facturas|proyectos) = \[' app/reportes app/proyectos` returns
     zero matches — pasted.
  2. `rg -n 'createClient|\.from\(' app/reportes app/proyectos` returns zero matches.
  3. `git status --porcelain` shows **no** new file under `app/proyectos/facturas/` (proves the
     broken link was flagged, not fixed — [[unrequested-hardening-regression]]: change A must not
     silently ship change B).
  4. `git diff --stat` lists exactly these 5 files.
  5. Each file read to EOF before rewrite ([[blind-write-partial-read]]).
  6. `npm run qa` exits 0, output pasted **verbatim**.
- **Rollback:** `git revert <sha>`.

---

### T4 — Stub `/facturacion/buscar` and `/pagos/copias`
- **Owner:** junior-dev
- **Depends on:** T1
- **Files in scope (exact):** `app/facturacion/buscar/page.tsx` · `app/pagos/copias/page.tsx`
- **DB/RLS:** none
- **Notes:** `facturacion/buscar/page.tsx:21` holds a hardcoded `documentos` array;
  `pagos/copias/page.tsx:30` holds a hardcoded `recibos` array. Both sit next to genuinely live
  modules — do not touch `app/facturacion/{fiscal,proforma,voucher}` or any other `app/pagos/*` page.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n 'const (documentos|recibos) = \[' app/facturacion app/pagos` returns zero matches — pasted.
  2. `rg -n 'createClient|\.from\(' app/facturacion/buscar/page.tsx app/pagos/copias/page.tsx`
     returns zero matches.
  3. `git diff --stat` lists exactly 2 files; **no** `app/pagos/registrar|buscar|ver|editar` and
     **no** `app/facturacion/{fiscal,proforma,voucher}` file appears.
  4. Both files read to EOF before rewrite ([[blind-write-partial-read]]).
  5. `npm run qa` exits 0, output pasted **verbatim** — this is the guard on the live money/document
     modules that neighbour these two files.
- **Rollback:** `git revert <sha>`.

---

### T5 — Stub the three Logs routes and `/admin` (deletes real Supabase code)
- **Owner:** **senior-dev**
- **Depends on:** T1
- **Files in scope (exact):** `app/logs/page.tsx` · `app/logs/auditoria/page.tsx` ·
  `app/logs/rendimiento/page.tsx` · `app/admin/page.tsx`
- **DB/RLS:** none — **no DDL, no row deletion.** `acciones_pendientes` keeps its data; only its
  reader UI goes away.
- **What happens to `/admin`'s query code (spec decision #6):** `app/admin/page.tsx`'s
  `cargarAcciones()` (line 85, `supabase.from("acciones_pendientes").select(...)` at line 89) and its
  approve/reject write handlers are **deleted outright with the file body**. Nothing is relocated to
  `lib/`, no helper is extracted, no new file is created. This is safe because the sole writer chain
  (`crearAccionPendiente` + wrappers in `lib/admin-actions.ts`, lines 16-171) has **zero importers
  repo-wide** outside its two test files, and the real, live approval queue is `app/page.tsx`'s
  `AdminPanel` (lines 80-744) over `cambios_provisionales` — which this task must not touch.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n 'mockLogs|auditLogs' app/logs` returns zero matches — pasted.
  2. `rg -n 'createClient|\.from\(|acciones_pendientes' app/logs app/admin` returns zero matches.
  3. **`git diff --stat -- lib/admin-actions.ts` prints NOTHING** (zero diff lines) — pasted.
  4. `git diff --stat -- tests/` prints nothing; `tests/pagos.provisional.test.ts` **and**
     `tests/configuracion.actions.test.ts` are untouched and still green (both import
     `lib/admin-actions`; the spec named only the first).
  5. `git status --porcelain` shows **no** new/untracked file — proves the query code was deleted,
     not relocated (pre-mortem mitigation).
  6. `git diff --stat` shows `app/page.tsx` is NOT in this task's diff (the real approval queue).
  7. Each of the 4 files read to EOF before rewrite ([[blind-write-partial-read]]).
  8. `npm run qa` exits 0, output pasted **verbatim**.
- **Rollback:** `git revert <sha>`.

---

### T6 — FISCAL: stub `/configuracion` and `/facturacion/comprobantes` — ⚠️ HUMAN GATE BEFORE MERGE
- **Owner:** **senior-dev**
- **Depends on:** T1
- **⚠️ This task MUST NOT be merged without fiscal sign-off from a human with fiscal authority.**
  CLAUDE.md mandatory fiscal gate + [[0012-elibry-confirmacion-without-factura-numero]]. Never bundle
  it with a non-fiscal hide.
- **Files in scope (exact):** `app/configuracion/page.tsx` · `app/facturacion/comprobantes/page.tsx`
- **DB/RLS:** none
- **Why fiscal:** `app/configuracion/page.tsx:58` fabricates `"NCF Próximo: B0100000025"` and shows it
  to **all** users; `app/facturacion/comprobantes/page.tsx:50-159` fabricates six NCF blocks including
  `proximo_ncf: "B0404000001"` and invented usage percentages. Rendering an invented NCF is the same
  failure class ADR-0012 rejected when it refused to fabricate/placeholder a fiscal number.
- **HARD CALL C, to be ruled on at the gate:** `app/facturacion/comprobantes/page.tsx:269` is the
  ONLY link in the repo to `/facturacion/comprobantes/registrar`, a real live insert into
  `comprobantes_disponibles`. **Proposed:** the comprobantes stub keeps that one link (via
  `ModuloNoDisponible`'s `children`), so the real fiscal registration flow keeps a UI entrance.
  If the human rules otherwise, drop the link — a one-line change inside this same task.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n 'B0100000025|B0404000001|100 disponibles|mockData' .` (repo-wide, excluding `docs/`)
     returns zero matches — pasted.
  2. `rg -n 'createClient|\.from\(' app/configuracion/page.tsx app/facturacion/comprobantes/page.tsx`
     returns zero matches — proves ZERO BUILD on a fiscal surface.
  3. `git diff --stat` lists exactly these 2 files. `app/facturacion/comprobantes/registrar/page.tsx`
     is **NOT** in the diff — its insert (line 91), links (131, 334) and redirect (107) are byte-identical.
  4. The stub invents **no** NCF, sequence, count or percentage ([[stockin-zero-price]],
     [[0012-elibry-confirmacion-without-factura-numero]] rejected alternative (ii)).
  5. Both files read to EOF before rewrite ([[blind-write-partial-read]]).
  6. `npm run qa` exits 0, output pasted **verbatim**.
  7. **HUMAN-OWED (do not self-certify):** fiscal sign-off recorded; browser check that
     `/facturacion/comprobantes/registrar` still inserts and redirects cleanly to the stub.
- **Rollback:** `git revert <sha>`.

---

### T7 — The forcing function: `tests/mockup-census-stubs.test.ts`
- **Owner:** **senior-dev**
- **Depends on:** T2, T3, T4, T5, T6 (all 18 stubs must exist)
- **Files in scope (exact):** `tests/mockup-census-stubs.test.ts` (new — this file only)
- **DB/RLS:** none
- **⚠️ AMENDED 2026-08-18 — read [RULING R1](#ruling-r1--t7-mechanism-demotion-2026-08-18) first.**
  Option (b) was chosen: the per-shape regexes are demoted to best-effort heuristics, the load-bearing
  set is fixed, and a stopping rule now binds QA. **The remaining work is documentation-shaped: ship
  the exact header block from RULING R1. No regex is added, widened, or removed.**
- **What it does:** hard-codes the 18 exact route paths and, per path, asserts via `readFileSync`
  (the in-repo convention — `tests/voucher-data.test.ts:350-382`, `tests/recibo-html.test.ts:259`,
  `tests/confirmacion-data.test.ts:556`) that the file: imports/renders `ModuloNoDisponible`;
  contains no `createClient`, no `.from(`, no array-of-objects literal; contains none of the 11
  `FORBIDDEN_LITERALS`; and is ≤ 30 lines. Two additional heuristics
  (`OBJECT_LITERAL_DECLARATION`, `CURRENCY_OR_PERCENT_LITERAL`) are retained as **best-effort only**.
- **Acceptance criteria (PASS/FAIL):**
  1. The test enumerates **all 18** paths explicitly (assert `PATHS.length === 18` inside the test so
     a silently-shortened list fails).
  2. **[[relocated-coverage-gap]] — AMENDED 2026-08-18, superseding the original wording.** The
     import assertion makes "bypass the shared stub and hand-roll a page" **RED for all 18 routes**
     — that is the caller pin, it is complete over the path list, and it is what this task delivers.
     The ≤30-line bound makes "import the stub **and also** reintroduce a mockup at the original
     scale (several-hundred-line tables/stat grids)" RED — a bound on **volume**, not a detector of
     fabrication. **It is expressly NOT claimed, here or in the test, that any static source scan
     makes an arbitrary two-line fabrication RED; it cannot** (RULING R1 §Q1). PASS requires:
     (a) the seven load-bearing assertions of RULING R1 §1 present and green over all 18 paths;
     (b) the header carrying RULING R1's block, claims and labels intact;
     (c) the residual gap stated as a **class**, never as an enumerated list.
  3. **[[fake-green-tests]] anti-theater proof, MANDATORY:** restore one stub from HEAD
     (`git show HEAD:app/reportes/page.tsx > app/reportes/page.tsx`), run
     `npx vitest run tests/mockup-census-stubs.test.ts`, **paste the RED output**, restore the stub,
     re-run, paste the GREEN output. A test that has never been observed failing is not evidence.
  4. The test header documents its own limit — it pins **presence and structure, not rendered
     output or provenance** ([[compile-time-omission-guard]]'s known hole). No jsdom/RTL; **B-23 is
     out of scope**, and `vitest.config.ts` is unmodified.
  5. `git diff --stat` lists exactly 1 new file; no page file is modified by this task.
  6. `npm run qa` exits 0, output pasted **verbatim**, with the new test count visible.
  7. **(NEW) Zero false positives:** all 18 *real* stub files pass, including
     `app/facturacion/comprobantes/page.tsx`'s legitimate `style={{ … }}` JSX prop and its single
     HARD CALL C `<Link>`. A heuristic firing on a real stub is a genuine FAIL.
  8. **(NEW) Stopping rule — binding on QA.** A demonstration that some fabrication shape passes the
     demoted heuristics is **expected, pre-documented, and NOT a T7 defect**; it must be recorded in
     the QA report as a confirming instance of the residual class and, if a genuinely new category,
     filed to backlog — never as a send-back. On the heuristic axis only two things fail T7: a false
     positive (AC #7) or a header that does not carry RULING R1's claims. Widening the heuristics is
     **out of scope** ([[unrequested-hardening-regression]]).
- **Rollback:** `git revert <sha>` / `rm tests/mockup-census-stubs.test.ts`.

---

### T8 — Remove sidebar entries for hidden routes
- **Owner:** junior-dev
- **Depends on:** T2, T3, T4, T5, T6
- **Files in scope (exact):** `components/app-sidebar.tsx` (this file only)
- **DB/RLS:** none
- **Scope detail:** remove from `menuItems` — `"Buscar Documentos"` (line 107), the whole `"Proyectos"`
  group (126-134), `"Estadísticas"` (140), and the whole `"Configuración"` group (143-151, all three
  children hidden). Remove `adminItems` entirely (154-163) and its spread at line 169, since both
  children are hidden and **an "Administración" group with zero children must not render** (spec
  SCOPE item 4).
- **⚠️ HARD CALL A, must be stated in the QA report:** `AppSidebar` has **zero importers repo-wide**
  and `app/layout.tsx` renders no sidebar — this component is currently dead code. T8 is correct
  hygiene and a literal spec AC, but it is **not** a reachability fix; the live tiles are handled by
  T9/T10. Do not report T8 as having removed a user-visible entry point.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n '/configuracion|/reportes|/proyectos|/facturacion/buscar|/logs|/admin' components/app-sidebar.tsx`
     returns zero matches — pasted.
  2. `adminItems` no longer exists; no group object with an empty `items` array remains
     (`rg -n 'items: \[\]' components/app-sidebar.tsx` → zero).
  3. Remaining entries still cover every LIVE route (clientes, crm, reservas, pagos,
     facturacion/{proforma,voucher,fiscal}, productos, suplidores, dashboard) — list them in the report.
  4. Only ESLint-reported unused `lucide-react` imports are removed; no other refactor
     ([[unrequested-hardening-regression]]).
  5. `git diff --stat` lists exactly 1 file.
  6. `npm run qa` exits 0, output pasted **verbatim** (ESLint no-unused-vars is the real check here).
- **Rollback:** `git revert <sha>`.

---

### T9 — Remove live hub tiles: `/dashboard` and `/facturacion`
- **Owner:** **senior-dev**
- **Depends on:** T2, T3, T4, T5, T6
- **Files in scope (exact):** `app/dashboard/page.tsx` · `app/facturacion/page.tsx`
- **DB/RLS:** none
- **Scope detail:** in `app/dashboard/page.tsx` remove the 15 `modulos` entries whose `path` is a
  hidden route — `/facturacion/comprobantes` (300-306); the entire "Proyectos" group (310-346);
  "Dashboard de Reportes" → the entire "Reportes" group (348-363); the entire "Logs del Sistema"
  group (365-394); the entire "Configuración" group (396-445, all six children hidden). In
  `app/facturacion/page.tsx` remove the single `<Link href="/facturacion/comprobantes">` block
  (324-333). **Nothing else in either file.**
- **⚠️ Fiscal note:** two of these tiles (`/facturacion/comprobantes`, `/configuracion`) are entry
  points to T6's fiscal screens; this task therefore rides the **same human gate** as T6 for those
  two removals, even though it is a pure navigation deletion.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n '"/configuracion|"/reportes|"/proyectos|"/facturacion/comprobantes|"/logs' app/dashboard/page.tsx app/facturacion/page.tsx`
     returns zero matches — pasted.
  2. No `modulos` group with an empty `items` array remains (`rg -n 'items: \[\s*\]'` → zero).
  3. `app/dashboard/page.tsx`'s live Supabase reads and `app/facturacion/page.tsx`'s live document
     logic are **unchanged**: `git diff` shows only `modulos`-entry / `<Link>`-block deletions plus
     unused-import removals. No mutation added ⇒ no optimistic-UI/rollback surface
     ([[optimistic-ui-rollback]] N/A, state it).
  4. **File size:** `app/dashboard/page.tsx` is 562 lines pre-change and stays > 500 after. Report
     the new `wc -l`; the ≤500 split is **backlog, its own scoped task, NOT bundled**
     (`.claude/rules/file-size.md`) — pre-mortem mitigation.
  5. `git diff --stat` lists exactly 2 files.
  6. `npm run qa` exits 0, output pasted **verbatim**.
- **Rollback:** `git revert <sha>`.

---

### T10 — Remove the two hidden-route tiles from the non-admin landing page ⚠️ SPEC-LIST GAP
- **Owner:** **senior-dev**
- **Depends on:** T3, T6
- **Files in scope (exact):** `app/page.tsx` (this file only)
- **DB/RLS:** none
- **⚠️ Read HARD CALL B before starting.** `app/page.tsx` is **not** in the spec's final "diff touches
  ONLY…" list, but `app/page.tsx:1014` (`/reportes`) and `:1031` (`/configuracion`) are live tiles on
  the **non-admin landing page** (`UserDashboard`, lines 745-1036; `HomePage` at 1202-1205 routes
  non-admins here). Leaving them ships exactly the PARTIAL FIX the spec's own RISKS section warns
  about. This task is isolated so the orchestrator can surface the gap and, if the human declines,
  drop one task with zero collateral.
- **Scope detail:** remove the whole "Reportes" group (1003-1018) and the whole "Configuración"
  group (1020-1035) from `UserDashboard`'s `modulos` array — both groups have exactly one child and
  both children are hidden routes.
- **Acceptance criteria (PASS/FAIL):**
  1. `rg -n '"/reportes"|"/configuracion"' app/page.tsx` returns zero matches — pasted.
  2. `git diff` touches **only** lines inside `UserDashboard`'s `modulos` array. `AdminPanel`
     (lines 80-744 — the REAL `cambios_provisionales` approval queue) and `UserDashboard`'s live
     `cargarEstadisticas()` Supabase reads (764-790) are byte-identical.
  3. No group with an empty `items` array remains.
  4. `git diff --stat` lists exactly 1 file.
  5. File read to EOF before editing ([[blind-write-partial-read]]); use targeted edits, **never** a
     full-file `Write` on this 1200+-line file.
  6. `npm run qa` exits 0, output pasted **verbatim**.
- **Rollback:** `git revert <sha>`.

---

## Sprint-close checklist (lead)

- [ ] T1–T10 each have a verbatim QA report with **Verdict: PASS** (CLAUDE.md sprint-validation gate).
- [ ] `git diff --stat -- lib/admin-actions.ts` prints nothing.
- [ ] `git diff --stat` for the whole sprint lists exactly the 24 seam-map files and nothing else.
- [ ] `npm run qa` green on the final HEAD, pasted verbatim.
- [ ] Human fiscal sign-off recorded for T6 (and T9's two fiscal-adjacent tiles) **before merge**.
- [ ] HARD CALLS A, B, C, D, **E** surfaced to the human — not silently resolved by an agent.
- [ ] Human-owed ACs (browser renders, live-DB redirect, admin-URL reachability) recorded as
      **NOT VERIFIED in this workspace**, never as PASS.
- [ ] **(Amendment 1)** The digest records `[[relocated-coverage-gap]]` as **PARTIALLY closed** —
      18/18 call sites pinned to `ModuloNoDisponible` (mutation (a) RED); rendered output and
      provenance still open (mutation (b) green), deferred to **B-23**, the standing blocker. The
      word *partially* is mandatory; "T7 closes relocated-coverage-gap" is an overclaim.
- [ ] **(Amendment 1)** The digest records RULING R1: an architect-level plan defect (an
      undecidable acceptance criterion) cost three send-back rounds on a one-file task. Candidate
      for the inbox as an instance of [[0014-bounded-evidence-rule]]'s family — *an unsatisfiable
      rule is a rule defect, not a dev defect* — the second time this shape has bitten.
- [ ] Backlog filed, **not** bundled: delete `lib/admin-actions.ts` + orphaned wrappers;
      `/proyectos/facturas/crear` broken link; real BUILD for `colaboradores` / `datos_maestros` /
      `tipos_productos` (real tables); route-level admin gating (needs real auth, ADR-0011);
      `app/dashboard/page.tsx` ≤500-line split (B-9 family); B-23 jsdom/RTL harness;
      **NEW — AST-level stub guard:** replace the demoted regex heuristics with a TypeScript-compiler
      pass over the 18 stub files asserting zero `ObjectLiteralExpression` / `ArrayLiteralExpression`
      nodes (with a single carve-out for JSX-attribute initializers such as `style={{ … }}`). This
      collapses the entire unbounded syntactic set — destructuring, class fields, computed keys,
      IIFEs, `Object.assign`, `useState({...})` — into one node kind, and `typescript@5.7.3` is
      already a devDependency. **It still does not close bare rendered literals or `JSON.parse` of a
      string**, so it is a strictly-better bound, not a closure; B-23 remains the closure. Allocate
      the next free number after B-33 (B-19..B-33 are taken).

PLAN_PATH: docs/plans/mockup-census-hide.md
