-- Up

ALTER TABLE parent_post ADD COLUMN position REAL NOT NULL DEFAULT 0;

UPDATE parent_post AS pp
   SET position = (
     SELECT rn FROM (
       SELECT postId,
              ROW_NUMBER() OVER (PARTITION BY parentTable, parentId ORDER BY postId DESC) AS rn
         FROM parent_post
     ) s
     WHERE s.postId = pp.postId
   );

CREATE INDEX parent_post_ix_parent_position
  ON parent_post (parentTable, parentId, position);

-- Down

DROP INDEX parent_post_ix_parent_position;
ALTER TABLE parent_post DROP COLUMN position;
