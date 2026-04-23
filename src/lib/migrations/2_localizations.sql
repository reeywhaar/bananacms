-- Up

CREATE TABLE localizations (
  id      TEXT NOT NULL PRIMARY KEY,
  key     TEXT NOT NULL,
  locale  TEXT NOT NULL,
  text    TEXT NOT NULL
);

CREATE UNIQUE INDEX localizations_ix_key_locale ON localizations (key, locale);
CREATE INDEX         localizations_ix_key        ON localizations (key);

CREATE TRIGGER trg_category_delete AFTER DELETE ON category BEGIN
  DELETE FROM localizations WHERE key LIKE 'category:' || old.id || ':%';
END;

CREATE TRIGGER trg_post_delete AFTER DELETE ON post BEGIN
  DELETE FROM localizations WHERE key LIKE 'post:' || old.id || ':%';
END;

CREATE TRIGGER trg_block_delete AFTER DELETE ON block BEGIN
  DELETE FROM localizations WHERE key LIKE 'block:' || old.id || ':%';
END;

-- Down

DROP TRIGGER trg_block_delete;
DROP TRIGGER trg_post_delete;
DROP TRIGGER trg_category_delete;
DROP INDEX localizations_ix_key;
DROP INDEX localizations_ix_key_locale;
DROP TABLE localizations;
