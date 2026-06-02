-- Script para corregir las columnas específicas que están causando problemas
-- Basado en el análisis de los datos del insert

DO $$
BEGIN
    RAISE NOTICE '🔧 Iniciando corrección específica de columnas problemáticas...';

    -- Corregir metodo_pago (necesita al menos 12 chars para "TRANSFERENCIA")
    BEGIN
        ALTER TABLE reservas ALTER COLUMN metodo_pago TYPE VARCHAR(20);
        RAISE NOTICE '✅ metodo_pago corregido a VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo metodo_pago: %', SQLERRM;
    END;

    -- Corregir proforma (necesita al menos 14 chars para "A LA ESP CONF")
    BEGIN
        ALTER TABLE reservas ALTER COLUMN proforma TYPE VARCHAR(20);
        RAISE NOTICE '✅ proforma corregido a VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo proforma: %', SQLERRM;
    END;

    -- Corregir status (necesita al menos 9 chars para "PENDIENTE")
    BEGIN
        ALTER TABLE reservas ALTER COLUMN status TYPE VARCHAR(20);
        RAISE NOTICE '✅ status corregido a VARCHAR(20)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo status: %', SQLERRM;
    END;

    -- Corregir moneda (necesita 3 chars para "DOP")
    BEGIN
        ALTER TABLE reservas ALTER COLUMN moneda TYPE VARCHAR(3);
        RAISE NOTICE '✅ moneda corregido a VARCHAR(3)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo moneda: %', SQLERRM;
    END;

    -- Asegurar que asientos_bus sea TEXT o VARCHAR suficiente
    BEGIN
        ALTER TABLE reservas ALTER COLUMN asientos_bus TYPE VARCHAR(10);
        RAISE NOTICE '✅ asientos_bus corregido a VARCHAR(10)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo asientos_bus: %', SQLERRM;
    END;

    -- Verificar y corregir las columnas SI/NO
    BEGIN
        ALTER TABLE reservas ALTER COLUMN comision TYPE VARCHAR(2);
        RAISE NOTICE '✅ comision corregido a VARCHAR(2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo comision: %', SQLERRM;
    END;

    BEGIN
        ALTER TABLE reservas ALTER COLUMN factura_enviada_cliente TYPE VARCHAR(2);
        RAISE NOTICE '✅ factura_enviada_cliente corregido a VARCHAR(2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo factura_enviada_cliente: %', SQLERRM;
    END;

    BEGIN
        ALTER TABLE reservas ALTER COLUMN factura_recibida_proveedor TYPE VARCHAR(2);
        RAISE NOTICE '✅ factura_recibida_proveedor corregido a VARCHAR(2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo factura_recibida_proveedor: %', SQLERRM;
    END;

    BEGIN
        ALTER TABLE reservas ALTER COLUMN grupo TYPE VARCHAR(2);
        RAISE NOTICE '✅ grupo corregido a VARCHAR(2)';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error corrigiendo grupo: %', SQLERRM;
    END;

    RAISE NOTICE '🎉 Corrección específica completada';
END $$;

-- Verificar la estructura final
SELECT 
    column_name,
    data_type,
    COALESCE(character_maximum_length::text, 'N/A') as max_length
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND column_name IN (
    'moneda', 'metodo_pago', 'proforma', 'status', 'asientos_bus',
    'comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo'
)
ORDER BY column_name;
