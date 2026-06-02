-- Agregar campos separados de contacto a la tabla productos
ALTER TABLE productos 
ADD COLUMN email_contacto VARCHAR(255),
ADD COLUMN telefono_contacto VARCHAR(50);

-- Migrar datos existentes del campo contactos si existe
UPDATE productos 
SET email_contacto = CASE 
  WHEN contactos LIKE '%@%' THEN 
    TRIM(SUBSTRING(contactos FROM POSITION('@' IN contactos) - 50 FOR 100))
  ELSE NULL 
END,
telefono_contacto = CASE 
  WHEN contactos ~ '[0-9]' THEN 
    REGEXP_REPLACE(contactos, '[^0-9\-$$$$\+\s]', '', 'g')
  ELSE NULL 
END
WHERE contactos IS NOT NULL;
