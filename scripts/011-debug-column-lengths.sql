-- Script para debuggear y identificar exactamente qué columnas tienen problemas de longitud
-- Revisar la estructura actual de la tabla reservas

-- 1. Verificar la estructura actual de todas las columnas de texto
SELECT 
    column_name,
    data_type,
    COALESCE(character_maximum_length::text, 'N/A') as max_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND data_type LIKE '%character%'
ORDER BY column_name;

-- 2. Identificar columnas problemáticas específicas
DO $$
DECLARE
    col_record RECORD;
    problem_found BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '🔍 Analizando columnas problemáticas...';
    
    -- Verificar cada columna que podría tener problemas
    FOR col_record IN 
        SELECT column_name, character_maximum_length 
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type LIKE '%character%'
        AND character_maximum_length IS NOT NULL
    LOOP
        -- Verificar columnas específicas que aparecen en los datos
        CASE col_record.column_name
            WHEN 'moneda' THEN
                IF col_record.character_maximum_length < 3 THEN
                    RAISE NOTICE '❌ PROBLEMA: moneda tiene longitud % pero necesita 3 para "DOP"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ moneda OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'metodo_pago' THEN
                IF col_record.character_maximum_length < 8 THEN
                    RAISE NOTICE '❌ PROBLEMA: metodo_pago tiene longitud % pero necesita 8 para "EFECTIVO"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ metodo_pago OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'proforma' THEN
                IF col_record.character_maximum_length < 14 THEN
                    RAISE NOTICE '❌ PROBLEMA: proforma tiene longitud % pero necesita 14 para "A LA ESP CONF"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ proforma OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'comision' THEN
                IF col_record.character_maximum_length < 2 THEN
                    RAISE NOTICE '❌ PROBLEMA: comision tiene longitud % pero necesita 2 para "NO"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ comision OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'factura_enviada_cliente' THEN
                IF col_record.character_maximum_length < 2 THEN
                    RAISE NOTICE '❌ PROBLEMA: factura_enviada_cliente tiene longitud % pero necesita 2 para "NO"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ factura_enviada_cliente OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'factura_recibida_proveedor' THEN
                IF col_record.character_maximum_length < 2 THEN
                    RAISE NOTICE '❌ PROBLEMA: factura_recibida_proveedor tiene longitud % pero necesita 2 para "NO"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ factura_recibida_proveedor OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'grupo' THEN
                IF col_record.character_maximum_length < 2 THEN
                    RAISE NOTICE '❌ PROBLEMA: grupo tiene longitud % pero necesita 2 para "NO"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ grupo OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'status' THEN
                IF col_record.character_maximum_length < 9 THEN
                    RAISE NOTICE '❌ PROBLEMA: status tiene longitud % pero necesita 9 para "PENDIENTE"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ status OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            WHEN 'asientos_bus' THEN
                IF col_record.character_maximum_length < 1 THEN
                    RAISE NOTICE '❌ PROBLEMA: asientos_bus tiene longitud % pero necesita al menos 1 para "2"', col_record.character_maximum_length;
                    problem_found := TRUE;
                ELSE
                    RAISE NOTICE '✅ asientos_bus OK: longitud %', col_record.character_maximum_length;
                END IF;
                
            ELSE
                RAISE NOTICE 'ℹ️  %: longitud %', col_record.column_name, col_record.character_maximum_length;
        END CASE;
    END LOOP;
    
    IF NOT problem_found THEN
        RAISE NOTICE '🎉 No se encontraron problemas obvios de longitud';
    ELSE
        RAISE NOTICE '⚠️  Se encontraron problemas de longitud que necesitan corrección';
    END IF;
END $$;

-- 3. Mostrar los valores exactos que se están intentando insertar
SELECT '🔍 Análisis de valores del insert:' as analisis;
SELECT 'moneda: "DOP" (3 chars)' as valor_analizado;
SELECT 'metodo_pago: "EFECTIVO" (8 chars)' as valor_analizado;
SELECT 'proforma: "A LA ESP CONF" (14 chars)' as valor_analizado;
SELECT 'comision: "NO" (2 chars)' as valor_analizado;
SELECT 'factura_enviada_cliente: "NO" (2 chars)' as valor_analizado;
SELECT 'factura_recibida_proveedor: "NO" (2 chars)' as valor_analizado;
SELECT 'grupo: "NO" (2 chars)' as valor_analizado;
SELECT 'status: "PENDIENTE" (9 chars)' as valor_analizado;
SELECT 'asientos_bus: "2" (1 char)' as valor_analizado;
