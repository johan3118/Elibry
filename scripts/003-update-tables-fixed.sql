-- Actualizar estructura de tablas para coincidir con los tipos TypeScript

-- Verificar y actualizar tabla clientes
-- Solo renombrar si la columna cedula existe
DO $$ 
BEGIN
    -- Verificar si la columna identificacion existe, si no, renombrar cedula
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'cedula') THEN
        ALTER TABLE clientes RENAME COLUMN cedula TO identificacion;
    END IF;
    
    -- Agregar columnas faltantes si no existen
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'tipo_documento') THEN
        ALTER TABLE clientes ADD COLUMN tipo_documento VARCHAR(20) DEFAULT 'CEDULA';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clientes' AND column_name = 'nacionalidad') THEN
        ALTER TABLE clientes ADD COLUMN nacionalidad VARCHAR(50) DEFAULT 'Dominicana';
    END IF;
END $$;

-- Agregar columna razon_social si no existe
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS razon_social VARCHAR(255);

-- Verificar y crear tabla productos si no existe
IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'productos') THEN
    CREATE TABLE productos (
        id SERIAL PRIMARY KEY,
        codigo VARCHAR(50) UNIQUE,
        nombre_producto VARCHAR(255) NOT NULL,
        nombre_original VARCHAR(255) NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        suplidor_id INTEGER REFERENCES suplidores(id),
        contactos TEXT NOT NULL,
        pais VARCHAR(100) NOT NULL,
        direccion TEXT NOT NULL,
        comentarios TEXT,
        status VARCHAR(20) DEFAULT 'ACTIVO',
        registrado_por VARCHAR(100),
        fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        fecha_editado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    
    -- Crear índices
    CREATE INDEX idx_productos_tipo ON productos(tipo);
    CREATE INDEX idx_productos_status ON productos(status);
    CREATE INDEX idx_productos_suplidor ON productos(suplidor_id);
    
    RAISE NOTICE 'Tabla productos creada exitosamente';
ELSE
    RAISE NOTICE 'Tabla productos ya existe';
END IF;

-- Verificar y crear tabla reservas si no existe
CREATE TABLE IF NOT EXISTS reservas (
    id SERIAL PRIMARY KEY,
    codigo_reserva VARCHAR(50) UNIQUE NOT NULL,
    cliente_id INTEGER REFERENCES clientes(id),
    producto_id INTEGER REFERENCES productos(id),
    fecha_reserva DATE NOT NULL,
    fecha_viaje DATE NOT NULL,
    cantidad_personas INTEGER NOT NULL,
    precio_total DECIMAL(10,2) NOT NULL,
    monto_pagado DECIMAL(10,2) DEFAULT 0,
    balance_pendiente DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    observaciones TEXT,
    asientos_bus VARCHAR(255),
    registrado_por VARCHAR(100),
    fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_editado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Actualizar tabla reservas existente agregando columnas faltantes
ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS codigo VARCHAR(50),
ADD COLUMN IF NOT EXISTS cedula_cliente VARCHAR(20),
ADD COLUMN IF NOT EXISTS referido_por VARCHAR(255),
ADD COLUMN IF NOT EXISTS atendido_por VARCHAR(255),
ADD COLUMN IF NOT EXISTS fecha_entrada DATE,
ADD COLUMN IF NOT EXISTS fecha_salida DATE,
ADD COLUMN IF NOT EXISTS hora_entrada TIME,
ADD COLUMN IF NOT EXISTS hora_salida TIME,
ADD COLUMN IF NOT EXISTS pasajeros INTEGER,
ADD COLUMN IF NOT EXISTS habitaciones INTEGER,
ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS descuento DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS impuestos DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fecha_limite_pago DATE,
ADD COLUMN IF NOT EXISTS fecha_gastos_proveedor DATE,
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
ADD COLUMN IF NOT EXISTS abonado_contabilidad VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS proveedor VARCHAR(255),
ADD COLUMN IF NOT EXISTS proforma VARCHAR(100),
ADD COLUMN IF NOT EXISTS comision VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS factura_enviada_cliente VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS factura_recibida_proveedor VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS asientos_bus INTEGER,
ADD COLUMN IF NOT EXISTS grupo VARCHAR(255),
ADD COLUMN IF NOT EXISTS nota_interna_reserva TEXT;

-- Actualizar restricciones NOT NULL solo si las columnas existen y tienen datos
DO $$ 
BEGIN
    -- Verificar si la columna pasajeros existe antes de modificarla
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'pasajeros') THEN
        -- Actualizar valores NULL a 1 antes de aplicar NOT NULL
        UPDATE reservas SET pasajeros = 1 WHERE pasajeros IS NULL;
        ALTER TABLE reservas ALTER COLUMN pasajeros SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'precio_unitario') THEN
        UPDATE reservas SET precio_unitario = 0 WHERE precio_unitario IS NULL;
        ALTER TABLE reservas ALTER COLUMN precio_unitario SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'precio_total') THEN
        UPDATE reservas SET precio_total = 0 WHERE precio_total IS NULL;
        ALTER TABLE reservas ALTER COLUMN precio_total SET NOT NULL;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'atendido_por') THEN
        UPDATE reservas SET atendido_por = 'Sistema' WHERE atendido_por IS NULL;
        ALTER TABLE reservas ALTER COLUMN atendido_por SET NOT NULL;
    END IF;
END $$;

-- Crear constraint único para codigo si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE table_name = 'reservas' AND constraint_name = 'reservas_codigo_key') THEN
        ALTER TABLE reservas ADD CONSTRAINT reservas_codigo_key UNIQUE (codigo);
    END IF;
END $$;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON reservas(codigo);
CREATE INDEX IF NOT EXISTS idx_reservas_cedula_cliente ON reservas(cedula_cliente);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada ON reservas(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion ON clientes(identificacion);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre_producto);
CREATE INDEX IF NOT EXISTS idx_suplidores_numero_documento ON suplidores(numero_documento);

-- Actualizar trigger para fecha_editado en reservas
CREATE OR REPLACE FUNCTION update_fecha_editado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_editado = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_reservas_fecha_editado ON reservas;
CREATE TRIGGER trigger_update_reservas_fecha_editado
    BEFORE UPDATE ON reservas
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_editado();

-- Verificar y crear función para generar códigos automáticos
-- Función para generar códigos automáticos de productos
CREATE OR REPLACE FUNCTION generar_codigo_producto()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
        NEW.codigo := 'PROD-' || LPAD(nextval('productos_codigo_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear secuencia para códigos de productos si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'productos_codigo_seq') THEN
        CREATE SEQUENCE productos_codigo_seq START 1;
    END IF;
END $$;

-- Función para generar códigos automáticos de reservas
CREATE OR REPLACE FUNCTION generar_codigo_reserva()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.codigo IS NULL OR NEW.codigo = '' THEN
        NEW.codigo := 'RES-' || EXTRACT(YEAR FROM CURRENT_DATE) || '-' || LPAD(nextval('reservas_codigo_seq')::text, 4, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear secuencia para códigos de reservas si no existe
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'reservas_codigo_seq') THEN
        CREATE SEQUENCE reservas_codigo_seq START 1;
    END IF;
END $$;

-- Crear trigger para códigos automáticos de productos
DROP TRIGGER IF EXISTS trigger_generar_codigo_producto ON productos;
CREATE TRIGGER trigger_generar_codigo_producto
    BEFORE INSERT ON productos
    FOR EACH ROW
    EXECUTE FUNCTION generar_codigo_producto();

-- Crear trigger para códigos automáticos de reservas si la tabla existe
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservas') THEN
        DROP TRIGGER IF EXISTS trigger_generar_codigo_reserva ON reservas;
        CREATE TRIGGER trigger_generar_codigo_reserva
            BEFORE INSERT ON reservas
            FOR EACH ROW
            EXECUTE FUNCTION generar_codigo_reserva();
    END IF;
END $$;

-- Actualizar códigos existentes de productos que no tengan código
UPDATE productos 
SET codigo = 'PROD-' || LPAD(ROW_NUMBER() OVER (ORDER BY id)::text, 4, '0')
WHERE codigo IS NULL OR codigo = '';

-- Actualizar tabla suplidores
DO $$
BEGIN
    -- Renombrar rnc a numero_documento si existe
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suplidores' AND column_name = 'rnc') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suplidores' AND column_name = 'numero_documento') THEN
        ALTER TABLE suplidores RENAME COLUMN rnc TO numero_documento;
    END IF;
    
    -- Agregar tipo_documento si no existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suplidores' AND column_name = 'tipo_documento') THEN
        ALTER TABLE suplidores ADD COLUMN tipo_documento VARCHAR(20) DEFAULT 'RNC';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suplidores' AND column_name = 'numero_documento') THEN
        ALTER TABLE suplidores ADD COLUMN numero_documento VARCHAR(50);
        -- Copiar datos de RNC a numero_documento si existe
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suplidores' AND column_name = 'rnc') THEN
            UPDATE suplidores SET numero_documento = rnc WHERE rnc IS NOT NULL;
        END IF;
    END IF;
END $$;

-- Crear tabla tipos_productos si no existe
CREATE TABLE IF NOT EXISTS tipos_productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    registrado_por VARCHAR(100) NOT NULL,
    fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_editado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_codigo ON productos(codigo);
CREATE INDEX IF NOT EXISTS idx_productos_tipo ON productos(tipo);
CREATE INDEX IF NOT EXISTS idx_productos_status ON productos(status);
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion ON clientes(identificacion);
CREATE INDEX IF NOT EXISTS idx_clientes_status ON clientes(status);
CREATE INDEX IF NOT EXISTS idx_suplidores_numero_documento ON suplidores(numero_documento);
CREATE INDEX IF NOT EXISTS idx_suplidores_status ON suplidores(status);
