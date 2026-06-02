-- Script para corregir la lógica de balances en reservas
-- Lógica correcta:
-- balance_reserva = precio total original (no cambia)
-- balance_general = precio total - suma de pagos realizados
-- abonado_contabilidad = campo fijo (NO se modifica con pagos)

-- Paso 1: Crear función para calcular suma de pagos por reserva
CREATE OR REPLACE FUNCTION calcular_suma_pagos(reserva_id_param INTEGER)
RETURNS DECIMAL AS $$
DECLARE
    total_pagos DECIMAL := 0;
BEGIN
    SELECT COALESCE(SUM(CAST(monto AS DECIMAL)), 0)
    INTO total_pagos
    FROM pagos 
    WHERE reserva_id = reserva_id_param 
    AND status = 'COMPLETADO';
    
    RETURN total_pagos;
END;
$$ LANGUAGE plpgsql;

-- Paso 2: Mostrar estado actual antes de la corrección
SELECT 
    'ESTADO ANTES DE LA CORRECCIÓN' as info,
    COUNT(*) as total_reservas,
    AVG(CAST(precio_total AS DECIMAL)) as precio_promedio,
    AVG(CAST(abonado_contabilidad AS DECIMAL)) as abonado_promedio
FROM reservas;

-- Paso 3: Actualizar balances con lógica correcta
UPDATE reservas 
SET 
    -- balance_reserva = precio total original
    balance_reserva = CAST(precio_total AS DECIMAL),
    -- balance_general = precio total - suma de pagos realizados
    balance_general = CAST(precio_total AS DECIMAL) - calcular_suma_pagos(id),
    -- abonado_contabilidad NO se modifica (es campo fijo)
    fecha_editado = NOW(),
    editado_por = 'sistema_correccion_balances'
WHERE TRUE;

-- Paso 4: Actualizar status basado en la nueva lógica
UPDATE reservas 
SET status = CASE 
    WHEN balance_general <= 0 AND CAST(precio_total AS DECIMAL) > 0 THEN 'PAGADA'
    WHEN calcular_suma_pagos(id) > 0 AND balance_general > 0 THEN 'PARCIAL'
    WHEN CAST(precio_total AS DECIMAL) > 0 THEN 'PENDIENTE'
    ELSE status
END;

-- Paso 5: Verificar resultados
SELECT 
    'ESTADO DESPUÉS DE LA CORRECCIÓN' as info,
    COUNT(*) as total_reservas,
    COUNT(CASE WHEN status = 'PAGADA' THEN 1 END) as pagadas,
    COUNT(CASE WHEN status = 'PARCIAL' THEN 1 END) as parciales,
    COUNT(CASE WHEN status = 'PENDIENTE' THEN 1 END) as pendientes,
    SUM(CAST(precio_total AS DECIMAL)) as total_precio_original,
    SUM(CAST(abonado_contabilidad AS DECIMAL)) as total_abonado_contabilidad,
    SUM(balance_general) as total_saldo_pendiente
FROM reservas;

-- Paso 6: Mostrar ejemplos de reservas corregidas
SELECT 
    id,
    codigo,
    CAST(precio_total AS DECIMAL) as precio_total_original,
    calcular_suma_pagos(id) as pagos_realizados,
    CAST(abonado_contabilidad AS DECIMAL) as abonado_contabilidad_fijo,
    balance_reserva as balance_reserva_corregido,
    balance_general as balance_general_corregido,
    status
FROM reservas 
WHERE CAST(precio_total AS DECIMAL) > 0
ORDER BY id DESC
LIMIT 10;

-- Paso 7: Limpiar función auxiliar
DROP FUNCTION IF EXISTS calcular_suma_pagos(INTEGER);

-- Mensaje final
SELECT 'CORRECCIÓN DE LÓGICA DE BALANCES COMPLETADA EXITOSAMENTE' as resultado;
