-- Crear tabla de comprobantes fiscales
CREATE TABLE IF NOT EXISTS comprobantes_fiscales (
    id SERIAL PRIMARY KEY,
    numero_comprobante VARCHAR(50) NOT NULL UNIQUE,
    tipo_comprobante VARCHAR(2) NOT NULL,
    ncf VARCHAR(19),
    fecha_emision DATE NOT NULL,
    fecha_vencimiento DATE,
    proveedor_nombre VARCHAR(255) NOT NULL,
    proveedor_rnc VARCHAR(20) NOT NULL,
    proveedor_direccion TEXT,
    proveedor_telefono VARCHAR(20),
    descripcion TEXT NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    itbis DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    moneda VARCHAR(3) NOT NULL DEFAULT 'DOP',
    tasa_cambio DECIMAL(10,4) DEFAULT 1.0000,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    documento_url VARCHAR(500),
    observaciones TEXT,
    usuario_registro VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_modificacion VARCHAR(100),
    fecha_modificacion TIMESTAMP,
    
    CONSTRAINT chk_tipo_comprobante CHECK (tipo_comprobante IN ('01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17')),
    CONSTRAINT chk_estado CHECK (estado IN ('ACTIVO', 'ANULADO', 'VENCIDO')),
    CONSTRAINT chk_moneda CHECK (moneda IN ('DOP', 'USD', 'EUR')),
    CONSTRAINT chk_subtotal CHECK (subtotal >= 0),
    CONSTRAINT chk_itbis CHECK (itbis >= 0),
    CONSTRAINT chk_total CHECK (total >= 0)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_comprobantes_tipo ON comprobantes_fiscales(tipo_comprobante);
CREATE INDEX IF NOT EXISTS idx_comprobantes_fecha ON comprobantes_fiscales(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_comprobantes_proveedor ON comprobantes_fiscales(proveedor_rnc);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_fiscales(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_ncf ON comprobantes_fiscales(ncf);

-- Crear vista para obtener descripción de tipos
CREATE OR REPLACE VIEW v_comprobantes_fiscales AS
SELECT 
    cf.*,
    CASE cf.tipo_comprobante
        WHEN '01' THEN 'Facturas de Crédito Fiscal'
        WHEN '02' THEN 'Factura de Consumo'
        WHEN '03' THEN 'Nota de Débito'
        WHEN '04' THEN 'Nota de Crédito'
        WHEN '11' THEN 'Comprobante de Compras'
        WHEN '12' THEN 'Comprobante de Registro Único de Ingresos'
        WHEN '13' THEN 'Comprobante para Gastos Menores'
        WHEN '14' THEN 'Comprobante para Regímenes Especiales'
        WHEN '15' THEN 'Comprobante Gubernamental'
        WHEN '16' THEN 'Comprobante para Exportaciones'
        WHEN '17' THEN 'Comprobantes de Pagos al Exterior'
        ELSE 'Tipo Desconocido'
    END as tipo_descripcion
FROM comprobantes_fiscales cf;

-- Insertar datos de ejemplo
INSERT INTO comprobantes_fiscales (
    numero_comprobante, tipo_comprobante, ncf, fecha_emision, fecha_vencimiento,
    proveedor_nombre, proveedor_rnc, proveedor_direccion, proveedor_telefono,
    descripcion, subtotal, itbis, total, moneda, estado, usuario_registro
) VALUES 
(
    'COMP-2025-001', '01', 'B0100000001', '2025-01-15', '2025-02-14',
    'Distribuidora Central S.A.', '131-12345-6', 'Av. 27 de Febrero #123, Santo Domingo', '809-555-0001',
    'Compra de materiales de construcción para proyecto residencial', 
    15000.00, 2700.00, 17700.00, 'DOP', 'ACTIVO', 'admin'
),
(
    'COMP-2025-002', '11', 'B1100000001', '2025-01-18', '2025-02-17',
    'Ferretería El Constructor', '001-98765-4', 'Calle Duarte #456, Santiago', '809-555-0002',
    'Compra de herramientas y equipos menores',
    8500.00, 1530.00, 10030.00, 'DOP', 'ACTIVO', 'admin'
),
(
    'COMP-2025-003', '02', 'B0200000001', '2025-01-20', '2025-02-19',
    'Suplidora Industrial Norte', '131-55555-5', 'Zona Industrial, Santiago', '809-555-0003',
    'Compra de suministros de oficina y consumibles',
    3200.00, 576.00, 3776.00, 'DOP', 'ACTIVO', 'admin'
),
(
    'COMP-2025-004', '13', '', '2025-01-22', '2025-02-21',
    'Combustibles y Servicios RD', '131-77777-7', 'Av. Independencia #789, Santo Domingo', '809-555-0004',
    'Compra de combustible para vehículos de la empresa',
    2500.00, 450.00, 2950.00, 'DOP', 'ACTIVO', 'admin'
),
(
    'COMP-2025-005', '04', 'B0400000001', '2025-01-25', '2025-02-24',
    'Proveedor Internacional LLC', '131-88888-8', 'Zona Franca, Santo Domingo', '809-555-0005',
    'Nota de crédito por devolución de mercancía defectuosa',
    1200.00, 216.00, 1416.00, 'DOP', 'ACTIVO', 'admin'
);

-- Comentarios sobre la tabla
COMMENT ON TABLE comprobantes_fiscales IS 'Tabla para almacenar todos los comprobantes fiscales de la empresa';
COMMENT ON COLUMN comprobantes_fiscales.tipo_comprobante IS 'Código del tipo de comprobante según DGII: 01-Crédito Fiscal, 02-Consumo, etc.';
COMMENT ON COLUMN comprobantes_fiscales.ncf IS 'Número de Comprobante Fiscal (NCF) cuando aplique';
COMMENT ON COLUMN comprobantes_fiscales.tasa_cambio IS 'Tasa de cambio aplicada si la moneda no es DOP';
