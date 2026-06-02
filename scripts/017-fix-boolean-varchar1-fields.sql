-- Script para corregir campos BOOLEAN y VARCHAR(1) que están causando el problema

DO $$
DECLARE
    col_record RECORD;
    fix_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔧 CORRIGIENDO CAMPOS BOOLEAN Y VARCHAR(1) PROBLEMÁTICOS...';
    
    -- Opción 1: Convertir campos BOOLEAN a VARCHAR(2) para manejar SI/NO
    RAISE NOTICE '🔄 Convirtiendo campos BOOLEAN a VARCHAR(2)...';
    FOR col_record IN 
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'boolean'
        AND column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(2)';
            RAISE NOTICE '✅ % convertido de BOOLEAN a VARCHAR(2)', col_record.column_name;
            fix_count := fix_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error convirtiendo %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
    
    -- Opción 2: Expandir campos VARCHAR(1) a VARCHAR(2)
    RAISE NOTICE '🔄 Expandiendo campos VARCHAR(1) a VARCHAR(2)...';
    FOR col_record IN 
        SELECT column_name
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length = 1
        AND column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(2)';
            RAISE NOTICE '✅ % expandido de VARCHAR(1) a VARCHAR(2)', col_record.column_name;
            fix_count := fix_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error expandiendo %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '🎉 Corrección completada. % campos procesados.', fix_count;
    
END $$;

-- Verificar que los campos problemáticos ahora puedan manejar SI/NO
DO $$
DECLARE
    col_record RECORD;
    all_ok BOOLEAN := true;
BEGIN
    RAISE NOTICE '🔍 VERIFICANDO QUE LOS CAMPOS PUEDAN MANEJAR "SI"/"NO"...';
    
    FOR col_record IN 
        SELECT column_name, data_type, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
        ORDER BY column_name
    LOOP
        IF col_record.data_type = 'character varying' AND col_record.character_maximum_length >= 2 THEN
            RAISE NOTICE '✅ %: VARCHAR(%) - OK para "SI"/"NO"', col_record.column_name, col_record.character_maximum_length;
        ELSIF col_record.data_type = 'boolean' THEN
            RAISE NOTICE '⚠️ %: BOOLEAN - Necesita ajuste en el código React', col_record.column_name;
            all_ok := false;
        ELSE
            RAISE NOTICE '❌ %: % - TODAVÍA PROBLEMÁTICO', col_record.column_name, col_record.data_type;
            all_ok := false;
        END IF;
    END LOOP;
    
    IF all_ok THEN
        RAISE NOTICE '🎉 TODOS LOS CAMPOS ESTÁN LISTOS PARA "SI"/"NO"';
    ELSE
        RAISE NOTICE '⚠️ ALGUNOS CAMPOS NECESITAN AJUSTES ADICIONALES';
    END IF;
    
END $$;
