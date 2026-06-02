-- Agregar campos de estado provisional a todas las tablas principales

-- Tabla clientes
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE',
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100),
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP,
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT; -- JSON con IDs de registros dependientes

-- Tabla productos  
ALTER TABLE productos
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE',
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100),
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP,
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT;

-- Tabla suplidores
ALTER TABLE suplidores
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE', 
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100),
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP,
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT;

-- Tabla reservas
ALTER TABLE reservas
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE',
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100), 
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP,
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT;

-- Tabla pagos
ALTER TABLE pagos
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE',
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100),
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP, 
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT;

-- Tabla reserva_detalles
ALTER TABLE reserva_detalles
ADD COLUMN IF NOT EXISTS estado_registro VARCHAR(20) DEFAULT 'PERMANENTE',
ADD COLUMN IF NOT EXISTS usuario_creacion VARCHAR(100),
ADD COLUMN IF NOT EXISTS fecha_provisional TIMESTAMP,
ADD COLUMN IF NOT EXISTS dependencias_ids TEXT;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_clientes_estado_registro ON clientes(estado_registro);
CREATE INDEX IF NOT EXISTS idx_productos_estado_registro ON productos(estado_registro);
CREATE INDEX IF NOT EXISTS idx_suplidores_estado_registro ON suplidores(estado_registro);
CREATE INDEX IF NOT EXISTS idx_reservas_estado_registro ON reservas(estado_registro);
CREATE INDEX IF NOT EXISTS idx_pagos_estado_registro ON pagos(estado_registro);
CREATE INDEX IF NOT EXISTS idx_reserva_detalles_estado_registro ON reserva_detalles(estado_registro);

-- Comentarios para documentar los estados posibles
COMMENT ON COLUMN clientes.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN productos.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN suplidores.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN reservas.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN pagos.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
COMMENT ON COLUMN reserva_detalles.estado_registro IS 'PERMANENTE, PROVISIONAL, MODIFICADO, ELIMINADO';
