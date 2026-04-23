-- Up

ALTER TABLE asset ADD COLUMN content TEXT;

UPDATE asset
   SET content = '{"resolution":"@1x"}'
 WHERE mime LIKE 'image/%';

-- Down

ALTER TABLE asset DROP COLUMN content;
