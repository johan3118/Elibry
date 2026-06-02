-- Script para corregir TODAS las columnas que tienen VARCHAR(2) 
-- y que podrían estar causando el problema

DO $$
DECLARE
    col_record RECORD;
    fix_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 INICIANDO CORRECCIÓN DE TODAS LAS COLUMNAS VARCHAR(2)...';
    
    -- Encontrar y corregir todas las columnas VARCHAR(2)
    FOR col_record IN 
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length = 2
    LOOP
        BEGIN
            -- Determinar el tamaño apropiado según el campo
            CASE col_record.column_name
                WHEN 'moneda' THEN
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(3)';
                    RAISE NOTICE '✅ % corregido a VARCHAR(3)', col_record.column_name;
                    
                WHEN 'metodo_pago' THEN
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(20)';
                    RAISE NOTICE '✅ % corregido a VARCHAR(20)', col_record.column_name;
                    
                WHEN 'proforma' THEN
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(20)';
                    RAISE NOTICE '✅ % corregido a VARCHAR(20)', col_record.column_name;
                    
                WHEN 'status' THEN
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(20)';
                    RAISE NOTICE '✅ % corregido a VARCHAR(20)', col_record.column_name;
                    
                WHEN 'comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo' THEN
                    -- Estos campos están bien con VARCHAR(2) para SI/NO
                    RAISE NOTICE 'ℹ️  % mantenido como VARCHAR(2) (correcto para SI/NO)', col_record.column_name;
                    
                ELSE
                    -- Para cualquier otro campo, usar VARCHAR(50) como seguro
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(50)';
                    RAISE NOTICE '✅ % corregido a VARCHAR(50) (genérico)', col_record.column_name;
            END CASE;
            
            fix_count := fix_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error corrigiendo %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '🎉 Corrección completada. % columnas procesadas.', fix_count;
    
END $$;

-- Verificar correcciones específicas para los campos problemáticos
DO $$
BEGIN
    RAISE NOTICE '🔍 VERIFICANDO CORRECCIONES ESPECÍFICAS...';
    
    -- Verificar moneda
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'moneda' 
        AND character_maximum_length >= 3
    ) THEN
        RAISE NOTICE '✅ moneda: OK para "DOP"';
    ELSE
        RAISE NOTICE '❌ moneda: AÚN TIENE PROBLEMA';
    END IF;
    
    -- Verificar metodo_pago
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'metodo_pago' 
        AND character_maximum_length >= 8
    ) THEN
        RAISE NOTICE '✅ metodo_pago: OK para "EFECTIVO"';
    ELSE
        RAISE NOTICE '❌ metodo_pago: AÚN TIENE PROBLEMA';
    END IF;
    
    -- Verificar proforma
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'proforma' 
        AND character_maximum_length >= 14
    ) THEN
        RAISE NOTICE '✅ proforma: OK para "A LA ESP CONF"';
    ELSE
        RAISE NOTICE '❌ proforma: AÚN TIENE PROBLEMA';
    END IF;
    
    -- Verificar status
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'status' 
        AND character_maximum_length >= 9
    ) THEN
        RAISE NOTICE '✅ status: OK para "PENDIENTE"';
    ELSE
        RAISE NOTICE '❌ status: AÚN TIENE PROBLEMA';
    END IF;
    
END $$;

-- Mostrar estructura final
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    CASE 
        WHEN column_name = 'moneda' AND character_maximum_length >= 3 THEN '✅ OK'
        WHEN column_name = 'metodo_pago' AND character_maximum_length >= 8 THEN '✅ OK'
        WHEN column_name = 'proforma' AND character_maximum_length >= 14 THEN '✅ OK'
        WHEN column_name = 'status' AND character_maximum_length >= 9 THEN '✅ OK'
        WHEN column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo') 
             AND character_maximum_length = 2 THEN '✅ OK'
        ELSE '⚠️ REVISAR'
    END as validacion
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND data_type LIKE '%character%'
AND column_name IN ('moneda', 'metodo_pago', 'proforma', 'status', 'comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo', 'asientos_bus')
ORDER BY column_name;
