-- Actualizar estructura de tabla clientes según especificaciones
DROP TABLE IF EXISTS clientes CASCADE;

CREATE TABLE clientes (
    id SERIAL PRIMARY KEY,
    tipo_cliente VARCHAR(20) NOT NULL CHECK (tipo_cliente IN ('EMPRESA', 'NORMAL')),
    compania VARCHAR(50) NOT NULL CHECK (compania IN ('MARCA 1', 'MARCA 2')),
    
    -- Campos para EMPRESA
    rnc VARCHAR(20),
    razon_social VARCHAR(200),
    nombre_comercial VARCHAR(200),
    responsable VARCHAR(200),
    
    -- Campos para NORMAL
    identificacion VARCHAR(20),
    nombre_completo VARCHAR(200),
    sexo VARCHAR(20) CHECK (sexo IN ('FEMENINO', 'MASCULINO', 'OTROS', 'N/A')),
    fecha_nacimiento DATE,
    
    -- Campos comunes
    telefonos VARCHAR(200) NOT NULL,
    email VARCHAR(200) NOT NULL,
    direccion TEXT NOT NULL,
    observacion TEXT,
    referido_por VARCHAR(200),
    registrado_por VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'INACTIVO')),
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    editado_por VARCHAR(200),
    
    -- Constraints
    CONSTRAINT chk_empresa_fields CHECK (
        (tipo_cliente = 'EMPRESA' AND rnc IS NOT NULL AND razon_social IS NOT NULL AND nombre_comercial IS NOT NULL AND responsable IS NOT NULL) OR
        (tipo_cliente = 'NORMAL' AND identificacion IS NOT NULL AND nombre_completo IS NOT NULL AND sexo IS NOT NULL)
    )
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_clientes_tipo ON clientes(tipo_cliente);
CREATE INDEX idx_clientes_compania ON clientes(compania);
CREATE INDEX idx_clientes_status ON clientes(status);
CREATE INDEX idx_clientes_rnc ON clientes(rnc) WHERE rnc IS NOT NULL;
CREATE INDEX idx_clientes_identificacion ON clientes(identificacion) WHERE identificacion IS NOT NULL;
CREATE INDEX idx_clientes_email ON clientes(email);

-- Trigger para actualizar fecha_editado
CREATE OR REPLACE FUNCTION update_fecha_editado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_editado = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_clientes_fecha_editado
    BEFORE UPDATE ON clientes
    FOR EACH ROW
    EXECUTE FUNCTION update_fecha_editado();

-- Insertar datos de ejemplo
INSERT INTO clientes (
    tipo_cliente, compania, rnc, razon_social, nombre_comercial, responsable,
    telefonos, email, direccion, observacion, referido_por, registrado_por, status
) VALUES 
(
    'EMPRESA', 'MARCA 1', '131-12345-6', 'Constructora del Norte SRL', 'Norte Construcciones',
    'María González', '809-555-0001, 809-555-0002', 'info@norteconstrucciones.com',
    'Av. Winston Churchill #123, Santo Domingo', 'Cliente corporativo importante',
    'Carlos Vendedor', 'Sistema', 'ACTIVO'
),
(
    'EMPRESA', 'MARCA 2', '131-54321-9', 'Inversiones Turísticas del Caribe SRL', 'Caribe Inversiones',
    'Roberto Martínez', '809-555-0003, 809-555-0004', 'contacto@caribeinversiones.com',
    'Calle El Conde #45, Zona Colonial', 'Especializado en turismo',
    'Ana Vendedora', 'Sistema', 'ACTIVO'
);

INSERT INTO clientes (
    tipo_cliente, compania, identificacion, nombre_completo, sexo, fecha_nacimiento,
    telefonos, email, direccion, observacion, referido_por, registrado_por, status
) VALUES 
(
    'NORMAL', 'MARCA 1', '001-1234567-8', 'Juan Carlos Pérez Martínez', 'MASCULINO', '1985-05-15',
    '809-555-1001, 809-555-1002', 'juan.perez@email.com', 'Calle Principal #123, Santo Domingo',
    'Cliente frecuente', 'Luis Colaborador', 'Sistema', 'ACTIVO'
),
(
    'NORMAL', 'MARCA 2', '001-9876543-2', 'María Elena García López', 'FEMENINO', '1990-08-22',
    '809-555-2001', 'maria.garcia@email.com', 'Av. Independencia #456, Santiago',
    'Referida por cliente anterior', 'Carmen Vendedora', 'Sistema', 'ACTIVO'
),
(
    'NORMAL', 'MARCA 1', '001-5555555-5', 'Pedro Antonio Rodríguez', 'MASCULINO', '1978-12-03',
    '809-555-3001', 'pedro.rodriguez@email.com', 'Calle Duarte #789, La Vega',
    NULL, 'Miguel Colaborador', 'Sistema', 'ACTIVO'
);
