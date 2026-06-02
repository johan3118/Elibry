-- Script ultra-seguro para actualizar balances sin importar el tipo de dato

-- Paso 1: Crear función auxiliar que maneja cualquier tipo de dato
CREATE OR REPLACE FUNCTION convert_to_decimal(input_val ANYELEMENT)
RETURNS DECIMAL AS $$
DECLARE
    result DECIMAL := 0;
    clean_val TEXT;
BEGIN
    -- Si es NULL, retornar 0
    IF input_val IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Convertir a texto y limpiar
    clean_val := TRIM(input_val::TEXT);
    
    -- Si está vacío después de limpiar, retornar 0
    IF clean_val = '' OR clean_val = 'NULL' THEN
        RETURN 0;
    END IF;
    
    -- Remover caracteres no numéricos excepto punto y coma
    clean_val := REGEXP_REPLACE(clean_val, '[^0-9.,\-]', '', 'g');
    
    -- Reemplazar coma por punto
    clean_val := REPLACE(clean_val, ',', '.');
    
    -- Si queda vacío, retornar 0
    IF clean_val = '' THEN
        RETURN 0;
    END IF;
    
    -- Intentar convertir
    BEGIN
        result := clean_val::DECIMAL;
    EXCEPTION
        WHEN OTHERS THEN
            result := 0;
    END;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Paso 2: Mostrar estado actual
SELECT 
    'ESTADO ANTES DE LA ACTUALIZACIÓN' as info,
    COUNT(*) as total_reservas,
    AVG(convert_to_decimal(precio_total)) as precio_promedio,
    AVG(convert_to_decimal(abonado_contabilidad)) as abonado_promedio
FROM reservas;

-- Paso 3: Actualizar todos los balances de forma segura
UPDATE reservas 
SET 
    balance_reserva = convert_to_decimal(precio_total) - convert_to_decimal(abonado_contabilidad),
    balance_general = convert_to_decimal(precio_total) - convert_to_decimal(abonado_contabilidad)
WHERE TRUE;

-- Paso 4: Actualizar status basado en los nuevos balances
UPDATE reservas 
SET status = CASE 
    WHEN convert_to_decimal(balance_reserva) <= 0 AND convert_to_decimal(precio_total) > 0 THEN 'PAGADA'
    WHEN convert_to_decimal(abonado_contabilidad) > 0 AND convert_to_decimal(balance_reserva) > 0 THEN 'PARCIAL'
    WHEN convert_to_decimal(precio_total) > 0 THEN 'PENDIENTE'
    ELSE status
END;

-- Paso 5: Verificar resultados
SELECT 
    'ESTADO DESPUÉS DE LA ACTUALIZACIÓN' as info,
    COUNT(*) as total_reservas,
    COUNT(CASE WHEN status = 'PAGADA' THEN 1 END) as pagadas,
    COUNT(CASE WHEN status = 'PARCIAL' THEN 1 END) as parciales,
    COUNT(CASE WHEN status = 'PENDIENTE' THEN 1 END) as pendientes,
    SUM(convert_to_decimal(precio_total)) as total_precio,
    SUM(convert_to_decimal(abonado_contabilidad)) as total_abonado,
    SUM(convert_to_decimal(balance_reserva)) as total_balance
FROM reservas;

-- Paso 6: Mostrar ejemplos actualizados
SELECT 
    id,
    codigo,
    convert_to_decimal(precio_total) as precio_total_limpio,
    convert_to_decimal(abonado_contabilidad) as abonado_limpio,
    convert_to_decimal(balance_reserva) as balance_limpio,
    status
FROM reservas 
WHERE convert_to_decimal(precio_total) > 0
ORDER BY id DESC
LIMIT 10;

-- Paso 7: Limpiar función auxiliar
DROP FUNCTION IF EXISTS convert_to_decimal(ANYELEMENT);

-- Mensaje final
SELECT 'ACTUALIZACIÓN COMPLETADA EXITOSAMENTE' as resultado;
