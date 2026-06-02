-- Insertar tipos de productos
INSERT INTO tipos_productos (nombre, descripcion) VALUES
('HOTEL', 'Servicios de hospedaje hotelero'),
('VILLA', 'Alquiler de villas y casas vacacionales'),
('APARTAMENTO', 'Apartamentos turísticos'),
('EXCURSION', 'Tours y excursiones turísticas'),
('BOLETO AEREO', 'Boletos de avión y servicios aéreos'),
('LOCAL COMERCIAL', 'Alquiler de locales comerciales'),
('CASA', 'Alquiler de casas residenciales'),
('PARQUE', 'Acceso a parques temáticos'),
('TRANSPORTE', 'Servicios de transporte turístico'),
('SEGURO', 'Seguros de viaje y turísticos'),
('CRUCERO', 'Paquetes de cruceros'),
('OTROS', 'Otros productos y servicios');

-- Insertar suplidores
INSERT INTO suplidores (razon_social, nombre_comercial, identificacion, nombre_responsable, telefono_responsable, pais, direccion, email) VALUES
('Hoteles del Caribe S.A.', 'Caribbean Hotels', '131-45678-9', 'Ana María González', '(809) 555-0101', 'República Dominicana', 'Av. George Washington #123, Santo Domingo', 'reservas@caribbeanhotels.com'),
('Excursiones Tropicales EIRL', 'Tropical Tours', '131-98765-4', 'Carlos Rodríguez', '(809) 555-0202', 'República Dominicana', 'Calle El Conde #456, Zona Colonial', 'info@tropicaltours.do'),
('Villas Premium International', 'Premium Villas', '131-11111-1', 'María José Martínez', '(809) 555-0303', 'República Dominicana', 'Av. Sarasota #789, Punta Cana', 'bookings@premiumvillas.com');

-- Insertar colaboradores
INSERT INTO colaboradores (nombre, apellido, telefono, email, tipo, comision) VALUES
('Ana María', 'González Pérez', '(809) 555-0101', 'ana.gonzalez@grupoellibry.com', 'VENDEDOR', 5.00),
('Carlos', 'Rodríguez Martínez', '(809) 555-0202', 'carlos.rodriguez@grupoellibry.com', 'COLABORADOR', 3.00),
('María José', 'Martínez López', '(809) 555-0303', 'maria.martinez@grupoellibry.com', 'VENDEDOR', 4.50),
('Luis', 'Fernández García', '(809) 555-0404', 'luis.fernandez@grupoellibry.com', 'COLABORADOR', 2.50);

-- Insertar clientes
INSERT INTO clientes (tipo_cliente, compania, identificacion, nombre_completo, sexo, telefonos, email, direccion, status) VALUES
('NORMAL', 'MARCA 1', '001-1234567-8', 'Juan Carlos Pérez', 'MASCULINO', '(809) 555-0123', 'juan.perez@email.com', 'Av. Principal #123, Santo Domingo', 'ACTIVO'),
('NORMAL', 'MARCA 1', '001-9876543-2', 'María Elena García', 'FEMENINO', '(809) 555-0456', 'maria.garcia@email.com', 'Calle Segunda #456, Santiago', 'ACTIVO'),
('NORMAL', 'MARCA 2', '001-5555555-5', 'Ana María Rodríguez', 'FEMENINO', '(809) 555-0789', 'ana.rodriguez@email.com', 'Av. Tercera #789, La Vega', 'ACTIVO'),
('NORMAL', 'MARCA 1', '001-7777777-7', 'Pedro José Martínez', 'MASCULINO', '(809) 555-0321', 'pedro.martinez@email.com', 'Calle Cuarta #321, San Pedro', 'ACTIVO');

INSERT INTO clientes (tipo_cliente, compania, rnc, razon_social, nombre_comercial, responsable, telefonos, email, direccion, status) VALUES
('EMPRESA', 'MARCA 1', '131-12345-6', 'Constructora del Norte SRL', 'Constructora del Norte', 'Ing. Roberto Jiménez', '(809) 555-0789', 'info@constructoranorte.com', 'Zona Industrial, Santiago', 'ACTIVO'),
('EMPRESA', 'MARCA 2', '131-98765-4', 'Hotel Caribe S.A.', 'Hotel Caribe', 'Lic. Carmen Valdez', '(809) 555-0654', 'gerencia@hotelcaribe.com', 'Malecón #100, Puerto Plata', 'ACTIVO');

-- Insertar productos (sin precios)
INSERT INTO productos (codigo, nombre_producto, nombre_original, tipo, suplidor_id, contactos, pais, direccion, comentarios, registrado_por) VALUES
('HTL-001', 'Hotel Paradise Resort', 'Paradise Beach Resort & Spa', 'HOTEL', 1, 'reservas@paradise.com, +1-809-555-0123', 'República Dominicana', 'Playa Dorada, Puerto Plata', 'Hotel 5 estrellas con vista al mar', 'admin'),
('VLL-001', 'Villa Tropical Premium', 'Tropical Villa Deluxe', 'VILLA', 3, 'villas@tropical.com, +1-809-555-0456', 'República Dominicana', 'Casa de Campo, La Romana', 'Villa de lujo con piscina privada', 'admin'),
('EXC-001', 'Excursión Isla Saona', 'Saona Island Full Day Tour', 'EXCURSION', 2, 'tours@saona.com, +1-809-555-0789', 'República Dominicana', 'Bayahibe, La Altagracia', 'Tour completo con almuerzo incluido', 'admin');

-- Insertar reservas con precios específicos
INSERT INTO reservas (
    codigo, cliente_id, cedula_cliente, producto_id, atendido_por,
    fecha_entrada, fecha_salida, pasajeros, habitaciones,
    precio_unitario, precio_total, metodo_pago,
    fecha_limite_pago, referido_por
) VALUES
('R-2025-001', 1, '001-1234567-8', 1, 'admin', '2025-02-15', '2025-02-20', 2, 1, 150.00, 750.00, 'TARJETA', '2025-02-10', 'Ana María González'),
('R-2025-002', 2, '001-9876543-2', 2, 'admin', '2025-03-01', '2025-03-07', 4, 2, 200.00, 1200.00, 'TRANSFERENCIA', '2025-02-25', 'Carlos Rodríguez'),
('R-2025-003', 3, '001-5555555-5', 3, 'operador1', '2025-02-28', '2025-02-28', 6, 0, 75.00, 450.00, 'EFECTIVO', '2025-02-26', NULL);

-- Insertar pagos
INSERT INTO pagos (
    codigo, recibo, cliente_id, reserva_id, fecha_pago, monto, metodo_pago, 
    referencia, concepto, estado, usuario
) VALUES
('PAG-2025-001', 'REC-2025-001', 1, 1, '2025-01-20', 600.00, 'Transferencia', 'TRF-123456', 'Anticipo Reserva Hotel Paradise', 'PROCESADO', 'admin'),
('PAG-2025-002', 'REC-2025-002', 5, NULL, '2025-01-22', 5000.00, 'Cheque', 'CHQ-789012', 'Pago Proyecto Inmobiliario', 'PROCESADO', 'operador1'),
('PAG-2025-003', 'REC-2025-003', 2, 2, '2025-01-25', 1250.00, 'Efectivo', NULL, 'Pago completo Villa Tropical', 'PENDIENTE', 'admin');
