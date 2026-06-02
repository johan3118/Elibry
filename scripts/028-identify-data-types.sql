-- Script para identificar los tipos de datos de las columnas financieras

-- Información de columnas financieras
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  numeric_precision,
  numeric_scale,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'reservas' 
  AND column_name IN ('precio_total', 'abonado_contabilidad', 'balance_reserva', 'balance_general', 'balance_abonado')
ORDER BY column_name;

-- Verificar algunos valores de ejemplo y sus tipos
SELECT 
  id,
  codigo,
  precio_total,
  abonado_contabilidad,
  balance_reserva,
  CASE 
    WHEN precio_total IS NULL THEN 'NULL'
    WHEN precio_total::TEXT ~ '^[0-9]*\.?[0-9]+$' THEN 'NUMÉRICO'
    ELSE 'NO NUMÉRICO'
  END as tipo_precio,
  CASE 
    WHEN abonado_contabilidad IS NULL THEN 'NULL'
    WHEN abonado_contabilidad::TEXT ~ '^[0-9]*\.?[0-9]*$' THEN 'NUMÉRICO'
    ELSE 'NO NUMÉRICO'
  END as tipo_abonado
FROM reservas 
WHERE precio_total IS NOT NULL 
ORDER BY id DESC
LIMIT 10;

-- Estadísticas de precio_total
SELECT 
  'precio_total' as campo,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN precio_total IS NOT NULL THEN 1 END) as no_nulos,
  COUNT(CASE WHEN precio_total IS NULL THEN 1 END) as nulos
FROM reservas;

-- Estadísticas de abonado_contabilidad  
SELECT 
  'abonado_contabilidad' as campo,
  COUNT(*) as total_registros,
  COUNT(CASE WHEN abonado_contabilidad IS NOT NULL THEN 1 END) as no_nulos,
  COUNT(CASE WHEN abonado_contabilidad IS NULL THEN 1 END) as nulos
FROM reservas;

-- Verificar valores problemáticos en precio_total
SELECT 
  id,
  codigo,
  precio_total,
  'precio_total no numérico' as problema
FROM reservas 
WHERE precio_total IS NOT NULL 
  AND NOT (precio_total::TEXT ~ '^[0-9]*\.?[0-9]+$')
LIMIT 5;

-- Verificar valores problemáticos en abonado_contabilidad
SELECT 
  id,
  codigo,
  abonado_contabilidad,
  'abonado_contabilidad no numérico' as problema
FROM reservas 
WHERE abonado_contabilidad IS NOT NULL 
  AND NOT (abonado_contabilidad::TEXT ~ '^[0-9]*\.?[0-9]*$')
LIMIT 5;
