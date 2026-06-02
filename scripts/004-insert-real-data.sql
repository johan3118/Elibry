-- Insertar datos de ejemplo para el sistema

-- Insertar suplidores de ejemplo
INSERT INTO suplidores (razon_social, nombre_comercial, tipo_documento, numero_documento, telefono, email, direccion, contacto_principal, status, registrado_por) VALUES
('Caribbean Hotels Group SRL', 'CHG Hotels', 'RNC', '131-12345-6', '809-555-0001', 'info@chghotels.com', 'Av. Winston Churchill #123, Santo Domingo', 'María González', 'ACTIVO', 'Sistema'),
('Excursiones del Caribe SRL', 'Caribe Tours', 'RNC', '131-54321-9', '809-555-0002', 'reservas@caribetours.com', 'Calle El Conde #45, Zona Colonial', 'Carlos Martínez', 'ACTIVO', 'Sistema'),
('Transportes Turísticos SA', 'TransTur', 'RNC', '131-98765-4', '809-555-0003', 'info@transtur.com', 'Av. 27 de Febrero #567, Santiago', 'Ana Rodríguez', 'ACTIVO', 'Sistema'),
('Restaurantes Premium EIRL', 'Premium Dining', 'RNC', '131-11111-1', '809-555-0004', 'reservas@premiumdining.com', 'Malecón de Santo Domingo #89', 'Luis Fernández', 'ACTIVO', 'Sistema'),
('Aventuras Extremas SRL', 'Adventure Pro', 'RNC', '131-22222-2', '809-555-0005', 'info@adventurepro.com', 'Jarabacoa, La Vega', 'Carmen Jiménez', 'ACTIVO', 'Sistema')
ON CONFLICT (numero_documento) DO NOTHING;

-- Insertar clientes de ejemplo
INSERT INTO clientes (nombre_completo, identificacion, tipo_documento, telefono, email, direccion, fecha_nacimiento, nacionalidad, status, registrado_por) VALUES
('Juan Carlos Pérez Martínez', '001-1234567-8', 'CEDULA', '809-555-1001', 'juan.perez@email.com', 'Calle Principal #123, Santo Domingo', '1985-05-15', 'Dominicana', 'ACTIVO', 'Sistema'),
('María Elena González Rodríguez', '001-2345678-9', 'CEDULA', '809-555-1002', 'maria.gonzalez@email.com', 'Av. Independencia #456, Santiago', '1990-08-22', 'Dominicana', 'ACTIVO', 'Sistema'),
('Constructora del Norte SRL', '131-33333-3', 'RNC', '809-555-2001', 'info@constructoranorte.com', 'Zona Industrial, Santiago', NULL, NULL, 'ACTIVO', 'Sistema'),
('Robert Johnson', 'P001234567', 'PASAPORTE', '1-555-123-4567', 'robert.johnson@email.com', '123 Main St, New York, USA', '1978-12-10', 'Estadounidense', 'ACTIVO', 'Sistema'),
('Servicios Empresariales SA', '131-44444-4', 'RNC', '809-555-2002', 'contacto@serviciosempresariales.com', 'Piantini, Santo Domingo', NULL, NULL, 'ACTIVO', 'Sistema')
ON CONFLICT (identificacion) DO NOTHING;

-- Insertar productos de ejemplo (los códigos se generarán automáticamente)
INSERT INTO productos (nombre_producto, nombre_original, tipo, suplidor_id, contactos, pais, direccion, comentarios, status, registrado_por) VALUES
('Hotel Paradise Premium', 'Paradise Golden Resort & Spa', 'Hotel', 1, 'reservas@paradise.com, 809-555-4001', 'República Dominicana', 'Playa Dorada, Puerto Plata', 'Hotel 5 estrellas todo incluido con spa', 'ACTIVO', 'Sistema'),
('Excursión Samaná Completa', 'Samaná Full Day Adventure', 'Excursión', 2, 'tours@caribetours.com, 809-555-4002', 'República Dominicana', 'Península de Samaná', 'Tour completo con almuerzo y transporte incluido', 'ACTIVO', 'Sistema'),
('Transporte Aeropuerto VIP', 'Airport VIP Transfer Service', 'Transporte', 3, 'vip@transtur.com, 809-555-4003', 'República Dominicana', 'Aeropuerto Internacional Las Américas', 'Servicio de transporte privado con vehículos de lujo', 'ACTIVO', 'Sistema'),
('Cena Romántica Premium', 'Premium Romantic Dinner Experience', 'Restaurante', 4, 'romantic@premiumdining.com, 809-555-4004', 'República Dominicana', 'Malecón de Santo Domingo', 'Experiencia gastronómica de 5 cursos con vista al mar', 'ACTIVO', 'Sistema'),
('Rafting Río Yaque', 'Yaque River Rafting Adventure', 'Aventura', 5, 'rafting@adventurepro.com, 809-555-4005', 'República Dominicana', 'Río Yaque del Norte, Jarabacoa', 'Aventura de rafting nivel intermedio con guías certificados', 'ACTIVO', 'Sistema'),
('Spa Relajación Total', 'Total Relaxation Spa Package', 'Spa', 1, 'spa@paradise.com, 809-555-4006', 'República Dominicana', 'Playa Dorada, Puerto Plata', 'Paquete completo de spa con masajes y tratamientos', 'ACTIVO', 'Sistema')
ON CONFLICT (codigo) DO NOTHING;

-- Insertar colaboradores de ejemplo
INSERT INTO colaboradores (nombre_completo, identificacion, telefono, email, cargo, departamento, fecha_ingreso, salario, status, registrado_por) VALUES
('Pedro Martínez López', '001-3456789-0', '809-555-3001', 'pedro.martinez@grupoellibry.com', 'Agente de Ventas', 'Ventas', '2023-01-15', 35000.00, 'ACTIVO', 'Sistema'),
('Laura Fernández García', '001-4567890-1', '809-555-3002', 'laura.fernandez@grupoellibry.com', 'Coordinadora de Tours', 'Operaciones', '2023-03-20', 45000.00, 'ACTIVO', 'Sistema'),
('Miguel Ángel Rodríguez', '001-5678901-2', '809-555-3003', 'miguel.rodriguez@grupoellibry.com', 'Supervisor de Reservas', 'Reservas', '2022-11-10', 50000.00, 'ACTIVO', 'Sistema'),
('Carmen Isabel Jiménez', '001-6789012-3', '809-555-3004', 'carmen.jimenez@grupoellibry.com', 'Gerente de Cuentas', 'Ventas', '2022-08-05', 60000.00, 'ACTIVO', 'Sistema')
ON CONFLICT (identificacion) DO NOTHING;

-- Insertar tipos de productos de ejemplo
INSERT INTO tipos_productos (nombre, descripcion, status, registrado_por) VALUES
('Hotel', 'Servicios de hospedaje y alojamiento', 'ACTIVO', 'Sistema'),
('Excursión', 'Tours y excursiones turísticas', 'ACTIVO', 'Sistema'),
('Transporte', 'Servicios de transporte turístico', 'ACTIVO', 'Sistema'),
('Restaurante', 'Servicios gastronómicos y restaurantes', 'ACTIVO', 'Sistema'),
('Aventura', 'Actividades de aventura y deportes extremos', 'ACTIVO', 'Sistema'),
('Spa', 'Servicios de spa y relajación', 'ACTIVO', 'Sistema')
ON CONFLICT (nombre) DO NOTHING;

-- Insertar reservas de ejemplo (si la tabla existe)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservas') THEN
        INSERT INTO reservas (cliente_id, producto_id, fecha_reserva, fecha_viaje, cantidad_personas, precio_total, monto_pagado, balance_pendiente, status, observaciones, registrado_por) VALUES
        (1, 1, '2024-01-20', '2024-02-15', 2, 2500.00, 1000.00, 1500.00, 'CONFIRMADA', 'Reserva para luna de miel', 'Sistema'),
        (2, 2, '2024-01-22', '2024-02-10', 4, 800.00, 800.00, 0.00, 'COMPLETADA', 'Tour familiar completo', 'Sistema'),
        (4, 3, '2024-01-25', '2024-02-05', 1, 150.00, 0.00, 150.00, 'PENDIENTE', 'Transporte desde aeropuerto', 'Sistema')
        ON CONFLICT DO NOTHING;
    END IF;
END $$;
