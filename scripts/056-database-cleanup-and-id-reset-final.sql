-- =====================================================
-- SCRIPT: Database Cleanup and ID Reset Final
-- DESCRIPCIÓN: Limpia todos los datos y resetea IDs con nuevo formato
-- FECHA: 2024
-- =====================================================

-- Deshabilitar verificaciones de claves foráneas temporalmente
SET session_replication_role = replica;

DO $$
BEGIN
    RAISE NOTICE '🧹 INICIANDO LIMPIEZA COMPLETA DE BASE DE DATOS...';
END $$;

-- =====================================================
-- PASO 1: ELIMINAR TODOS LOS DATOS EXISTENTES
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '📋 Eliminando todos los datos existentes...';
    
    -- Eliminar en orden de dependencias (hijos primero)
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reserva_detalles') THEN
        DELETE FROM reserva_detalles;
        RAISE NOTICE '✅ Datos eliminados de: reserva_detalles';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pagos') THEN
        DELETE FROM pagos;
        RAISE NOTICE '✅ Datos eliminados de: pagos';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'reservas') THEN
        DELETE FROM reservas;
        RAISE NOTICE '✅ Datos eliminados de: reservas';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'productos') THEN
        DELETE FROM productos;
        RAISE NOTICE '✅ Datos eliminados de: productos';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'clientes') THEN
        DELETE FROM clientes;
        RAISE NOTICE '✅ Datos eliminados de: clientes';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'suplidores') THEN
        DELETE FROM suplidores;
        RAISE NOTICE '✅ Datos eliminados de: suplidores';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'colaboradores') THEN
        DELETE FROM colaboradores;
        RAISE NOTICE '✅ Datos eliminados de: colaboradores';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tipos_productos') THEN
        DELETE FROM tipos_productos;
        RAISE NOTICE '✅ Datos eliminados de: tipos_productos';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'usuarios') THEN
        DELETE FROM usuarios;
        RAISE NOTICE '✅ Datos eliminados de: usuarios';
    END IF;
    
    -- Eliminar datos de sistema provisional si existen
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cambios_provisionales') THEN
        DELETE FROM cambios_provisionales;
        RAISE NOTICE '✅ Datos eliminados de: cambios_provisionales';
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'acciones_pendientes') THEN
        DELETE FROM acciones_pendientes;
        RAISE NOTICE '✅ Datos eliminados de: acciones_pendientes';
    END IF;
END $$;

-- =====================================================
-- PASO 2: RESETEAR SECUENCIAS CON NUEVOS RANGOS
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '🔢 Reseteando secuencias con nuevos rangos de IDs...';
    
    -- Clientes: empezar desde 1
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'clientes_id_seq') THEN
        ALTER SEQUENCE clientes_id_seq RESTART WITH 1;
        RAISE NOTICE '✅ Secuencia clientes_id_seq reseteada a: 1';
    END IF;
    
    -- Reservas: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'reservas_id_seq') THEN
        ALTER SEQUENCE reservas_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia reservas_id_seq reseteada a: 101';
    END IF;
    
    -- Pagos: empezar desde 111
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'pagos_id_seq') THEN
        ALTER SEQUENCE pagos_id_seq RESTART WITH 111;
        RAISE NOTICE '✅ Secuencia pagos_id_seq reseteada a: 111';
    END IF;
    
    -- Productos: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'productos_id_seq') THEN
        ALTER SEQUENCE productos_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia productos_id_seq reseteada a: 101';
    END IF;
    
    -- Suplidores: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'suplidores_id_seq') THEN
        ALTER SEQUENCE suplidores_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia suplidores_id_seq reseteada a: 101';
    END IF;
    
    -- Colaboradores: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'colaboradores_id_seq') THEN
        ALTER SEQUENCE colaboradores_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia colaboradores_id_seq reseteada a: 101';
    END IF;
    
    -- Tipos Productos: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'tipos_productos_id_seq') THEN
        ALTER SEQUENCE tipos_productos_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia tipos_productos_id_seq reseteada a: 101';
    END IF;
    
    -- Usuarios: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'usuarios_id_seq') THEN
        ALTER SEQUENCE usuarios_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia usuarios_id_seq reseteada a: 101';
    END IF;
    
    -- Reserva Detalles: empezar desde 101
    IF EXISTS (SELECT FROM information_schema.sequences WHERE sequence_name = 'reserva_detalles_id_seq') THEN
        ALTER SEQUENCE reserva_detalles_id_seq RESTART WITH 101;
        RAISE NOTICE '✅ Secuencia reserva_detalles_id_seq reseteada a: 101';
    END IF;
END $$;

-- =====================================================
-- PASO 3: INSERTAR DATOS DE EJEMPLO CON NUEVOS IDs
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '📊 Insertando datos de ejemplo con nuevos rangos de IDs...';
END $$;

-- CLIENTES (IDs: 1, 2, 3, 4, 5, 6)
INSERT INTO clientes (
    tipo_cliente, compania, identificacion, nombre_completo, sexo, 
    telefonos, email, direccion, status, fecha_creado
) VALUES 
('INDIVIDUAL', 'N/A', '00112345678', 'Juan Carlos Pérez', 'M', '809-555-0001', 'juan.perez@email.com', 'Av. 27 de Febrero #123, Santo Domingo', 'ACTIVO', NOW()),
('INDIVIDUAL', 'N/A', '00187654321', 'María Elena Rodríguez', 'F', '809-555-0002', 'maria.rodriguez@email.com', 'Calle El Conde #456, Zona Colonial', 'ACTIVO', NOW()),
('INDIVIDUAL', 'N/A', '00198765432', 'Carlos Alberto Martínez', 'M', '809-555-0003', 'carlos.martinez@email.com', 'Av. Abraham Lincoln #789, Piantini', 'ACTIVO', NOW()),
('INDIVIDUAL', 'N/A', '00156789012', 'Ana Sofía García', 'F', '809-555-0004', 'ana.garcia@email.com', 'Calle José Reyes #321, Gazcue', 'ACTIVO', NOW()),
('EMPRESA', 'Turismo del Caribe SA', '131234567', 'Turismo del Caribe SA', 'N/A', '809-555-0005', 'info@turismocaribe.com', 'Av. Sarasota #654, Bella Vista', 'ACTIVO', NOW()),
('EMPRESA', 'Viajes Dominicanos SRL', '131987654', 'Viajes Dominicanos SRL', 'N/A', '809-555-0006', 'contacto@viajesdominicanos.com', 'Calle Gustavo Mejía Ricart #987, Naco', 'ACTIVO', NOW());

-- PRODUCTOS (IDs: 101, 102, 103)
INSERT INTO productos (
    codigo, nombre_producto, nombre_original, tipo, contactos, pais, direccion, status, fecha_creado, fecha_editado
) VALUES 
('PROD-101', 'Hotel Paradise Beach Resort', 'Paradise Beach Resort & Spa', 'HOTEL', 'Reservas: 809-555-1001, Gerencia: 809-555-1002', 'República Dominicana', 'Playa Dorada, Puerto Plata', 'ACTIVO', NOW(), NOW()),
('PROD-102', 'Villa Tropical Escape', 'Tropical Escape Private Villa', 'VILLA', 'Administrador: 809-555-2001, Mantenimiento: 809-555-2002', 'República Dominicana', 'Casa de Campo, La Romana', 'ACTIVO', NOW(), NOW()),
('PROD-103', 'Excursión Saona Island VIP', 'Saona Island VIP Experience', 'EXCURSION', 'Coordinador: 809-555-3001, Emergencias: 809-555-3002', 'República Dominicana', 'Bayahibe, La Altagracia', 'ACTIVO', NOW(), NOW());

-- SUPLIDORES (IDs: 101, 102, 103)
INSERT INTO suplidores (
    razon_social, nombre_comercial, identificacion, nombre_responsable, 
    telefono_responsable, email, direccion, pais, status, fecha_creado
) VALUES 
('Hoteles del Caribe SA', 'Paradise Hotels Group', '131555001', 'Roberto Fernández', '809-555-1010', 'roberto@paradisehotels.com', 'Av. George Washington #100, Malecón', 'República Dominicana', 'ACTIVO', NOW()),
('Villas Premium SRL', 'Premium Villas RD', '131555002', 'Carmen Jiménez', '809-555-2020', 'carmen@premiumvillas.com', 'Calle Principal #200, Casa de Campo', 'República Dominicana', 'ACTIVO', NOW()),
('Tours Aventura EIRL', 'Aventura Tours RD', '131555003', 'Miguel Santos', '809-555-3030', 'miguel@aventuratours.com', 'Av. Libertad #300, Bayahibe', 'República Dominicana', 'ACTIVO', NOW());

-- RESERVAS (IDs: 101, 102, 103)
INSERT INTO reservas (
    codigo, cliente_id, producto_id, fecha_entrada, fecha_salida, 
    pasajeros, habitaciones, precio_total, status, fecha_creado
) VALUES 
('101', 1, 101, '2024-03-15', '2024-03-20', 2, 1, 1500.00, 'PENDIENTE', NOW()),
('102', 2, 102, '2024-03-22', '2024-03-25', 4, 2, 2800.00, 'PARCIAL', NOW()),
('103', 3, 103, '2024-04-01', '2024-04-01', 6, 0, 450.00, 'PENDIENTE', NOW());

-- PAGOS (IDs: 111, 112, 113)
INSERT INTO pagos (
    reserva_id, cliente_id, monto, metodo_pago, fecha_pago, estado, fecha_creado
) VALUES 
(101, 1, 500.00, 'TRANSFERENCIA', '2024-02-15', 'COMPLETADO', NOW()),
(102, 2, 1000.00, 'TARJETA_CREDITO', '2024-02-20', 'COMPLETADO', NOW()),
(103, 3, 150.00, 'EFECTIVO', '2024-03-01', 'COMPLETADO', NOW());

-- COLABORADORES (IDs: 101, 102, 103, 104)
INSERT INTO colaboradores (
    nombre_completo, identificacion, telefono, email, cargo, status, fecha_creado
) VALUES 
('Luis Alberto Vásquez', '00123456789', '809-555-4001', 'luis.vasquez@ellibry.com', 'Vendedor Senior', 'ACTIVO', NOW()),
('Patricia Morales', '00198765432', '809-555-4002', 'patricia.morales@ellibry.com', 'Coordinadora de Reservas', 'ACTIVO', NOW()),
('Fernando Castillo', '00156789012', '809-555-4003', 'fernando.castillo@ellibry.com', 'Agente de Ventas', 'ACTIVO', NOW()),
('Gabriela Núñez', '00187654321', '809-555-4004', 'gabriela.nunez@ellibry.com', 'Asistente Administrativa', 'ACTIVO', NOW());

-- TIPOS DE PRODUCTOS (IDs: 101-112)
INSERT INTO tipos_productos (nombre_tipo, descripcion, status, fecha_creado) VALUES 
('HOTEL', 'Hoteles y resorts todo incluido', 'ACTIVO', NOW()),
('VILLA', 'Villas privadas y casas de alquiler', 'ACTIVO', NOW()),
('APARTAMENTO', 'Apartamentos turísticos', 'ACTIVO', NOW()),
('EXCURSION', 'Tours y excursiones', 'ACTIVO', NOW()),
('TRANSPORTE', 'Servicios de transporte turístico', 'ACTIVO', NOW()),
('CRUCERO', 'Paquetes de cruceros', 'ACTIVO', NOW()),
('VUELO', 'Boletos aéreos', 'ACTIVO', NOW()),
('PAQUETE', 'Paquetes turísticos completos', 'ACTIVO', NOW()),
('ACTIVIDAD', 'Actividades recreativas', 'ACTIVO', NOW()),
('RESTAURANTE', 'Servicios gastronómicos', 'ACTIVO', NOW()),
('SPA', 'Servicios de spa y bienestar', 'ACTIVO', NOW()),
('EVENTO', 'Organización de eventos', 'ACTIVO', NOW());

-- USUARIOS (IDs: 101, 102, 103)
INSERT INTO usuarios (
    nombre_usuario, nombre_completo, email, rol, status, fecha_creado
) VALUES 
('admin', 'Administrador del Sistema', 'admin@ellibry.com', 'ADMIN', 'ACTIVO', NOW()),
('operador1', 'Juan Operador', 'operador1@ellibry.com', 'OPERADOR', 'ACTIVO', NOW()),
('vendedor1', 'María Vendedora', 'vendedor1@ellibry.com', 'VENDEDOR', 'ACTIVO', NOW());

-- Habilitar verificaciones de claves foráneas
SET session_replication_role = DEFAULT;

-- =====================================================
-- PASO 4: VERIFICACIONES Y ESTADÍSTICAS
-- =====================================================

DO $$
DECLARE
    tabla_record RECORD;
    conteo INTEGER;
    min_id INTEGER;
    max_id INTEGER;
BEGIN
    RAISE NOTICE '📊 VERIFICACIONES Y ESTADÍSTICAS FINALES:';
    RAISE NOTICE '================================================';
    
    -- Verificar cada tabla
    FOR tabla_record IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
        AND table_name IN ('clientes', 'reservas', 'pagos', 'productos', 'suplidores', 'colaboradores', 'tipos_productos', 'usuarios')
        ORDER BY table_name
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', tabla_record.table_name) INTO conteo;
        
        IF conteo > 0 THEN
            EXECUTE format('SELECT MIN(id), MAX(id) FROM %I', tabla_record.table_name) INTO min_id, max_id;
            RAISE NOTICE '✅ %-20s | Registros: %3s | IDs: %3s - %3s', 
                UPPER(tabla_record.table_name), conteo, min_id, max_id;
        ELSE
            RAISE NOTICE '⚠️  %-20s | Sin datos', UPPER(tabla_record.table_name);
        END IF;
    END LOOP;
    
    RAISE NOTICE '================================================';
    RAISE NOTICE '🎉 LIMPIEZA Y RESET DE IDs COMPLETADO EXITOSAMENTE';
    RAISE NOTICE '📋 Nuevos rangos implementados:';
    RAISE NOTICE '   • Clientes: 1, 2, 3, 4, 5, 6...';
    RAISE NOTICE '   • Reservas: 101, 102, 103...';
    RAISE NOTICE '   • Pagos: 111, 112, 113...';
    RAISE NOTICE '   • Productos: 101, 102, 103...';
    RAISE NOTICE '   • Suplidores: 101, 102, 103...';
    RAISE NOTICE '   • Colaboradores: 101, 102, 103, 104...';
    RAISE NOTICE '   • Tipos Productos: 101-112';
    RAISE NOTICE '   • Usuarios: 101, 102, 103...';
END $$;
