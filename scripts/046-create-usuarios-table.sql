-- Crear tabla de usuarios del sistema
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMIN', 'USER')),
    activo BOOLEAN DEFAULT true,
    ultimo_acceso TIMESTAMP,
    fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_editado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    creado_por VARCHAR(255) DEFAULT 'SISTEMA',
    editado_por VARCHAR(255)
);

-- Insertar usuarios de prueba (en producción usar hashes reales)
INSERT INTO usuarios (email, password_hash, nombre, rol, creado_por) VALUES
('admin@ellibry.com', 'admin123', 'Administrador', 'ADMIN', 'SISTEMA'),
('usuario@ellibry.com', 'user123', 'Usuario Sistema', 'USER', 'SISTEMA')
ON CONFLICT (email) DO NOTHING;

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- Comentarios
COMMENT ON TABLE usuarios IS 'Tabla de usuarios del sistema';
COMMENT ON COLUMN usuarios.email IS 'Email único del usuario';
COMMENT ON COLUMN usuarios.password_hash IS 'Hash de la contraseña';
COMMENT ON COLUMN usuarios.nombre IS 'Nombre completo del usuario';
COMMENT ON COLUMN usuarios.rol IS 'Rol del usuario: ADMIN o USER';
COMMENT ON COLUMN usuarios.activo IS 'Estado del usuario';
COMMENT ON COLUMN usuarios.ultimo_acceso IS 'Fecha del último acceso';
