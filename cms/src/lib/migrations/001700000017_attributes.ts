import { createMigration } from './migration.ts'

export default createMigration({
  async up(client) {
    await client.executeMultiple(`
CREATE TABLE attribute (
  id           TEXT NOT NULL PRIMARY KEY,
  key          TEXT NOT NULL,
  translatable INTEGER NOT NULL DEFAULT 0 CHECK (translatable IN (0, 1)),
  text         TEXT NOT NULL DEFAULT ''
);

CREATE TABLE parent_attribute (
  attributeId TEXT NOT NULL PRIMARY KEY,
  parentId    TEXT NOT NULL,
  parentTable TEXT NOT NULL,

  CONSTRAINT parent_attribute_fk_attributeId FOREIGN KEY (attributeId)
    REFERENCES attribute (id) ON UPDATE CASCADE ON DELETE CASCADE
);
CREATE INDEX parent_attribute_ix_parent ON parent_attribute (parentTable, parentId);

CREATE TRIGGER trg_attribute_delete AFTER DELETE ON attribute BEGIN
  DELETE FROM localizations WHERE key LIKE 'attribute:' || old.id || ':%';
END;

CREATE TRIGGER trg_post_delete_children_attributes AFTER DELETE ON post BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'post' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_category_delete_children_attributes AFTER DELETE ON category BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'category' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_page_delete_children_attributes AFTER DELETE ON page BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'page' AND parentId = old.id
  );
END;

CREATE TRIGGER trg_block_delete_children_attributes AFTER DELETE ON block BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'block' AND parentId = old.id
  );
END;
    `)
  },

  async down(client) {
    await client.executeMultiple(`
DROP TRIGGER trg_block_delete_children_attributes;
DROP TRIGGER trg_page_delete_children_attributes;
DROP TRIGGER trg_category_delete_children_attributes;
DROP TRIGGER trg_post_delete_children_attributes;
DROP TRIGGER trg_attribute_delete;
DROP INDEX parent_attribute_ix_parent;
DROP TABLE parent_attribute;
DROP TABLE attribute;
    `)
  },
})
