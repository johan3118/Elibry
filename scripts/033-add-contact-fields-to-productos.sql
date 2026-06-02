-- Add separate contact fields to productos table
ALTER TABLE productos 
ADD COLUMN IF NOT EXISTS email_contacto VARCHAR(255),
ADD COLUMN IF NOT EXISTS telefono_contacto VARCHAR(50);

-- Update existing records that might have contact info in the contactos field
UPDATE productos 
SET 
  email_contacto = CASE 
    WHEN contactos LIKE '%@%' THEN 
      TRIM(SUBSTRING(contactos FROM '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'))
    ELSE NULL 
  END,
  telefono_contacto = CASE 
    WHEN contactos ~ '[0-9]' THEN 
      TRIM(REGEXP_REPLACE(contactos, '[^0-9\-\+$$$$\s]', '', 'g'))
    ELSE NULL 
  END
WHERE contactos IS NOT NULL AND contactos != '';

-- Create index for better performance on contact searches
CREATE INDEX IF NOT EXISTS idx_productos_email_contacto ON productos(email_contacto);
CREATE INDEX IF NOT EXISTS idx_productos_telefono_contacto ON productos(telefono_contacto);
