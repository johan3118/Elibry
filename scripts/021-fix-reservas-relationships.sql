-- Script para arreglar las relaciones entre reservas, clientes y productos
-- Versión: 021
-- Fecha: 2025-01-02

DO $$
BEGIN
    -- Verificar que las tablas existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservas') THEN
        RAISE EXCEPTION 'La tabla reservas no existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'clientes') THEN
        RAISE EXCEPTION 'La tabla clientes no existe';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos') THEN
        RAISE EXCEPTION 'La tabla productos no existe';
    END IF;

    -- Crear columna cliente_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'cliente_id') THEN
        ALTER TABLE reservas ADD COLUMN cliente_id INTEGER;
        RAISE NOTICE 'Columna cliente_id agregada a reservas';
    END IF;

    -- Crear columna producto_id si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'producto_id') THEN
        ALTER TABLE reservas ADD COLUMN producto_id INTEGER;
        RAISE NOTICE 'Columna producto_id agregada a reservas';
    END IF;

    -- Limpiar datos inconsistentes antes de crear foreign keys
    UPDATE reservas SET cliente_id = NULL WHERE cliente_id NOT IN (SELECT id FROM clientes);
    UPDATE reservas SET producto_id = NULL WHERE producto_id NOT IN (SELECT id FROM productos);
    
    RAISE NOTICE 'Datos inconsistentes limpiados';

    -- Eliminar foreign keys existentes si existen
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_reservas_cliente' AND table_name = 'reservas') THEN
        ALTER TABLE reservas DROP CONSTRAINT fk_reservas_cliente;
        RAISE NOTICE 'Foreign key fk_reservas_cliente eliminada';
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'fk_reservas_producto' AND table_name = 'reservas') THEN
        ALTER TABLE reservas DROP CONSTRAINT fk_reservas_producto;
        RAISE NOTICE 'Foreign key fk_reservas_producto eliminada';
    END IF;

    -- Crear foreign key para cliente_id
    ALTER TABLE reservas 
    ADD CONSTRAINT fk_reservas_cliente 
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Foreign key fk_reservas_cliente creada';

    -- Crear foreign key para producto_id
    ALTER TABLE reservas 
    ADD CONSTRAINT fk_reservas_producto 
    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL;
    
    RAISE NOTICE 'Foreign key fk_reservas_producto creada';

    -- Crear índices para mejorar rendimiento
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reservas_cliente_id') THEN
        CREATE INDEX idx_reservas_cliente_id ON reservas(cliente_id);
        RAISE NOTICE 'Índice idx_reservas_cliente_id creado';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_reservas_producto_id') THEN
        CREATE INDEX idx_reservas_producto_id ON reservas(producto_id);
        RAISE NOTICE 'Índice idx_reservas_producto_id creado';
    END IF;

    RAISE NOTICE 'Script completado exitosamente';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error ejecutando script: %', SQLERRM;
END $$;

-- Verificar que las relaciones se crearon correctamente
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name = 'reservas'
ORDER BY tc.constraint_name;

-- Mostrar estadísticas de las tablas
SELECT 'clientes' as tabla, COUNT(*) as registros FROM clientes
UNION ALL
SELECT 'productos' as tabla, COUNT(*) as registros FROM productos
UNION ALL
SELECT 'reservas' as tabla, COUNT(*) as registros FROM reservas;
