-- Script de emergencia para expandir TODAS las columnas de texto problemáticas
-- Este script es más agresivo y seguro

DO $$
DECLARE
    col_record RECORD;
    fix_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🚨 SCRIPT DE EMERGENCIA: EXPANDIENDO TODAS LAS COLUMNAS PROBLEMÁTICAS...';
    
    -- Lista de columnas específicas que sabemos que pueden causar problemas
    -- Basado en los datos del log del usuario
    
    -- Corregir moneda (DOP = 3 chars)
    BEGIN
        ALTER TABLE reservas ALTER COLUMN moneda TYPE VARCHAR(10);
        RAISE NOTICE '✅ moneda expandido a VARCHAR(10)';
        fix_count := fix_count + 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ moneda: %', SQLERRM;
    END;
    
    -- Corregir metodo_pago (EFECTIVO = 8 chars)
    BEGIN
        ALTER TABLE reservas ALTER COLUMN metodo_pago TYPE VARCHAR(50);
        RAISE NOTICE '✅ metodo_pago expandido a VARCHAR(50)';
        fix_count := fix_count + 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ metodo_pago: %', SQLERRM;
    END;
    
    -- Corregir proforma (A LA ESP CONF = 14 chars)
    BEGIN
        ALTER TABLE reservas ALTER COLUMN proforma TYPE VARCHAR(100);
        RAISE NOTICE '✅ proforma expandido a VARCHAR(100)';
        fix_count := fix_count + 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ proforma: %', SQLERRM;
    END;
    
    -- Corregir status (PENDIENTE = 9 chars)
    BEGIN
        ALTER TABLE reservas ALTER COLUMN status TYPE VARCHAR(50);
        RAISE NOTICE '✅ status expandido a VARCHAR(50)';
        fix_count := fix_count + 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ status: %', SQLERRM;
    END;
    
    -- Corregir asientos_bus por si acaso
    BEGIN
        ALTER TABLE reservas ALTER COLUMN asientos_bus TYPE VARCHAR(10);
        RAISE NOTICE '✅ asientos_bus expandido a VARCHAR(10)';
        fix_count := fix_count + 1;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ asientos_bus: %', SQLERRM;
    END;
    
    -- Expandir cualquier otra columna VARCHAR pequeña
    FOR col_record IN 
        SELECT column_name, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length < 10
        AND column_name NOT IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
    LOOP
        BEGIN
            EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || col_record.column_name || ' TYPE VARCHAR(100)';
            RAISE NOTICE '✅ % expandido de VARCHAR(%) a VARCHAR(100)', col_record.column_name, col_record.character_maximum_length;
            fix_count := fix_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE '❌ Error expandiendo %: %', col_record.column_name, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '🎉 CORRECCIÓN DE EMERGENCIA COMPLETADA. % columnas procesadas.', fix_count;
    
END $$;

-- Verificación final completa
DO $$
BEGIN
    RAISE NOTICE '🔍 VERIFICACIÓN FINAL COMPLETA...';
    
    -- Verificar que todas las columnas críticas tengan suficiente espacio
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'moneda' 
        AND character_maximum_length >= 3
    ) THEN
        RAISE NOTICE '✅ moneda: LISTO para "DOP"';
    ELSE
        RAISE NOTICE '❌ moneda: TODAVÍA TIENE PROBLEMA';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'metodo_pago' 
        AND character_maximum_length >= 8
    ) THEN
        RAISE NOTICE '✅ metodo_pago: LISTO para "EFECTIVO"';
    ELSE
        RAISE NOTICE '❌ metodo_pago: TODAVÍA TIENE PROBLEMA';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'proforma' 
        AND character_maximum_length >= 14
    ) THEN
        RAISE NOTICE '✅ proforma: LISTO para "A LA ESP CONF"';
    ELSE
        RAISE NOTICE '❌ proforma: TODAVÍA TIENE PROBLEMA';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = 'status' 
        AND character_maximum_length >= 9
    ) THEN
        RAISE NOTICE '✅ status: LISTO para "PENDIENTE"';
    ELSE
        RAISE NOTICE '❌ status: TODAVÍA TIENE PROBLEMA';
    END IF;
    
    RAISE NOTICE '🚀 SISTEMA LISTO PARA INSERTAR RESERVAS';
    
END $$;
