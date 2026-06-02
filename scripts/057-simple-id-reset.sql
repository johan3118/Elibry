-- Script para resetear solo las secuencias de IDs sin tocar los datos existentes
-- Este script SOLO ajusta los contadores de las secuencias para que los próximos registros tengan los IDs correctos

-- Resetear secuencia de clientes para que empiece desde 1
SELECT setval('clientes_id_seq', 1, false);

-- Resetear secuencia de reservas para que empiece desde 101
SELECT setval('reservas_id_seq', 101, false);

-- Resetear secuencia de pagos para que empiece desde 111
SELECT setval('pagos_id_seq', 111, false);

-- Resetear secuencia de productos para que empiece desde 101
SELECT setval('productos_id_seq', 101, false);

-- Resetear secuencia de suplidores para que empiece desde 101
SELECT setval('suplidores_id_seq', 101, false);

-- Resetear secuencia de colaboradores para que empiece desde 101
SELECT setval('colaboradores_id_seq', 101, false);

-- Resetear secuencia de tipos_productos para que empiece desde 101
SELECT setval('tipos_productos_id_seq', 101, false);

-- Resetear secuencia de usuarios para que empiece desde 101
SELECT setval('usuarios_id_seq', 101, false);

-- Resetear secuencia de reserva_detalles para que empiece desde 101
SELECT setval('reserva_detalles_id_seq', 101, false);

-- Verificar los valores actuales de las secuencias
SELECT 'clientes_id_seq' as tabla, last_value, is_called FROM clientes_id_seq
UNION ALL
SELECT 'reservas_id_seq' as tabla, last_value, is_called FROM reservas_id_seq
UNION ALL
SELECT 'pagos_id_seq' as tabla, last_value, is_called FROM pagos_id_seq
UNION ALL
SELECT 'productos_id_seq' as tabla, last_value, is_called FROM productos_id_seq
UNION ALL
SELECT 'suplidores_id_seq' as tabla, last_value, is_called FROM suplidores_id_seq
UNION ALL
SELECT 'colaboradores_id_seq' as tabla, last_value, is_called FROM colaboradores_id_seq
UNION ALL
SELECT 'tipos_productos_id_seq' as tabla, last_value, is_called FROM tipos_productos_id_seq
UNION ALL
SELECT 'usuarios_id_seq' as tabla, last_value, is_called FROM usuarios_id_seq
UNION ALL
SELECT 'reserva_detalles_id_seq' as tabla, last_value, is_called FROM reserva_detalles_id_seq;
