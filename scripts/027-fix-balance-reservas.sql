-- Script para corregir y actualizar los balances de las reservas
-- Maneja diferentes tipos de datos de forma segura

-- Paso 1: Verificar estructura actual
SELECT 'VERIFICANDO ESTRUCTURA ACTUAL' as paso;

-- Paso 2: Función auxiliar para convertir valores a numérico de forma segura
CREATE OR REPLACE FUNCTION safe_to_numeric(input_value TEXT)
RETURNS NUMERIC AS $$
BEGIN
    -- Si es NULL o vacío, retornar 0
    IF input_value IS NULL OR TRIM(input_value) = '' THEN
        RETURN 0;
    END IF;
    
    -- Limpiar el valor (remover espacios, caracteres no numéricos excepto punto y coma)
    input_value := REGEXP_REPLACE(TRIM(input_value), '[^0-9.,]', '', 'g');
    
    -- Reemplazar coma por punto para decimales
    input_value := REPLACE(input_value, ',', '.');
    
    -- Si después de limpiar queda vacío, retornar 0
    IF input_value = '' THEN
        RETURN 0;
    END IF;
    
    -- Intentar convertir a numérico
    RETURN input_value::NUMERIC;
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- Paso 3: Actualizar balances de reservas
UPDATE reservas 
SET 
    -- Convertir precio_total a numérico si no lo es
    precio_total = CASE 
        WHEN precio_total IS NULL THEN 0
        ELSE safe_to_numeric(precio_total::TEXT)
    END,
    
    -- Convertir abonado_contabilidad a numérico si no lo es
    abonado_contabilidad = CASE 
        WHEN abonado_contabilidad IS NULL THEN 0
        ELSE safe_to_numeric(abonado_contabilidad::TEXT)
    END
WHERE precio_total IS NOT NULL OR abonado_contabilidad IS NOT NULL;

-- Paso 4: Calcular balance_reserva correctamente
UPDATE reservas 
SET balance_reserva = safe_to_numeric(precio_total::TEXT) - safe_to_numeric(abonado_contabilidad::TEXT)
WHERE precio_total IS NOT NULL;

-- Paso 5: Actualizar balance_general (igual que balance_reserva)
UPDATE reservas 
SET balance_general = balance_reserva
WHERE balance_reserva IS NOT NULL;

-- Paso 6: Actualizar status según el balance
UPDATE reservas 
SET status = CASE 
    WHEN safe_to_numeric(balance_reserva::TEXT) <= 0 THEN 'PAGADA'
    WHEN safe_to_numeric(abonado_contabilidad::TEXT) > 0 THEN 'PARCIAL'
    ELSE 'PENDIENTE'
END
WHERE precio_total IS NOT NULL;

-- Paso 7: Verificar resultados
SELECT 
    'RESULTADOS DESPUÉS DE LA ACTUALIZACIÓN' as resultado,
    COUNT(*) as total_reservas,
    COUNT(CASE WHEN status = 'PAGADA' THEN 1 END) as pagadas,
    COUNT(CASE WHEN status = 'PARCIAL' THEN 1 END) as parciales,
    COUNT(CASE WHEN status = 'PENDIENTE' THEN 1 END) as pendientes,
    SUM(safe_to_numeric(precio_total::TEXT)) as total_precio,
    SUM(safe_to_numeric(abonado_contabilidad::TEXT)) as total_abonado,
    SUM(safe_to_numeric(balance_reserva::TEXT)) as total_balance
FROM reservas;

-- Paso 8: Mostrar ejemplos de reservas actualizadas
SELECT 
    id,
    codigo,
    precio_total,
    abonado_contabilidad,
    balance_reserva,
    status
FROM reservas 
WHERE precio_total IS NOT NULL
ORDER BY id DESC
LIMIT 10;

-- Limpiar función auxiliar
DROP FUNCTION IF EXISTS safe_to_numeric(TEXT);
