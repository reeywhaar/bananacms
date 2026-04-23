-- Up

ALTER TABLE category ADD COLUMN shortid TEXT NOT NULL DEFAULT '';
UPDATE category SET shortid = substr(id, length(id) - 7);
CREATE UNIQUE INDEX category_ix_shortid ON category (shortid);

ALTER TABLE post ADD COLUMN shortid TEXT NOT NULL DEFAULT '';
UPDATE post SET shortid = substr(id, length(id) - 7);
CREATE UNIQUE INDEX post_ix_shortid ON post (shortid);

-- Down

DROP INDEX post_ix_shortid;
ALTER TABLE post DROP COLUMN shortid;

DROP INDEX category_ix_shortid;
ALTER TABLE category DROP COLUMN shortid;
