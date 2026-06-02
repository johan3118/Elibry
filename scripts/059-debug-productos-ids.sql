-- Script para debuggear los IDs de productos y su estado actual

-- 1. Verificar todos los productos y sus IDs
SELECT 
    id,
    nombre_producto,
    codigo,
    status,
    estado_registro,
    usuario_creacion,
    fecha_creado
FROM productos 
ORDER BY id ASC;

-- 2. Verificar el rango de IDs
SELECT 
    MIN(id) as id_minimo,
    MAX(id) as id_maximo,
    COUNT(*) as total_productos
FROM productos;

-- 3. Verificar productos por estado
SELECT 
    estado_registro,
    COUNT(*) as cantidad
FROM productos 
GROUP BY estado_registro;

-- 4. Verificar si hay gaps en los IDs
SELECT 
    id,
    LAG(id) OVER (ORDER BY id) as id_anterior,
    id - LAG(id) OVER (ORDER BY id) as diferencia
FROM productos 
ORDER BY id;

-- 5. Verificar la secuencia actual (PostgreSQL syntax)
SELECT 
    schemaname,
    sequencename,
    last_value,
    increment_by
FROM pg_sequences 
WHERE sequencename LIKE '%productos%';

-- 6. Mostrar productos específicos alrededor del ID 110
SELECT 
    id,
    nombre_producto,
    codigo,
    status,
    estado_registro
FROM productos 
WHERE id BETWEEN 105 AND 115
ORDER BY id;

-- 7. Verificar si existe el producto con ID 110 específicamente
SELECT 
    id,
    nombre_producto,
    codigo,
    status,
    estado_registro,
    usuario_creacion
FROM productos 
WHERE id = 110;

-- 8. Mostrar los primeros 20 productos para referencia
SELECT 
    id,
    nombre_producto,
    codigo,
    status,
    estado_registro
FROM productos 
ORDER BY id ASC
LIMIT 20;
