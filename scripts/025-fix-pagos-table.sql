-- Script para corregir y crear la tabla de pagos con todas las columnas necesarias

-- Verificar si la tabla pagos existe y crearla si no existe
DO $$
BEGIN
    -- Crear tabla pagos si no existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pagos') THEN
        CREATE TABLE pagos (
            id SERIAL PRIMARY KEY,
            reserva_id INTEGER,
            cliente_id INTEGER,
            numero_recibo VARCHAR(50) UNIQUE NOT NULL,
            monto DECIMAL(10,2) NOT NULL,
            metodo_pago VARCHAR(50) NOT NULL,
            referencia VARCHAR(100),
            banco VARCHAR(100),
            concepto TEXT NOT NULL,
            notas TEXT,
            fecha_pago DATE NOT NULL,
            estado VARCHAR(20) DEFAULT 'completado',
            usuario VARCHAR(100) NOT NULL DEFAULT 'sistema',
            creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            editado_por VARCHAR(100),
            editado_en TIMESTAMP,
            
            -- Foreign keys
            CONSTRAINT fk_pagos_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id),
            CONSTRAINT fk_pagos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id)
        );
    END IF;

    -- Agregar columnas faltantes si no existen
    
    -- numero_recibo
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'numero_recibo') THEN
        ALTER TABLE pagos ADD COLUMN numero_recibo VARCHAR(50);
    END IF;
    
    -- reserva_id
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'reserva_id') THEN
        ALTER TABLE pagos ADD COLUMN reserva_id INTEGER;
    END IF;
    
    -- cliente_id
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'cliente_id') THEN
        ALTER TABLE pagos ADD COLUMN cliente_id INTEGER;
    END IF;
    
    -- metodo_pago
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'metodo_pago') THEN
        ALTER TABLE pagos ADD COLUMN metodo_pago VARCHAR(50);
    END IF;
    
    -- referencia
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'referencia') THEN
        ALTER TABLE pagos ADD COLUMN referencia VARCHAR(100);
    END IF;
    
    -- banco
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'banco') THEN
        ALTER TABLE pagos ADD COLUMN banco VARCHAR(100);
    END IF;
    
    -- concepto
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'concepto') THEN
        ALTER TABLE pagos ADD COLUMN concepto TEXT;
    END IF;
    
    -- notas
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'notas') THEN
        ALTER TABLE pagos ADD COLUMN notas TEXT;
    END IF;
    
    -- fecha_pago
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'fecha_pago') THEN
        ALTER TABLE pagos ADD COLUMN fecha_pago DATE;
    END IF;
    
    -- estado
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'estado') THEN
        ALTER TABLE pagos ADD COLUMN estado VARCHAR(20) DEFAULT 'completado';
    END IF;
    
    -- usuario (columna principal para el usuario que crea el pago)
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'usuario') THEN
        ALTER TABLE pagos ADD COLUMN usuario VARCHAR(100) NOT NULL DEFAULT 'sistema';
    END IF;
    
    -- creado_en
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'creado_en') THEN
        ALTER TABLE pagos ADD COLUMN creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    END IF;
    
    -- editado_por
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'editado_por') THEN
        ALTER TABLE pagos ADD COLUMN editado_por VARCHAR(100);
    END IF;
    
    -- editado_en
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'pagos' AND column_name = 'editado_en') THEN
        ALTER TABLE pagos ADD COLUMN editado_en TIMESTAMP;
    END IF;

    -- Agregar constraints si no existen
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'pagos' AND constraint_name = 'fk_pagos_reserva') THEN
        ALTER TABLE pagos ADD CONSTRAINT fk_pagos_reserva FOREIGN KEY (reserva_id) REFERENCES reservas(id);
    END IF;
    
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'pagos' AND constraint_name = 'fk_pagos_cliente') THEN
        ALTER TABLE pagos ADD CONSTRAINT fk_pagos_cliente FOREIGN KEY (cliente_id) REFERENCES clientes(id);
    END IF;

    -- Hacer numero_recibo único si no lo es
    IF NOT EXISTS (SELECT FROM information_schema.table_constraints WHERE table_name = 'pagos' AND constraint_name = 'pagos_numero_recibo_key') THEN
        -- Primero generar números únicos para registros existentes sin numero_recibo
        UPDATE pagos 
        SET numero_recibo = 'REC-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(id::text, 3, '0')
        WHERE numero_recibo IS NULL OR numero_recibo = '';
        
        -- Luego agregar la constraint
        ALTER TABLE pagos ADD CONSTRAINT pagos_numero_recibo_key UNIQUE (numero_recibo);
    END IF;

    -- Asegurar que la columna usuario no sea NULL para registros existentes
    UPDATE pagos SET usuario = 'sistema' WHERE usuario IS NULL;

    -- Hacer la columna usuario NOT NULL si no lo es
    BEGIN
        ALTER TABLE pagos ALTER COLUMN usuario SET NOT NULL;
    EXCEPTION
        WHEN OTHERS THEN
            -- Ignorar error si ya es NOT NULL
            NULL;
    END;

END $$;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_pagos_reserva_id ON pagos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_numero_recibo ON pagos(numero_recibo);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario ON pagos(usuario);

-- Crear trigger para actualizar editado_en automáticamente
CREATE OR REPLACE FUNCTION update_editado_en_pagos()
RETURNS TRIGGER AS $$
BEGIN
    NEW.editado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger si no existe
DROP TRIGGER IF EXISTS trigger_update_editado_en_pagos ON pagos;
CREATE TRIGGER trigger_update_editado_en_pagos
    BEFORE UPDATE ON pagos
    FOR EACH ROW
    EXECUTE FUNCTION update_editado_en_pagos();

-- Verificar la estructura final
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'pagos' 
ORDER BY ordinal_position;
