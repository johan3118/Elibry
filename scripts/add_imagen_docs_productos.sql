-- Add imagen_url and documentos_urls columns to productos table
ALTER TABLE productos ADD COLUMN IF NOT EXISTS imagen_url TEXT;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS documentos_urls TEXT[];
