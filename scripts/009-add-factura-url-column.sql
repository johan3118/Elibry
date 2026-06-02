-- Script para agregar la columna factura_url a la tabla reservas
-- Verificar y agregar columna factura_url si no existe

DO $$
BEGIN
    -- Verificar si la tabla existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        RAISE EXCEPTION 'La tabla reservas no existe. Ejecute primero los scripts anteriores.';
    END IF;

    -- Agregar columna factura_url si no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'factura_url') THEN
        ALTER TABLE reservas ADD COLUMN factura_url TEXT;
        RAISE NOTICE 'Columna factura_url agregada como TEXT';
    ELSE
        RAISE NOTICE 'Columna factura_url ya existe';
    END IF;

    RAISE NOTICE 'Script ejecutado exitosamente. Columna factura_url disponible.';

END $$;

-- Verificar la estructura de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservas' AND column_name = 'factura_url'
ORDER BY ordinal_position;
