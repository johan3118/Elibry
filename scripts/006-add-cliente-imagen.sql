-- Agregar campo para imagen/logo de clientes
ALTER TABLE clientes ADD COLUMN imagen_url TEXT;

-- Comentario sobre el campo
COMMENT ON COLUMN clientes.imagen_url IS 'URL de la imagen/logo del cliente. Solo para empresas (400x200px)';

-- Actualizar algunos registros de ejemplo con logos para empresas
UPDATE clientes 
SET imagen_url = '/placeholder.svg?height=200&width=400&text=Logo+Norte+Construcciones'
WHERE tipo_cliente = 'EMPRESA' AND id = 1;
