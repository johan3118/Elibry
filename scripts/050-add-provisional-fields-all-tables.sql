-- Agregar campos de estado provisional a todas las tablas principales

-- Productos
ALTER TABLE productos ADD COLUMN IF NOT EXISTS estado_provisional VARCHAR(50) DEFAULT 'PERMANENTE';
ALTER TABLE productos ADD COLUMN IF NOT EXISTS usuario_provisional VARCHAR(100);
ALTER TABLE productos ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP;

-- Reservas
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(50) DEFAULT 'PERMANENTE';
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100);
ALTER TABLE reservas ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP;

-- Reserva Detalles
ALTER TABLE reserva_detalles ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(50) DEFAULT 'PERMANENTE';
ALTER TABLE reserva_detalles ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100);
ALTER TABLE reserva_detalles ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP;

-- Pagos
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER REFERENCES reservas(id),
    cliente_id INTEGER REFERENCES clientes(id),
    monto DECIMAL(12,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    referencia VARCHAR(100),
    fecha_pago DATE NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    notas TEXT,
    estado VARCHAR(50) DEFAULT 'PENDIENTE',
    usuario VARCHAR(100) DEFAULT 'Sistema',
    estado_registro VARCHAR(50) DEFAULT 'PERMANENTE',
    usuario_creacion VARCHAR(100),
    fecha_provisional TIMESTAMP,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Suplidores ya tiene los campos, solo agregar índices si no existen
CREATE INDEX IF NOT EXISTS idx_suplidores_estado_registro ON suplidores(estado_registro);
CREATE INDEX IF NOT EXISTS idx_productos_estado_provisional ON productos(estado_provisional);
CREATE INDEX IF NOT EXISTS idx_reservas_estado_registro ON reservas(estado_registro);
CREATE INDEX IF NOT EXISTS idx_pagos_estado_registro ON pagos(estado_registro);

-- Actualizar registros existentes para marcarlos como permanentes
UPDATE productos SET estado_provisional = 'PERMANENTE' WHERE estado_provisional IS NULL;
UPDATE reservas SET estado_registro = 'PERMANENTE' WHERE estado_registro IS NULL;
UPDATE reserva_detalles SET estado_registro = 'PERMANENTE' WHERE estado_registro IS NULL;
UPDATE suplidores SET estado_registro = 'PERMANENTE' WHERE estado_registro IS NULL;

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_productos_usuario_provisional ON productos(usuario_provisional);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_creacion ON reservas(usuario_creacion);
CREATE INDEX IF NOT EXISTS idx_pagos_usuario_creacion ON pagos(usuario_creacion);
CREATE INDEX IF NOT EXISTS idx_suplidores_usuario_creacion ON suplidores(usuario_creacion);

-- Comentarios para documentar el sistema
COMMENT ON COLUMN productos.estado_provisional IS 'Estado del registro: PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN reservas.estado_registro IS 'Estado del registro: PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN pagos.estado_registro IS 'Estado del registro: PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN suplidores.estado_registro IS 'Estado del registro: PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
