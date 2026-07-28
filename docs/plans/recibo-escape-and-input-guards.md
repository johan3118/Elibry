# Plan — RECIBO escaping (B-12) + Server-Action input guards (B-15/B-16)

**Sprint size:** small. **Exactly two tasks.** No refactors, no file splits, no new abstractions.
**Human steer, verbatim:** *"skip any overengineer thing. lets make it work."* — taken literally.

---

## Corrections to the sprint brief

Per `~/Developer/CBrain/mistakes/assertion-without-verification.md`, this plan carries the same
evidentiary weight as a dev report. Every line number and claim in the brief was checked against
the real files. Findings:

### CORRECTION 1 (material) — the B-16(b) claim is FALSE. Coverage already exists.

The brief states: *"the integer guard on pax_adultos / pax_ninos / pax_infantes ALREADY EXISTS in
code but has NO test coverage proving it fires. Add mutation-checked coverage."*

The first half is right; **the second half is wrong.** The coverage exists today:

- Guard: `app/actions/documentos-actions.ts:1029` —
  `if (typeof valor !== "number" || !Number.isFinite(valor) || !Number.isInteger(valor) || valor < 0)`
- Test: `tests/documentos-actions.test.ts:1930-1937` —
  `it("rejects a NON-INTEGER pax_ninos BEFORE touching the DB, with pax_ninos named in the error")`,
  feeding `{ pax_ninos: 2.5 }`, asserting `success === false`, `error` contains `"pax_ninos"`, and
  `expect(mockFrom).not.toHaveBeenCalled()`.

That test is **mutation-killing for the `!Number.isInteger` clause specifically**: `2.5` is a
`number`, is finite, and is not `< 0`, so it survives every *other* clause in the disjunction and
is rejected **only** by `!Number.isInteger(valor)`. Sibling coverage for the negative case exists
at `:1921` (`pax_adultos: -1`) and `:1939` (`pax_infantes: -3`, which also asserts the error does
NOT name the other two fields).

**Consequence for the plan:** B-16(b) is **not** a "write new tests" deliverable. Writing a second
`pax_ninos: 2.5` test would be duplicate work with zero new information. B-16(b) is downgraded to a
**verification step inside Task 2** — the dev must *run* mutation **M5** (delete
`!Number.isInteger(valor) ||` from `:1029`) and paste the RED output of the existing test. That is
exactly what the brief actually wants ("prove it fires"), minus the redundant test.

**Escape hatch (do not skip):** if M5 comes back **GREEN**, the claim above is wrong and there *is*
a real gap — in that case, and only then, the dev adds the missing test in the same task and says so
explicitly. Task 2's acceptance criteria encode both branches.

### CORRECTION 2 (minor) — `Number.isFinite` / `typeof` clauses at `:1029` are redundant

Not a defect, and **not to be touched** — recorded only so nobody "cleans it up". Given
`!Number.isInteger(valor)` is in the same disjunction, the `typeof valor !== "number"` and
`!Number.isFinite(valor)` clauses can never be the sole rejecter (`Number.isFinite`/`Number.isInteger`
do not coerce, and `NaN`/`Infinity`/`"5"` all fail `Number.isInteger` too). They are harmless
defense-in-depth. **Leave them.** No mutation is required for them and none should be reported.

### CORRECTION 3 (minor) — `ReciboData` has a field the receipt never renders

`ReciboData.cliente.direccion` (`lib/document-generator.tsx:36`) is declared and populated by the
caller (`app/pagos/buscar/page.tsx:172`) but is **never interpolated** into the receipt HTML. So the
escape task covers **17 interpolation sites, not 18**. Do **not** "fix" this by rendering it — that
is a product change, not an escape task. Backlog.

### CONFIRMED AS STATED (no correction needed)

| Brief claim | Verified |
|---|---|
| `generateReciboHTML` at `lib/document-generator.tsx:1589` | ✅ exact |
| `ReciboData` at `lib/document-generator.tsx:31-57` | ✅ exact |
| `lib/document-generator.tsx:3` already imports `{ html, renderHtml }` from `./html-escape` | ✅ exact |
| Sole call site `app/pagos/buscar/page.tsx:206`, inside `regenerarRecibo` at `:152` | ✅ exact; repo-wide grep for `generateReciboHTML` outside `node_modules` returns only this call site, the import at `app/pagos/buscar/page.tsx:16`, the definition, `docs/plans/`, `MEMORY/`, and two "still exported" existence checks in `tests/voucher-html.test.ts:427` / `tests/confirmacion-html.test.ts:837` |
| Unlabeled `<Download />` icon button at `app/pagos/buscar/page.tsx:471-478` (`onClick` on `:474`) | ✅ exact |
| Two `Intl.NumberFormat` money calls at `:1752` and `:1762` | ✅ exact |
| B-16(a): `cantidad` guard at `:120-126` checks `typeof` / `Number.isFinite` / `<= 0` but **NOT** `Number.isInteger` | ✅ exact — and no test anywhere feeds a fractional `cantidad` |
| B-15: `normalizarTextoLibreONull` at `app/actions/documentos-actions.ts:1043`, typed `(valor: string | null)`, calls `valor.trim()` at `:1045` with no `typeof` guard | ✅ exact — a non-string non-null value produces `TypeError: valor.trim is not a function`, caught by the `catch` at `:1143` and returned as an opaque `error` string |
| `lib/document-generator.tsx` = 1822 lines; `app/actions/documentos-actions.ts` = 1146 lines | ✅ exact |
| Next.js **14.2.25** (CLAUDE.md's "Next.js 15" is stale) | ✅ `package.json:57` |
| `npm run qa` = `npm run typecheck && npm run lint && npm run test` = `tsc --noEmit` → `eslint .` → `vitest run` | ✅ `package.json:8-12` |

**Unverifiable from this workspace (stated, not asserted):** whether migrations
`scripts/061-create-reserva-pasajeros-ocupaciones.sql` and
`scripts/062-add-voucher-fields-to-reservas.sql` are *applied* to any database. Both files exist in
the repo. There are **no Supabase credentials anywhere in this workspace**, so applied-state cannot
be checked here. Nothing in this plan depends on the answer: Task 1's RECIBO path reads only
pre-existing tables, and Task 2's guards are pure input validation that runs **before** any DB call
and is fully covered by the existing `vi.mock("@supabase/supabase-js")` harness at
`tests/documentos-actions.test.ts:51-55`.

---

## Architecture Reasoning (show your work)

**Invariants in play + the existing mechanism each follows**

- **Escaping is a property of the renderer, never of the data** — stated as binding at
  `lib/html-escape.ts:8-14`. `ReciboData` keeps RAW domain values; only the generator changes.
  Existing mechanism to copy verbatim: `generateVoucherDocHTML` (`lib/document-generator.tsx:100`)
  and `generateConfirmacionHTML` (`:966`), both of which `return renderHtml(html\`…\`)` (see `:146`).
- **`escapeHtmlText`'s documented context limits** (`lib/html-escape.ts:20-24`): safe for element
  content and *quoted* attribute values; **not** sufficient for unquoted attributes, `javascript:`/URL
  contexts, or `<script>`/`<style>` bodies. I checked all 17 RECIBO interpolation sites against this:
  every one lands in element content or inside `<title>` (`:1596`). **Zero** interpolations land in
  any attribute, URL, `<style>` body (`:1597-1709` is fully static) or `<script>` body (there is no
  `<script>`; `onclick="window.print()"` at `:1784` is a static literal with no interpolation).
  The `html` tag is therefore sufficient here with no `raw()` and no sanitizer.
- **Accent preservation** — `escapeHtmlText` (`lib/html-escape.ts:50-59`) replaces exactly five ASCII
  characters, `&` first. Spanish accents and the en-dash pass byte-identical. This is already
  regression-tested for VOUCHER at `tests/voucher-html.test.ts:149-179` and gets the same treatment
  for RECIBO.
- **Money must not be corrupted** — the two `Intl.NumberFormat("es-DO", { style: "currency" })`
  outputs at `:1752` and `:1762`. Their output contains digits, grouping/decimal separators, a
  currency symbol, and possibly a non-breaking space — none of which is in the five-character escape
  set. So escaping is a no-op on them *in principle*; Task 1 proves it *in practice* with a pinned
  literal + a positive-control mutation, rather than asserting it.
- **Block-never-coerce** (`~/Developer/CBrain/mistakes/stockin-zero-price.md`) — governs Task 2
  absolutely. Existing mechanism to copy: the `orden` guard at
  `app/actions/documentos-actions.ts:107-118` and the pax guard at `:1021-1035`, both of which push a
  **named-field** message into an `errores: string[]` and return it joined, rejecting **before** the
  Supabase client is even constructed (`:1126-1127` runs before `:1138`).
- **Server/client boundary** — `app/actions/documentos-actions.ts` is `"use server"` (`:1`) and the
  service-role key is read only inside `createSupabaseServerClient()` (`:26-31`). Task 2 adds pure
  synchronous validation above that seam and moves nothing across it.
- **Fiscal** — RECIBO is a payment receipt. It does **not** allocate, read, or renumber an NCF;
  `comprobantes_fiscales` / `comprobantes_disponibles` are not in either task's file scope.

**Approaches considered + trade-offs + choice**

*Task 1 (B-12):*
1. **Wrap the existing template in the existing `html` tagged template** — `return renderHtml(html\`…\`)`,
   identical in shape to `generateVoucherDocHTML:146`. Diff is two edited lines plus whatever
   re-indentation the dev does *not* do. Zero new modules, zero new concepts, zero API change (still
   `(data: ReciboData) => string`). **CHOSEN.**
2. **Hand-call `escapeHtmlText(...)` at each of the 17 sites.** Rejected: 17 chances to forget one,
   and it inverts the module's own stated rule ("escaping is a property of the renderer") into
   per-site discipline — the exact thing the tagged template exists to remove.
3. **Escape at the data-construction boundary in `app/pagos/buscar/page.tsx:167-204`.** Rejected
   twice over: it contradicts `lib/html-escape.ts:8-14` verbatim, and it would leave the generator
   unsafe for any future caller. It also expands the blast radius into a 500+ line page component.

*Task 2 (B-15 + B-16):*
1. **Extend the two existing validator functions in place** — add `!Number.isInteger(...)` to the
   `cantidad` disjunction at `:120-124`, and add a small `localizador`/`regimen` `typeof` loop to
   `validateDatosVoucherInput` (`:1021-1035`), mirroring the `CAMPOS_PAX_VOUCHER` loop directly above
   it. **CHOSEN** — smallest surface, uses the file's own established shape, and both guards land on
   the path that already returns `{ success: false, error }` before any DB call.
2. **Throw from inside `normalizarTextoLibreONull` (`:1043`).** Rejected. Its return type is
   `string | null` — it structurally cannot express an error. A `throw` there would be swallowed by
   the `catch` at `:1143-1145` and surfaced as `{ success: false, error: "<message>" }` with no
   guarantee the field name survives, which is a *different* opaque error replacing the current
   opaque `TypeError`. The validator route produces the required **named-field** rejection directly.
   `normalizarTextoLibreONull` is therefore left **byte-unchanged**, and its declared
   `(valor: string | null)` signature becomes honest because nothing else can reach it.
3. **A shared validation framework / zod schema for the whole module.** Rejected on the human's
   explicit steer. Two guards do not justify a framework, and `zod` is a dependency this module does
   not currently use.

**Seam map (total file budget for this sprint — 4 files, nothing else)**

| File | Why it is in the budget | Task |
|---|---|---|
| `lib/document-generator.tsx` | edit: wrap `generateReciboHTML`'s body in `html`/`renderHtml` | 1 |
| `tests/recibo-html.test.ts` | **new file**: rendered-output assertions for RECIBO | 1 |
| `app/actions/documentos-actions.ts` | edit: `cantidad` integer guard + `localizador`/`regimen` typeof guard | 2 |
| `tests/documentos-actions.test.ts` | edit: new tests for the two new guards | 2 |

**Complement — MUST NOT be touched by either task**

- `lib/html-escape.ts` — the escape module itself. Task 1 is a *consumer*. Any change here silently
  alters CONFIRMACIÓN and VOUCHER too.
- `app/pagos/buscar/page.tsx` — the RECIBO call site. `generateReciboHTML`'s signature does not
  change, so this file needs no edit. Editing it is an automatic scope FAIL.
- `generateProformaHTML` (`lib/document-generator.tsx:288`) — byte-frozen dead code, guarded by
  `tests/proforma-snapshot.test.ts`. B-13 (deleting it) is out of scope.
- `generateVoucherDocHTML` (`:100`), `generateConfirmacionHTML` (`:966`),
  `openDocumentInNewWindow` (`:1798`) — already escaped / out of scope.
- `normalizarTextoLibreONull` (`app/actions/documentos-actions.ts:1043-1047`) and
  `construirActualizacionVoucher` (`:1058-1074`) — leave byte-unchanged (see Approach 2 above).
- The `typeof` / `Number.isFinite` clauses at `:1029` — redundant but harmless (Correction 2).
- Anything touching **auth, RLS, org scoping, NCF allocation, `comprobantes_fiscales`,
  `comprobantes_disponibles`, or any new table**.
- `scripts/*.sql` — no migration in this sprint.
- `CLAUDE.md`, `.claude/`, `package.json`, `vitest.config.ts`, `tsconfig.json`, `.eslintrc*`.
- `docs/plans/geb-rollout-checklist.md` — the human runs it externally; no task may run, simulate,
  or partially discharge it.
- `app/page.tsx`, `app/dashboard/page.tsx`, `app/facturacion/voucher/page.tsx` — the stale
  voucher strings are backlog only.

**Negative space checked**

Grepped `~/Developer/CBrain/decisions` and `~/Developer/CBrain/mistakes` for this area
(`escap|XSS|html-escape|isInteger|coerce|block-never-default`) and read the hits in full:
`0011-elibry-single-tenant-for-now`, `0006-rls-org-isolation-default`,
`0010-guard-the-negative-space`, `0003-hard-gates-anti-theater`, `stockin-zero-price`,
`assertion-without-verification`, `fake-green-tests`, `unrun-command-claimed-green`,
`environment-reliability-incidents`.

- **`0011` (HC-1, accepted-and-open):** Elibry has no auth; the browser runs as PostgREST `anon`;
  ~29 pre-existing tables have zero RLS. All three of its REJECTED alternatives — literal
  `TO authenticated` policies today, permissive `TO anon USING (true)`, and `org_id` + org-scoped RLS
  ahead of real auth — are **absent from this plan**. Neither task adds a table, a policy, a column,
  or a role. **Explicitly: nothing in this sprint makes Elibry meaningfully more secure.** Task 1
  closes one stored-XSS surface in one document rendered into a `window.open` document; Task 2 adds
  input hygiene at a Server Action boundary. The `anon` key remains a full read/write credential to
  `clientes` / `reservas` / `pagos` / `comprobantes_fiscales`. No report from this sprint may claim
  otherwise.
- **`0006`:** any NEW table needs an RLS policy. **No new tables here** — DB/RLS changes are `none`
  for both tasks, stated per-task below.
- **`0010`:** a structural-looking guarantee with no teeth is worse than none. This is why Task 1's
  `raw(`-count static guard is labelled **supplementary** and is never the sole proof, and why every
  guard in both tasks must be proven by a **run** mutation rather than by prose.
- **`stockin-zero-price` (BLOCK, NEVER DEFAULT):** governs Task 2 directly and is named inside its
  acceptance criteria. `Math.trunc`, `Math.round`, `|| 0`, `?? 0`, `String(...)`, `Number(...)` and
  any other coercion of a rejected value are **banned**.
- **`fake-green-tests` (nine banned anti-patterns, recurred four consecutive sprints):** both tasks'
  tests must import and call the **real** exported functions — `generateReciboHTML` from
  `../lib/document-generator`, and `guardarOcupacionesReservaAction` /
  `guardarDatosVoucherReservaAction` from `../app/actions/documentos-actions`. **No mirror tests, no
  hand-copied stubs, no argument-ignoring stubs, no vacuous assertions.** Anti-pattern #4
  (source-text assertions) is why the one `fs.readFileSync` guard in Task 1 is explicitly
  supplementary — precedent for that exact supplementary use is `tests/voucher-html.test.ts:226-236`.
  Anti-pattern #9 (claimed-but-absent coverage) is why Correction 1 exists at all: I greped before
  believing the brief.
- **`assertion-without-verification`:** this plan does **not** assert what any mutation will do. Every
  mutation below is written as an instruction to **run it and paste the output**, including the
  branch where the result contradicts my expectation (Task 2, M5).
- **`unrun-command-claimed-green`:** `npm run qa` must be actually run per task, output pasted.
- **`environment-reliability-incidents` (root cause UNRESOLVED):** no single test run here is
  self-evidently authoritative. If a run produces failures unrelated to the diff, `git stash` the
  change, re-run to establish the baseline, and report **both** runs rather than explaining the
  anomaly away.

**Pre-mortem — most drift-prone task + mitigation**

**Task 1 is the drift risk, in two specific directions.**

1. *Re-indentation noise.* Wrapping a 200-line template literal invites the dev (or an editor
   on-save formatter) to reflow the whole block, producing a 200-line diff in which a real change
   hides. **Mitigation, binding:** the source diff for Task 1 must be **≤ 6 changed lines** — the
   `return \`` → `return renderHtml(html\`` line, the closing `` ` `` → `` `) `` line, and nothing else.
   Whitespace inside the template must not change. QA rejects a whitespace-reflowed diff.
2. *"While I'm in here" fixes.* The function sits 9 lines below `generateConfirmacionHTML`'s tail and
   9 lines above `openDocumentInNewWindow`. The temptations are visible and named so they can be
   refused: rendering the unused `cliente.direccion`, guarding `data.pago.moneda` against an invalid
   ISO-4217 code, deleting `generateProformaHTML`, splitting the file. **All are backlog.** The file
   list plus the ≤ 6-line diff cap makes each of them a mechanical FAIL.

A third, smaller risk on Task 2: `tests/documentos-actions.test.ts` is a ~2100-line shared file that
several past tasks have edited. The new tests must be **appended inside the existing relevant
`describe` blocks** (`"guardarOcupacionesReservaAction — block-never-default validation"` at `:430`,
`"guardarDatosVoucherReservaAction — block-never-default, applied literally"` at `:1859`), not
placed in a new top-level block that re-declares the mock harness. Re-declaring
`makeQueryBuilder`/`mockFrom` is a FAIL.

**Genuinely hard architectural calls flagged for the human**

**None.** Both tasks are bounded, local, and have two working in-repo precedents each. There is no
schema redesign, no execution engine, and no concurrency question in this sprint. I am not going to
dress either of these up as harder than it is.

The only judgement call worth surfacing (already decided, recorded so it is not re-litigated): B-15's
rejection lives in `validateDatosVoucherInput`, **not** inside `normalizarTextoLibreONull`, because a
`string | null` return type cannot carry a named-field error and a `throw` there would be swallowed
by the existing `catch` at `:1143`. Justification is in Approach 2 above.

---

## Technical approach (one paragraph)

Two independent, local hardening changes on already-shipped code, each following a precedent that
already exists in the same file. **Task 1** wraps `generateReciboHTML`'s existing template literal in
the repo's existing `html` tagged template from `lib/html-escape.ts` — `return renderHtml(html\`…\`)`,
byte-for-byte the shape `generateVoucherDocHTML` (`lib/document-generator.tsx:146`) and
`generateConfirmacionHTML` already use — so all 17 interpolated values are escaped at the single
render seam, with no change to `ReciboData`, to the function signature, or to the sole caller at
`app/pagos/buscar/page.tsx:206`; a new `tests/recibo-html.test.ts` modelled on
`tests/voucher-html.test.ts` proves it with a hostile fixture, an accent-survival block, a
clean-fixture no-op block, and a money-preservation block. **Task 2** adds two missing runtime guards
to the voucher Server Action path in `app/actions/documentos-actions.ts` — `Number.isInteger` on
`OcupacionInput.cantidad` (`:120-126`) and a `typeof` check on `localizador`/`regimen` folded into
`validateDatosVoucherInput` (`:1021-1035`) — both of which **reject with a named-field error before
any DB call**, never coercing (`stockin-zero-price`), and re-verifies the already-existing pax integer
guard by running a mutation against its already-existing test. No schema, no RLS, no auth, no NCF, no
new table, no new dependency, no file split.

---

## File map

| File | Create / Edit | What changes |
|---|---|---|
| `lib/document-generator.tsx` | **Edit** | `generateReciboHTML` (`:1589`): `return \`` → `return renderHtml(html\``, and the closing `` ` `` → `` `) ``. The `html`/`renderHtml` import at `:3` already exists — do **not** add an import. Nothing else in the file changes. Target diff: **≤ 6 lines**. |
| `tests/recibo-html.test.ts` | **Create** | New test file (target ≤ 400 lines, hard cap 500 per `.claude/rules/file-size.md`) importing the real `generateReciboHTML`. Blocks: hostile fixture, accent survival, clean-fixture no-op, money preservation, supplementary `raw(`-count static guard. |
| `app/actions/documentos-actions.ts` | **Edit** | (a) `validateOcupacionesInput` (`:120-126`): add `!Number.isInteger(ocupacionGrupo.cantidad)` to the disjunction and extend the message to name the integer requirement, keeping the `cantidad:` prefix (existing tests at `:437`/`:447` assert `toContain("cantidad")`). (c) `validateDatosVoucherInput` (`:1021-1035`): add a loop over `["localizador", "regimen"]` that skips `undefined`/`null` and pushes a named-field error for any non-string. `normalizarTextoLibreONull` (`:1043-1047`) stays **byte-unchanged**. Target diff: **≤ 15 lines**. |
| `tests/documentos-actions.test.ts` | **Edit** | Append tests inside the two existing `describe` blocks at `:430` and `:1859`. Do not re-declare the mock harness (`:18-55`). |

**No other file may appear in either task's diff.**

---

## DB changes

**None.** No new table, no new column, no new index, no new view, no migration file, no
`CREATE POLICY`, no `ALTER TABLE`. `scripts/` is untouched.

## RLS

**None, and none weakened.** Per `~/Developer/CBrain/decisions/0011-elibry-single-tenant-for-now.md`
(HC-1, accepted-and-open), Elibry has no authentication and ~29 pre-existing tables have no RLS at
all. This sprint does not change that in either direction. `0006-rls-org-isolation-default`'s
"every new table needs a policy" rule is satisfied vacuously — there are no new tables.
**No report from this sprint may claim Elibry became more secure.**

## API / service changes

**None.** Both function signatures are unchanged:

- `generateReciboHTML(data: ReciboData): string` — same input, same output type. Only the *content*
  of the returned string changes, and only for values containing `& < > " '`.
- `guardarOcupacionesReservaAction` / `guardarDatosVoucherReservaAction` — same `{ success, error }` /
  `{ success, data }` result shape. The only behavioural change is that three previously-accepted
  (or previously-crashing) inputs now return `{ success: false, error: "<field>: …" }`.

No new Server Action, no new route, no new Supabase query, no change to
`createSupabaseServerClient()`.

## UI changes

**None.** No component, page, string, label, or style changes. `app/pagos/buscar/page.tsx` is
explicitly out of scope — the receipt it opens will simply render `&lt;script&gt;` where it used to
render a live `<script>`.

*(Noted, not fixed: the RECIBO trigger at `app/pagos/buscar/page.tsx:471-478` is an unlabeled
`<Download />` icon button with no `aria-label` and no tooltip. Accessibility backlog, not this
sprint.)*

## Edge cases

| Case | Where it is handled / why it cannot occur |
|---|---|
| **Empty / missing receipt fields** | `regenerarRecibo` (`app/pagos/buscar/page.tsx:152-204`) already substitutes `"N/A"` / `0` upstream, so the generator receives strings. `escapeHtmlText` (`lib/html-escape.ts:51`) additionally maps `null`/`undefined` → `""`, never the literal `"null"`. **Task 1 must not change the upstream substitution** — that is pre-existing behaviour and out of scope. |
| **Accents / en-dash corrupted by escaping** | Cannot occur: exactly five ASCII chars are replaced (`lib/html-escape.ts:53-58`). Proven by Task 1's accent-survival block, not asserted. |
| **Double-encoding** (`&lt;` → `&amp;lt;`) | Cannot occur: `&` is replaced **first** (`:54`). Task 1 asserts absence of `&amp;lt;` / `&amp;gt;` / `&amp;quot;` / `&amp;#39;`, mirroring `tests/voucher-html.test.ts:141-146`. |
| **Money mangled by escaping** | Currency output contains no `& < > " '`. Task 1 pins the literal and proves the assertion is non-vacuous via mutation **M3**. |
| **Invalid `moneda` → `Intl.NumberFormat` RangeError** | **Pre-existing**, unchanged by this sprint: `data.pago.moneda` (`:1754`, `:1764`) feeds the `currency:` option, and a non-ISO-4217 value throws. Today that throw is caught by `regenerarRecibo`'s `catch` (`:213-219`) → error toast. Escaping neither introduces nor fixes it. **Backlog. Do not fix in Task 1.** |
| **Concurrent edits / realtime races** | Not applicable. Neither task touches a subscription, a write path, or shared state. `generateReciboHTML` is pure. Task 2's guards are synchronous and run before any I/O. A repo grep for realtime subscribers on these paths returns nothing. |
| **Optimistic UI / rollback** | Not applicable — no optimistic mutation is added or modified. RECIBO generation is read-only and client-local. Task 2 **shortens** the write path (rejects earlier), so there is strictly less to roll back than before. |
| **Task 2 rejects a value the UI used to accept** | Intended and safe: the affected path (`guardarDatosVoucherReservaAction`) is reached from a React form that produces strings and numbers. A non-string `localizador` or fractional `cantidad` can realistically only arrive from a direct Server Action invocation — which is precisely the network boundary being defended, since Next.js Server Actions are directly callable independent of the React UI. |
| **Partial write on rejection** | Cannot occur: both guards return before `createSupabaseServerClient()` is called (`:1126-1127` precedes `:1138`; the ocupaciones guard likewise precedes its write). Both tasks assert `expect(mockFrom).not.toHaveBeenCalled()`, following the existing convention at `tests/documentos-actions.test.ts:1927`. |

---

## Test plan

**Gate command (run in full, per task, output pasted):**

```
npm run qa
```
which is `tsc --noEmit` → `eslint .` → `vitest run` (`package.json:8-12`).

**Focused runs while iterating:**

```
npx vitest run tests/recibo-html.test.ts          # Task 1
npx vitest run tests/documentos-actions.test.ts   # Task 2
```

**Scope proof (both tasks):**

```
git status --porcelain
git diff --stat
```
The changed-file list must equal that task's declared file list exactly — no more, no fewer.

**Baseline note (`environment-reliability-incidents`, root cause unresolved):** capture
`npm run qa` output **before** editing. If a post-change run shows failures unrelated to the diff,
`git stash`, re-run, and report **both** runs. Do not explain an anomaly away.

**Every acceptance criterion below has a verifying command or a named mutation. "It'll pass" is not
evidence.**

---

# Task list

## Task 1 — B-12: escape `generateReciboHTML` via the existing `html` tagged template

**Owner: senior-dev.** Justification: RECIBO is the only customer-facing document that actually
generates today, it renders money through two `Intl.NumberFormat` calls, and applying the escape
correctly requires verifying that no interpolation lands in one of the three contexts
`lib/html-escape.ts:20-24` explicitly says the module does **not** cover (unquoted attribute, URL,
`<script>`/`<style>` body) — a judgement call, not a mechanical substitution.

**Files in scope (exact — nothing else may appear in the diff):**
- `lib/document-generator.tsx`
- `tests/recibo-html.test.ts` *(new)*

**DB / RLS changes: none.** No table, column, migration, or policy.

**Dependencies: none.** This is the first task.

### Acceptance criteria (each independently verifiable, PASS/FAIL)

1. **AC1-1 — the escape is applied at the render seam, not per site.** `generateReciboHTML`
   (`lib/document-generator.tsx:1589`) returns `renderHtml(html\`…\`)`, matching
   `generateVoucherDocHTML:146`. No `escapeHtmlText(` call appears inside the function; no new import
   is added (`:3` already imports `html, renderHtml`). **Verify:** read the diff.
2. **AC1-2 — the diff is ≤ 6 changed source lines** in `lib/document-generator.tsx` and contains no
   whitespace-only reflow of the template body. **Verify:** `git diff --stat lib/document-generator.tsx`
   and read the diff. A reflowed 200-line diff is an automatic FAIL (pre-mortem risk 1).
3. **AC1-3 — signature and caller unchanged.** `generateReciboHTML(data: ReciboData): string` is
   unchanged, `ReciboData` (`:31-57`) is unchanged, and `app/pagos/buscar/page.tsx` does **not**
   appear in `git status --porcelain`. **Verify:** `tsc --noEmit` green + `git status --porcelain`.
4. **AC1-4 — hostile fixture renders safe.** `tests/recibo-html.test.ts` calls the **real imported**
   `generateReciboHTML` (no stub, no hand-copied re-implementation — `fake-green-tests` anti-pattern
   #7, *mirror tests*) with a fixture carrying, in the **same** object, a `<script>` payload, an
   `<img src=x onerror=…>` payload, single quotes, double quotes, ampersands, angle brackets **and**
   accented Spanish. **Distinct hostile payloads in at least three different fields**
   (`cliente.nombre`, `pago.referencia`, `reserva.servicio`) — a single-field fixture cannot
   distinguish "escapes every value" from "escapes the first value". Output contains no `<script`,
   and each field's exact escaped form is asserted individually.
5. **AC1-5 — no double-encoding.** Output contains none of `&amp;lt;`, `&amp;gt;`, `&amp;quot;`,
   `&amp;#39;` (mirrors `tests/voucher-html.test.ts:141-146`).
6. **AC1-6 — accents survive byte-identical.** A fixture containing `Pérez`, `Añejo`, `Ñandú`,
   `ESTADÍA`, `Categoría` renders each verbatim, and the output matches no numeric character
   reference in the Latin-1/Latin-Extended-A entity range (`/&#(2|3)\d\d;/`).
7. **AC1-7 — no-op on clean data.** A fixture with no escapable characters renders **zero** entities:
   output contains none of `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, and every clean field value
   appears verbatim.
8. **AC1-8 — money is preserved exactly.** For a fixture with a known `pago.monto` and
   `reserva.total` and `moneda: "DOP"`, the test pins **at least one hardcoded literal substring** of
   the rendered currency output (grouping + decimals), taken from the **actual observed output** of
   the real function and pasted into the dev report alongside the test. **Do not** write
   `expect(out).toContain(new Intl.NumberFormat(...).format(x))` as the *only* money assertion —
   an assertion that re-derives its own expectation from the same formatter would follow a future
   formatting change and stay green (`fake-green-tests` anti-pattern #6, *decoupled payload proxy*).
   The literal must be **run-derived, never guessed** (`assertion-without-verification`), and its
   non-vacuity is proven by mutation **M3**.
9. **AC1-9 — supplementary static guard.** A `raw(`-count guard over the sliced source of
   `generateReciboHTML`, asserting **0**, following the exact precedent at
   `tests/voucher-html.test.ts:226-236`. This is **supplementary only** and must be accompanied by
   the rendered-output assertions above — a source-text assertion alone is `fake-green-tests`
   anti-pattern #4 and, per `0010-guard-the-negative-space`, a toothless structural guarantee is
   worse than none.
10. **AC1-10 — sibling generators untouched.** `generateProformaHTML`, `generateConfirmacionHTML`,
    `generateVoucherDocHTML` and `openDocumentInNewWindow` show an **empty diff**, and
    `tests/proforma-snapshot.test.ts`, `tests/confirmacion-html.test.ts`, `tests/voucher-html.test.ts`
    pass unchanged. **Verify:** `npm run qa` + read the diff.
11. **AC1-11 — `npm run qa` actually run, full output pasted** (`unrun-command-claimed-green`,
    `0003-hard-gates-anti-theater`). A command that "would" pass but was not run = FAILED.
12. **AC1-12 — no security overclaim.** The dev report must state plainly that this closes one
    stored-XSS surface in one document and does **not** change Elibry's auth or RLS posture
    (`0011-elibry-single-tenant-for-now`, HC-1 accepted-and-open).

### Mutations the dev must RUN (not assert), with real output pasted

> These are **instructions to execute**, not predictions. Run each on a clean copy, paste the actual
> pass/fail counts, then restore. Per `assertion-without-verification`, a claim that a mutation
> "would" flip a test RED is void until the RED output exists. If a mutation comes back GREEN, that
> is a finding: report it and strengthen the test.

- **M1 (whole-function revert).** Change `return renderHtml(html\`` back to `` return ` `` and the
  closing `` `) `` back to `` ` ``. Run `npx vitest run tests/recibo-html.test.ts`. Paste output.
  Restore.
- **M2 (per-field, the important one).** With the fix in place, wrap exactly **one** interpolation in
  the explicit opt-out — `${raw(data.cliente.nombre)}` (adding `raw` to the `:3` import for the
  duration of the mutation only). Run the file. This must be shown to take down **both** the
  `cliente.nombre` hostile assertion **and** the AC1-9 `raw(`-count guard, proving per-field coverage
  rather than merely whole-function coverage. Paste output. Restore, **including the import**.
- **M3 (money positive control, anti-vacuity).** With the fix in place, change `.format(data.pago.monto)`
  at `:1762` to `.format(0)`. Run the file. This proves the AC1-8 money literal is a real assertion
  and not one that passes regardless. Paste output. Restore.

**Rollback:** `git revert <task-1-commit>` — restores the unescaped template and deletes
`tests/recibo-html.test.ts`; no other file, no schema, and no data is affected.
*(Re-verify this command against the actual commit hash at the moment you cite it — a rollback note
correct when written goes stale, per `assertion-without-verification` instance 2.)*

---

## Task 2 — B-15 + B-16: integer guard on `cantidad`, typeof guard on `localizador`/`regimen`, and mutation-proof of the existing pax guard

*(One scope unit — same defect class, two sites. The brain rule is explicit that the `pax_*` guard is
never treated in isolation.)*

**Owner: junior-dev.** Justification: two small guards added directly beside two in-file precedents
(`validatePasajerosInput`'s `orden` guard at `:69-75`, `validateDatosVoucherInput`'s pax loop at
`:1024-1032`), with no schema, no RLS, no money math, and no fiscal surface — and the block-never-coerce
rule is stated concretely enough in the criteria below to be followed without judgement calls.

**Files in scope (exact — nothing else may appear in the diff):**
- `app/actions/documentos-actions.ts`
- `tests/documentos-actions.test.ts`

**DB / RLS changes: none.** No table, column, migration, or policy. `scripts/` untouched.

**Dependencies:** **Technically none** — zero file overlap with Task 1, so nothing in Task 2 is
blocked by Task 1's code. **However**, `CLAUDE.md` ("Workflow rules": *"One task at a time. Do not
start task N+1 until task N passes QA"*) governs, so **Task 2 starts only after Task 1's QA report
shows Verdict: PASS.** Both facts are stated so the sequencing is a house rule, not a
misunderstanding about coupling.

### Acceptance criteria (each independently verifiable, PASS/FAIL)

1. **AC2-1 — `cantidad` must be an integer (B-16a).** `validateOcupacionesInput`
   (`app/actions/documentos-actions.ts:120-126`) rejects a fractional `cantidad` (e.g. `2.5`).
   **BLOCK, NEVER COERCE** (`~/Developer/CBrain/mistakes/stockin-zero-price.md`): the value is
   rejected — never `Math.trunc`'d, `Math.round`ed, `|| 0`'d, `?? 0`'d, or `Number()`/`String()`-cast.
   **Verify:** `git diff` contains none of `Math.trunc`, `Math.round`, `|| 0`, `?? 0`, `Number(`,
   `String(` in the changed hunks, **and** mutation **M4**.
2. **AC2-2 — the `cantidad` error names its field and its group.** The returned `error` contains
   `"cantidad"` and the `ocupación #N` label, and the existing tests at
   `tests/documentos-actions.test.ts:431-450` (`cantidad: 0`, `cantidad: -2`) still pass — i.e. the
   `cantidad:` prefix survived the message change.
3. **AC2-3 — nothing reaches the DB on rejection.** The new fractional-`cantidad` test asserts
   `expect(mockFrom).not.toHaveBeenCalled()`, matching the convention at
   `tests/documentos-actions.test.ts:1927`.
4. **AC2-4 — non-string `localizador`/`regimen` are rejected with a named-field error (B-15).**
   `guardarDatosVoucherReservaAction(id, { localizador: 12345 as any })` returns
   `{ success: false }` with `error` containing `"localizador"`; same for `regimen`. The test
   additionally asserts the error is **not** the old opaque crash —
   `expect(error).not.toContain("is not a function")` — which is the entire point of B-15.
   `expect(mockFrom).not.toHaveBeenCalled()`.
5. **AC2-5 — `null` and `undefined` still behave exactly as before (regression guard).** An explicit
   `localizador: null` still writes `null` (existing test `:1983-1992` passes unchanged), and
   `undefined` still leaves the column out of the payload entirely (existing test `:1890-1904` passes
   unchanged). The new guard must skip both — **`stockin-zero-price` cuts both ways**: `0`/`null` are
   legitimate values, not "unset", and over-eager rejection is the same defect class as coercion.
6. **AC2-6 — positive control, anti-tautology.** A **valid** non-blank string `localizador` still
   saves and still trims (existing tests `:1860-1877`, `:1972-1981` pass unchanged). This proves the
   new guard did not simply start rejecting everything — a rejection test with no passing counterpart
   is a vacuous assertion (`fake-green-tests` anti-pattern #5).
7. **AC2-7 — `normalizarTextoLibreONull` is byte-unchanged.** `app/actions/documentos-actions.ts:1043-1047`
   shows an **empty diff**. The rejection lives in `validateDatosVoucherInput`, which runs at `:1126`
   before `construirActualizacionVoucher` at `:1129`, so the normalizer can no longer be reached with
   a non-string and its declared `(valor: string | null)` type becomes honest. **Verify:** read the diff.
8. **AC2-8 — B-16(b): the existing pax integer guard is proven live by a RUN mutation, not by new
   tests.** Per **Correction 1** at the top of this plan, coverage already exists at
   `tests/documentos-actions.test.ts:1930-1937` (`{ pax_ninos: 2.5 }`). The deliverable is mutation
   **M5** with its real output pasted. **Do not add a duplicate `pax_ninos: 2.5` test.**
   **Branch, mandatory:** if M5 comes back **GREEN**, my correction is wrong, the gap is real, and the
   dev must (i) say so explicitly in the report and (ii) add the missing mutation-killing test in this
   same task. Reporting M5 without its actual output is `unrun-command-claimed-green` and is an
   automatic FAIL.
9. **AC2-9 — tests appended inside existing `describe` blocks.** New cases go inside
   `"guardarOcupacionesReservaAction — block-never-default validation"` (`:430`) and
   `"guardarDatosVoucherReservaAction — block-never-default, applied literally"` (`:1859`). The mock
   harness (`makeQueryBuilder`/`queueBuilders`/`mockFrom`, `:18-55`) is **not** re-declared,
   duplicated, or modified — a re-declared or argument-ignoring stub is `fake-green-tests`
   anti-pattern #8 (*weak stubs*).
10. **AC2-10 — tests exercise the real exported Server Actions.** `guardarOcupacionesReservaAction`
    and `guardarDatosVoucherReservaAction` are imported from `../app/actions/documentos-actions`
    (already imported at `tests/documentos-actions.test.ts:57-70`) and called directly. The private
    validators are **not** re-implemented, re-exported, or hand-copied into the test
    (`fake-green-tests` anti-pattern #7, *mirror tests*).
11. **AC2-11 — source diff ≤ 15 lines** in `app/actions/documentos-actions.ts`, confined to
    `validateOcupacionesInput` and `validateDatosVoucherInput`. No other function is touched; the
    redundant `typeof`/`Number.isFinite` clauses at `:1029` are **left alone** (Correction 2).
    **Verify:** `git diff --stat` + read the diff.
12. **AC2-12 — `npm run qa` actually run, full output pasted**, with the pre-existing 498-test
    baseline plus the new cases all green (`unrun-command-claimed-green`,
    `0003-hard-gates-anti-theater`).
13. **AC2-13 — no security overclaim.** The report states plainly that these guards are
    **defense-in-depth at the Server Action network boundary** (Next.js Server Actions are directly
    callable, independent of the React UI) on a voucher path that is **inert in any environment where
    `scripts/062-add-voucher-fields-to-reservas.sql` is unapplied** — applied-state is **not verifiable
    from this workspace** (no credentials). No claim that Elibry's security posture changed
    (`0011-elibry-single-tenant-for-now`, HC-1).

### Mutations the dev must RUN (not assert), with real output pasted

> Execute each on a clean copy, paste actual output, restore. Predictions are not evidence
> (`assertion-without-verification`).

- **M4 (B-16a).** Delete `!Number.isInteger(ocupacionGrupo.cantidad) ||` from the guard at
  `app/actions/documentos-actions.ts:120-124`. Run `npx vitest run tests/documentos-actions.test.ts`.
  The new fractional-`cantidad` test must go RED. Paste output. Restore.
- **M5 (B-16b — the deliverable for that item).** Delete `!Number.isInteger(valor) ||` from
  `app/actions/documentos-actions.ts:1029`. Run `npx vitest run tests/documentos-actions.test.ts`.
  The **existing** test at `:1930` (`"rejects a NON-INTEGER pax_ninos…"`) must go RED. Paste output.
  Restore. **If it stays GREEN, follow the branch in AC2-8.**
- **M6 (B-15).** Delete the new `localizador`/`regimen` typeof guard from `validateDatosVoucherInput`.
  Run the file. The new non-string tests must go RED — and the dev should note whether they fail with
  the opaque `TypeError: … .trim is not a function` (the original B-15 symptom) or with a plain
  assertion failure. Paste output. Restore.
- **M7 (anti-tautology positive control).** With **all** guards in place, run the full
  `tests/documentos-actions.test.ts` and confirm the pre-existing valid-input tests
  (`:1860`, `:1879`, `:1950`, `:1961`, `:1972`, `:1983`) are still green — proving the new guards
  reject only what they are meant to reject. Paste the summary line.

**Rollback:** `git revert <task-2-commit>` — restores both validators and removes the added tests; no
schema, no data, and no other file is affected. **Do not delete `app/actions/documentos-actions.ts`**
— it is tracked and shared by T1/T2/T2b/T5/T7/T12 per the standing note at its `:3-4`.
*(Re-verify against the actual commit hash at the moment you cite it.)*

---

## Risks

- **R1 — Task 1 diff bloat via re-indentation.** Wrapping a ~200-line template invites a full reflow
  that buries the real change. **Mitigation:** AC1-2's hard ≤ 6-line cap; QA rejects a reflowed diff.
- **R2 — The money literal in AC1-8 is guessed rather than observed.** `Intl.NumberFormat("es-DO",
  { style: "currency", currency: "DOP" })` output (symbol placement, and whether the separator is a
  normal space or U+00A0) depends on the runtime's ICU build. **I deliberately did not put an expected
  currency string in this plan** — asserting one I have not run is exactly
  `assertion-without-verification`. **Mitigation:** AC1-8 requires the literal be derived by running
  the real function and pasted into the report; M3 proves it is not vacuous.
- **R3 — Pre-existing `RangeError` on an invalid `moneda`.** `data.pago.moneda` feeds
  `Intl.NumberFormat`'s `currency:` option at `:1754`/`:1764`; a non-ISO-4217 value throws (today
  caught by `regenerarRecibo`'s `catch` → error toast). **Unchanged by this sprint. Backlog. Not a
  Task 1 fix** — fixing it inside Task 1 is scope creep.
- **R4 — Task 2's guards land on a path that may be inert.** They sit on the voucher Server Action
  path, which does nothing in an environment where `scripts/062` is unapplied — and applied-state is
  **unverifiable from this workspace** (no credentials anywhere). This is accepted: the guards are
  defense-in-depth at a directly-callable network boundary. The value must not be overstated in any
  report (AC2-13).
- **R5 — Behaviour change on previously-accepted input.** After Task 2, a fractional `cantidad` or a
  non-string `localizador` that previously slipped through (or crashed opaquely) now returns a clean
  named-field error. Intended. AC2-5/AC2-6 pin the `null`/`undefined`/valid-string paths so the guard
  cannot over-reject.
- **R6 — Environment reliability (root cause UNRESOLVED,
  `~/Developer/CBrain/mistakes/environment-reliability-incidents.md`).** Prior sprints saw root-owned
  `.git` objects (twice, two repos), concurrent-agent scratch contamination, and an unexplained
  24-failure vitest false-negative on md5-clean source. **No single test run here is self-evidently
  authoritative.** **Mitigation:** capture a pre-change `npm run qa` baseline; on any unrelated
  failure, `git stash`, re-run, and report both runs rather than rationalising.
- **R7 — Fake-green recurrence (four consecutive sprints).** The single most likely way this sprint
  ships nothing real. **Mitigation:** every guard has a named RUN mutation (M1–M7); the one
  source-text assertion (AC1-9) is explicitly supplementary; QA must independently re-run each
  mutation by restoring the **real** original code, never accepting the dev's account of it.
- **R8 — File-size breach worsens.** See the dedicated section below.

---

## File-size breach note (B-1 / B-9) — REQUIRED, and deliberately NOT fixed here

`.claude/rules/file-size.md` sets a healthy range of **≤ 500 lines per file** and states that a split
**is its own scoped task and must never be bundled into a feature task**.

Both files this sprint edits **already breach that rule before a single line is added**:

| File | Lines today | Over the 500 limit by | This sprint adds |
|---|---|---|---|
| `lib/document-generator.tsx` | **1822** | 3.6× | ~0–2 lines (Task 1 is a wrap, ≤ 6 changed lines) |
| `app/actions/documentos-actions.ts` | **1146** | 2.3× | ~8–15 lines (Task 2's two guards) |
| `tests/documentos-actions.test.ts` | ~2100 | 4.2× | ~30–50 lines (Task 2's new cases) |

**Both tasks therefore make an existing breach slightly worse. This is flagged, accepted, and
explicitly not fixed in this sprint** — per the file-size rule itself (a split is its own scoped
task), per the sprint brief (B-1/B-9 are out of scope), and per the human's steer ("skip any
overengineer thing"). **No task in this plan may split, extract from, or reorganise either file.**
Doing so is an automatic scope FAIL. B-1 and B-9 remain in the backlog below, now with exact
current line counts so the future split task can be sized without re-measuring.

The one place this plan actively *limits* the damage: `tests/recibo-html.test.ts` is a **new** file
with a target of ≤ 400 lines and a hard cap of 500 — it must not be appended into an existing
oversized test file.

---

## Backlog (not in this sprint)

Recorded here rather than added as tasks, per the human's steer and `CLAUDE.md`'s "New ideas go in a
backlog note, not into the diff."

1. **B-1 / B-9 — file splits.** `lib/document-generator.tsx` (1822 lines) and
   `app/actions/documentos-actions.ts` (1146 lines); also `tests/documentos-actions.test.ts` (~2100
   lines). Each is its own scoped task, never bundled.
2. **B-13 — delete the dead `generateProformaHTML`** (`lib/document-generator.tsx:288`), currently
   byte-frozen by `tests/proforma-snapshot.test.ts`.
3. **B-17 — proxy hardening.** Skipped by the human as ambiguous under both readings
   (`lib/supabase.ts`'s lazy client / `lib/voucher-data.ts`'s `VoucherDocData`). Needs a product
   ruling before it can be specced.
4. **B-14 — fixture-strength sweep.** Cut by the orchestrator. Stays backlog.
5. **Stale voucher strings** — `app/page.tsx:995`, `app/dashboard/page.tsx:295`
   ("Generar vouchers de pago"), and the misleading block message at
   `app/facturacion/voucher/page.tsx:1149-1152`.
6. **`ReciboData.cliente.direccion` is populated but never rendered** (`lib/document-generator.tsx:36`,
   populated at `app/pagos/buscar/page.tsx:172`). Either render it or drop it from the contract —
   a **product** decision, not an escaping one (Correction 3).
7. **Invalid-`moneda` `RangeError` in RECIBO** — `data.pago.moneda` reaches `Intl.NumberFormat`'s
   `currency:` option unvalidated (`lib/document-generator.tsx:1754`, `:1764`). Today it produces a
   generic error toast. A block-never-default guard belongs here eventually (R3).
8. **Accessibility: the RECIBO trigger is an unlabeled icon button** —
   `app/pagos/buscar/page.tsx:471-478`, a bare `<Download />` with no `aria-label` or tooltip.
9. **The hardcoded `empresa` block in `regenerarRecibo`** (`app/pagos/buscar/page.tsx:198-203`) —
   company name, address, phone and email are literals in a page component while
   `configuracion_empresa` exists as a table. Data-source cleanup, not this sprint.
10. **`docs/plans/geb-rollout-checklist.md`** — the migration pre-flight. **No agent task.** There are
    no Supabase credentials in this workspace; the human runs it externally. No task in this or any
    near-term sprint may run, simulate, or partially discharge it.
11. **HC-1 / R1 standing exposure** (`0011-elibry-single-tenant-for-now`) — no auth, ~29 tables with
    zero RLS, public anon key as a full read/write credential. **Accepted-and-open. Untouched by this
    sprint.** Any future sprint touching auth or broad RLS must re-read that ADR and
    `0006-rls-org-isolation-default` and re-raise HC-1 to the human first.

---

PLAN_PATH: docs/plans/recibo-escape-and-input-guards.md
