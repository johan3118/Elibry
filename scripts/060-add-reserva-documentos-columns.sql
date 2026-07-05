-- Add columns to store attachments captured during reservation creation
-- (Bug 3: "Tampoco se ven los datos adjuntos en la reserva")
--
-- app/reservas/crear/page.tsx already collects three file inputs
-- (factura cliente, factura proveedor, archivos adicionales) but never
-- persisted their upload URLs on the reserva row, so they never showed
-- up in app/reservas/ver/[id]/page.tsx.
--
-- This migration is additive and non-destructive: it does NOT touch the
-- existing `reservas.factura_url` column, which is used by
-- app/facturacion/page.tsx for a different purpose.
--
-- ROLLBACK: ALTER TABLE reservas DROP COLUMN IF EXISTS documentos_urls, DROP COLUMN IF EXISTS factura_cliente_url, DROP COLUMN IF EXISTS factura_proveedor_url;

ALTER TABLE reservas ADD COLUMN IF NOT EXISTS documentos_urls TEXT[];
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS factura_cliente_url TEXT;
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS factura_proveedor_url TEXT;
