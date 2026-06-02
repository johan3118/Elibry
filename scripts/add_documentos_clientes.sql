-- Add documentos_urls column to clientes table for storing document URLs
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS documentos_urls TEXT[];
