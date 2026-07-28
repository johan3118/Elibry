"use server"

// ROLLBACK: this file is TRACKED and shared by T1/T2/T2b/T5/T7/T12 — do NOT
// delete it. Roll back per-commit (revert the specific task's commit) instead.

import { createClient } from "@supabase/supabase-js"

/**
 * "use server" — this whole module is a Next.js Server Actions module. It is
 * never bundled into client code, and the service-role key is read from
 * process.env only inside createSupabaseServerClient(), never captured into a
 * module-level value a client component could import. This matches the
 * existing convention in app/actions/crm-actions.ts (do not invent a new one).
 *
 * WHY THIS FILE EXISTS (see docs/plans/geb-documents-real-data.md §1/§5,
 * architect's Approach C): Elibry has no real authentication — the browser
 * Supabase client (lib/supabase.ts) always runs as PostgREST `anon`
 * (lib/user-context.tsx is a hardcoded two-user array in localStorage; there
 * is zero supabase.auth usage in this repo). reserva_pasajeros and
 * reserva_ocupaciones (scripts/061-create-reserva-pasajeros-ocupaciones.sql)
 * have RLS enabled with policies scoped `TO authenticated` and NO grant to
 * `anon`. The service-role client constructed below bypasses RLS entirely, so
 * this "use server" module is the ONLY sanctioned access path to those two
 * tables — never query them from a client component with the anon client.
 */
function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export type TipoPax = "ADULTO" | "NINO" | "INFANTE"

const TIPOS_PAX_VALIDOS: TipoPax[] = ["ADULTO", "NINO", "INFANTE"]

export interface PasajeroInput {
  orden: number
  nombre_completo: string
  tipo_pax: TipoPax
  documento?: string | null
  /** FK into reserva_ocupaciones.id — must belong to the SAME reserva_id. See guardarPasajerosReservaAction. */
  ocupacion_id?: number | null
}

export interface OcupacionInput {
  orden: number
  cantidad: number
  ocupacion: string
  categoria: string
}

/**
 * Block-never-default (mistakes/stockin-zero-price): validates every
 * PasajeroInput BEFORE any DB write. A blank/whitespace nombre_completo, a
 * missing or invalid tipo_pax, or a missing/duplicated orden is rejected with
 * a named-field error here — never coerced to "", "Acompañante", "ADULTO", or
 * an invented sequence number. The DB's NOT NULL/CHECK constraints
 * (scripts/061) are the last line of defence, not the first: this function is
 * the first.
 */
function validatePasajerosInput(pasajeros: PasajeroInput[]): string | null {
  const errores: string[] = []
  const ordenesVistos = new Set<number>()

  pasajeros.forEach((pasajero, index) => {
    const etiqueta = `pasajero #${index + 1}`

    if (
      pasajero.orden === undefined ||
      pasajero.orden === null ||
      !Number.isInteger(pasajero.orden) ||
      pasajero.orden <= 0
    ) {
      errores.push(`orden: ${etiqueta} requiere un orden entero positivo (no puede inventarse)`)
    } else if (ordenesVistos.has(pasajero.orden)) {
      errores.push(`orden: valor duplicado ${pasajero.orden} entre pasajeros`)
    } else {
      ordenesVistos.add(pasajero.orden)
    }

    if (typeof pasajero.nombre_completo !== "string" || pasajero.nombre_completo.trim().length === 0) {
      errores.push(`nombre_completo: ${etiqueta} no puede estar vacío`)
    }

    if (!pasajero.tipo_pax || !TIPOS_PAX_VALIDOS.includes(pasajero.tipo_pax)) {
      errores.push(`tipo_pax: ${etiqueta} debe ser ADULTO, NINO o INFANTE (no se asume un valor por defecto)`)
    }
  })

  return errores.length > 0 ? errores.join("; ") : null
}

/**
 * Block-never-default (mistakes/stockin-zero-price): validates every
 * OcupacionInput BEFORE any DB write. cantidad <= 0, blank ocupacion, blank
 * categoria, or a missing/duplicated orden are rejected here — never
 * defaulted.
 */
function validateOcupacionesInput(ocupaciones: OcupacionInput[]): string | null {
  const errores: string[] = []
  const ordenesVistos = new Set<number>()

  ocupaciones.forEach((ocupacionGrupo, index) => {
    const etiqueta = `ocupación #${index + 1}`

    if (
      ocupacionGrupo.orden === undefined ||
      ocupacionGrupo.orden === null ||
      !Number.isInteger(ocupacionGrupo.orden) ||
      ocupacionGrupo.orden <= 0
    ) {
      errores.push(`orden: ${etiqueta} requiere un orden entero positivo (no puede inventarse)`)
    } else if (ordenesVistos.has(ocupacionGrupo.orden)) {
      errores.push(`orden: valor duplicado ${ocupacionGrupo.orden} entre ocupaciones`)
    } else {
      ordenesVistos.add(ocupacionGrupo.orden)
    }

    if (
      typeof ocupacionGrupo.cantidad !== "number" ||
      !Number.isFinite(ocupacionGrupo.cantidad) ||
      !Number.isInteger(ocupacionGrupo.cantidad) ||
      ocupacionGrupo.cantidad <= 0
    ) {
      errores.push(`cantidad: ${etiqueta} debe ser un número entero mayor que 0 (no puede ser decimal)`)
    }

    if (typeof ocupacionGrupo.ocupacion !== "string" || ocupacionGrupo.ocupacion.trim().length === 0) {
      errores.push(`ocupacion: ${etiqueta} no puede estar vacía`)
    }

    if (typeof ocupacionGrupo.categoria !== "string" || ocupacionGrupo.categoria.trim().length === 0) {
      errores.push(`categoria: ${etiqueta} no puede estar vacía`)
    }
  })

  return errores.length > 0 ? errores.join("; ") : null
}

/**
 * Returns the passengers of one reserva, ordered by `orden` — the render
 * order CONFIRMACIÓN's "1) 2) 3)…" section and VOUCHER both depend on.
 */
export async function getPasajerosReservaAction(reservaId: number) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("reserva_pasajeros")
      .select("*")
      .eq("reserva_id", reservaId)
      .order("orden", { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

/**
 * Return type of reemplazarConjuntoConRestauracion — distinguishes THREE
 * outcomes on the write path so a caller can never silently assume the old
 * data is still there when it is not (send-back on T2/AC2):
 *   - success: true                        -> new rows written, `data` returned.
 *   - success: false, restored: true       -> the new write failed; the
 *     ORIGINAL rows (captured before the delete) were re-inserted verbatim,
 *     so the reserva is back to its pre-call state. Includes the case where
 *     there was nothing to restore (the set was already empty).
 *   - success: false, restored: false      -> the new write failed AND the
 *     best-effort restore of the original rows also failed. The reserva now
 *     has NO rows in this table and needs manual intervention — `restoreError`
 *     carries the DB error from the failed restore attempt.
 */
type ResultadoReemplazoConRestauracion<T> =
  | { success: true; data: T[] }
  | { success: false; error: string; restored?: undefined }
  | { success: false; error: string; restored: true }
  | { success: false; error: string; restored: false; restoreError: string }

/**
 * Shared write path for both guardarPasajerosReservaAction and
 * guardarOcupacionesReservaAction: replace the full row set for one reserva
 * (delete-then-insert against the same reserva_id — there is no multi-
 * statement SQL transaction available over PostgREST without a dedicated RPC
 * function, which is out of this task's scope). PostgREST issues the delete
 * and the insert as two separate HTTP calls, so there is a real window where
 * the delete has committed and the insert has not: if the insert then fails,
 * a bare delete-then-insert would leave the reserva with ZERO rows — worse
 * than either the old or the new set. To close that window, this helper
 * captures the full existing row set (including `id`, so any composite-FK
 * references such as reserva_pasajeros.ocupacion_id keep pointing at the
 * SAME occupancy row on restore — `id` is a plain `serial`, not a
 * GENERATED ALWAYS identity, so PostgREST can insert it back explicitly)
 * BEFORE the delete, and — if the new insert fails — attempts a best-effort
 * re-insert of that captured set. See ResultadoReemplazoConRestauracion for
 * the three outcomes this can produce; a caller must check `restored`
 * whenever `success` is false, never assume the old data survived.
 */
async function reemplazarConjuntoConRestauracion<T>(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  tabla: "reserva_pasajeros" | "reserva_ocupaciones",
  reservaId: number,
  filasNuevas: Record<string, unknown>[],
): Promise<ResultadoReemplazoConRestauracion<T>> {
  const { data: filasOriginales, error: selectError } = await supabase
    .from(tabla)
    .select("*")
    .eq("reserva_id", reservaId)

  if (selectError) return { success: false, error: selectError.message }

  const { error: deleteError } = await supabase.from(tabla).delete().eq("reserva_id", reservaId)

  if (deleteError) return { success: false, error: deleteError.message }

  if (filasNuevas.length === 0) {
    return { success: true, data: [] as T[] }
  }

  const { data, error: insertError } = await supabase.from(tabla).insert(filasNuevas).select()

  if (!insertError) {
    return { success: true, data: data as T[] }
  }

  // The new write failed. Best-effort restore of the ORIGINAL rows captured
  // before the delete — never the new/rejected rows.
  if (!filasOriginales || filasOriginales.length === 0) {
    // Nothing existed before the delete: the "original" state (empty) is
    // already what's on the table, so there is nothing to lose.
    return { success: false, error: insertError.message, restored: true }
  }

  const { error: restoreError } = await supabase.from(tabla).insert(filasOriginales)

  if (restoreError) {
    return {
      success: false,
      error: insertError.message,
      restored: false,
      restoreError: restoreError.message,
    }
  }

  return { success: false, error: insertError.message, restored: true }
}

/**
 * Replaces the full set of passengers for one reserva within a single call.
 * See reemplazarConjuntoConRestauracion for the delete/insert/restore
 * mechanics and the three possible outcomes on failure.
 *
 * CRITICAL — composite FK safety (reserva_pasajeros.ocupacion_id, reserva_id):
 * before writing anything, any ocupacion_id referenced by an input row is
 * checked against the occupancy rows that actually belong to THIS reservaId.
 * A pasajero cannot be linked to another reserva's occupancy group — this is
 * a structural, application-level guard in ADDITION to the DB's composite FK
 * constraint, not a substitute for it. If this guard is somehow bypassed with
 * stale data, the DB still rejects the write and that error is returned to
 * the caller, never swallowed.
 */
export async function guardarPasajerosReservaAction(
  reservaId: number,
  pasajeros: PasajeroInput[],
  registradoPor: string,
) {
  try {
    const validationError = validatePasajerosInput(pasajeros)
    if (validationError) return { success: false, error: validationError }

    const supabase = createSupabaseServerClient()

    const ocupacionIdsReferenciados = Array.from(
      new Set(
        pasajeros
          .map((pasajero) => pasajero.ocupacion_id)
          .filter((id): id is number => id !== null && id !== undefined),
      ),
    )

    if (ocupacionIdsReferenciados.length > 0) {
      const { data: ocupacionesDeLaReserva, error: ocupacionesError } = await supabase
        .from("reserva_ocupaciones")
        .select("id")
        .eq("reserva_id", reservaId)

      if (ocupacionesError) return { success: false, error: ocupacionesError.message }

      const idsValidos = new Set((ocupacionesDeLaReserva || []).map((fila: any) => fila.id))
      const ordenesConOcupacionInvalida = pasajeros
        .filter(
          (pasajero) =>
            pasajero.ocupacion_id !== null &&
            pasajero.ocupacion_id !== undefined &&
            !idsValidos.has(pasajero.ocupacion_id),
        )
        .map((pasajero) => pasajero.orden)

      if (ordenesConOcupacionInvalida.length > 0) {
        return {
          success: false,
          error: `ocupacion_id: no pertenece a la reserva ${reservaId} (pasajero(s) con orden: ${ordenesConOcupacionInvalida.join(", ")})`,
        }
      }
    }

    const filas = pasajeros.map((pasajero) => ({
      reserva_id: reservaId,
      ocupacion_id: pasajero.ocupacion_id ?? null,
      orden: pasajero.orden,
      nombre_completo: pasajero.nombre_completo.trim(),
      tipo_pax: pasajero.tipo_pax,
      documento: pasajero.documento ?? null,
      registrado_por: registradoPor,
    }))

    return await reemplazarConjuntoConRestauracion(supabase, "reserva_pasajeros", reservaId, filas)
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

/**
 * Returns the room-occupancy groups of one reserva, ordered by `orden`.
 */
export async function getOcupacionesReservaAction(reservaId: number) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("reserva_ocupaciones")
      .select("*")
      .eq("reserva_id", reservaId)
      .order("orden", { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

/** One row of `reserva_detalles`, as read by getDetallesReservaParaVoucherAction. */
export interface DetalleReservaParaVoucher {
  id: number
  concepto: string
  descripcion: string | null
  habitaciones: number | null
}

/**
 * VOUCHER prefill task: reads the SERVICE LINES of one reserva
 * (`reserva_detalles`) so the voucher's occupancy-group editor can be
 * seeded ONE ROW PER LINE, in the reserva's own order, when nothing has
 * been saved to `reserva_ocupaciones` yet. Read-only — this action never
 * writes.
 *
 * Column names verified against scripts/023-create-reserva-detalles-table-fixed.sql
 * (NOT against lib/supabase.ts's `ReservaDetalle` interface, which the T15
 * investigation already found incomplete — missing estado_registro /
 * usuario_creacion / fecha_provisional / dependencias_ids from
 * scripts/047:39-43 — and a stale interface in that exact file caused a
 * production outage):
 *   - id           scripts/023:3  (SERIAL PRIMARY KEY)
 *   - concepto     scripts/023:5  (VARCHAR(200) NOT NULL)
 *   - descripcion  scripts/023:6  (TEXT, nullable — no NOT NULL, no DEFAULT)
 *   - habitaciones scripts/023:15 (INTEGER DEFAULT 1, nullable) — this is the
 *     PER-LINE room count. `reservas.habitaciones` is a SUM across every
 *     line via the `recalcular_totales_reserva` trigger
 *     (scripts/023:69-85) and must NEVER be used as a per-group source.
 *
 * Ordered by `id` (insertion order) so the mapped occupancy groups line up
 * with the reserva's own line order, matching how the lines were entered.
 *
 * No named SELECT-columns constant (unlike PRODUCTOS_SELECT_COLUMNS in
 * app/facturacion/voucher/page.tsx): this file's own sibling read action,
 * getDatosVoucherReservaAction just above, already establishes the
 * convention of an inline select string for a single-use server action —
 * PRODUCTOS_SELECT_COLUMNS exists because voucher/page.tsx queries
 * `productos` directly from the browser with the anon client across
 * multiple call sites; this is one server-only call site querying a table
 * no other code in this file touches, so a shared constant would have
 * nothing to be shared with.
 */
export async function getDetallesReservaParaVoucherAction(reservaId: number) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("reserva_detalles")
      .select("id, concepto, descripcion, habitaciones")
      .eq("reserva_id", reservaId)
      .order("id", { ascending: true })

    if (error) return { success: false, error: error.message }
    return { success: true, data: (data ?? []) as DetalleReservaParaVoucher[] }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

interface EnlacePasajeroOcupacion {
  id: number
  ocupacion_id: number
}

interface OcupacionMaterialCapturada {
  id: number
  orden: number
  ocupacion: string
  categoria: string
}

/**
 * (HC-4) Result of attempting to rebuild passenger->room links after a
 * SUCCESSFUL occupancy replace. See relinkPasajerosPorIdentidadMaterial and
 * guardarOcupacionesReservaAction's JSDoc for the full rule.
 */
interface ResultadoRelinkExitoso {
  relinked: boolean
  enlacesDescartados: number[]
  enlacesNoRestablecidos: number[]
  relinkError?: string
}

/**
 * (HC-4) The identity key for matching a room ACROSS two saves: the material
 * tuple (`orden`, `ocupacion`, `categoria`), compared on the exact trimmed,
 * case-sensitive strings this file writes (see the `filas` mapping inside
 * guardarOcupacionesReservaAction, a few lines below). `cantidad` is
 * deliberately EXCLUDED — editing "X 8 HABITACIONES" to "X 9" does not
 * change WHICH room a passenger is in, and since `orden` is already in the
 * key a count edit cannot alias two different rooms. `orden` ALONE is not
 * used as the key: scripts/061 makes `(reserva_id, orden)` unique only at
 * one instant — it is a render position, not a durable identity across
 * saves — so matching on it alone could re-link a passenger who was in a
 * DOBLE into a TRIPLE after a reorder. No case-folding or accent-folding
 * either: a stricter comparison only ever produces a conservative NULL
 * (safe), never a manufactured link (mistakes/stockin-zero-price).
 *
 * (T2b send-back #1) INJECTIVITY — why JSON.stringify(tuple), not a template
 * string: an unescaped delimiter-joined string (e.g. `${orden}::${ocupacion}::${categoria}`)
 * is NOT injective, because neither ocupacion nor categoria is validated
 * against containing the delimiter substring anywhere (validateOcupacionesInput
 * only checks non-blank). Two materially DIFFERENT tuples can then collide:
 * (orden:1, ocupacion:"A::B", categoria:"C") and (orden:1, ocupacion:"A",
 * categoria:"B::C") both join to the identical string "1::A::B::C" — a
 * silent wrong-link, the exact failure class HC-4 exists to make impossible
 * by construction (T2b AC-7).
 * JSON.stringify([orden, ocupacion, categoria]) IS injective for this input
 * shape (a number plus two strings, never undefined/function/symbol/cyclic —
 * ocupacion/categoria are always plain strings here). Proof by the standard
 * round-trip argument: JSON.parse(JSON.stringify(x)) is structurally equal to
 * x for every JSON-representable x (numbers, strings, arrays/objects thereof).
 * So if JSON.stringify(tupleA) === JSON.stringify(tupleB), parsing both sides
 * of that equality yields JSON.parse(JSON.stringify(tupleA)) ===
 * JSON.parse(JSON.stringify(tupleB)), i.e. tupleA and tupleB are the SAME
 * array (same orden, same two strings) — parse is a genuine left inverse of
 * stringify here, which is exactly what the naive `::`-join lacks (the join
 * has no unambiguous parse/inverse once a component may itself contain the
 * delimiter). Concretely: JSON's string encoding escapes every embedded `"`
 * and `\` (and control characters), so an embedded literal `::`, `"`, or `,`
 * inside ocupacion/categoria is always re-quoted rather than left to merge
 * with the array's own `,`/`[`/`]` structural characters — two different
 * strings can never escape to the same quoted JSON string. And orden is
 * validated elsewhere as a positive integer, whose canonical decimal
 * JSON/JS numeric serialization is unique. Applied consistently to BOTH the
 * claveDeIdAnterior and nuevoIdPorClave maps below, so old and new rooms are
 * compared under the exact same, now-injective, encoding.
 */
function claveIdentidadMaterial(orden: number, ocupacion: string, categoria: string): string {
  return JSON.stringify([orden, ocupacion.trim(), categoria.trim()])
}

/**
 * (HC-4) Rebuilds passenger->room links on the SUCCESS path of
 * guardarOcupacionesReservaAction — as opposed to relinkPasajerosRestaurados,
 * which serves the FAILURE/restore path and is left untouched (see B-10 for
 * its one known limitation, not replicated here).
 *
 * For each passenger link captured BEFORE the delete, this looks up the
 * MATERIAL IDENTITY of the room it used to be in (via `ocupacionesAnteriores`
 * — a dedicated capture taken before the delete, NOT the shared
 * reemplazarConjuntoConRestauracion helper's internal capture) and searches
 * `ocupacionesNuevas` (the rows the replace just inserted, with fresh ids)
 * for a room with the SAME (orden, ocupacion, categoria). If found, the
 * passenger is re-linked to the new id with a GUARDED update —
 * `.eq("id", …).is("ocupacion_id", null)` — so it can only fill the gap our
 * own delete made and can never overwrite a concurrent assignment (Risk R9).
 * If no matching new room exists (the room was deleted, reordered, or
 * materially changed), the link is DELIBERATELY left NULL and the passenger
 * is reported in `enlacesDescartados` — never a guessed link. EVERY captured
 * link is attempted, even after an earlier one errors or is claimed by
 * another writer — unlike relinkPasajerosRestaurados, which stops at the
 * first error (B-10; not repeated here per T2b AC-6).
 */
async function relinkPasajerosPorIdentidadMaterial(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  enlacesCapturados: EnlacePasajeroOcupacion[],
  ocupacionesAnteriores: OcupacionMaterialCapturada[],
  ocupacionesNuevas: OcupacionMaterialCapturada[],
): Promise<ResultadoRelinkExitoso> {
  const claveDeIdAnterior = new Map<number, string>()
  ocupacionesAnteriores.forEach((ocupacionAnterior) => {
    claveDeIdAnterior.set(
      ocupacionAnterior.id,
      claveIdentidadMaterial(ocupacionAnterior.orden, ocupacionAnterior.ocupacion, ocupacionAnterior.categoria),
    )
  })

  const nuevoIdPorClave = new Map<string, number>()
  ocupacionesNuevas.forEach((ocupacionNueva) => {
    nuevoIdPorClave.set(
      claveIdentidadMaterial(ocupacionNueva.orden, ocupacionNueva.ocupacion, ocupacionNueva.categoria),
      ocupacionNueva.id,
    )
  })

  const enlacesDescartados: number[] = []
  const enlacesNoRestablecidos: number[] = []
  let relinkError: string | undefined

  for (const enlace of enlacesCapturados) {
    const clave = claveDeIdAnterior.get(enlace.ocupacion_id)
    const nuevoId = clave !== undefined ? nuevoIdPorClave.get(clave) : undefined

    if (nuevoId === undefined) {
      // Room gone, reordered, or materially changed — never guess a link.
      enlacesDescartados.push(enlace.id)
      continue
    }

    const { data, error } = await supabase
      .from("reserva_pasajeros")
      .update({ ocupacion_id: nuevoId })
      .eq("id", enlace.id)
      .is("ocupacion_id", null)
      .select("id")

    if (error) {
      enlacesNoRestablecidos.push(enlace.id)
      if (relinkError === undefined) relinkError = error.message
      continue
    }

    if (!data || data.length === 0) {
      // A concurrent writer already claimed this passenger between our
      // capture and this UPDATE — the guard stopped us from clobbering it.
      // Reported, not an error (Risk R9).
      enlacesNoRestablecidos.push(enlace.id)
    }
  }

  return {
    relinked: enlacesNoRestablecidos.length === 0,
    enlacesDescartados,
    enlacesNoRestablecidos,
    relinkError,
  }
}

/**
 * Re-links passengers to their restored occupancy rows AFTER a successful
 * restore-insert inside reemplazarConjuntoConRestauracion (called only from
 * guardarOcupacionesReservaAction's `restored: true` branch). scripts/061's
 * composite FK carries `ON DELETE SET NULL (ocupacion_id)`: deleting the
 * occupancy rows — even transiently, en route to a failed insert that
 * triggers the restore — nulls `ocupacion_id` on every reserva_pasajeros row
 * that referenced them. Restoring the occupancy rows brings the ROOMS back
 * with their ORIGINAL ids (safe — every id was issued by nextval(), and
 * sequences are monotonic and never rewind, so a restored id can never
 * collide with a future auto-assigned one), but that restore-insert does NOT
 * reverse the SET NULL side effect on its own — the passenger rows still
 * have `ocupacion_id: null`. This function closes that gap with one UPDATE
 * per captured link (PostgREST has no "bulk update, different value per
 * row" primitive). Returns the first error message encountered, or `null`
 * if every link was re-linked.
 */
async function relinkPasajerosRestaurados(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  enlaces: EnlacePasajeroOcupacion[],
): Promise<string | null> {
  for (const enlace of enlaces) {
    const { error } = await supabase
      .from("reserva_pasajeros")
      .update({ ocupacion_id: enlace.ocupacion_id })
      .eq("id", enlace.id)

    if (error) return error.message
  }

  return null
}

/**
 * Replaces the full set of room-occupancy groups for one reserva within a
 * single call. See reemplazarConjuntoConRestauracion for the
 * delete/insert/restore mechanics and the three possible outcomes on
 * failure — identical pattern to guardarPasajerosReservaAction.
 *
 * Deleting a reserva's occupancy rows nulls out `ocupacion_id` on any
 * passenger rows that referenced them (DB-level `ON DELETE SET NULL
 * (ocupacion_id)`, scripts/061) — the passengers themselves are never
 * deleted by this action. Before that delete can happen, this action
 * captures every passenger->occupancy link that currently exists for this
 * reserva (id + ocupacion_id). If reemplazarConjuntoConRestauracion's
 * outcome is `restored: true` — the new write failed and the ORIGINAL
 * occupancy rows, with their ORIGINAL ids, were re-inserted — those
 * captured links are re-applied via relinkPasajerosRestaurados, because the
 * restored rows still have the SAME ids the captured links point at. On a
 * genuine success (a real new set was written, with NEW ids) no re-link
 * happens: that is an intentional replace, not a restore, and the old links
 * no longer make sense against the new ids.
 *
 * If the re-link UPDATE itself fails, that failure is folded into the SAME
 * three-outcome contract reemplazarConjuntoConRestauracion already uses —
 * NOT a fourth silent state: the result is reported as `restored: false`
 * with a `restoreError`, exactly as honestly as an occupancy-row restore
 * failure already is. A caller must never see `restored: true` when the
 * passenger->room links did not actually come back — VOUCHER renders
 * passengers GROUPED BY ROOM (docs/VOUCHER GEB-2.docx, "X 8 HABITACIONES
 * OCUPACION DOBLE"), so a stale `restored: true` here would silently and
 * permanently orphan every affected passenger from its room.
 *
 * T2b ROLLBACK (task-specific — see the file-level T2 ROLLBACK note at the
 * top for the earlier task; this is a DIFFERENT, narrower note and does not
 * override it): revert this commit and guardarOcupacionesReservaAction
 * returns to T2's success-path behaviour — which orphans — do not revert
 * without re-opening HC-4.
 *
 * (HC-4) THE SUCCESS PATH — this is the part that was missing, and is the
 * reason T2b exists. On a GENUINE new write (new occupancy ids, not a
 * restore), the delete still fires `ON DELETE SET NULL (ocupacion_id)` on
 * every referencing passenger row, and — before this fix — nothing rebuilt
 * those links: every successful occupancy save, including a one-`categoria`
 * typo fix, silently and permanently orphaned every room-assigned passenger
 * while returning `{ success: true }` with zero signal. The fix: capture
 * both the reserva's passenger->occupancy links AND the occupancy rows'
 * MATERIAL IDENTITY `(orden, ocupacion, categoria)` before the delete, then —
 * once the new rows are written — match each captured link's old room
 * identity against the new rows' identities (never on `orden` alone; see
 * claveIdentidadMaterial) and re-link what matches. A room that changed
 * materially, was reordered, or no longer exists yields a DELIBERATE NULL,
 * reported in `enlacesDescartados` — never a guessed link. See
 * relinkPasajerosPorIdentidadMaterial for the matching + guarded-update
 * mechanics, and the module-level return contract below.
 *
 * Every `success: true` return now ALSO carries `relinked` and
 * `enlacesDescartados` — including the trivial "nothing captured, nothing to
 * re-link" case — so a caller cannot forget to check the link-rebuild
 * outcome:
 *   { success: true, data, relinked: true, enlacesDescartados }
 *   { success: true, data, relinked: false, enlacesDescartados,
 *     enlacesNoRestablecidos, relinkError? }
 * `relinked === (enlacesNoRestablecidos.length === 0)`. `enlacesDescartados`
 * (the rule deliberately dropped it) and `enlacesNoRestablecidos` (an
 * attempted re-link did not succeed — DB error or a concurrent writer
 * claimed the passenger first) are kept as SEPARATE arrays on purpose: they
 * demand different operator responses and must never be conflated (T2b
 * AC-3/M6). `success` describes the occupancy WRITE; `relinked` describes
 * the link REBUILD — neither asserts anything the code did not achieve.
 * The FAILURE/restore path above (relinkPasajerosRestaurados,
 * `restored`/`restoreError`) is UNCHANGED by this — the two mechanisms are
 * deliberately separate (see the "Why a separate task" note in
 * docs/plans/geb-documents-real-data.md T2b).
 */
export async function guardarOcupacionesReservaAction(
  reservaId: number,
  ocupaciones: OcupacionInput[],
  registradoPor: string,
) {
  try {
    const validationError = validateOcupacionesInput(ocupaciones)
    if (validationError) return { success: false, error: validationError }

    const supabase = createSupabaseServerClient()

    // Capture passenger -> occupancy links BEFORE reemplazarConjuntoConRestauracion
    // deletes the occupancy rows (see this function's JSDoc for why).
    const { data: pasajerosDeLaReserva, error: pasajerosSelectError } = await supabase
      .from("reserva_pasajeros")
      .select("id, ocupacion_id")
      .eq("reserva_id", reservaId)

    if (pasajerosSelectError) return { success: false, error: pasajerosSelectError.message }

    const enlacesCapturados: EnlacePasajeroOcupacion[] = (pasajerosDeLaReserva || [])
      .filter((pasajero: any) => pasajero.ocupacion_id !== null && pasajero.ocupacion_id !== undefined)
      .map((pasajero: any) => ({ id: pasajero.id, ocupacion_id: pasajero.ocupacion_id as number }))

    // (HC-4) Capture the MATERIAL IDENTITY of the reserva's occupancy rows
    // BEFORE the delete, via a DEDICATED select — deliberately NOT the
    // shared reemplazarConjuntoConRestauracion helper's internal capture
    // (that helper's signature/behaviour must not change; see T2b AC-2).
    // This is what claveIdentidadMaterial matches the new rows against on
    // the success path below.
    const { data: ocupacionesDeLaReservaAntes, error: ocupacionesSelectError } = await supabase
      .from("reserva_ocupaciones")
      .select("id, orden, ocupacion, categoria")
      .eq("reserva_id", reservaId)

    if (ocupacionesSelectError) return { success: false, error: ocupacionesSelectError.message }

    const ocupacionesAnteriores: OcupacionMaterialCapturada[] = ocupacionesDeLaReservaAntes || []

    const filas = ocupaciones.map((ocupacionGrupo) => ({
      reserva_id: reservaId,
      orden: ocupacionGrupo.orden,
      cantidad: ocupacionGrupo.cantidad,
      ocupacion: ocupacionGrupo.ocupacion.trim(),
      categoria: ocupacionGrupo.categoria.trim(),
      registrado_por: registradoPor,
    }))

    const resultado = await reemplazarConjuntoConRestauracion(supabase, "reserva_ocupaciones", reservaId, filas)

    if (resultado.success) {
      // (HC-4) Genuine new set written (new ids). Re-link by MATERIAL
      // IDENTITY — never a restore, and never a re-link by `orden` alone.
      if (enlacesCapturados.length === 0) {
        // Nothing was linked before the save — nothing to rebuild.
        return { ...resultado, relinked: true, enlacesDescartados: [] }
      }

      const ocupacionesNuevas = resultado.data as unknown as OcupacionMaterialCapturada[]

      const relinkResultado = await relinkPasajerosPorIdentidadMaterial(
        supabase,
        enlacesCapturados,
        ocupacionesAnteriores,
        ocupacionesNuevas,
      )

      if (relinkResultado.relinked) {
        return { ...resultado, relinked: true, enlacesDescartados: relinkResultado.enlacesDescartados }
      }

      return {
        ...resultado,
        relinked: false,
        enlacesDescartados: relinkResultado.enlacesDescartados,
        enlacesNoRestablecidos: relinkResultado.enlacesNoRestablecidos,
        ...(relinkResultado.relinkError !== undefined ? { relinkError: relinkResultado.relinkError } : {}),
      }
    }

    if (resultado.restored !== true || enlacesCapturados.length === 0) {
      // Nothing was restored (write failed outright, or restore itself
      // failed), or nothing was linked to begin with — pass through
      // unchanged, already an honest outcome.
      return resultado
    }

    const relinkError = await relinkPasajerosRestaurados(supabase, enlacesCapturados)

    if (relinkError) {
      return { success: false, error: resultado.error, restored: false, restoreError: relinkError }
    }

    return resultado
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T5 — HC-3: totals-discrepancy persistence (the IMPURE half; DETECTION is
// pure and lives in lib/confirmacion-data.ts's buildConfirmacionData, which
// has zero Supabase imports and never writes anything itself — see
// docs/plans/geb-documents-real-data.md §4.3/§9 HC-3).
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscrepanciaTotalesPayload {
  reservaId: number
  clienteId: number
  sumaDetalles: number
  precioTotal: number
  delta: number
  moneda: string
  /** From lib/user-context.tsx — NOT NULL; falls back to 'SISTEMA' if absent/blank (§4.3). */
  usuario?: string | null
}

function esUsuarioValido(valor: unknown): valor is string {
  return typeof valor === "string" && valor.trim().length > 0
}

/**
 * (HC-3) Persists EXACTLY ONE `auditoria` row recording a Σreserva_detalles
 * vs reservas.precio_total mismatch detected by
 * lib/confirmacion-data.ts's buildConfirmacionData. The human ruled the
 * document PRINTS regardless of a mismatch (§9 HC-3) — this write is
 * best-effort and MUST NOT throw or block generation. A failed write returns
 * `{ success: false, error }` and the CALLER is expected not to surface it to
 * the operator (Risk R7, pre-accepted in the plan: losing an audit row here
 * is preferable to blocking a document the human ruled should print).
 *
 * Row shape is EXACTLY §4.3's payload:
 *   tabla='reservas', registro_id=<reserva.id>, accion='DISCREPANCIA',
 *   datos_anteriores=null,
 *   datos_nuevos={source:'CONFIRMACION', reserva_id, cliente_id,
 *                 suma_detalles, precio_total, delta, moneda, generado_en},
 *   usuario=<the acting user, falling back to 'SISTEMA'>,
 *   fecha left to the column DEFAULT NOW() (never passed explicitly).
 *
 * `accion: 'DISCREPANCIA'` requires
 * scripts/063-allow-discrepancia-in-auditoria.sql to have widened
 * auditoria.accion's CHECK constraint — if that migration has not run (or
 * `auditoria` itself does not exist, per scripts/058-fix-auditoria-table.sql:8),
 * this INSERT fails at the DB and this function returns
 * `{ success: false, error }` exactly like any other DB failure; it does not
 * special-case that condition, per the "log write failing cannot silently
 * swallow the discrepancy" instruction — the caller gets a real error
 * message, not a bare boolean.
 *
 * Idempotency is deliberately NOT attempted (§5): one generation attempt
 * writes one row, so regenerating the same document writes another — that
 * is the audit trail, not a bug.
 */
export async function registrarDiscrepanciaTotalesAction(payload: DiscrepanciaTotalesPayload) {
  try {
    const supabase = createSupabaseServerClient()
    const usuario = esUsuarioValido(payload.usuario) ? (payload.usuario as string) : "SISTEMA"

    const { error } = await supabase.from("auditoria").insert({
      tabla: "reservas",
      registro_id: payload.reservaId,
      accion: "DISCREPANCIA",
      datos_anteriores: null,
      datos_nuevos: {
        source: "CONFIRMACION",
        reserva_id: payload.reservaId,
        cliente_id: payload.clienteId,
        suma_detalles: payload.sumaDetalles,
        precio_total: payload.precioTotal,
        delta: payload.delta,
        moneda: payload.moneda,
        generado_en: new Date().toISOString(),
      },
      usuario,
    })

    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T7 — HC-2: `FACTURA #` read-only lookup that BLOCKS on failure
// (docs/plans/geb-documents-real-data.md §5/§9 HC-2, §11 T7).
//
// *** THE HARD STOP *** This function NEVER allocates, issues, reserves,
// increments or renumbers an NCF or a comprobante fiscal — not as a
// fallback, not "just once if none exists". It issues EXACTLY ONE SELECT
// against `comprobantes_fiscales` and nothing else: no insert/update/
// upsert/delete/rpc against `comprobantes_fiscales` OR
// `comprobantes_disponibles` anywhere in this module (grep-verifiable). Any
// need to allocate an NCF is a human gate, not something this function may
// decide on its own.
//
// WHY THE SCHEMA IS UNVERIFIED (finding F1, HC-2): scripts/038 creates a
// SUPPLIER-INVOICE `comprobantes_fiscales` with no `reserva_id` and no
// `numero_factura`, and scripts/039:2 immediately DROPS that table. The
// shape `app/facturacion/fiscal/page.tsx:54-70,634,680` actually writes
// (`reserva_id`, `numero_factura`, `fecha_emision`, ...) exists ONLY in the
// live production database, created out of band. This function cannot trust
// that shape at compile time, so — per the human's ruling ("Verify columns
// at runtime, block if the lookup fails") — it verifies at RUNTIME and
// BLOCKS on any failure. `FACTURA #` is a REQUIRED field
// (lib/confirmacion-data.ts): a runtime lookup failure must never silently
// downgrade it to `""`/optional (mistakes/stockin-zero-price) — that is
// precisely the failure mode HC-2 exists to close.
//
// ONE query does double duty as both the data fetch AND the runtime
// column-shape verification (AC-1/AC-2 — "Exactly one SELECT" forbids a
// second, dedicated schema probe):
//   - `select("*")` never fails just because a column is ABSENT from the
//     table — it simply omits that key from every returned row. That is
//     what the explicit `hasOwnProperty` check below catches for
//     `numero_factura`.
//   - `.eq("reserva_id", reservaId)` FILTERS on `reserva_id` — if that
//     column does not exist in the live schema, PostgREST fails the whole
//     query with an error (`error` is non-null), which lands in the
//     LOOKUP_FAILED branch below. There is no way to reach this function's
//     row-shape check with a live table that lacks `reserva_id`, because the
//     filter itself cannot execute against it.
//
// THE TWO MESSAGES ARE DELIBERATELY DISTINCT (AC-4/AC-5), so an operator
// (or another agent) can tell from the message ALONE whose job this is:
//   - SIN_COMPROBANTE — no row for this reserva, OR a row exists but its
//     `numero_factura` is null/empty/whitespace-only. A DATA-ENTRY job: go
//     assign a comprobante. Must never mention a technical fault.
//   - LOOKUP_FAILED — the query itself errored, OR the live schema does not
//     actually carry `numero_factura` as a column. An ENGINEERING problem,
//     not a data problem — carries `detail` with the underlying cause.
// A test asserts these two verbatim strings are NOT equal — collapsing them
// into one generic error defeats the entire point of HC-2.
//
// Multiple rows for one reserva ⇒ deterministic pick: `order("fecha_emision",
// { ascending: false })` sorts most-recent-first server-side, and this
// function always reads `filas[0]` — documented here per AC-6.
// ─────────────────────────────────────────────────────────────────────────────

const COMPROBANTES_FISCALES_TABLA = "comprobantes_fiscales" as const

const MENSAJE_SIN_COMPROBANTE = "FACTURA #: esta reserva no tiene comprobante fiscal asignado"

function mensajeLookupFailed(detalle: string): string {
  return `FACTURA #: no se pudo consultar el comprobante fiscal — problema técnico, no de datos: ${detalle}`
}

export interface FacturaNumeroOk {
  ok: true
  numeroFactura: string
}

export interface FacturaNumeroSinComprobante {
  ok: false
  reason: "SIN_COMPROBANTE"
  message: string
}

export interface FacturaNumeroLookupFailed {
  ok: false
  reason: "LOOKUP_FAILED"
  detail: string
  message: string
}

export type FacturaNumeroResult = FacturaNumeroOk | FacturaNumeroSinComprobante | FacturaNumeroLookupFailed

/**
 * Read-only `FACTURA #` lookup for one reserva. See the module-level T7/HC-2
 * doc block immediately above for the full rule. Returns:
 *   { ok: true, numeroFactura }
 *   { ok: false, reason: "SIN_COMPROBANTE", message }   -- data-entry job
 *   { ok: false, reason: "LOOKUP_FAILED", detail, message } -- engineering job
 * NEVER throws into the caller, and NEVER allocates/writes anything.
 */
export async function getFacturaNumeroPorReservaAction(reservaId: number): Promise<FacturaNumeroResult> {
  try {
    const supabase = createSupabaseServerClient()

    // The ONE and ONLY SELECT this function issues.
    const { data, error } = await supabase
      .from(COMPROBANTES_FISCALES_TABLA)
      .select("*")
      .eq("reserva_id", reservaId)
      .order("fecha_emision", { ascending: false })

    if (error) {
      const detalle = error.message || "error desconocido"
      return { ok: false, reason: "LOOKUP_FAILED", detail: detalle, message: mensajeLookupFailed(detalle) }
    }

    const filas = (data ?? []) as Record<string, unknown>[]

    if (filas.length === 0) {
      return { ok: false, reason: "SIN_COMPROBANTE", message: MENSAJE_SIN_COMPROBANTE }
    }

    // Deterministic pick on multiple rows (AC-6): the ORDER BY above already
    // sorts most-recent-`fecha_emision`-first, so the first row IS that pick.
    const filaMasReciente = filas[0]

    // (HC-2) Runtime shape guard — never trust a row's shape just because the
    // query itself succeeded. A live table/view that silently lacks
    // `numero_factura` as a column blocks HERE, as an engineering problem —
    // never as an absent value rendered blank.
    if (!Object.prototype.hasOwnProperty.call(filaMasReciente, "numero_factura")) {
      const detalle = "comprobantes_fiscales no tiene la columna numero_factura"
      return { ok: false, reason: "LOOKUP_FAILED", detail: detalle, message: mensajeLookupFailed(detalle) }
    }

    const numeroFacturaCrudo = filaMasReciente.numero_factura

    // Block-never-default (mistakes/stockin-zero-price): null, undefined,
    // "" and whitespace-only are ALL "no usable comprobante number" — the
    // SAME data-entry outcome as no row at all. Never an `ok: true` with an
    // empty/blank string rendered on a fiscal document.
    if (typeof numeroFacturaCrudo !== "string" || numeroFacturaCrudo.trim().length === 0) {
      return { ok: false, reason: "SIN_COMPROBANTE", message: MENSAJE_SIN_COMPROBANTE }
    }

    return { ok: true, numeroFactura: numeroFacturaCrudo }
  } catch (error: any) {
    const detalle = error?.message || "error desconocido"
    return { ok: false, reason: "LOOKUP_FAILED", detail: detalle, message: mensajeLookupFailed(detalle) }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// T12 — Voucher server actions: localizador / régimen / pax breakdown
// (docs/plans/geb-documents-real-data.md §5, §11 T12). Reads/writes ONLY the
// five nullable columns scripts/062-add-voucher-fields-to-reservas.sql (T11)
// added to `reservas` — localizador, regimen, pax_adultos, pax_ninos,
// pax_infantes. Every other write path in this file targets
// reserva_pasajeros/reserva_ocupaciones; this is the ONLY one that targets
// `reservas` itself, and it NEVER touches the trigger-owned columns
// (precio_total, descuento, pasajeros, habitaciones — scripts/023's
// recalcular_totales_reserva() owns those exclusively; grep this function's
// body for those four identifiers and it returns nothing).
//
// T12 ROLLBACK (task-specific — does not override the file-level T2 note at
// the top): revert this commit. Nothing outside this file imports
// getDatosVoucherReservaAction/guardarDatosVoucherReservaAction yet (T15
// wires app/facturacion/voucher/page.tsx to them, and has not run) — no
// other file depends on their existence being removed.
//
// *** THE LOCALIZADOR IS THE POINT OF THIS TASK *** The old code
// (app/facturacion/voucher/page.tsx:225, generateVoucherNumber — NOT in this
// task's scope, that page is T15) built a "localizador" from date +
// Math.random() on every click and never persisted it, so the SAME reserva
// produced a DIFFERENT localizador every time the voucher was regenerated. A
// localizador is the SUPPLIER's confirmation code — it identifies the
// booking to the hotel, and a changing one is worse than none because the
// hotel cannot match it. This module NEVER generates, defaults, or
// synthesizes a localizador — an agent types it, and this module only
// persists/reads it back verbatim, so the SAME reserva returns the SAME
// value on every subsequent read until someone deliberately changes it.
//
// *** BLOCK-NEVER-DEFAULT, APPLIED LITERALLY (T12 AC-2) *** The pax columns
// are the sharp case: `0` is a LEGITIMATE value ("zero children on this
// booking"), `null` is an explicit "clear to not supplied", and `undefined`
// (the key simply absent from the input object) is the ONLY thing that
// leaves the column untouched on a write. The write path below tests
// `!== undefined` — NEVER truthiness (`if (value)` would treat a genuine `0`
// as "no value supplied" and silently skip writing it, recreating
// mistakes/stockin-zero-price at the exact column this task exists to fix).
// A negative or non-integer pax count is rejected BEFORE the DB is touched,
// with the SPECIFIC field named in the error — never a generic "pax
// inválido" that collapses all three fields into one indistinguishable
// message.
//
// `regimen` is free text the agent types (e.g. "TODO INCLUIDO"). A blank or
// whitespace-only value is "not supplied", not a value — it is saved as
// NULL, never as "" and never defaulted to a fixed string. The old code
// (app/facturacion/voucher/page.tsx:214) hardcoded "TODO INCLUIDO"; this
// module does not repeat that.
// ─────────────────────────────────────────────────────────────────────────────

const CAMPOS_PAX_VOUCHER = ["pax_adultos", "pax_ninos", "pax_infantes"] as const

export interface DatosVoucherInput {
  /**
   * The supplier's confirmation code. `undefined` = leave the column
   * untouched; `null` or a blank/whitespace-only string = "not supplied"
   * (persisted as NULL, never as ""); a non-blank string is trimmed and
   * persisted VERBATIM — this module never generates one.
   */
  localizador?: string | null
  /**
   * Free text (e.g. "TODO INCLUIDO"). Same blank/whitespace-only -> NULL
   * rule as localizador. Never defaulted to any fixed string.
   */
  regimen?: string | null
  pax_adultos?: number | null
  pax_ninos?: number | null
  pax_infantes?: number | null
}

export interface DatosVoucherReserva {
  localizador: string | null
  regimen: string | null
  pax_adultos: number | null
  pax_ninos: number | null
  pax_infantes: number | null
}

/**
 * Block-never-default (mistakes/stockin-zero-price), applied literally per
 * T12 AC-2: a pax field that is `undefined` is simply not being supplied —
 * skipped here, left untouched by the write below. A pax field that IS
 * present (including `null`, an explicit "clear to not supplied") is
 * validated: it must be a finite integer >= 0. Negative and non-integer
 * values are rejected with the SPECIFIC field named — never a generic
 * message that collapses all three fields together.
 */
function validateDatosVoucherInput(input: DatosVoucherInput): string | null {
  const errores: string[] = []

  for (const campo of ["localizador", "regimen"]) {
    const valor = input[campo as keyof DatosVoucherInput]
    if (valor === undefined || valor === null) continue
    if (typeof valor !== "string") {
      errores.push(`${campo}: debe ser un texto (string), no ${typeof valor}`)
    }
  }

  for (const campo of CAMPOS_PAX_VOUCHER) {
    const valor = input[campo]
    // not supplied / explicit clear-to-null — both are valid, nothing to check.
    if (valor === undefined || valor === null) continue

    if (typeof valor !== "number" || !Number.isFinite(valor) || !Number.isInteger(valor) || valor < 0) {
      errores.push(`${campo}: debe ser un número entero mayor o igual a 0 (no puede ser negativo ni decimal)`)
    }
  }

  return errores.length > 0 ? errores.join("; ") : null
}

/**
 * Normalizes a free-text field (localizador/regimen) per the blank->NULL
 * rule: a value that is present but blank/whitespace-only is "not
 * supplied", saved as NULL — never as "", and never a fixed default. A
 * non-blank value is trimmed and persisted VERBATIM.
 */
function normalizarTextoLibreONull(valor: string | null): string | null {
  if (valor === null) return null
  const recortado = valor.trim()
  return recortado.length > 0 ? recortado : null
}

/**
 * Builds the exact `reservas` UPDATE payload from a DatosVoucherInput,
 * setting ONLY the keys whose value is `!== undefined` (T12 AC-2) — this is
 * the ONLY test used; a truthiness check anywhere here would silently drop
 * a genuine `0` for pax_ninos/pax_infantes/pax_adultos. Never includes
 * precio_total/descuento/pasajeros/habitaciones — those are exclusively
 * owned by scripts/023's recalcular_totales_reserva() trigger and this
 * function has no branch that could ever add them.
 */
function construirActualizacionVoucher(input: DatosVoucherInput): Record<string, unknown> {
  const actualizacion: Record<string, unknown> = {}

  if (input.localizador !== undefined) {
    actualizacion.localizador = normalizarTextoLibreONull(input.localizador)
  }
  if (input.regimen !== undefined) {
    actualizacion.regimen = normalizarTextoLibreONull(input.regimen)
  }
  for (const campo of CAMPOS_PAX_VOUCHER) {
    if (input[campo] !== undefined) {
      actualizacion[campo] = input[campo]
    }
  }

  return actualizacion
}

/**
 * Reads the voucher-specific fields of one reserva — localizador, regimen,
 * and the pax breakdown — directly off `reservas` (T11's five additive
 * columns). Returns NULL honestly for anything not supplied; NEVER invents
 * a localizador and NEVER returns "" for an absent value that a caller
 * could mistake for a real one. A `0` pax count is returned as `0`,
 * distinct from `null` — see DatosVoucherReserva.
 */
export async function getDatosVoucherReservaAction(reservaId: number) {
  try {
    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase
      .from("reservas")
      .select("localizador, regimen, pax_adultos, pax_ninos, pax_infantes")
      .eq("id", reservaId)

    if (error) return { success: false, error: error.message }

    const filas = (data ?? []) as Record<string, unknown>[]
    if (filas.length === 0) {
      return { success: false, error: `reserva ${reservaId} no encontrada` }
    }

    const fila = filas[0]
    const datos: DatosVoucherReserva = {
      localizador: (fila.localizador as string | null | undefined) ?? null,
      regimen: (fila.regimen as string | null | undefined) ?? null,
      pax_adultos: (fila.pax_adultos as number | null | undefined) ?? null,
      pax_ninos: (fila.pax_ninos as number | null | undefined) ?? null,
      pax_infantes: (fila.pax_infantes as number | null | undefined) ?? null,
    }

    return { success: true, data: datos }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}

/**
 * Writes ONLY the voucher fields explicitly supplied (`!== undefined`) on
 * one reserva. See the module-level T12 doc block above for the full rule.
 * NEVER writes precio_total/descuento/pasajeros/habitaciones (trigger-owned,
 * scripts/023) — this function has no code path that could add them.
 *
 * If EVERY field is `undefined` there is nothing to persist — this returns
 * `{ success: false, error }` naming that, rather than silently reporting
 * success for a call that touched nothing.
 */
export async function guardarDatosVoucherReservaAction(reservaId: number, input: DatosVoucherInput) {
  try {
    const validationError = validateDatosVoucherInput(input)
    if (validationError) return { success: false, error: validationError }

    const actualizacion = construirActualizacionVoucher(input)

    if (Object.keys(actualizacion).length === 0) {
      return {
        success: false,
        error: "guardarDatosVoucherReservaAction: ningún campo tiene un valor definido para actualizar",
      }
    }

    const supabase = createSupabaseServerClient()
    const { data, error } = await supabase.from("reservas").update(actualizacion).eq("id", reservaId).select()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
  } catch (error: any) {
    return { success: false, error: error?.message || "Error desconocido" }
  }
}
