-- Crear extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de tipos de productos
CREATE TABLE tipos_productos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de suplidores
CREATE TABLE suplidores (
    id SERIAL PRIMARY KEY,
    razon_social VARCHAR(255) NOT NULL,
    nombre_comercial VARCHAR(255) NOT NULL,
    identificacion VARCHAR(50) NOT NULL UNIQUE,
    nombre_responsable VARCHAR(255) NOT NULL,
    telefono_responsable VARCHAR(20) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    email VARCHAR(255) NOT NULL,
    observacion TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de colaboradores/vendedores
CREATE TABLE colaboradores (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('VENDEDOR', 'COLABORADOR', 'REFERIDOR', 'AGENTE')),
    comision DECIMAL(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de clientes
CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('EMPRESA', 'NORMAL')),
    compania VARCHAR(50) NOT NULL,
    -- Campos para empresa
    rnc VARCHAR(20),
    razon_social VARCHAR(255),
    nombre_comercial VARCHAR(255),
    responsable VARCHAR(255),
    -- Campos para cliente normal
    identificacion VARCHAR(20),
    nombre_completo VARCHAR(255),
    sexo VARCHAR(20),
    fecha_nacimiento DATE,
    -- Campos comunes
    telefonos VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    direccion TEXT NOT NULL,
    observacion TEXT,
    referido_por VARCHAR(255),
    status VARCHAR(20) DEFAULT 'ACTIVO',
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de productos (sin precios)
CREATE TABLE productos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    nombre_producto VARCHAR(255) NOT NULL,
    nombre_original VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    suplidor_id INTEGER REFERENCES suplidores(id),
    contactos VARCHAR(255) NOT NULL,
    pais VARCHAR(100) NOT NULL,
    direccion TEXT NOT NULL,
    comentarios TEXT,
    status VARCHAR(20) DEFAULT 'ACTIVO',
    registrado_por VARCHAR(100),
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    editado_por VARCHAR(100)
);

-- Tabla de reservas (con precios específicos)
CREATE TABLE reservas (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    cliente_id INTEGER REFERENCES clientes(id),
    cedula_cliente VARCHAR(20) NOT NULL,
    producto_id INTEGER REFERENCES productos(id),
    referido_por VARCHAR(255),
    atendido_por VARCHAR(100) NOT NULL,
    
    -- Detalles de la reserva
    fecha_entrada DATE NOT NULL,
    fecha_salida DATE NOT NULL,
    hora_entrada TIME,
    hora_salida TIME,
    pasajeros INTEGER NOT NULL,
    habitaciones INTEGER,
    
    -- Precios específicos para esta reserva
    precio_unitario DECIMAL(12,2) NOT NULL,
    descuento DECIMAL(12,2) DEFAULT 0.00,
    impuestos DECIMAL(12,2) DEFAULT 0.00,
    precio_total DECIMAL(12,2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'DOP',
    
    -- Fechas y pagos
    fecha_limite_pago DATE,
    fecha_gastos_proveedor DATE,
    metodo_pago VARCHAR(20) NOT NULL,
    
    -- Información administrativa
    abonado_contabilidad VARCHAR(2) DEFAULT 'NO',
    proveedor VARCHAR(255),
    proforma VARCHAR(100),
    comision VARCHAR(2) DEFAULT 'NO',
    factura_enviada_cliente VARCHAR(2) DEFAULT 'NO',
    factura_recibida_proveedor VARCHAR(2) DEFAULT 'NO',
    asientos_bus INTEGER,
    grupo VARCHAR(100),
    nota_interna_reserva TEXT,
    
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de pagos
CREATE TABLE pagos (
    id SERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE,
    recibo VARCHAR(50) UNIQUE,
    cliente_id INTEGER REFERENCES clientes(id),
    reserva_id INTEGER REFERENCES reservas(id),
    proyecto VARCHAR(100),
    fecha_pago DATE NOT NULL,
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago VARCHAR(20) NOT NULL,
    referencia VARCHAR(100),
    banco VARCHAR(100),
    concepto TEXT NOT NULL,
    notas TEXT,
    estado VARCHAR(20) DEFAULT 'PENDIENTE',
    usuario VARCHAR(100) NOT NULL,
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de auditoría
CREATE TABLE auditoria (
    id SERIAL PRIMARY KEY,
    tabla VARCHAR(50) NOT NULL,
    registro_id INTEGER NOT NULL,
    accion VARCHAR(20) NOT NULL CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE')),
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario VARCHAR(100) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para optimizar búsquedas
CREATE INDEX idx_clientes_identificacion ON clientes(identificacion);
CREATE INDEX idx_clientes_email ON clientes(email);
CREATE INDEX idx_productos_codigo ON productos(codigo);
CREATE INDEX idx_productos_tipo ON productos(tipo);
CREATE INDEX idx_reservas_codigo ON reservas(codigo);
CREATE INDEX idx_reservas_cliente_id ON reservas(cliente_id);
CREATE INDEX idx_reservas_fecha_entrada ON reservas(fecha_entrada);
CREATE INDEX idx_pagos_codigo ON pagos(codigo);
CREATE INDEX idx_pagos_recibo ON pagos(recibo);
CREATE INDEX idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX idx_auditoria_tabla_registro ON auditoria(tabla, registro_id);

-- Función para actualizar fecha_editado automáticamente
CREATE OR REPLACE FUNCTION update_fecha_editado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_editado = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para actualizar fecha_editado
CREATE TRIGGER trigger_update_tipos_productos_fecha_editado
    BEFORE UPDATE ON tipos_productos
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_suplidores_fecha_editado
    BEFORE UPDATE ON suplidores
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_colaboradores_fecha_editado
    BEFORE UPDATE ON colaboradores
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_clientes_fecha_editado
    BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_productos_fecha_editado
    BEFORE UPDATE ON productos
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_reservas_fecha_editado
    BEFORE UPDATE ON reservas
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

CREATE TRIGGER trigger_update_pagos_fecha_editado
    BEFORE UPDATE ON pagos
    FOR EACH ROW EXECUTE FUNCTION update_fecha_editado();

-- Función de auditoría
CREATE OR REPLACE FUNCTION audit_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO auditoria (tabla, registro_id, accion, datos_anteriores, usuario)
        VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), current_user);
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO auditoria (tabla, registro_id, accion, datos_anteriores, datos_nuevos, usuario)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), current_user);
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO auditoria (tabla, registro_id, accion, datos_nuevos, usuario)
        VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), current_user);
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers de auditoría para todas las tablas principales
CREATE TRIGGER audit_clientes
    AFTER INSERT OR UPDATE OR DELETE ON clientes
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_productos
    AFTER INSERT OR UPDATE OR DELETE ON productos
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_reservas
    AFTER INSERT OR UPDATE OR DELETE ON reservas
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_pagos
    AFTER INSERT OR UPDATE OR DELETE ON pagos
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();

CREATE TRIGGER audit_suplidores
    AFTER INSERT OR UPDATE OR DELETE ON suplidores
    FOR EACH ROW EXECUTE FUNCTION audit_trigger();
