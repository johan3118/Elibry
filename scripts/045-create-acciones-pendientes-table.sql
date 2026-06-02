-- Crear tabla de acciones pendientes para el sistema de administración
CREATE TABLE IF NOT EXISTS acciones_pendientes (
    id SERIAL PRIMARY KEY,
    tipo_accion VARCHAR(50) NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE'
    modulo VARCHAR(50) NOT NULL, -- 'clientes', 'productos', 'reservas', etc.
    tabla_objetivo VARCHAR(50) NOT NULL, -- nombre de la tabla afectada
    registro_id INTEGER, -- ID del registro afectado (null para CREATE)
    datos_nuevos JSONB, -- datos nuevos o a crear
    datos_anteriores JSONB, -- datos anteriores (para UPDATE/DELETE)
    descripcion TEXT NOT NULL, -- descripción legible de la acción
    usuario_solicitante VARCHAR(100) NOT NULL, -- quien solicita la acción
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'PENDIENTE' CHECK (estado IN ('PENDIENTE', 'APROBADO', 'RECHAZADO')),
    fecha_procesamiento TIMESTAMP,
    usuario_procesamiento VARCHAR(100), -- admin que procesa
    notas_procesamiento TEXT, -- notas del admin al procesar
    resultado_procesamiento JSONB -- datos del resultado si es exitoso
);

-- Índices para optimización
CREATE INDEX IF NOT EXISTS idx_acciones_pendientes_estado ON acciones_pendientes(estado);
CREATE INDEX IF NOT EXISTS idx_acciones_pendientes_modulo ON acciones_pendientes(modulo);
CREATE INDEX IF NOT EXISTS idx_acciones_pendientes_fecha ON acciones_pendientes(fecha_solicitud);
CREATE INDEX IF NOT EXISTS idx_acciones_pendientes_usuario ON acciones_pendientes(usuario_solicitante);

-- Función para registrar acciones pendientes
CREATE OR REPLACE FUNCTION registrar_accion_pendiente(
    p_tipo_accion VARCHAR(50),
    p_modulo VARCHAR(50),
    p_tabla_objetivo VARCHAR(50),
    p_registro_id INTEGER DEFAULT NULL,
    p_datos_nuevos JSONB DEFAULT NULL,
    p_datos_anteriores JSONB DEFAULT NULL,
    p_descripcion TEXT DEFAULT '',
    p_usuario_solicitante VARCHAR(100) DEFAULT 'Sistema'
) RETURNS INTEGER AS $$
DECLARE
    nueva_accion_id INTEGER;
BEGIN
    INSERT INTO acciones_pendientes (
        tipo_accion,
        modulo,
        tabla_objetivo,
        registro_id,
        datos_nuevos,
        datos_anteriores,
        descripcion,
        usuario_solicitante
    ) VALUES (
        p_tipo_accion,
        p_modulo,
        p_tabla_objetivo,
        p_registro_id,
        p_datos_nuevos,
        p_datos_anteriores,
        p_descripcion,
        p_usuario_solicitante
    ) RETURNING id INTO nueva_accion_id;
    
    RETURN nueva_accion_id;
END;
$$ LANGUAGE plpgsql;

-- Insertar datos de ejemplo para demostración
INSERT INTO acciones_pendientes (tipo_accion, modulo, tabla_objetivo, datos_nuevos, descripcion, usuario_solicitante) VALUES
('CREATE', 'clientes', 'clientes', '{"nombre_completo": "Cliente Demo", "email": "demo@email.com", "telefonos": "809-123-4567", "tipo_cliente": "NORMAL"}', 'Solicitud de creación de nuevo cliente: Cliente Demo', 'operador1'),
('UPDATE', 'productos', 'productos', '{"nombre_producto": "Hotel Paradise Actualizado", "precio": 150.00}', '{"nombre_producto": "Hotel Paradise", "precio": 120.00}', 'Solicitud de actualización de producto ID 5: cambio de precio', 'operador2'),
('CREATE', 'reservas', 'reservas', '{"cliente_id": 1, "producto_id": 2, "fecha_entrada": "2025-02-15", "precio_total": 800.00}', 'Solicitud de nueva reservación para Cliente ID 1', 'operador1'),
('DELETE', 'suplidores', 'suplidores', NULL, '{"razon_social": "Suplidor Inactivo", "status": "INACTIVO"}', 'Solicitud de eliminación de suplidor: Suplidor Inactivo', 'operador3');
