-- Script para corregir las longitudes de columnas en la tabla reservas
-- Identificar y corregir columnas con restricciones de longitud inadecuadas

DO $$
BEGIN
    -- Verificar si la tabla existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        RAISE EXCEPTION 'La tabla reservas no existe. Ejecute primero los scripts anteriores.';
    END IF;

    RAISE NOTICE 'Iniciando corrección de longitudes de columnas en tabla reservas...';

    -- Corregir columna moneda (debe permitir 3 caracteres: DOP, USD, EUR)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'moneda') THEN
            ALTER TABLE reservas ALTER COLUMN moneda TYPE VARCHAR(3);
            RAISE NOTICE '✅ Columna moneda actualizada a VARCHAR(3)';
        ELSE
            ALTER TABLE reservas ADD COLUMN moneda VARCHAR(3) DEFAULT 'DOP';
            RAISE NOTICE '✅ Columna moneda creada como VARCHAR(3)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna moneda: %', SQLERRM;
    END;

    -- Corregir columna status (debe permitir al menos 20 caracteres: PENDIENTE, CONFIRMADA, etc.)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'status') THEN
            ALTER TABLE reservas ALTER COLUMN status TYPE VARCHAR(20);
            RAISE NOTICE '✅ Columna status actualizada a VARCHAR(20)';
        ELSE
            ALTER TABLE reservas ADD COLUMN status VARCHAR(20) DEFAULT 'PENDIENTE';
            RAISE NOTICE '✅ Columna status creada como VARCHAR(20)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna status: %', SQLERRM;
    END;

    -- Corregir columna metodo_pago (debe permitir al menos 20 caracteres: TRANSFERENCIA)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'metodo_pago') THEN
            ALTER TABLE reservas ALTER COLUMN metodo_pago TYPE VARCHAR(20);
            RAISE NOTICE '✅ Columna metodo_pago actualizada a VARCHAR(20)';
        ELSE
            ALTER TABLE reservas ADD COLUMN metodo_pago VARCHAR(20);
            RAISE NOTICE '✅ Columna metodo_pago creada como VARCHAR(20)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna metodo_pago: %', SQLERRM;
    END;

    -- Corregir columna comision (debe permitir 2 caracteres: SI, NO)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'comision') THEN
            ALTER TABLE reservas ALTER COLUMN comision TYPE VARCHAR(2);
            RAISE NOTICE '✅ Columna comision actualizada a VARCHAR(2)';
        ELSE
            ALTER TABLE reservas ADD COLUMN comision VARCHAR(2) DEFAULT 'NO';
            RAISE NOTICE '✅ Columna comision creada como VARCHAR(2)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna comision: %', SQLERRM;
    END;

    -- Corregir columna factura_enviada_cliente (debe permitir 2 caracteres: SI, NO)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'factura_enviada_cliente') THEN
            ALTER TABLE reservas ALTER COLUMN factura_enviada_cliente TYPE VARCHAR(2);
            RAISE NOTICE '✅ Columna factura_enviada_cliente actualizada a VARCHAR(2)';
        ELSE
            ALTER TABLE reservas ADD COLUMN factura_enviada_cliente VARCHAR(2) DEFAULT 'NO';
            RAISE NOTICE '✅ Columna factura_enviada_cliente creada como VARCHAR(2)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna factura_enviada_cliente: %', SQLERRM;
    END;

    -- Corregir columna factura_recibida_proveedor (debe permitir 2 caracteres: SI, NO)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'factura_recibida_proveedor') THEN
            ALTER TABLE reservas ALTER COLUMN factura_recibida_proveedor TYPE VARCHAR(2);
            RAISE NOTICE '✅ Columna factura_recibida_proveedor actualizada a VARCHAR(2)';
        ELSE
            ALTER TABLE reservas ADD COLUMN factura_recibida_proveedor VARCHAR(2) DEFAULT 'NO';
            RAISE NOTICE '✅ Columna factura_recibida_proveedor creada como VARCHAR(2)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna factura_recibida_proveedor: %', SQLERRM;
    END;

    -- Corregir columna grupo (debe permitir 2 caracteres: SI, NO)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'grupo') THEN
            ALTER TABLE reservas ALTER COLUMN grupo TYPE VARCHAR(2);
            RAISE NOTICE '✅ Columna grupo actualizada a VARCHAR(2)';
        ELSE
            ALTER TABLE reservas ADD COLUMN grupo VARCHAR(2) DEFAULT 'NO';
            RAISE NOTICE '✅ Columna grupo creada como VARCHAR(2)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna grupo: %', SQLERRM;
    END;

    -- Corregir columna proforma (debe permitir al menos 20 caracteres: A LA ESP CONF)
    BEGIN
        IF EXISTS (SELECT FROM information_schema.columns 
                   WHERE table_name = 'reservas' AND column_name = 'proforma') THEN
            ALTER TABLE reservas ALTER COLUMN proforma TYPE VARCHAR(20);
            RAISE NOTICE '✅ Columna proforma actualizada a VARCHAR(20)';
        ELSE
            ALTER TABLE reservas ADD COLUMN proforma VARCHAR(20);
            RAISE NOTICE '✅ Columna proforma creada como VARCHAR(20)';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error actualizando columna proforma: %', SQLERRM;
    END;

    -- Agregar columna factura_url si no existe
    BEGIN
        IF NOT EXISTS (SELECT FROM information_schema.columns 
                       WHERE table_name = 'reservas' AND column_name = 'factura_url') THEN
            ALTER TABLE reservas ADD COLUMN factura_url VARCHAR(255);
            RAISE NOTICE '✅ Columna factura_url creada como VARCHAR(255)';
        ELSE
            RAISE NOTICE '✅ Columna factura_url ya existe';
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '⚠️ Error creando columna factura_url: %', SQLERRM;
    END;

    RAISE NOTICE '🎉 Corrección de longitudes de columnas completada exitosamente.';

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error general en el script: %', SQLERRM;
END $$;

-- Verificar las longitudes actuales de las columnas críticas
SELECT 
    column_name,
    data_type,
    COALESCE(character_maximum_length::text, 'N/A') as max_length,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND column_name IN (
    'moneda', 'status', 'metodo_pago', 'comision', 
    'factura_enviada_cliente', 'factura_recibida_proveedor', 
    'grupo', 'proforma', 'factura_url'
)
ORDER BY column_name;

-- Mostrar mensaje final
SELECT '✅ Script de corrección de columnas ejecutado correctamente' as resultado;
