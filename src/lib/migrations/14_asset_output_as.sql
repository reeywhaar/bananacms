-- Up

UPDATE asset
   SET content = json_set(COALESCE(content, '{}'), '$.output_as', json('{"type":"original"}'))
 WHERE mime LIKE 'image/%';

-- Down

UPDATE asset
   SET content = json_remove(content, '$.output_as')
 WHERE mime LIKE 'image/%';
