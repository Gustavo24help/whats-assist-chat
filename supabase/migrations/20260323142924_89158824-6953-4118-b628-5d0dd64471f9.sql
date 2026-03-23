UPDATE whatsapp_templates
SET variables = (
  SELECT jsonb_agg(trim(both '"' from elem #>> '{}'))
  FROM jsonb_array_elements(variables::jsonb) AS elem
)
WHERE variables IS NOT NULL 
  AND variables::text LIKE '%\"%'
  AND jsonb_array_length(variables::jsonb) > 0;