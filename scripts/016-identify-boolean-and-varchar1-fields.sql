-- Script para identificar campos BOOLEAN y VARCHAR(1) que podrían estar causando el problema

DO $$
DECLARE
    col_record RECORD;
    boolean_count INTEGER := 0;
    varchar1_count INTEGER := 0;
    varchar2_count INTEGER := 0;
BEGIN
    RAISE NOTICE '🔍 IDENTIFICANDO CAMPOS BOOLEAN Y VARCHAR(1) EN TABLA RESERVAS...';
    
    -- Buscar campos BOOLEAN
    RAISE NOTICE '📋 CAMPOS BOOLEAN ENCONTRADOS:';
    FOR col_record IN 
        SELECT column_name, data_type
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'boolean'
        ORDER BY column_name
    LOOP
        RAISE NOTICE '🔵 BOOLEAN: % (esperaba true/false, recibiendo SI/NO)', col_record.column_name;
        boolean_count := boolean_count + 1;
    END LOOP;
    
    -- Buscar campos VARCHAR(1)
    RAISE NOTICE '📋 CAMPOS VARCHAR(1) ENCONTRADOS:';
    FOR col_record IN 
        SELECT column_name, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length = 1
        ORDER BY column_name
    LOOP
        RAISE NOTICE '🔴 VARCHAR(1): % (esperaba S/N, recibiendo SI/NO)', col_record.column_name;
        varchar1_count := varchar1_count + 1;
    END LOOP;
    
    -- Buscar campos VARCHAR(2) para completar el análisis
    RAISE NOTICE '📋 CAMPOS VARCHAR(2) ENCONTRADOS:';
    FOR col_record IN 
        SELECT column_name, character_maximum_length
        FROM information_schema.columns 
        WHERE table_name = 'reservas' 
        AND data_type = 'character varying'
        AND character_maximum_length = 2
        ORDER BY column_name
    LOOP
        RAISE NOTICE '🟡 VARCHAR(2): % (debería estar OK para SI/NO)', col_record.column_name;
        varchar2_count := varchar2_count + 1;
    END LOOP;
    
    -- Resumen del problema
    RAISE NOTICE '📊 RESUMEN DEL ANÁLISIS:';
    RAISE NOTICE '- Campos BOOLEAN: % (necesitan true/false, no SI/NO)', boolean_count;
    RAISE NOTICE '- Campos VARCHAR(1): % (necesitan S/N, no SI/NO)', varchar1_count;
    RAISE NOTICE '- Campos VARCHAR(2): % (deberían estar OK para SI/NO)', varchar2_count;
    
    -- Análisis de los valores que estamos enviando
    RAISE NOTICE '🔍 VALORES QUE ESTAMOS ENVIANDO:';
    RAISE NOTICE '- comision: "NO" (2 chars)';
    RAISE NOTICE '- factura_enviada_cliente: "NO" (2 chars)';
    RAISE NOTICE '- factura_recibida_proveedor: "NO" (2 chars)';
    RAISE NOTICE '- grupo: "NO" (2 chars)';
    
    IF varchar1_count > 0 THEN
        RAISE NOTICE '🚨 PROBLEMA IDENTIFICADO: Hay % campos VARCHAR(1) que no pueden recibir "SI"/"NO"', varchar1_count;
    END IF;
    
    IF boolean_count > 0 THEN
        RAISE NOTICE '🚨 PROBLEMA IDENTIFICADO: Hay % campos BOOLEAN que no pueden recibir "SI"/"NO"', boolean_count;
    END IF;
    
END $$;

-- Mostrar todos los campos que podrían estar relacionados con SI/NO
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    CASE 
        WHEN data_type = 'boolean' THEN '🔵 BOOLEAN - Necesita true/false'
        WHEN data_type = 'character varying' AND character_maximum_length = 1 THEN '🔴 VARCHAR(1) - Necesita S/N'
        WHEN data_type = 'character varying' AND character_maximum_length = 2 THEN '🟡 VARCHAR(2) - OK para SI/NO'
        ELSE '✅ OK'
    END as problema_potencial
FROM information_schema.columns 
WHERE table_name = 'reservas' 
AND (
    data_type = 'boolean' 
    OR (data_type = 'character varying' AND character_maximum_length <= 2)
    OR column_name IN ('comision', 'factura_enviada_cliente', 'factura_recibida_proveedor', 'grupo')
)
ORDER BY 
    CASE 
        WHEN data_type = 'boolean' THEN 1
        WHEN character_maximum_length = 1 THEN 2
        WHEN character_maximum_length = 2 THEN 3
        ELSE 4
    END,
    column_name;
