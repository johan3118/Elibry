-- Crear tabla de colaboradores/vendedores para el dropdown de Referido Por
CREATE TABLE IF NOT EXISTS colaboradores (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(200) NOT NULL,
  apellido VARCHAR(200) NOT NULL, -- Updated to match existing table schema with apellido column
  tipo VARCHAR(50) NOT NULL DEFAULT 'VENDEDOR', -- VENDEDOR, REFERIDOR, AGENTE
  comision DECIMAL(5, 2) DEFAULT 0,
  email VARCHAR(200),
  telefono VARCHAR(50),
  notas TEXT,
  activo BOOLEAN DEFAULT TRUE, -- Updated to match existing table schema with activo column
  status VARCHAR(20) DEFAULT 'ACTIVO',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insertar datos de ejemplo
INSERT INTO colaboradores (nombre, apellido, tipo, comision, email, telefono, activo, status) VALUES
  ('María', 'González', 'VENDEDOR', 5.00, 'maria@ejemplo.com', '(809) 123-4567', true, 'ACTIVO'),
  ('Carlos', 'Rodríguez', 'AGENTE', 3.00, 'carlos@ejemplo.com', '(809) 987-6543', true, 'ACTIVO'),
  ('Laura', 'Fernández', 'REFERIDOR', 2.00, 'laura@ejemplo.com', '(809) 555-1234', true, 'ACTIVO'),
  ('Pedro', 'Martínez', 'VENDEDOR', 4.50, 'pedro@ejemplo.com', '(809) 444-5678', true, 'ACTIVO'),
  ('Ana', 'Díaz', 'AGENTE', 3.50, 'ana@ejemplo.com', '(809) 333-9012', true, 'ACTIVO')
ON CONFLICT DO NOTHING;

-- Crear índice para búsquedas
CREATE INDEX IF NOT EXISTS idx_colaboradores_status ON colaboradores(status);
CREATE INDEX IF NOT EXISTS idx_colaboradores_tipo ON colaboradores(tipo);
