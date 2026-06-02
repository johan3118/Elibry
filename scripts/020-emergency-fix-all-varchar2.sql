-- Script de emergencia para expandir TODOS los campos VARCHAR(1) y VARCHAR(2) 
-- que puedan causar problemas en la tabla reservas

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Buscar todos los campos VARCHAR con longitud <= 2 en la tabla reservas
    FOR rec IN 
        SELECT column_name, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length <= 2
    LOOP
        -- Expandir campos según su propósito probable
        CASE 
            WHEN rec.column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo') THEN
                -- Estos son campos SI/NO, mantener VARCHAR(2)
                CONTINUE;
            
            WHEN rec.column_name = 'moneda' THEN
                EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || rec.column_name || ' TYPE VARCHAR(10)';
                RAISE NOTICE 'Campo % expandido de VARCHAR(%) a VARCHAR(10)', rec.column_name, rec.character_maximum_length;
            
            WHEN rec.column_name IN ('metodo_pago', 'status') THEN
                EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || rec.column_name || ' TYPE VARCHAR(50)';
                RAISE NOTICE 'Campo % expandido de VARCHAR(%) a VARCHAR(50)', rec.column_name, rec.character_maximum_length;
            
            WHEN rec.column_name = 'proforma' THEN
                EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || rec.column_name || ' TYPE VARCHAR(100)';
                RAISE NOTICE 'Campo % expandido de VARCHAR(%) a VARCHAR(100)', rec.column_name, rec.character_maximum_length;
            
            WHEN rec.column_name = 'asientos_bus' THEN
                EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || rec.column_name || ' TYPE VARCHAR(10)';
                RAISE NOTICE 'Campo % expandido de VARCHAR(%) a VARCHAR(10)', rec.column_name, rec.character_maximum_length;
            
            ELSE
                -- Para cualquier otro campo VARCHAR(1) o VARCHAR(2), expandir a VARCHAR(50)
                EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || rec.column_name || ' TYPE VARCHAR(50)';
                RAISE NOTICE 'Campo % expandido de VARCHAR(%) a VARCHAR(50)', rec.column_name, rec.character_maximum_length;
        END CASE;
    END LOOP;

    RAISE NOTICE 'Script 020 completado - Corrección de emergencia aplicada';
END $$;
