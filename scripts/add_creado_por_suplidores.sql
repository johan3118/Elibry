-- Add creado_por column to suplidores table if it doesn't exist
ALTER TABLE suplidores ADD COLUMN IF NOT EXISTS creado_por character varying(255);

-- Update existing records to use usuario_creacion or registrado_por as creado_por
UPDATE suplidores 
SET creado_por = COALESCE(usuario_creacion, registrado_por, 'Sistema') 
WHERE creado_por IS NULL;
