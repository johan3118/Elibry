-- Eliminar tabla anterior si existe
DROP TABLE IF EXISTS comprobantes_fiscales CASCADE;
DROP VIEW IF EXISTS v_comprobantes_fiscales CASCADE;

-- Crear tabla para gestionar los comprobantes fiscales disponibles de la empresa
CREATE TABLE IF NOT EXISTS comprobantes_disponibles (
    id SERIAL PRIMARY KEY,
    tipo_comprobante VARCHAR(2) NOT NULL,
    serie VARCHAR(4) NOT NULL,
    numero_inicial BIGINT NOT NULL,
    numero_final BIGINT NOT NULL,
    numero_actual BIGINT NOT NULL,
    fecha_autorizacion DATE NOT NULL,
    fecha_vencimiento DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',
    observaciones TEXT,
    usuario_registro VARCHAR(100),
    fecha_registro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    usuario_modificacion VARCHAR(100),
    fecha_modificacion TIMESTAMP,
    
    CONSTRAINT chk_tipo_comprobante CHECK (tipo_comprobante IN ('01', '02', '03', '04', '11', '12', '13', '14', '15', '16', '17')),
    CONSTRAINT chk_estado CHECK (estado IN ('ACTIVO', 'AGOTADO', 'VENCIDO', 'SUSPENDIDO')),
    CONSTRAINT chk_numeros CHECK (numero_inicial <= numero_final AND numero_actual >= numero_inicial AND numero_actual <= numero_final),
    CONSTRAINT uk_tipo_serie UNIQUE (tipo_comprobante, serie, numero_inicial)
);

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_comprobantes_tipo ON comprobantes_disponibles(tipo_comprobante);
CREATE INDEX IF NOT EXISTS idx_comprobantes_estado ON comprobantes_disponibles(estado);
CREATE INDEX IF NOT EXISTS idx_comprobantes_vencimiento ON comprobantes_disponibles(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_comprobantes_serie ON comprobantes_disponibles(serie);

-- Crear vista para obtener información completa
CREATE OR REPLACE VIEW v_comprobantes_disponibles AS
SELECT 
    cd.*,
    CASE cd.tipo_comprobante
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
    END as tipo_descripcion,
    (numero_final - numero_inicial + 1) as total_comprobantes,
    (numero_actual - numero_inicial) as comprobantes_usados,
    (numero_final - numero_actual) as comprobantes_disponibles,
    ROUND(((numero_actual - numero_inicial) * 100.0 / (numero_final - numero_inicial + 1)), 2) as porcentaje_usado,
    CONCAT(cd.serie, LPAD(cd.numero_actual::text, 8, '0')) as proximo_ncf
FROM comprobantes_disponibles cd;

-- Insertar datos de ejemplo (bloques de comprobantes típicos)
INSERT INTO comprobantes_disponibles (
    tipo_comprobante, serie, numero_inicial, numero_final, numero_actual,
    fecha_autorizacion, fecha_vencimiento, estado, observaciones, usuario_registro
) VALUES 
-- Facturas de Crédito Fiscal
(
    '01', 'B010', 1000001, 1000500, 1000001,
    '2025-01-01', '2025-12-31', 'ACTIVO', 
    'Bloque de facturas de crédito fiscal para el año 2025', 'admin'
),
-- Facturas de Consumo
(
    '02', 'B020', 2000001, 2001000, 2000001,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Bloque de facturas de consumo para el año 2025', 'admin'
),
-- Notas de Débito
(
    '03', 'B030', 3000001, 3000100, 3000001,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Bloque de notas de débito para el año 2025', 'admin'
),
-- Notas de Crédito
(
    '04', 'B040', 4000001, 4000100, 4000001,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Bloque de notas de crédito para el año 2025', 'admin'
),
-- Comprobantes de Compras
(
    '11', 'B110', 5000001, 5000200, 5000001,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Bloque de comprobantes de compras para el año 2025', 'admin'
),
-- Comprobantes para Gastos Menores
(
    '13', 'B130', 6000001, 6000050, 6000001,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Bloque de comprobantes para gastos menores', 'admin'
),
-- Ejemplo de bloque parcialmente usado
(
    '01', 'B011', 1000501, 1001000, 1000525,
    '2025-01-01', '2025-12-31', 'ACTIVO',
    'Segundo bloque de facturas de crédito fiscal - parcialmente usado', 'admin'
),
-- Ejemplo de bloque agotado
(
    '02', 'B021', 2001001, 2001100, 2001100,
    '2024-01-01', '2024-12-31', 'AGOTADO',
    'Bloque anterior completamente utilizado', 'admin'
);

-- Función para obtener el próximo NCF disponible
CREATE OR REPLACE FUNCTION obtener_proximo_ncf(p_tipo_comprobante VARCHAR(2))
RETURNS VARCHAR(12) AS $$
DECLARE
    v_record RECORD;
    v_ncf VARCHAR(12);
BEGIN
    -- Buscar el primer bloque activo con comprobantes disponibles
    SELECT * INTO v_record
    FROM comprobantes_disponibles
    WHERE tipo_comprobante = p_tipo_comprobante
      AND estado = 'ACTIVO'
      AND numero_actual <= numero_final
      AND fecha_vencimiento >= CURRENT_DATE
    ORDER BY numero_actual
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN NULL; -- No hay comprobantes disponibles
    END IF;
    
    -- Generar el NCF
    v_ncf := v_record.serie || LPAD(v_record.numero_actual::text, 8, '0');
    
    -- Incrementar el número actual
    UPDATE comprobantes_disponibles
    SET numero_actual = numero_actual + 1,
        fecha_modificacion = CURRENT_TIMESTAMP,
        usuario_modificacion = 'sistema'
    WHERE id = v_record.id;
    
    -- Si se agotó el bloque, marcarlo como agotado
    IF v_record.numero_actual = v_record.numero_final THEN
        UPDATE comprobantes_disponibles
        SET estado = 'AGOTADO',
            fecha_modificacion = CURRENT_TIMESTAMP,
            usuario_modificacion = 'sistema'
        WHERE id = v_record.id;
    END IF;
    
    RETURN v_ncf;
END;
$$ LANGUAGE plpgsql;

-- Comentarios sobre la tabla
COMMENT ON TABLE comprobantes_disponibles IS 'Tabla para gestionar los bloques de comprobantes fiscales (NCF) disponibles para la empresa';
COMMENT ON COLUMN comprobantes_disponibles.tipo_comprobante IS 'Código del tipo de comprobante según DGII';
COMMENT ON COLUMN comprobantes_disponibles.serie IS 'Serie del comprobante (ej: B010, B020, etc.)';
COMMENT ON COLUMN comprobantes_disponibles.numero_inicial IS 'Primer número del bloque autorizado';
COMMENT ON COLUMN comprobantes_disponibles.numero_final IS 'Último número del bloque autorizado';
COMMENT ON COLUMN comprobantes_disponibles.numero_actual IS 'Próximo número a utilizar';
COMMENT ON COLUMN comprobantes_disponibles.fecha_autorizacion IS 'Fecha en que fue autorizado el bloque por DGII';
COMMENT ON COLUMN comprobantes_disponibles.fecha_vencimiento IS 'Fecha de vencimiento del bloque';
