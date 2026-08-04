/**
 * Pure logic lifted out of app/crm/casos/page.tsx.
 *
 * WHY IT LIVES HERE AND NOT IN THE PAGE: Next generates a per-route type in
 * `.next/types` asserting that a page module exports NOTHING but `default` and
 * the framework's own reserved names. A page that also exports a helper makes
 * `tsc --noEmit` fail once a build has run — which collided head-on with this
 * repo's own testing pattern of extracting a pure function out of a page and
 * unit-testing it. The pattern is right; the location was wrong.
 */

/**
 * Builds the optimistic patch applied to a case when it is closed. Extracted
 * so the omission of comentario_cierre (CR2) is covered by a unit test without
 * rendering the client component.
 */
export function buildCierreOptimista(cerradoPor: string, fechaCierre: string, comentarioCierre: string) {
  return {
    estado: "CERRADO" as const,
    cerrado_por: cerradoPor,
    fecha_cierre: fechaCierre,
    comentario_cierre: comentarioCierre || undefined,
  }
}
