/**
 * lib/html-escape.ts
 *
 * HC-5 (docs/plans/geb-documents-real-data.md §9 HC-5, Task T6b) — the single
 * seam where HTML is produced from interpolated values in this codebase's
 * document generators.
 *
 * THE RULE (binding for every future generator, stated so T13/T14 inherit it
 * without re-litigating): ESCAPING IS A PROPERTY OF THE RENDERER, NEVER OF
 * THE DATA. Data contracts (e.g. `ConfirmacionData`) carry RAW domain values.
 * Every generator that produces HTML builds its output with the `html` tag
 * below, which escapes EVERY interpolated value by default. The only way to
 * emit unescaped content is to wrap it in `raw()` — explicit, greppable, and
 * never given a value that originated in the database or from a user.
 *
 * Pure. No DOM API. No dependency (no sanitizer) — there is no DOM in this
 * path (plain string templates written into `window.open`'s document), and a
 * sanitizer solves a different problem (allowing SOME markup).
 *
 * CONTEXT LIMITS (do not over-trust this module): `escapeHtmlText` is safe
 * for element content and quoted attribute values. It is NOT sufficient for
 * unquoted attributes, `javascript:`/URL contexts, or `<script>`/`<style>`
 * bodies. Interpolating database or user data into those contexts is
 * forbidden in these generators.
 */

/** A pre-built HTML fragment that the `html` tag will inline verbatim. */
export type SafeHtml = { readonly __safeHtml: string }

function isSafeHtml(value: unknown): value is SafeHtml {
  return (
    typeof value === "object" &&
    value !== null &&
    "__safeHtml" in value &&
    typeof (value as { __safeHtml: unknown }).__safeHtml === "string"
  )
}

/**
 * Replaces EXACTLY five ASCII characters — `&` FIRST (so a literal `&lt;` in
 * the input never becomes `&amp;lt;`), then `<`, `>`, `"`, `'`. Nothing else
 * is touched: accented Spanish (á é í ó ú ñ Á É Í Ó Ú Ñ) and punctuation like
 * the en-dash (–) pass through byte-identical. Matches the semantics of the
 * legacy `escapeHtml` at `app/facturacion/proforma/page.tsx:97-103`.
 *
 * Non-string inputs are coerced with `String(v)`. `null`/`undefined` render
 * as `""`, never the string `"null"`/`"undefined"` (block-never-default —
 * this module never invents a placeholder value).
 */
export function escapeHtmlText(value: unknown): string {
  if (value === null || value === undefined) return ""
  const str = typeof value === "string" ? value : String(value)
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * The explicit, greppable escape hatch for genuinely pre-trusted markup
 * (i.e. markup built by THIS module, never a raw database/user value). Every
 * generator's acceptance criteria include a static guard asserting how many
 * times `raw(` appears — changing that count later requires a deliberate
 * comment, never a silent edit.
 */
export function raw(value: string): SafeHtml {
  return { __safeHtml: value }
}

/**
 * Stringifies one interpolated value for the `html` tag:
 *  - `SafeHtml` (from `raw()` or a nested `html` template) inlines verbatim.
 *  - Arrays recurse per-element and are joined with `""` — this is what lets
 *    a `.map()` of nested `html` row-fragments (SafeHtml[]) compose into the
 *    parent template with no `raw()` needed, e.g. DETALLE rows and the
 *    passenger list.
 *  - Everything else is escaped by default.
 */
function stringifyInterpolatedValue(value: unknown): string {
  if (isSafeHtml(value)) return value.__safeHtml
  if (Array.isArray(value)) return value.map(stringifyInterpolatedValue).join("")
  return escapeHtmlText(value)
}

/**
 * Tagged template literal: escapes EVERY interpolated value by default, at
 * the one seam where interpolation happens. `SafeHtml` values and arrays of
 * them inline verbatim (see `stringifyInterpolatedValue`), so nested
 * `.map()` row fragments compose without any opt-out.
 */
export function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let result = strings[0]
  for (let i = 0; i < values.length; i++) {
    result += stringifyInterpolatedValue(values[i])
    result += strings[i + 1]
  }
  return { __safeHtml: result }
}

/** Unwraps a `SafeHtml` to a plain string at the outermost render boundary. */
export function renderHtml(value: SafeHtml): string {
  return value.__safeHtml
}
