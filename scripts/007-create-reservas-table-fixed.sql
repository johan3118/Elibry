-- Verificar estructura actual de reservas y agregar columnas faltantes
DO $$ 
BEGIN
    -- Agregar columnas que faltan en la tabla reservas
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'balance_reserva') THEN
        ALTER TABLE reservas ADD COLUMN balance_reserva DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'balance_general') THEN
        ALTER TABLE reservas ADD COLUMN balance_general DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'balance_abonado') THEN
        ALTER TABLE reservas ADD COLUMN balance_abonado DECIMAL(10,2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'moneda') THEN
        ALTER TABLE reservas ADD COLUMN moneda VARCHAR(3) DEFAULT 'DOP';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reservas' AND column_name = 'editado_por') THEN
        ALTER TABLE reservas ADD COLUMN editado_por VARCHAR(255);
    END IF;
END $$;

-- Insertar datos de ejemplo solo si no existen
INSERT INTO reservas (
    codigo, cliente_id, cedula_cliente, producto_id, referido_por, atendido_por,
    fecha_entrada, fecha_salida, hora_entrada, hora_salida, pasajeros, habitaciones,
    precio_unitario, descuento, impuestos, precio_total, moneda,
    fecha_limite_pago, fecha_gastos_proveedor, metodo_pago,
    abonado_contabilidad, proveedor, proforma, comision,
    factura_enviada_cliente, factura_recibida_proveedor,
    asientos_bus, grupo, nota_interna_reserva, status,
    balance_reserva, balance_general, balance_abonado, registrado_por
) 
SELECT * FROM (VALUES 
    ('R-2025-001', 2, '001-1234567-8', 1, 'Luis Colaborador', 'Juan Pérez',
     '2025-02-15', '2025-02-18', '15:00', '11:00', 2, 1,
     600.00, 0.00, 108.00, 1200.00, 'DOP',
     '2025-02-10', '2025-02-12', 'TARJETA',
     'SI', 'Paradise Hotels Group', 'PRO-001', 'SI',
     'SI', 'SI',
     2, 'GRP-001', 'Cliente frecuente, habitación con vista al mar', 'CONFIRMADA',
     600.00, 600.00, 600.00, 'Sistema'),
    ('R-2025-002', 3, '001-9876543-2', 1, 'Carmen Vendedora', 'Ana López',
     '2025-02-18', '2025-02-21', '14:00', '12:00', 4, 2,
     625.00, 50.00, 225.00, 2500.00, 'DOP',
     '2025-02-15', '2025-02-16', 'TRANSFERENCIA',
     'NO', 'Paradise Hotels Group', 'PRO-002', 'NO',
     'SI', 'NO',
     4, 'GRP-002', 'Requiere confirmación de disponibilidad', 'PENDIENTE',
     2500.00, 2500.00, 0.00, 'Sistema'),
    ('R-2025-003', 1, '131-12345-6', 1, 'Carlos Vendedor', 'Roberto Silva',
     '2025-03-01', '2025-03-08', '16:00', '10:00', 8, 4,
     625.00, 0.00, 900.00, 5000.00, 'DOP',
     '2025-02-25', '2025-02-27', 'CHEQUE',
     'SI', 'Paradise Hotels Group', 'PRO-003', 'SI',
     'NO', 'NO',
     8, 'GRP-003', 'Evento corporativo, requiere documentación adicional', 'COMPLETADA',
     0.00, 0.00, 5000.00, 'Sistema'),
    ('R-2025-004', 2, '001-1234567-8', 1, 'Luis Colaborador', 'María González',
     '2025-02-28', '2025-03-01', '13:00', '11:00', 1, 1,
     800.00, 0.00, 144.00, 800.00, 'DOP',
     '2025-02-26', '2025-02-26', 'EFECTIVO',
     'NO', 'Paradise Hotels Group', 'PRO-004', 'NO',
     'SI', 'SI',
     1, 'GRP-004', 'Primera consulta, cliente nuevo', 'PENDIENTE',
     800.00, 800.00, 0.00, 'Sistema')
) AS v(codigo, cliente_id, cedula_cliente, producto_id, referido_por, atendido_por,
        fecha_entrada, fecha_salida, hora_entrada, hora_salida, pasajeros, habitaciones,
        precio_unitario, descuento, impuestos, precio_total, moneda,
        fecha_limite_pago, fecha_gastos_proveedor, metodo_pago,
        abonado_contabilidad, proveedor, proforma, comision,
        factura_enviada_cliente, factura_recibida_proveedor,
        asientos_bus, grupo, nota_interna_reserva, status,
        balance_reserva, balance_general, balance_abonado, registrado_por)
WHERE NOT EXISTS (SELECT 1 FROM reservas WHERE codigo = v.codigo);
