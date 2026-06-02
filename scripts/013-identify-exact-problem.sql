-- Script para identificar exactamente qué columnas tienen VARCHAR(2) y están causando el problema

DO $$
DECLARE
    col_record RECORD;
    problem_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 IDENTIFICANDO COLUMNAS CON VARCHAR(2) EN TABLA RESERVAS...';
    
    -- Mostrar todas las columnas VARCHAR con sus longitudes
    RAISE NOTICE '📋 TODAS LAS COLUMNAS VARCHAR EN RESERVAS:';
    FOR col_record IN 
        SELECT column_name, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        ORDER BY column_name
    LOOP
        IF col_record.character_maximum_length = 2 THEN
            RAISE NOTICE '🚨 PROBLEMA: % tiene VARCHAR(2)', col_record.column_name;
            problem_count := problem_count + 1;
        ELSE
            RAISE NOTICE '✅ OK: % tiene VARCHAR(%)', col_record.column_name, col_record.character_maximum_length;
        END IF;
    END LOOP;
    
    RAISE NOTICE '📊 RESUMEN: % columnas con VARCHAR(2) encontradas', problem_count;
    
    -- Analizar los valores específicos que están causando el problema
    RAISE NOTICE '🔍 ANALIZANDO VALORES ESPECÍFICOS DEL INSERT:';
    RAISE NOTICE '- moneda: "DOP" (3 chars) - Necesita VARCHAR(3+)';
    RAISE NOTICE '- metodo_pago: "EFECTIVO" (8 chars) - Necesita VARCHAR(8+)';
    RAISE NOTICE '- proforma: "A LA ESP CONF" (14 chars) - Necesita VARCHAR(14+)';
    RAISE NOTICE '- status: "PENDIENTE" (9 chars) - Necesita VARCHAR(9+)';
    RAISE NOTICE '- comision: "NO" (2 chars) - VARCHAR(2) está OK';
    RAISE NOTICE '- factura_enviada_cliente: "NO" (2 chars) - VARCHAR(2) está OK';
    RAISE NOTICE '- factura_recibida_proveedor: "NO" (2 chars) - VARCHAR(2) está OK';
    RAISE NOTICE '- grupo: "NO" (2 chars) - VARCHAR(2) está OK';
    RAISE NOTICE '- asientos_bus: "2" (1 char) - VARCHAR(2) está OK';
    
END $$;
