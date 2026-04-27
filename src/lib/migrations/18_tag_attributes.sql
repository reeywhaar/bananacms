-- Up

-- Cascade attribute rows when a tag is deleted (mirrors the same trigger on
-- post/category/page/block from migration 17). SQLite FKs can't reference
-- polymorphic columns, so the cascade is manual.
CREATE TRIGGER trg_tag_delete_children_attributes AFTER DELETE ON tag BEGIN
  DELETE FROM attribute WHERE id IN (
    SELECT attributeId FROM parent_attribute WHERE parentTable = 'tag' AND parentId = old.id
  );
END;

-- Down

DROP TRIGGER trg_tag_delete_children_attributes;
