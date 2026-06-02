-- Crear tabla de pagos si no existe
CREATE TABLE IF NOT EXISTS pagos (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER REFERENCES reservas(id),
    cliente_id INTEGER REFERENCES clientes(id),
    numero_recibo VARCHAR(50) UNIQUE NOT NULL,
    monto DECIMAL(10,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    referencia VARCHAR(100),
    banco VARCHAR(100),
    concepto TEXT NOT NULL,
    notas TEXT,
    fecha_pago DATE NOT NULL,
    estado VARCHAR(20) DEFAULT 'completado',
    creado_por VARCHAR(100),
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_pagos_reserva_id ON pagos(reserva_id);
CREATE INDEX IF NOT EXISTS idx_pagos_cliente_id ON pagos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos(fecha_pago);
CREATE INDEX IF NOT EXISTS idx_pagos_numero_recibo ON pagos(numero_recibo);

-- Trigger para actualizar timestamp
CREATE OR REPLACE FUNCTION update_pagos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pagos_timestamp
    BEFORE UPDATE ON pagos
    FOR EACH ROW
    EXECUTE FUNCTION update_pagos_timestamp();

-- Comentarios para documentación
COMMENT ON TABLE pagos IS 'Tabla para almacenar todos los pagos realizados';
COMMENT ON COLUMN pagos.numero_recibo IS 'Número único del recibo generado';
COMMENT ON COLUMN pagos.metodo_pago IS 'Método utilizado: efectivo, transferencia, cheque, tarjeta';
COMMENT ON COLUMN pagos.estado IS 'Estado del pago: completado, cancelado, reembolsado';
