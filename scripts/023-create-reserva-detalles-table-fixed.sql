-- Crear tabla reserva_detalles si no existe
CREATE TABLE IF NOT EXISTS public.reserva_detalles (
    id SERIAL PRIMARY KEY,
    reserva_id INTEGER NOT NULL,
    concepto VARCHAR(200) NOT NULL,
    descripcion TEXT,
    cantidad INTEGER DEFAULT 1,
    precio_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
    descuento DECIMAL(10,2) DEFAULT 0,
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    impuestos DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL DEFAULT 0,
    noches INTEGER DEFAULT 1,
    pasajeros INTEGER DEFAULT 1,
    habitaciones INTEGER DEFAULT 1,
    registrado_por VARCHAR(100) NOT NULL DEFAULT 'Sistema',
    fecha_creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    editado_por VARCHAR(100),
    fecha_editado TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraint para referenciar la tabla reservas
    CONSTRAINT fk_reserva_detalles_reserva 
        FOREIGN KEY (reserva_id) 
        REFERENCES public.reservas(id) 
        ON DELETE CASCADE
);

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_reserva_detalles_reserva_id ON public.reserva_detalles(reserva_id);
CREATE INDEX IF NOT EXISTS idx_reserva_detalles_concepto ON public.reserva_detalles(concepto);

-- Función para actualizar fecha_editado automáticamente
CREATE OR REPLACE FUNCTION update_reserva_detalles_fecha_editado()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_editado = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar fecha_editado
DROP TRIGGER IF EXISTS trigger_update_reserva_detalles_fecha_editado ON public.reserva_detalles;
CREATE TRIGGER trigger_update_reserva_detalles_fecha_editado
    BEFORE UPDATE ON public.reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION update_reserva_detalles_fecha_editado();

-- Función para recalcular totales de reserva cuando se modifican los detalles
CREATE OR REPLACE FUNCTION recalcular_totales_reserva()
RETURNS TRIGGER AS $$
DECLARE
    reserva_id_affected INTEGER;
    nuevo_total DECIMAL(10,2);
    nuevo_descuento DECIMAL(10,2);
    nuevos_pasajeros INTEGER;
    nuevas_habitaciones INTEGER;
BEGIN
    -- Determinar el reserva_id afectado
    IF TG_OP = 'DELETE' THEN
        reserva_id_affected = OLD.reserva_id;
    ELSE
        reserva_id_affected = NEW.reserva_id;
    END IF;
    
    -- Calcular nuevos totales
    SELECT 
        COALESCE(SUM(total), 0),
        COALESCE(SUM(descuento), 0),
        COALESCE(SUM(pasajeros), 0),
        COALESCE(SUM(habitaciones), 0)
    INTO 
        nuevo_total,
        nuevo_descuento,
        nuevos_pasajeros,
        nuevas_habitaciones
    FROM public.reserva_detalles 
    WHERE reserva_id = reserva_id_affected;
    
    -- Actualizar la reserva principal
    UPDATE public.reservas 
    SET 
        precio_total = nuevo_total,
        descuento = nuevo_descuento,
        pasajeros = nuevos_pasajeros,
        habitaciones = nuevas_habitaciones,
        balance_reserva = nuevo_total,
        balance_general = nuevo_total,
        fecha_editado = CURRENT_TIMESTAMP,
        editado_por = COALESCE(NEW.editado_por, OLD.editado_por, 'Sistema')
    WHERE id = reserva_id_affected;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para recalcular totales automáticamente
DROP TRIGGER IF EXISTS trigger_recalcular_totales_insert ON public.reserva_detalles;
CREATE TRIGGER trigger_recalcular_totales_insert
    AFTER INSERT ON public.reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_totales_reserva();

DROP TRIGGER IF EXISTS trigger_recalcular_totales_update ON public.reserva_detalles;
CREATE TRIGGER trigger_recalcular_totales_update
    AFTER UPDATE ON public.reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_totales_reserva();

DROP TRIGGER IF EXISTS trigger_recalcular_totales_delete ON public.reserva_detalles;
CREATE TRIGGER trigger_recalcular_totales_delete
    AFTER DELETE ON public.reserva_detalles
    FOR EACH ROW
    EXECUTE FUNCTION recalcular_totales_reserva();

-- Insertar algunos datos de ejemplo si la tabla está vacía
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.reserva_detalles LIMIT 1) THEN
        -- Solo insertar si hay reservas existentes
        IF EXISTS (SELECT 1 FROM public.reservas LIMIT 1) THEN
            INSERT INTO public.reserva_detalles (
                reserva_id, concepto, descripcion, cantidad, precio_unitario, 
                descuento, subtotal, total, noches, pasajeros, habitaciones, registrado_por
            )
            SELECT 
                r.id,
                'Servicio Principal',
                'Servicio principal de la reserva',
                1,
                COALESCE(r.precio_unitario, r.precio_total, 0),
                COALESCE(r.descuento, 0),
                COALESCE(r.precio_total, 0) - COALESCE(r.descuento, 0),
                COALESCE(r.precio_total, 0),
                CASE 
                    WHEN r.fecha_entrada IS NOT NULL AND r.fecha_salida IS NOT NULL 
                    THEN GREATEST(1, EXTRACT(DAY FROM (r.fecha_salida::date - r.fecha_entrada::date)))
                    ELSE 1 
                END,
                COALESCE(r.pasajeros, 1),
                COALESCE(r.habitaciones, 1),
                COALESCE(r.registrado_por, 'Sistema')
            FROM public.reservas r
            WHERE r.id NOT IN (SELECT DISTINCT reserva_id FROM public.reserva_detalles)
            LIMIT 10; -- Limitar para evitar insertar demasiados registros de una vez
        END IF;
    END IF;
END $$;

-- Verificar que la tabla se creó correctamente
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reserva_detalles') THEN
        RAISE NOTICE '✅ Tabla reserva_detalles creada exitosamente';
        RAISE NOTICE '📊 Total de registros: %', (SELECT COUNT(*) FROM public.reserva_detalles);
    ELSE
        RAISE NOTICE '❌ Error: No se pudo crear la tabla reserva_detalles';
    END IF;
END $$;
