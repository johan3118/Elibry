-- Limpiar y resetear la tabla de auditoría
DO $$
DECLARE
    max_auditoria_id INTEGER;
    max_cambios_id INTEGER;
BEGIN
    -- Verificar si la tabla auditoria existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'auditoria') THEN
        -- Limpiar registros antiguos de auditoría
        DELETE FROM auditoria WHERE fecha < NOW() - INTERVAL '30 days';
        
        -- Resetear la secuencia de ID
        SELECT COALESCE(MAX(id), 1) INTO max_auditoria_id FROM auditoria;
        PERFORM setval('auditoria_id_seq', max_auditoria_id);
        
        RAISE NOTICE 'Tabla auditoria limpiada y secuencia reseteada';
    ELSE
        RAISE NOTICE 'Tabla auditoria no existe';
    END IF;
    
    -- Verificar si la tabla cambios_provisionales existe
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cambios_provisionales') THEN
        -- Limpiar registros antiguos procesados
        DELETE FROM cambios_provisionales 
        WHERE estado_cambio IN ('APROBADO', 'RECHAZADO') 
        AND fecha_procesamiento < NOW() - INTERVAL '7 days';
        
        -- Resetear la secuencia de ID
        SELECT COALESCE(MAX(id), 1) INTO max_cambios_id FROM cambios_provisionales;
        PERFORM setval('cambios_provisionales_id_seq', max_cambios_id);
        
        RAISE NOTICE 'Tabla cambios_provisionales limpiada y secuencia reseteada';
    ELSE
        RAISE NOTICE 'Tabla cambios_provisionales no existe';
    END IF;
    
    -- Verificar y corregir restricciones de clave foránea en productos
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
        -- Hacer que suplidor_id sea opcional (permitir NULL)
        ALTER TABLE productos ALTER COLUMN suplidor_id DROP NOT NULL;
        
        -- Verificar si la restricción existe antes de eliminarla
        IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'productos_suplidor_id_fkey' 
            AND table_name = 'productos'
        ) THEN
            -- Eliminar la restricción existente
            ALTER TABLE productos DROP CONSTRAINT productos_suplidor_id_fkey;
        END IF;
        
        -- Recrear la restricción permitiendo NULL
        ALTER TABLE productos 
        ADD CONSTRAINT productos_suplidor_id_fkey 
        FOREIGN KEY (suplidor_id) REFERENCES suplidores(id) 
        ON DELETE SET NULL;
        
        RAISE NOTICE 'Restricción de clave foránea en productos corregida';
    END IF;
    
    -- Verificar otras tablas con restricciones similares
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        -- Hacer que cliente_id y producto_id sean opcionales para registros provisionales
        ALTER TABLE reservas ALTER COLUMN cliente_id DROP NOT NULL;
        ALTER TABLE reservas ALTER COLUMN producto_id DROP NOT NULL;
        
        RAISE NOTICE 'Restricciones en reservas ajustadas';
    END IF;
    
END $$;
