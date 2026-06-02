-- Script para corregir y completar la tabla reservas
-- Verificar y agregar columnas faltantes con manejo de errores

DO $$
BEGIN
    -- Verificar si la tabla existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        RAISE EXCEPTION 'La tabla reservas no existe. Ejecute primero el script 007-create-reservas-table-fixed.sql';
    END IF;

    -- Agregar columna abonado_contabilidad como DECIMAL si no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'abonado_contabilidad') THEN
        ALTER TABLE reservas ADD COLUMN abonado_contabilidad DECIMAL(10,2) DEFAULT 0;
        RAISE NOTICE 'Columna abonado_contabilidad agregada como DECIMAL(10,2)';
    ELSE
        -- Si existe pero es de otro tipo, convertirla
        BEGIN
            ALTER TABLE reservas ALTER COLUMN abonado_contabilidad TYPE DECIMAL(10,2) USING abonado_contabilidad::DECIMAL(10,2);
            RAISE NOTICE 'Columna abonado_contabilidad convertida a DECIMAL(10,2)';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo convertir abonado_contabilidad: %', SQLERRM;
        END;
    END IF;

    -- Agregar columna grupo como VARCHAR(2) si no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'grupo') THEN
        ALTER TABLE reservas ADD COLUMN grupo VARCHAR(2) DEFAULT 'NO' CHECK (grupo IN ('SI', 'NO'));
        RAISE NOTICE 'Columna grupo agregada como VARCHAR(2)';
    ELSE
        -- Si existe pero es de otro tipo, convertirla
        BEGIN
            ALTER TABLE reservas ALTER COLUMN grupo TYPE VARCHAR(2);
            ALTER TABLE reservas ALTER COLUMN grupo SET DEFAULT 'NO';
            -- Agregar constraint si no existe
            IF NOT EXISTS (SELECT FROM information_schema.check_constraints WHERE constraint_name = 'reservas_grupo_check') THEN
                ALTER TABLE reservas ADD CONSTRAINT reservas_grupo_check CHECK (grupo IN ('SI', 'NO'));
            END IF;
            RAISE NOTICE 'Columna grupo convertida a VARCHAR(2)';
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'No se pudo convertir grupo: %', SQLERRM;
        END;
    END IF;

    -- Agregar columna factura_url si no existe
    IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'factura_url') THEN
        ALTER TABLE reservas ADD COLUMN factura_url TEXT;
        RAISE NOTICE 'Columna factura_url agregada como TEXT';
    END IF;

    -- Verificar y corregir tipos de datos de columnas existentes
    
    -- Precio unitario como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN precio_unitario TYPE DECIMAL(10,2) USING precio_unitario::DECIMAL(10,2);
        RAISE NOTICE 'Columna precio_unitario convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir precio_unitario: %', SQLERRM;
    END;

    -- Descuento como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN descuento TYPE DECIMAL(10,2) USING descuento::DECIMAL(10,2);
        RAISE NOTICE 'Columna descuento convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir descuento: %', SQLERRM;
    END;

    -- Impuestos como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN impuestos TYPE DECIMAL(10,2) USING impuestos::DECIMAL(10,2);
        RAISE NOTICE 'Columna impuestos convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir impuestos: %', SQLERRM;
    END;

    -- Precio total como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN precio_total TYPE DECIMAL(10,2) USING precio_total::DECIMAL(10,2);
        RAISE NOTICE 'Columna precio_total convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir precio_total: %', SQLERRM;
    END;

    -- Balance reserva como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN balance_reserva TYPE DECIMAL(10,2) USING balance_reserva::DECIMAL(10,2);
        RAISE NOTICE 'Columna balance_reserva convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir balance_reserva: %', SQLERRM;
    END;

    -- Balance general como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN balance_general TYPE DECIMAL(10,2) USING balance_general::DECIMAL(10,2);
        RAISE NOTICE 'Columna balance_general convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir balance_general: %', SQLERRM;
    END;

    -- Balance abonado como DECIMAL
    BEGIN
        ALTER TABLE reservas ALTER COLUMN balance_abonado TYPE DECIMAL(10,2) USING balance_abonado::DECIMAL(10,2);
        RAISE NOTICE 'Columna balance_abonado convertida a DECIMAL(10,2)';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No se pudo convertir balance_abonado: %', SQLERRM;
    END;

    -- Crear índices para mejorar rendimiento si no existen
    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_reservas_cliente_id') THEN
        CREATE INDEX idx_reservas_cliente_id ON reservas(cliente_id);
        RAISE NOTICE 'Índice idx_reservas_cliente_id creado';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_reservas_producto_id') THEN
        CREATE INDEX idx_reservas_producto_id ON reservas(producto_id);
        RAISE NOTICE 'Índice idx_reservas_producto_id creado';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_reservas_status') THEN
        CREATE INDEX idx_reservas_status ON reservas(status);
        RAISE NOTICE 'Índice idx_reservas_status creado';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_reservas_fecha_entrada') THEN
        CREATE INDEX idx_reservas_fecha_entrada ON reservas(fecha_entrada);
        RAISE NOTICE 'Índice idx_reservas_fecha_entrada creado';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_indexes WHERE indexname = 'idx_reservas_codigo') THEN
        CREATE INDEX idx_reservas_codigo ON reservas(codigo);
        RAISE NOTICE 'Índice idx_reservas_codigo creado';
    END IF;

    RAISE NOTICE 'Script ejecutado exitosamente. Tabla reservas actualizada.';

END $$;

-- Verificar la estructura final de la tabla
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'reservas' 
ORDER BY ordinal_position;

-- Insertar datos de ejemplo solo si la tabla está vacía
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM reservas) = 0 THEN
        INSERT INTO reservas (
            codigo, cliente_id, producto_id, referido_por, atendido_por,
            fecha_entrada, fecha_salida, hora_entrada, hora_salida,
            pasajeros, habitaciones, precio_unitario, descuento, impuestos, precio_total,
            moneda, metodo_pago, abonado_contabilidad, proveedor, proforma,
            comision, factura_enviada_cliente, factura_recibida_proveedor,
            asientos_bus, grupo, nota_interna_reserva, status,
            balance_reserva, balance_general, balance_abonado, registrado_por
        ) VALUES 
        (
            'R-2024-0001', 1, 1, 'María González', 'Admin Sistema',
            '2024-02-15', '2024-02-20', '14:00', '12:00',
            2, 1, 1500.00, 0.00, 540.00, 3540.00,
            'DOP', 'TARJETA', 1000.00, 'Hotel Paradise', 'PROFORMA',
            'SI', 'SI', 'NO', NULL, 'NO', 'Reserva de luna de miel',
            'PENDIENTE', 3540.00, 3540.00, 1000.00, 'Admin Sistema'
        ),
        (
            'R-2024-0002', 2, 2, 'Carlos Pérez', 'Admin Sistema',
            '2024-03-01', '2024-03-05', '09:00', '18:00',
            4, 2, 800.00, 100.00, 558.00, 3658.00,
            'DOP', 'EFECTIVO', 0.00, 'Tours Caribe', 'VOUCHER',
            'NO', 'NO', 'SI', 45, 'SI', 'Excursión familiar',
            'CONFIRMADA', 3658.00, 3658.00, 0.00, 'Admin Sistema'
        ),
        (
            'R-2024-0003', 3, 3, NULL, 'Admin Sistema',
            '2024-03-10', '2024-03-12', '16:00', '10:00',
            1, 1, 2000.00, 200.00, 324.00, 2124.00,
            'USD', 'TRANSFERENCIA', 500.00, 'Resort Premium', 'A LA ESP CONF',
            'SI', 'SI', 'SI', NULL, 'NO', 'Cliente VIP',
            'PARCIAL', 2124.00, 2124.00, 500.00, 'Admin Sistema'
        );

        RAISE NOTICE 'Datos de ejemplo insertados exitosamente';
    ELSE
        RAISE NOTICE 'La tabla ya contiene datos, no se insertaron ejemplos';
    END IF;
END $$;
