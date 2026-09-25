# Migrations

Migrations create and change the tables in the two SQLite databases in `DATA_PATH`: `database.db` holds the content, and `derived.db` holds sessions and backup state.

## Files

- The CMS's migrations are in `cms/src/lib/migrations/`, and each one has a line in that folder's `index.ts`.
- A site's migrations are in its `src/lib/migrations/`, where the CMS finds them with `import.meta.glob`. Every `.ts` file there is a migration.

The first database access in a process runs every migration that the `migrations` table in `database.db` doesn't list yet, the CMS's and the site's together, in id order. Each one runs in a transaction that also adds its id and name to that table. `bananacms db migration run` runs them the same way, without starting the site, and then checks the foreign keys.

`bananacms db migration check` fails unless a site's databases are what its migrations make: every migration has run, none has run that the CMS and the site don't have, and both databases have the schema a new pair gets from the migrations. It only reads them, so it can run while the site does, in CI or before a deploy. The demo's tests run it on a database seeded from `demo/seed/`.

## Ids are timestamps in milliseconds

A migration's file is named `<id>_<name>.ts`, and the id is `Date.now()` at the time you create it: 13 digits. `bananacms db migration create post_summary` creates the file with that name, and an up and a down to fill in. By hand:

```sh
node -p 'Date.now()'   # 1790312345678, so: 1790312345678_post_summary.ts
```

This is the rule that most often goes wrong, because a wrong id still works on your own database. That database has run every other migration already, so the new one runs last whatever its id. A fresh database runs them all in id order, and an id shorter than 13 digits sorts before migrations it may depend on:

- A sequential number: `0027_post_summary.ts` is id 27, and runs before `initial` has created any tables.
- Seconds from `date +%s`, 10 digits: they sort between `post_fts` and `derived_authtoken`, before the five newest migrations.
- A copy of a neighbor's shape, like `017834727001_asset_blob_mime.ts`: it sorts before `derived_backup_state`.

So the mistake surfaces later and somewhere else: in the tests, in CI, or on the next new install.

Timestamps also keep apart the migrations written at the same time, on two branches or in the CMS and a site. Two migrations with the same id never both run: where one has run, the runner skips the other.

The CMS checks the ids:

- A site migration with any other id fails the first database access, before any migration runs. The error names the file and suggests a name with a fresh id.
- For the CMS's own migrations, `index.test.ts` does the same, letting through only the older ids below. It also checks that `index.ts` lists every file under the id and name in its file name.

### The older ids

The CMS's older migrations have ids in three shapes: `1700000001` to `1700000022`, eleven digits like `17830358063`, and `1788736982582`, the first one in milliseconds. They sort in the right order only because each shape is longer than the one before it. New migrations take a 13-digit `Date.now()`, whatever the files next to them look like.

Leave the older ids as they are. Each database records the ids it has run, so changing an id runs that migration again.

A database from before migrations had these ids lists its migrations under others, like 1 to 20. `bananacms db backfill migration-ids` gives those rows the ids the files have now, matched by name, so the migrations don't run again.

The id is the number in the file name, and leading zeros don't count: `001700000001_initial.ts` is id 1700000001.

## Names

`<name>` is snake_case and says what changes, like `post_summary`. Names are unique across the CMS's and the site's migrations: of two with the same name, only the one with the lower id runs.

## Writing one

```ts
// src/lib/migrations/1790312345678_post_summary.ts
import { createMigration } from '@reeywhaar/bananacms'

export default createMigration({
  async up(tx) {
    await tx.execute('ALTER TABLE post ADD COLUMN summary TEXT')
  },

  async down(tx) {
    await tx.execute('ALTER TABLE post DROP COLUMN summary')
  },
})
```

- `up` makes the change and `down` undoes it. Both get a transaction on `database.db`, and a client for `derived.db` as their second argument.
- `foreignKeys: false` runs the migration with foreign keys off. A migration that rebuilds a table (a new table, a copy of the rows, a drop of the old one and a rename) needs it: with foreign keys on, dropping the old table fires `ON DELETE CASCADE` and deletes the rows that reference it.
- In the CMS, a migration imports `createMigration` from `./migration.ts`, and `index.ts` gets an import and a line for it.

## Where it lives

- [`cms/src/lib/migrations/`](../cms/src/lib/migrations/): the CMS's migrations, with `index.ts` listing them, and `migration.ts` defining their shape and checking file names.
- [`cms/src/lib/db/client.ts`](../cms/src/lib/db/client.ts): `runMigrations`, which merges, sorts and runs them.
- [`cms/src/framework/databases.ts`](../cms/src/framework/databases.ts): opens both databases on first use, finds the site's migrations and runs everything.
