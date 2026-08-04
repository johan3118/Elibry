/**
 * FACTURA # result → (value, notification) for CONFIRMACIÓN generation.
 * In lib/ (not the page) so it is importable/testable — `.next/types` forbids
 * a page exporting anything but `default` (see lib/proforma-passengers.ts).
 * Contract + rationale: ADR-0012 and
 * docs/plans/factura-numero-lookup-contract.md. Never throws.
 */
import type { FacturaNumeroResult } from "@/app/actions/documentos-actions"

export const TITULO_ERROR_TECNICO_COMPROBANTE = "Error técnico al consultar el comprobante fiscal"

export interface NotificacionFacturaNumero {
  title: string
  description: string
  variant: "destructive"
}

export type NotificadorFacturaNumero = (notificacion: NotificacionFacturaNumero) => void

export function resolverFacturaNumeroConfirmacion(
  resultado: FacturaNumeroResult,
  notificar: NotificadorFacturaNumero,
): string | null {
  if (resultado.ok) return resultado.numeroFactura

  if (resultado.reason === "LOOKUP_FAILED") {
    notificar({ title: TITULO_ERROR_TECNICO_COMPROBANTE, description: resultado.message, variant: "destructive" })
  }

  return null
}
