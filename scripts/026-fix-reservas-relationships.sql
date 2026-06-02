-- Script para corregir la tabla de reservas y sus relaciones

-- Verificar y corregir la tabla reservas
DO $$
BEGIN
    -- Verificar si la tabla reservas existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        -- Crear tabla básica si no existe
        CREATE TABLE reservas (
            id SERIAL PRIMARY KEY,
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    END IF;

    -- Agregar columnas faltantes si no existen
    
    -- codigo (para número de reserva)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'codigo') THEN
        ALTER TABLE reservas ADD COLUMN codigo VARCHAR(50);
    END IF;
    
    -- numero (alternativo para código)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'numero') THEN
        ALTER TABLE reservas ADD COLUMN numero VARCHAR(50);
    END IF;
    
    -- cliente_id
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'cliente_id') THEN
        ALTER TABLE reservas ADD COLUMN cliente_id INTEGER;
    END IF;
    
    -- producto_id
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'producto_id') THEN
        ALTER TABLE reservas ADD COLUMN producto_id INTEGER;
    END IF;
    
    -- precio_total
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'precio_total') THEN
        ALTER TABLE reservas ADD COLUMN precio_total DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- monto_total (alternativo)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'monto_total') THEN
        ALTER TABLE reservas ADD COLUMN monto_total DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- abonado_contabilidad
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'abonado_contabilidad') THEN
        ALTER TABLE reservas ADD COLUMN abonado_contabilidad DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- monto_pagado (alternativo)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'monto_pagado') THEN
        ALTER TABLE reservas ADD COLUMN monto_pagado DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    -- fecha_entrada
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'fecha_entrada') THEN
        ALTER TABLE reservas ADD COLUMN fecha_entrada DATE;
    END IF;
    
    -- fecha_evento (alternativo)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'fecha_evento') THEN
        ALTER TABLE reservas ADD COLUMN fecha_evento DATE;
    END IF;
    
    -- status
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'status') THEN
        ALTER TABLE reservas ADD COLUMN status VARCHAR(20) DEFAULT 'PENDIENTE';
    END IF;
    
    -- editado_por
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'editado_por') THEN
        ALTER TABLE reservas ADD COLUMN editado_por VARCHAR(100);
    END IF;
    
    -- fecha_editado
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'fecha_editado') THEN
        ALTER TABLE reservas ADD COLUMN fecha_editado TIMESTAMP;
    END IF;

    -- registrado_por
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'registrado_por') THEN
        ALTER TABLE reservas ADD COLUMN registrado_por VARCHAR(100) DEFAULT 'sistema';
    END IF;

    -- fecha_creado
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'fecha_creado') THEN
        ALTER TABLE reservas ADD COLUMN fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;

    -- Agregar foreign keys si no existen
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'reservas' AND constraint_name = 'fk_reservas_cliente') THEN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clientes') THEN
            ALTER TABLE reservas ADD CONSTRAINT fk_reservas_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id);
        END IF;
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'reservas' AND constraint_name = 'fk_reservas_producto') THEN
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
            ALTER TABLE reservas ADD CONSTRAINT fk_reservas_producto FOREIGN KEY (producto_id) REFERENCES productos(id);
        END IF;
    END IF;

    -- Generar códigos para reservas que no los tengan
    UPDATE reservas 
    SET codigo = 'R-' || EXTRACT(YEAR FROM COALESCE(fecha_entrada, fecha_evento, CURRENT_DATE)) || '-' || LPAD(id::text, 3, '0')
    WHERE codigo IS NULL OR codigo = '';

    -- Sincronizar numero con codigo
    UPDATE reservas SET numero = codigo WHERE numero IS NULL OR numero = '';

    -- Sincronizar campos de monto
    UPDATE reservas SET monto_total = precio_total WHERE monto_total = 0 AND precio_total > 0;
    UPDATE reservas SET precio_total = monto_total WHERE precio_total = 0 AND monto_total > 0;
    
    UPDATE reservas SET monto_pagado = abonado_contabilidad WHERE monto_pagado = 0 AND abonado_contabilidad > 0;
    UPDATE reservas SET abonado_contabilidad = monto_pagado WHERE abonado_contabilidad = 0 AND monto_pagado > 0;

    -- Sincronizar campos de fecha
    UPDATE reservas SET fecha_evento = fecha_entrada WHERE fecha_evento IS NULL AND fecha_entrada IS NOT NULL;
    UPDATE reservas SET fecha_entrada = fecha_evento WHERE fecha_entrada IS NULL AND fecha_evento IS NOT NULL;

END $$;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_id ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_producto_id ON reservas(producto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON reservas(codigo);
CREATE INDEX IF NOT EXISTS idx_reservas_numero ON reservas(numero);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada ON reservas(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_evento ON reservas(fecha_evento);

-- Insertar datos de ejemplo si la tabla está vacía
DO $$
DECLARE
    reserva_count INTEGER;
    cliente_id_ejemplo INTEGER;
    producto_id_ejemplo INTEGER;
BEGIN
    SELECT COUNT(*) INTO reserva_count FROM reservas;
    
    IF reserva_count = 0 THEN
        -- Obtener IDs de ejemplo
        SELECT id INTO cliente_id_ejemplo FROM clientes LIMIT 1;
        SELECT id INTO producto_id_ejemplo FROM productos LIMIT 1;
        
        IF cliente_id_ejemplo IS NOT NULL AND producto_id_ejemplo IS NOT NULL THEN
            INSERT INTO reservas (
                codigo, numero, cliente_id, producto_id, 
                precio_total, monto_total, abonado_contabilidad, monto_pagado,
                fecha_entrada, fecha_evento, status,
                registrado_por, fecha_creado
            ) VALUES 
            ('R-2024-001', 'R-2024-001', cliente_id_ejemplo, producto_id_ejemplo, 
             5000.00, 5000.00, 1000.00, 1000.00,
             CURRENT_DATE + INTERVAL '30 days', CURRENT_DATE + INTERVAL '30 days', 
             'PENDIENTE', 'sistema', CURRENT_TIMESTAMP),
            ('R-2024-002', 'R-2024-002', cliente_id_ejemplo, producto_id_ejemplo, 
             8000.00, 8000.00, 2000.00, 2000.00,
             CURRENT_DATE + INTERVAL '45 days', CURRENT_DATE + INTERVAL '45 days', 
             'CONFIRMADA', 'sistema', CURRENT_TIMESTAMP),
            ('R-2024-003', 'R-2024-003', cliente_id_ejemplo, producto_id_ejemplo, 
             3000.00, 3000.00, 500.00, 500.00,
             CURRENT_DATE + INTERVAL '60 days', CURRENT_DATE + INTERVAL '60 days', 
             'PENDIENTE', 'sistema', CURRENT_TIMESTAMP);
        END IF;
    END IF;
END $$;

-- Verificar la estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservas' 
ORDER BY ordinal_position;
