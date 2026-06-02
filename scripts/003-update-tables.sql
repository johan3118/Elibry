-- Actualizar estructura de tablas para coincidir con los tipos TypeScript

-- Actualizar tabla clientes
ALTER TABLE clientes 
RENAME COLUMN cedula TO identificacion;

-- Agregar columna razon_social si no existe
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS razon_social VARCHAR(255);

-- Actualizar tabla reservas para incluir todos los campos necesarios
ALTER TABLE reservas 
ADD COLUMN IF NOT EXISTS codigo VARCHAR(50) UNIQUE,
ADD COLUMN IF NOT EXISTS cedula_cliente VARCHAR(20),
ADD COLUMN IF NOT EXISTS referido_por VARCHAR(255),
ADD COLUMN IF NOT EXISTS atendido_por VARCHAR(255),
ADD COLUMN IF NOT EXISTS fecha_entrada DATE,
ADD COLUMN IF NOT EXISTS fecha_salida DATE,
ADD COLUMN IF NOT EXISTS hora_entrada TIME,
ADD COLUMN IF NOT EXISTS hora_salida TIME,
ADD COLUMN IF NOT EXISTS pasajeros INTEGER,
ADD COLUMN IF NOT EXISTS habitaciones INTEGER,
ADD COLUMN IF NOT EXISTS precio_unitario DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS descuento DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS impuestos DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS fecha_limite_pago DATE,
ADD COLUMN IF NOT EXISTS fecha_gastos_proveedor DATE,
ADD COLUMN IF NOT EXISTS metodo_pago VARCHAR(50),
ADD COLUMN IF NOT EXISTS abonado_contabilidad VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS proveedor VARCHAR(255),
ADD COLUMN IF NOT EXISTS proforma VARCHAR(100),
ADD COLUMN IF NOT EXISTS comision VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS factura_enviada_cliente VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS factura_recibida_proveedor VARCHAR(10) DEFAULT 'NO',
ADD COLUMN IF NOT EXISTS asientos_bus INTEGER,
ADD COLUMN IF NOT EXISTS grupo VARCHAR(255),
ADD COLUMN IF NOT EXISTS nota_interna_reserva TEXT;

-- Renombrar columnas existentes en reservas si es necesario
ALTER TABLE reservas 
RENAME COLUMN numero_reserva TO codigo;

-- Actualizar restricciones
ALTER TABLE reservas 
ALTER COLUMN pasajeros SET NOT NULL,
ALTER COLUMN precio_unitario SET NOT NULL,
ALTER COLUMN precio_total SET NOT NULL,
ALTER COLUMN atendido_por SET NOT NULL;

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON reservas(codigo);
CREATE INDEX IF NOT EXISTS idx_reservas_cedula_cliente ON reservas(cedula_cliente);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada ON reservas(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_clientes_identificacion ON clientes(identificacion);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre_producto);
CREATE INDEX IF NOT EXISTS idx_suplidores_razon_social ON suplidores(razon_social);
