-- Script para crear/actualizar tablas de seguimiento de casos
-- Maneja casos donde las tablas pueden existir parcialmente

-- Primero, eliminar las tablas si existen para empezar limpio
DROP TABLE IF EXISTS seguimiento_comentarios CASCADE;
DROP TABLE IF EXISTS seguimiento_casos CASCADE;

-- Crear tabla seguimiento_casos
CREATE TABLE seguimiento_casos (
    id SERIAL PRIMARY KEY,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    email_distribuidor VARCHAR(255) NOT NULL,
    nombre_distribuidor VARCHAR(255) NOT NULL,
    empresa_distribuidor VARCHAR(255),
    telefono_distribuidor VARCHAR(50),
    prioridad VARCHAR(20) DEFAULT 'MEDIA' CHECK (prioridad IN ('BAJA', 'MEDIA', 'ALTA', 'URGENTE')),
    estado VARCHAR(30) DEFAULT 'ABIERTO' CHECK (estado IN ('ABIERTO', 'EN_PROCESO', 'PENDIENTE_RESPUESTA', 'CERRADO')),
    creado_por VARCHAR(255) NOT NULL,
    cerrado_por VARCHAR(255),
    fecha_cierre TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Crear tabla seguimiento_comentarios
CREATE TABLE seguimiento_comentarios (
    id SERIAL PRIMARY KEY,
    caso_id INTEGER NOT NULL,
    tipo VARCHAR(30) DEFAULT 'COMENTARIO' CHECK (tipo IN ('COMENTARIO', 'EMAIL_ENVIADO', 'EMAIL_RECIBIDO', 'LLAMADA', 'NOTA_INTERNA')),
    comentario TEXT NOT NULL,
    usuario VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (caso_id) REFERENCES seguimiento_casos(id) ON DELETE CASCADE
);

-- Crear índices para mejor rendimiento
CREATE INDEX idx_seguimiento_casos_estado ON seguimiento_casos(estado);
CREATE INDEX idx_seguimiento_casos_prioridad ON seguimiento_casos(prioridad);
CREATE INDEX idx_seguimiento_casos_created_at ON seguimiento_casos(created_at);
CREATE INDEX idx_seguimiento_comentarios_caso_id ON seguimiento_comentarios(caso_id);
CREATE INDEX idx_seguimiento_comentarios_created_at ON seguimiento_comentarios(created_at);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en seguimiento_casos
CREATE TRIGGER update_seguimiento_casos_updated_at
    BEFORE UPDATE ON seguimiento_casos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insertar datos de ejemplo
INSERT INTO seguimiento_casos (titulo, descripcion, email_distribuidor, nombre_distribuidor, empresa_distribuidor, telefono_distribuidor, prioridad, estado, creado_por) VALUES
('Consulta sobre paquetes turísticos 2025', 'Distribuidor solicita información sobre nuevos paquetes para la temporada 2025', 'ventas@caribetours.com', 'María González', 'Caribe Tours', '(809) 555-0123', 'ALTA', 'ABIERTO', 'Juan Pérez'),
('Problema técnico con sistema de reservas', 'Reportan errores al procesar reservaciones en línea', 'soporte@viajesmundo.com', 'Carlos Rodríguez', 'Viajes Mundo', '(809) 555-0456', 'URGENTE', 'EN_PROCESO', 'Ana Martínez'),
('Solicitud de comisiones especiales', 'Petición de comisiones preferenciales para grupo corporativo', 'admin@turismoplus.com', 'Laura Fernández', 'Turismo Plus', '(809) 555-0789', 'MEDIA', 'PENDIENTE_RESPUESTA', 'Pedro López'),
('Capacitación para nuevo personal', 'Solicitud de capacitación para equipo de ventas recién contratado', 'rrhh@exploradominicana.com', 'Roberto Jiménez', 'Explora Dominicana', '(809) 555-0321', 'MEDIA', 'ABIERTO', 'Carmen Silva'),
('Actualización de catálogo de servicios', 'Necesitan información actualizada sobre servicios disponibles', 'info@aventurascaribe.com', 'Patricia Morales', 'Aventuras Caribe', '(809) 555-0654', 'BAJA', 'CERRADO', 'Miguel Torres');

-- Insertar comentarios de ejemplo
INSERT INTO seguimiento_comentarios (caso_id, tipo, comentario, usuario) VALUES
(1, 'COMENTARIO', 'Cliente interesado en paquetes todo incluido para familias', 'Juan Pérez'),
(1, 'EMAIL_ENVIADO', 'Enviado catálogo de paquetes 2025 con precios especiales', 'Juan Pérez'),
(2, 'LLAMADA', 'Llamada telefónica para diagnosticar el problema técnico', 'Ana Martínez'),
(2, 'EMAIL_ENVIADO', 'Enviadas instrucciones para solución temporal', 'Ana Martínez'),
(3, 'NOTA_INTERNA', 'Revisar políticas de comisiones con gerencia', 'Pedro López'),
(4, 'EMAIL_RECIBIDO', 'Confirmación de fechas disponibles para capacitación', 'Carmen Silva'),
(5, 'EMAIL_ENVIADO', 'Catálogo actualizado enviado por correo electrónico', 'Miguel Torres');

-- Verificar que todo se creó correctamente
SELECT 'Tabla seguimiento_casos creada con ' || COUNT(*) || ' registros' as resultado FROM seguimiento_casos
UNION ALL
SELECT 'Tabla seguimiento_comentarios creada con ' || COUNT(*) || ' registros' as resultado FROM seguimiento_comentarios;
