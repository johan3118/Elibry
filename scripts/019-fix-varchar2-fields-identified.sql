-- Script para identificar y corregir campos VARCHAR(2) que necesitan más espacio
-- Basado en el error específico: "value too long for type character varying(2)"

DO $$
BEGIN
    -- Expandir campo moneda de VARCHAR(2) a VARCHAR(10)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name = 'moneda' 
        AND character_maximum_length = 2
    ) THEN
        ALTER TABLE reservas ALTER COLUMN moneda TYPE VARCHAR(10);
        RAISE NOTICE 'Campo moneda expandido a VARCHAR(10)';
    END IF;

    -- Expandir campo metodo_pago de VARCHAR(2) a VARCHAR(50)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name = 'metodo_pago' 
        AND character_maximum_length = 2
    ) THEN
        ALTER TABLE reservas ALTER COLUMN metodo_pago TYPE VARCHAR(50);
        RAISE NOTICE 'Campo metodo_pago expandido a VARCHAR(50)';
    END IF;

    -- Expandir campo proforma de VARCHAR(2) a VARCHAR(100)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name = 'proforma' 
        AND character_maximum_length = 2
    ) THEN
        ALTER TABLE reservas ALTER COLUMN proforma TYPE VARCHAR(100);
        RAISE NOTICE 'Campo proforma expandido a VARCHAR(100)';
    END IF;

    -- Expandir campo status de VARCHAR(2) a VARCHAR(50)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name = 'status' 
        AND character_maximum_length = 2
    ) THEN
        ALTER TABLE reservas ALTER COLUMN status TYPE VARCHAR(50);
        RAISE NOTICE 'Campo status expandido a VARCHAR(50)';
    END IF;

    -- Expandir campo asientos_bus de VARCHAR(2) a VARCHAR(10)
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND column_name = 'asientos_bus' 
        AND character_maximum_length = 2
    ) THEN
        ALTER TABLE reservas ALTER COLUMN asientos_bus TYPE VARCHAR(10);
        RAISE NOTICE 'Campo asientos_bus expandido a VARCHAR(10)';
    END IF;

    RAISE NOTICE 'Script 019 completado - Campos VARCHAR(2) problemáticos corregidos';
END $$;
