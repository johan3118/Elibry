-- Script alternativo: Convertir campos específicos a VARCHAR(2) si son BOOLEAN o VARCHAR(1)

DO $$
DECLARE
    campos_si_no TEXT[] := ARRAY['comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo'];
    campo TEXT;
    col_info RECORD;
BEGIN
    RAISE NOTICE '🔧 ASEGURANDO QUE CAMPOS SI/NO SEAN VARCHAR(2)...';
    
    FOREACH campo IN ARRAY campos_si_no
    LOOP
        -- Obtener información actual del campo
        SELECT data_type, character_maximum_length 
        INTO col_info
        FROM information_schema.columns 
        WHERE table_name = 'reservas' AND column_name = campo;
        
        IF FOUND THEN
            RAISE NOTICE '🔍 Campo %: % (%)', campo, col_info.data_type, 
                CASE WHEN col_info.character_maximum_length IS NOT NULL 
                     THEN col_info.character_maximum_length::text 
                     ELSE 'N/A' END;
            
            -- Convertir a VARCHAR(2) si no lo es ya
            IF col_info.data_type = 'boolean' OR 
               (col_info.data_type = 'character varying' AND col_info.character_maximum_length < 2) THEN
                
                BEGIN
                    EXECUTE 'ALTER TABLE reservas ALTER COLUMN ' || campo || ' TYPE VARCHAR(2)';
                    RAISE NOTICE '✅ % convertido a VARCHAR(2)', campo;
                EXCEPTION
                    WHEN OTHERS THEN
                        RAISE NOTICE '❌ Error convirtiendo %: %', campo, SQLERRM;
                END;
            ELSE
                RAISE NOTICE '✅ % ya es compatible con SI/NO', campo;
            END IF;
        ELSE
            RAISE NOTICE '⚠️ Campo % no encontrado', campo;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🎉 Proceso completado';
    
END $$;

-- Verificación final
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    CASE 
        WHEN data_type = 'character varying' AND character_maximum_length >= 2 THEN '✅ OK para SI/NO'
        WHEN data_type = 'boolean' THEN '⚠️ Necesita conversión en React'
        ELSE '❌ Problemático'
    END as estado
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
ORDER BY column_name;
