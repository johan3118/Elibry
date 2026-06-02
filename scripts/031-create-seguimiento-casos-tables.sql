-- Crear tabla de seguimiento de casos externos
CREATE TABLE IF NOT EXISTS seguimiento_casos (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    email_distribuidor VARCHAR(255) NOT NULL,
    nombre_distribuidor VARCHAR(255) NOT NULL,
    empresa_distribuidor VARCHAR(255),
    telefono_distribuidor VARCHAR(50),
    prioridad VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    estado VARCHAR(30) DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'EN_PROCESO', 'PENDIENTE_RESPUESTA', 'CERRADO')),
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por VARCHAR(100) DEFAULT 'Sistema',
    cerrado_por VARCHAR(100),
    fecha_cierre TIMESTAMP
);

-- Crear tabla de comentarios/seguimiento
CREATE TABLE IF NOT EXISTS seguimiento_comentarios (
    id SERIAL PRIMARY KEY,
    caso_id INTEGER REFERENCES seguimiento_casos(id) ON DELETE CASCADE,
    tipo VARCHAR(30) DEFAULT 'COMENTARIO' CHECK (tipo IN ('COMENTARIO', 'EMAIL_ENVIADO', 'EMAIL_RECIBIDO', 'LLAMADA', 'NOTA_INTERNA')),
    comentario TEXT NOT NULL,
    usuario VARCHAR(100) DEFAULT 'Sistema',
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_seguimiento_casos_estado ON seguimiento_casos(estado);
CREATE INDEX IF NOT EXISTS idx_seguimiento_casos_prioridad ON seguimiento_casos(prioridad);
CREATE INDEX IF NOT EXISTS idx_seguimiento_casos_email ON seguimiento_casos(email_distribuidor);
CREATE INDEX IF NOT EXISTS idx_seguimiento_comentarios_caso ON seguimiento_comentarios(caso_id);

-- Trigger para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION update_seguimiento_casos_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_seguimiento_casos_timestamp
    BEFORE UPDATE ON seguimiento_casos
    FOR EACH ROW
    EXECUTE FUNCTION update_seguimiento_casos_timestamp();

-- Insertar datos de ejemplo
INSERT INTO seguimiento_casos (titulo, descripcion, email_distribuidor, nombre_distribuidor, empresa_distribuidor, telefono_distribuidor, prioridad, estado, creado_por) VALUES
('Consulta sobre paquetes turísticos 2025', 'Distribuidor solicita información sobre nuevos paquetes para la temporada 2025', 'ventas@caribetours.com', 'María González', 'Caribe Tours', '(809) 555-0123', 'ALTA', 'ABIERTO', 'Juan Pérez'),
('Problema técnico con sistema de reservas', 'Reportan errores al procesar reservaciones en línea', 'soporte@viajesmundo.com', 'Carlos Rodríguez', 'Viajes Mundo', '(809) 555-0456', 'URGENTE', 'EN_PROCESO', 'Ana Martínez'),
('Solicitud de comisiones especiales', 'Petición de comisiones preferenciales para grupo corporativo', 'admin@turismoplus.com', 'Laura Fernández', 'Turismo Plus', '(809) 555-0789', 'MEDIA', 'PENDIENTE_RESPUESTA', 'Pedro López'),
('Actualización de tarifas hoteleras', 'Solicitan actualización de tarifas para hoteles en Punta Cana', 'reservas@dominicanatravel.com', 'Roberto Jiménez', 'Dominicana Travel', '(809) 555-0321', 'BAJA', 'CERRADO', 'María García');

-- Insertar comentarios de ejemplo
INSERT INTO seguimiento_comentarios (caso_id, tipo, comentario, usuario) VALUES
(1, 'COMENTARIO', 'Cliente interesado en paquetes todo incluido para familias', 'Juan Pérez'),
(1, 'EMAIL_ENVIADO', 'Enviado catálogo de paquetes 2025 con precios especiales', 'Juan Pérez'),
(2, 'LLAMADA', 'Llamada telefónica para diagnosticar el problema técnico', 'Ana Martínez'),
(2, 'NOTA_INTERNA', 'Escalado a equipo técnico para revisión del sistema', 'Ana Martínez'),
(3, 'EMAIL_RECIBIDO', 'Recibida documentación del grupo corporativo', 'Pedro López'),
(4, 'COMENTARIO', 'Caso resuelto satisfactoriamente, tarifas actualizadas', 'María García');
