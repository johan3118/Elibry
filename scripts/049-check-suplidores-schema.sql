-- Check the current structure of the suplidores table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'suplidores'
ORDER BY ordinal_position;

-- Also show a sample record to understand the data structure
SELECT * FROM suplidores LIMIT 1;
