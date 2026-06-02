-- Tabla para manejar cambios provisionales y dependencias
CREATE TABLE IF NOT EXISTS cambios_provisionales (
    id SERIAL PRIMARY KEY,
    tabla_afectada VARCHAR(50) NOT NULL,
    registro_id INTEGER NOT NULL,
    tipo_cambio VARCHAR(20) NOT NULL, -- CREATE, UPDATE, DELETE
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    usuario_cambio VARCHAR(100) NOT NULL,
    fecha_cambio TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    estado_cambio VARCHAR(20) DEFAULT 'PENDIENTE', -- PENDIENTE, APROBADO, RECHAZADO
    dependencias JSONB, -- Array de objetos {tabla: string, id: number}
    dependientes JSONB, -- Array de registros que dependen de este
    notas_admin TEXT,
    procesado_por VARCHAR(100),
    fecha_procesamiento TIMESTAMP,
    orden_procesamiento INTEGER DEFAULT 0 -- Para manejar el orden de aprobación/rollback
);

-- Índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_cambios_provisionales_tabla_registro ON cambios_provisionales(tabla_afectada, registro_id);
CREATE INDEX IF NOT EXISTS idx_cambios_provisionales_usuario ON cambios_provisionales(usuario_cambio);
CREATE INDEX IF NOT EXISTS idx_cambios_provisionales_estado ON cambios_provisionales(estado_cambio);
CREATE INDEX IF NOT EXISTS idx_cambios_provisionales_fecha ON cambios_provisionales(fecha_cambio);
CREATE INDEX IF NOT EXISTS idx_cambios_provisionales_orden ON cambios_provisionales(orden_procesamiento);

-- Función para calcular dependencias automáticamente
CREATE OR REPLACE FUNCTION calcular_dependencias(tabla_name VARCHAR, registro_id INTEGER)
RETURNS JSONB AS $$
DECLARE
    dependencias JSONB := '[]'::JSONB;
    dependientes JSONB := '[]'::JSONB;
BEGIN
    -- Calcular dependencias según la tabla
    CASE tabla_name
        WHEN 'clientes' THEN
            -- Un cliente puede tener reservas y pagos
            SELECT COALESCE(jsonb_agg(jsonb_build_object('tabla', 'reservas', 'id', id)), '[]'::JSONB)
            INTO dependientes
            FROM reservas WHERE cliente_id = registro_id;
            
        WHEN 'productos' THEN
            -- Un producto puede tener reservas
            SELECT COALESCE(jsonb_agg(jsonb_build_object('tabla', 'reservas', 'id', id)), '[]'::JSONB)
            INTO dependientes  
            FROM reservas WHERE producto_id = registro_id;
            
        WHEN 'suplidores' THEN
            -- Un suplidor puede tener productos
            SELECT COALESCE(jsonb_agg(jsonb_build_object('tabla', 'productos', 'id', id)), '[]'::JSONB)
            INTO dependientes
            FROM productos WHERE suplidor_id = registro_id;
            
        WHEN 'reservas' THEN
            -- Una reserva depende de cliente y producto, puede tener pagos y detalles
            SELECT jsonb_build_array(
                jsonb_build_object('tabla', 'clientes', 'id', cliente_id),
                jsonb_build_object('tabla', 'productos', 'id', producto_id)
            ) INTO dependencias
            FROM reservas WHERE id = registro_id;
            
            SELECT COALESCE(jsonb_agg(jsonb_build_object('tabla', 'pagos', 'id', id)), '[]'::JSONB)
            INTO dependientes
            FROM pagos WHERE reserva_id = registro_id;
            
        WHEN 'pagos' THEN
            -- Un pago depende de una reserva
            SELECT jsonb_build_array(
                jsonb_build_object('tabla', 'reservas', 'id', reserva_id)
            ) INTO dependencias
            FROM pagos WHERE id = registro_id;
    END CASE;
    
    RETURN jsonb_build_object('dependencias', dependencias, 'dependientes', dependientes);
END;
$$ LANGUAGE plpgsql;
