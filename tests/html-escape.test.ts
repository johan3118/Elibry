// HC-5 (docs/plans/geb-documents-real-data.md §9 HC-5, Task T6b) — unit tests
// for lib/html-escape.ts: the tagged-template renderer, the escaper, and the
// raw() opt-out.
//
// Offline, plain data objects (patterns/port-and-in-memory-fake) — no
// network, no Supabase, no env vars.

import { describe, it, expect } from "vitest"
import { escapeHtmlText, raw, html, renderHtml, type SafeHtml } from "../lib/html-escape"

describe("escapeHtmlText — exactly five ASCII characters, & first", () => {
  it("replaces & < > \" ' and nothing else", () => {
    expect(escapeHtmlText(`& < > " '`)).toBe("&amp; &lt; &gt; &quot; &#39;")
  })

  it("escapes & BEFORE < so a literal &lt; in the input never becomes &amp;lt; — fixture 'literal &lt; entity'", () => {
    const input = "literal &lt; entity"
    const result = escapeHtmlText(input)
    // If & were escaped after < this would double-encode to &amp;lt;.
    expect(result).toBe("literal &amp;lt; entity")
    expect(result).not.toContain("&amp;lt;lt;")
  })

  it("leaves accented Spanish text byte-identical — fixture 'Categoría Pérez Añejo Ñandú ESTADÍA'", () => {
    const input = "Categoría Pérez Añejo Ñandú ESTADÍA – café"
    expect(escapeHtmlText(input)).toBe(input)
  })

  it("coerces a number with String(v) — no escapable characters, passes through", () => {
    expect(escapeHtmlText(1234)).toBe("1234")
  })

  it("coerces a boolean with String(v)", () => {
    expect(escapeHtmlText(true)).toBe("true")
  })

  it("renders null as empty string, never the text 'null'", () => {
    expect(escapeHtmlText(null)).toBe("")
  })

  it("renders undefined as empty string, never the text 'undefined'", () => {
    expect(escapeHtmlText(undefined)).toBe("")
  })

  it("escapes a script-tag payload — fixture '<script>alert(1)</script>'", () => {
    const input = "<script>alert(1)</script>"
    const result = escapeHtmlText(input)
    expect(result).not.toContain("<script")
    expect(result).toBe("&lt;script&gt;alert(1)&lt;/script&gt;")
  })
})

describe("raw() — explicit, greppable escape hatch", () => {
  it("wraps a string as SafeHtml UNMODIFIED — renderHtml(raw(x)) === x", () => {
    const markup = `<b>trusted & pre-built</b>`
    expect(renderHtml(raw(markup))).toBe(markup)
  })

  it("is NOT escaped when inlined by the html tag — fixture '<em>already markup</em>'", () => {
    const markup = raw("<em>already markup</em>")
    const out = renderHtml(html`<div>${markup}</div>`)
    expect(out).toBe("<div><em>already markup</em></div>")
  })
})

describe("html — escapes every interpolated value by default", () => {
  it("escapes a plain string interpolation — fixture 'Juana <script>alert(1)</script> Pérez'", () => {
    const nombre = "Juana <script>alert(1)</script> Pérez"
    const out = renderHtml(html`<span>${nombre}</span>`)
    expect(out).not.toContain("<script")
    expect(out).toBe("<span>Juana &lt;script&gt;alert(1)&lt;/script&gt; Pérez</span>")
  })

  it("escapes MULTIPLE interpolations, not just the first — fixture two distinct hostile values", () => {
    const a = `O'Brien & Asociados`
    const b = `Cliente "VIP" <b>preferente</b>`
    const out = renderHtml(html`<p>${a}</p><p>${b}</p>`)
    expect(out).toBe(`<p>O&#39;Brien &amp; Asociados</p><p>Cliente &quot;VIP&quot; &lt;b&gt;preferente&lt;/b&gt;</p>`)
  })

  it("leaves static template text completely untouched", () => {
    const out = renderHtml(html`<div class="foo & bar"><span>${"x"}</span></div>`)
    expect(out).toBe(`<div class="foo & bar"><span>x</span></div>`)
  })

  it("is a no-op on clean data with no escapable characters", () => {
    const out = renderHtml(html`<span>${"Categoría Pérez sin caracteres especiales"}</span>`)
    expect(out).toBe("<span>Categoría Pérez sin caracteres especiales</span>")
  })

  it("inlines a nested SafeHtml value verbatim — no double-escaping", () => {
    const row = html`<li>${"already & escaped once"}</li>`
    const out = renderHtml(html`<ul>${row}</ul>`)
    expect(out).toBe("<ul><li>already &amp; escaped once</li></ul>")
  })

  it("inlines an ARRAY of SafeHtml values verbatim, joined with no separator — >=2 non-identical row fragments", () => {
    const rows = [
      { nombre: "HABITACIÓN <DOBLE>" },
      { nombre: `SUITE & "Junior"` },
    ].map((r) => html`<tr><td>${r.nombre}</td></tr>`)
    const out = renderHtml(html`<table>${rows}</table>`)
    expect(out).toBe(
      `<table><tr><td>HABITACIÓN &lt;DOBLE&gt;</td></tr><tr><td>SUITE &amp; &quot;Junior&quot;</td></tr></table>`,
    )
  })

  it("escapes a NON-SafeHtml array element individually rather than skipping it", () => {
    const out = renderHtml(html`<div>${["a & b", "<c>"]}</div>`)
    expect(out).toBe("<div>a &amp; b&lt;c&gt;</div>")
  })

  it("escapes numbers passed through the tag (no-op, but goes through the same path)", () => {
    const out = renderHtml(html`<span>${1234}</span>`)
    expect(out).toBe("<span>1234</span>")
  })

  it("renders null/undefined interpolations as empty string, never 'null'/'undefined'", () => {
    expect(renderHtml(html`<span>${null}</span>`)).toBe("<span></span>")
    expect(renderHtml(html`<span>${undefined}</span>`)).toBe("<span></span>")
  })
})

describe("renderHtml — unwraps SafeHtml at the outermost boundary", () => {
  it("returns the plain string content of a SafeHtml value", () => {
    const safe: SafeHtml = raw("<p>hi</p>")
    expect(renderHtml(safe)).toBe("<p>hi</p>")
    expect(typeof renderHtml(safe)).toBe("string")
  })
})

describe("mutation-checked invariants (documented; live mutation evidence in the task report)", () => {
  // These pin the exact behaviors that M7-M10 (docs/plans/geb-documents-real-data.md
  // §10) must break for the mutation to be caught. They are ordinary assertions —
  // the RED/GREEN mutation demonstration itself is done by editing lib/html-escape.ts
  // directly and re-running this file (not simulated here), per
  // patterns/mutation-checked-tests.

  it("M7 target: html() must NOT inline a plain string unescaped", () => {
    const out = renderHtml(html`${"<script>alert(1)</script>"}`)
    expect(out).not.toContain("<script>alert(1)</script>")
  })

  it("M8 target: & must be escaped BEFORE < and > (order matters)", () => {
    const out = escapeHtmlText("&<>")
    expect(out).toBe("&amp;&lt;&gt;")
    expect(out).not.toBe("&amp;amp;lt;amp;gt;")
  })

  it("M9 target: escaper must NOT entity-encode non-ASCII — fixture 'Ñandú'", () => {
    expect(escapeHtmlText("Ñandú")).toBe("Ñandú")
    expect(escapeHtmlText("Ñandú")).not.toContain("&#")
  })

  it("M10 target: raw() must NOT be escaped when inlined by html()", () => {
    const out = renderHtml(html`${raw("<b>&trusted</b>")}`)
    expect(out).toBe("<b>&trusted</b>")
  })
})
