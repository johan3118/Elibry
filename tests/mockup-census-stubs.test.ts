// docs/plans/mockup-census-hide.md, T7 — THE FORCING FUNCTION.
// Sent back to the dev twice by QA (a `const`-PoC, then a `var`-PoC); the lead escalated to the
// architect rather than a third send-back. RULING R1 (2026-08-18) ruled the original AC
// unachievable by static source scanning and demoted the per-shape heuristics below.
//
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

import { readFileSync, existsSync } from "fs"
import { resolve } from "path"
import { describe, it, expect } from "vitest"

// The 18 exact routes stubbed by T2–T6. This list is hard-coded on purpose:
// PATHS.length === 18 is asserted below so a silently-shortened list fails.
const PATHS = [
  "app/configuracion/page.tsx",
  "app/configuracion/usuarios/page.tsx",
  "app/configuracion/parametros/page.tsx",
  "app/configuracion/colaboradores/page.tsx",
  "app/configuracion/maestros/page.tsx",
  "app/configuracion/tipos-productos/page.tsx",
  "app/reportes/page.tsx",
  "app/proyectos/page.tsx",
  "app/proyectos/pagos/page.tsx",
  "app/proyectos/facturas/page.tsx",
  "app/proyectos/buscar-pagos/page.tsx",
  "app/facturacion/buscar/page.tsx",
  "app/facturacion/comprobantes/page.tsx",
  "app/pagos/copias/page.tsx",
  "app/logs/page.tsx",
  "app/logs/auditoria/page.tsx",
  "app/logs/rendimiento/page.tsx",
  "app/admin/page.tsx",
]

// FORBIDDEN LITERALS — expanded per the T4/T6 lead ruling: the plan
// originally listed four; B0100000001/B0100000002 were added at T4, and QA
// discovered four more fabricated NCFs during T6. Scoped to THE 18 FILES
// ONLY (not repo-wide) — `131-12345-6`-style RNC placeholders legitimately
// still exist in scripts/*.sql seed data and app/clientes/editar/page.tsx
// and must NOT be swept in here.
const FORBIDDEN_LITERALS = [
  "$45,231",
  "100 disponibles",
  "B0100000025",
  "B0100000001",
  "B0100000002",
  "B0101000001",
  "B0202000001",
  "B0111000525",
  "B0212001100",
  "B0303000001",
  "B0404000001",
]

// A top-level (or function-scoped — deliberately not restricted to module
// scope, so a fabricated declaration hidden inside the component body is
// caught too) `const`/`let`/`var` object-literal declaration. `var` was
// added after the 2nd send-back: QA swapped `const` for `var`
// (`var stats = { total: "1234 clientes", trend: "en aumento" }`) and the
// v2 regex (const/let only) missed it. Verified against all 18 real stub
// files with zero false positives (none of the 18 declares any
// const/let/var).
const OBJECT_LITERAL_DECLARATION = /\b(?:const|let|var)\s+\w+\s*=\s*\{/

// The array-of-objects shape from the original plan (T7 v1).
const ARRAY_OF_OBJECTS_LITERAL = /=\s*\[\s*\{/

// Currency-shaped ($1,234 / $45,231.89) or percent-shaped (+15.3% / -2%)
// numeric literal — this is what closes the EXACT shape of the original
// /reportes bug ($45,231.89, +20.1%, +180.1%, +19%, +201) and of QA's first
// PoC (trend: "+15.3%"), neither of which is an array-of-objects and
// neither of which is one of the 11 exact forbidden strings above. Verified
// against all 18 real stub files with zero false positives.
const CURRENCY_OR_PERCENT_LITERAL = /\$[\d,]+(\.\d+)?|[+\-]?\d+(\.\d+)?%/

describe("mockup census — the 18 stubbed routes (T7 forcing function)", () => {
  it("hard-codes exactly 18 paths (a silently-shortened list fails here)", () => {
    expect(PATHS.length).toBe(18)
  })

  for (const relPath of PATHS) {
    describe(relPath, () => {
      const absPath = resolve(__dirname, "..", relPath)

      it("file exists", () => {
        expect(existsSync(absPath)).toBe(true)
      })

      it("renders through the shared ModuloNoDisponible component (forces callers through it — bypassing it is RED)", () => {
        const source = readFileSync(absPath, "utf-8")
        expect(source).toContain("ModuloNoDisponible")
      })

      it("contains ZERO Supabase build: no createClient, no .from( (zero BUILD proof)", () => {
        const source = readFileSync(absPath, "utf-8")
        expect(source).not.toMatch(/createClient/)
        expect(source).not.toMatch(/\.from\(/)
      })

      it("contains no array-of-objects literal (`= [` followed by `{`) — no fabricated table", () => {
        const source = readFileSync(absPath, "utf-8")
        expect(source).not.toMatch(ARRAY_OF_OBJECTS_LITERAL)
      })

      it("contains no const/let/var object-literal declaration (`const x = {` / `let x = {` / `var x = {`) — no fabricated stats object (closes both the const-PoC and the var-PoC send-backs)", () => {
        const source = readFileSync(absPath, "utf-8")
        expect(source).not.toMatch(OBJECT_LITERAL_DECLARATION)
      })

      it("contains no currency-shaped ($n,nnn) or percent-shaped (n%) literal — closes the exact original /reportes bug shape", () => {
        const source = readFileSync(absPath, "utf-8")
        expect(source).not.toMatch(CURRENCY_OR_PERCENT_LITERAL)
      })

      it("contains none of the forbidden fabricated literals", () => {
        const source = readFileSync(absPath, "utf-8")
        for (const literal of FORBIDDEN_LITERALS) {
          expect(source).not.toContain(literal)
        }
      })

      it("is <= 30 lines (the line-budget half of the forcing function)", () => {
        const source = readFileSync(absPath, "utf-8")
        const lineCount = source.split("\n").length
        expect(lineCount).toBeLessThanOrEqual(30)
      })
    })
  }
})
