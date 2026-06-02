-- Check the structure of the suplidores table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'suplidores'
ORDER BY ordinal_position;

-- Also get a sample of data to see what fields exist
SELECT * FROM suplidores LIMIT 5;
