import { createMigration } from './migration.ts'

// Image and file blocks drop the name they kept: a copy of their file's name from
// when it was dropped, or the text of a link to it. What a file is called is its
// asset's filename, which a download is saved as and the admin shows.
export default createMigration({
  async up(tx) {
    await tx.execute(`
UPDATE block SET content = json_remove(content, '$.name')
 WHERE json_extract(content, '$.type') IN ('image', 'asset')
   AND json_type(content, '$.name') IS NOT NULL
    `)
  },

  // each block gets its asset's filename as its name
  async down(tx) {
    await tx.execute(`
UPDATE block SET content = json_set(content, '$.name', coalesce(
  (SELECT filename FROM asset WHERE asset.id = json_extract(block.content, '$.assetId')), ''))
 WHERE json_extract(content, '$.type') IN ('image', 'asset')
    `)
  },
})
