import type { MigrationEntry } from './migration.ts'
import m1700000001 from './001700000001_initial.ts'
import m1700000002 from './001700000002_localizations.ts'
import m1700000003 from './001700000003_assets.ts'
import m1700000005 from './001700000005_fix_asset_cascade.ts'
import m1700000006 from './001700000006_shortid.ts'
import m1700000007 from './001700000007_pages_category.ts'
import m1700000008 from './001700000008_parent_tables.ts'
import m1700000009 from './001700000009_pages.ts'
import m1700000010 from './001700000010_drop_pages_category.ts'
import m1700000011 from './001700000011_users_and_tokens.ts'
import m1700000012 from './001700000012_parent_asset.ts'
import m1700000013 from './001700000013_asset_content.ts'
import m1700000014 from './001700000014_asset_output_as.ts'
import m1700000015 from './001700000015_tags.ts'
import m1700000016 from './001700000016_parent_post_position.ts'
import m1700000017 from './001700000017_attributes.ts'
import m1700000018 from './001700000018_tag_attributes.ts'
import m1700000019 from './001700000019_tag_blocks.ts'
import m1700000020 from './001700000020_parent_block_position.ts'
import m1700000021 from './001700000021_drop_block_type.ts'
import m1700000022 from './001700000022_post_fts.ts'
import m17830358063 from './017830358063_derived_authtoken.ts'
import m17831231180 from './017831231180_slug_indexes.ts'
import m17831245380 from './017831245380_drop_duplicate_indexes.ts'
import m17834727000 from './017834727000_asset_blob.ts'
import m1788736982582 from './1788736982582_derived_backup_state.ts'
import m1790392565582 from './1790392565582_derived_password_token.ts'

// The CMS's migrations, listed statically so they're part of the production
// bundle. A new migration goes in a new <Date.now()>_<name>.ts file and a line
// here; docs/migrations.md explains the ids.
export const cmsMigrations: MigrationEntry[] = [
  { id: 1700000001, name: 'initial', migration: m1700000001 },
  { id: 1700000002, name: 'localizations', migration: m1700000002 },
  { id: 1700000003, name: 'assets', migration: m1700000003 },
  { id: 1700000005, name: 'fix_asset_cascade', migration: m1700000005 },
  { id: 1700000006, name: 'shortid', migration: m1700000006 },
  { id: 1700000007, name: 'pages_category', migration: m1700000007 },
  { id: 1700000008, name: 'parent_tables', migration: m1700000008 },
  { id: 1700000009, name: 'pages', migration: m1700000009 },
  { id: 1700000010, name: 'drop_pages_category', migration: m1700000010 },
  { id: 1700000011, name: 'users_and_tokens', migration: m1700000011 },
  { id: 1700000012, name: 'parent_asset', migration: m1700000012 },
  { id: 1700000013, name: 'asset_content', migration: m1700000013 },
  { id: 1700000014, name: 'asset_output_as', migration: m1700000014 },
  { id: 1700000015, name: 'tags', migration: m1700000015 },
  { id: 1700000016, name: 'parent_post_position', migration: m1700000016 },
  { id: 1700000017, name: 'attributes', migration: m1700000017 },
  { id: 1700000018, name: 'tag_attributes', migration: m1700000018 },
  { id: 1700000019, name: 'tag_blocks', migration: m1700000019 },
  { id: 1700000020, name: 'parent_block_position', migration: m1700000020 },
  { id: 1700000021, name: 'drop_block_type', migration: m1700000021 },
  { id: 1700000022, name: 'post_fts', migration: m1700000022 },
  { id: 17830358063, name: 'derived_authtoken', migration: m17830358063 },
  { id: 17831231180, name: 'slug_indexes', migration: m17831231180 },
  { id: 17831245380, name: 'drop_duplicate_indexes', migration: m17831245380 },
  { id: 17834727000, name: 'asset_blob', migration: m17834727000 },
  { id: 1788736982582, name: 'derived_backup_state', migration: m1788736982582 },
  { id: 1790392565582, name: 'derived_password_token', migration: m1790392565582 },
]
