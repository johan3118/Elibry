-- Crear tabla para detalles de reserva (múltiples líneas por reserva)
CREATE TABLE IF NOT EXISTS reserva_detalles (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER NOT NULL REFERENCES reservas(id) ON DELETE CASCADE,
    concepto VARCHAR(200) NOT NULL, -- Ej: "Habitación Doble", "Habitación Triple", "Niños"
    descripcion TEXT, -- Descripción detallada del servicio
    cantidad INTEGER DEFAULT 1, -- Cantidad de este servicio
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0, -- cantidad * precio_unitario - descuento
    total DECIMAL(10,2) NOT NULL DEFAULT 0, -- subtotal + impuestos
    noches INTEGER DEFAULT 1, -- Para servicios de hospedaje
    pasajeros INTEGER DEFAULT 1, -- Pasajeros que aplican a este servicio
    registrado_por VARCHAR(100) DEFAULT 'Sistema',
    fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Relación con reservas
    -- CONSTRAINT fk_reserva_detalles_reserva 
    --     FOREIGN KEY (reserva_id) REFERENCES reservas(id) 
    --     ON DELETE CASCADE
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_reserva_detalles_reserva_id ON reserva_detalles(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_detalles_concepto ON reserva_detalles(concepto);

-- Insertar datos de ejemplo solo si la tabla está vacía
INSERT INTO reserva_detalles (reserva_id, concepto, descripcion, cantidad, precio_unitario, descuento, subtotal, total, noches, pasajeros)
SELECT 
    1, 'Habitación Doble', 'Habitación doble con vista al mar', 1, 150.00, 0.00, 150.00, 150.00, 3, 2
WHERE NOT EXISTS (SELECT 1 FROM reserva_detalles LIMIT 1);

INSERT INTO reserva_detalles (reserva_id, concepto, descripcion, cantidad, precio_unitario, descuento, subtotal, total, noches, pasajeros)
SELECT 
    1, 'Habitación Triple', 'Habitación triple estándar', 1, 200.00, 20.00, 180.00, 180.00, 3, 3
WHERE NOT EXISTS (SELECT 1 FROM reserva_detalles WHERE reserva_id = 1 AND concepto = 'Habitación Triple');

INSERT INTO reserva_detalles (reserva_id, concepto, descripcion, cantidad, precio_unitario, descuento, subtotal, total, noches, pasajeros)
SELECT 
    1, 'Niños', 'Tarifa especial para niños', 1, 50.00, 0.00, 50.00, 50.00, 3, 2
WHERE NOT EXISTS (SELECT 1 FROM reserva_detalles WHERE reserva_id = 1 AND concepto = 'Niños');

-- Función para actualizar totales de reserva cuando se modifican los detalles
CREATE OR REPLACE FUNCTION actualizar_totales_reserva()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar totales en la tabla reservas basado en la suma de detalles
    UPDATE reservas 
    SET 
        precio_total = (
            SELECT COALESCE(SUM(total), 0) 
            FROM reserva_detalles 
            WHERE reserva_id = COALESCE(NEW.reserva_id, OLD.reserva_id)
        ),
        impuestos = (
            SELECT COALESCE(SUM(impuestos), 0) 
            FROM reserva_detalles 
            WHERE reserva_id = COALESCE(NEW.reserva_id, OLD.reserva_id)
        ),
        descuento = (
            SELECT COALESCE(SUM(descuento), 0) 
            FROM reserva_detalles 
            WHERE reserva_id = COALESCE(NEW.reserva_id, OLD.reserva_id)
        ),
        fecha_editado = CURRENT_TIMESTAMP
    WHERE id = COALESCE(NEW.reserva_id, OLD.reserva_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar automáticamente fecha_actualizado
CREATE OR REPLACE FUNCTION update_reserva_detalles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizado = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Crear triggers para mantener sincronizados los totales
DROP TRIGGER IF EXISTS trigger_actualizar_totales_insert ON reserva_detalles;
DROP TRIGGER IF EXISTS trigger_actualizar_totales_update ON reserva_detalles;
DROP TRIGGER IF EXISTS trigger_actualizar_totales_delete ON reserva_detalles;

CREATE TRIGGER trigger_actualizar_totales_insert
    AFTER INSERT ON reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_totales_reserva();

CREATE TRIGGER trigger_actualizar_totales_update
    AFTER UPDATE ON reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_totales_reserva();

CREATE TRIGGER trigger_actualizar_totales_delete
    AFTER DELETE ON reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_totales_reserva();

CREATE TRIGGER update_reserva_detalles_updated_at
    BEFORE UPDATE ON reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION update_reserva_detalles_updated_at();

-- Comentarios para documentación
COMMENT ON TABLE reserva_detalles IS 'Detalles de servicios para cada reserva - permite múltiples servicios por reserva';
COMMENT ON COLUMN reserva_detalles.reserva_id IS 'ID de la reserva principal';
COMMENT ON COLUMN reserva_detalles.concepto IS 'Tipo de servicio (Habitación Doble, Triple, Niños, etc.)';
COMMENT ON COLUMN reserva_detalles.descripcion IS 'Descripción detallada del servicio';
COMMENT ON COLUMN reserva_detalles.cantidad IS 'Cantidad del servicio (por defecto 1)';
COMMENT ON COLUMN reserva_detalles.precio_unitario IS 'Precio por unidad del servicio';
COMMENT ON COLUMN reserva_detalles.descuento IS 'Descuento aplicado al servicio';
COMMENT ON COLUMN reserva_detalles.subtotal IS 'Precio unitario menos descuento';
COMMENT ON COLUMN reserva_detalles.total IS 'Total final del servicio';
COMMENT ON COLUMN reserva_detalles.noches IS 'Número de noches para este servicio';
COMMENT ON COLUMN reserva_detalles.pasajeros IS 'Número de pasajeros para este servicio específico';
