-- Crear tabla de reservas
CREATE TABLE IF NOT EXISTS reservas (
    id BIGSERIAL PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    cliente_id BIGINT REFERENCES clientes(id),
    cedula_cliente VARCHAR(20),
    producto_id BIGINT REFERENCES productos(id),
    referido_por VARCHAR(255),
    atendido_por VARCHAR(255) NOT NULL,
    fecha_entrada DATE,
    fecha_salida DATE,
    hora_entrada TIME,
    hora_salida TIME,
    pasajeros INTEGER NOT NULL,
    habitaciones INTEGER,
    precio_unitario DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) DEFAULT 0,
    impuestos DECIMAL(10,2) DEFAULT 0,
    precio_total DECIMAL(10,2) NOT NULL,
    moneda VARCHAR(3) DEFAULT 'DOP',
    fecha_limite_pago DATE,
    fecha_gastos_proveedor DATE,
    metodo_pago VARCHAR(50),
    abonado_contabilidad VARCHAR(10) DEFAULT 'NO',
    proveedor VARCHAR(255),
    proforma VARCHAR(100),
    comision VARCHAR(10) DEFAULT 'NO',
    factura_enviada_cliente VARCHAR(10) DEFAULT 'NO',
    factura_recibida_proveedor VARCHAR(10) DEFAULT 'NO',
    asientos_bus INTEGER,
    grupo VARCHAR(100),
    nota_interna_reserva TEXT,
    status VARCHAR(20) DEFAULT 'PENDIENTE',
    balance_reserva DECIMAL(10,2) DEFAULT 0,
    balance_general DECIMAL(10,2) DEFAULT 0,
    balance_abonado DECIMAL(10,2) DEFAULT 0,
    registrado_por VARCHAR(255) NOT NULL,
    fecha_creado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_editado TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    editado_por VARCHAR(255)
);

-- Crear índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_id ON reservas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_reservas_producto_id ON reservas(producto_id);
CREATE INDEX IF NOT EXISTS idx_reservas_status ON reservas(status);
CREATE INDEX IF NOT EXISTS idx_reservas_fecha_entrada ON reservas(fecha_entrada);
CREATE INDEX IF NOT EXISTS idx_reservas_codigo ON reservas(codigo);

-- Insertar datos de ejemplo
INSERT INTO reservas (
    codigo, cliente_id, cedula_cliente, producto_id, referido_por, atendido_por,
    fecha_entrada, fecha_salida, hora_entrada, hora_salida, pasajeros, habitaciones,
    precio_unitario, descuento, impuestos, precio_total, moneda,
    fecha_limite_pago, fecha_gastos_proveedor, metodo_pago,
    abonado_contabilidad, proveedor, proforma, comision,
    factura_enviada_cliente, factura_recibida_proveedor,
    asientos_bus, grupo, nota_interna_reserva, status,
    balance_reserva, balance_general, balance_abonado, registrado_por
) VALUES 
(
    'R-2025-001', 2, '001-1234567-8', 1, 'Luis Colaborador', 'Juan Pérez',
    '2025-02-15', '2025-02-18', '15:00', '11:00', 2, 1,
    600.00, 0.00, 108.00, 1200.00, 'DOP',
    '2025-02-10', '2025-02-12', 'TARJETA',
    'SI', 'Paradise Hotels Group', 'PRO-001', 'SI',
    'SI', 'SI',
    2, 'GRP-001', 'Cliente frecuente, habitación con vista al mar', 'CONFIRMADA',
    600.00, 600.00, 600.00, 'Sistema'
),
(
    'R-2025-002', 3, '001-9876543-2', 1, 'Carmen Vendedora', 'Ana López',
    '2025-02-18', '2025-02-21', '14:00', '12:00', 4, 2,
    625.00, 50.00, 225.00, 2500.00, 'DOP',
    '2025-02-15', '2025-02-16', 'TRANSFERENCIA',
    'NO', 'Paradise Hotels Group', 'PRO-002', 'NO',
    'SI', 'NO',
    4, 'GRP-002', 'Requiere confirmación de disponibilidad', 'PENDIENTE',
    2500.00, 2500.00, 0.00, 'Sistema'
),
(
    'R-2025-003', 1, '131-12345-6', 1, 'Carlos Vendedor', 'Roberto Silva',
    '2025-03-01', '2025-03-08', '16:00', '10:00', 8, 4,
    625.00, 0.00, 900.00, 5000.00, 'DOP',
    '2025-02-25', '2025-02-27', 'CHEQUE',
    'SI', 'Paradise Hotels Group', 'PRO-003', 'SI',
    'NO', 'NO',
    8, 'GRP-003', 'Evento corporativo, requiere documentación adicional', 'COMPLETADA',
    0.00, 0.00, 5000.00, 'Sistema'
),
(
    'R-2025-004', 2, '001-1234567-8', 1, 'Luis Colaborador', 'María González',
    '2025-02-28', '2025-03-01', '13:00', '11:00', 1, 1,
    800.00, 0.00, 144.00, 800.00, 'DOP',
    '2025-02-26', '2025-02-26', 'EFECTIVO',
    'NO', 'Paradise Hotels Group', 'PRO-004', 'NO',
    'SI', 'SI',
    1, 'GRP-004', 'Primera consulta, cliente nuevo', 'PENDIENTE',
    800.00, 800.00, 0.00, 'Sistema'
);
