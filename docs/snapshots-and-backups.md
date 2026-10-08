# Snapshots and backups

The CMS keeps copies of a site's data two ways. Both are off until their variables are set.

## Snapshots

`SNAPSHOTS_COUNT` turns them on: copies of `database.db`, the content, in `DATA_PATH/snapshots`, where the CLI can list and restore them. `derived.db`, which holds the sessions, has none.

- **When:** as `bananacms dev` or `start` starts and as it stops, and `SNAPSHOTS_DELAY` seconds after a write to the site's database, 600 by default. The writes made in that time go into the same snapshot, and those still waiting when the site stops go into the one it takes then. A snapshot the same as the newest one isn't written.
- **How many:** `SNAPSHOTS_COUNT`. Past the count, the oldest is removed. The SQL dumps and diffs that snapshots were in earlier versions are removed once the first copy is written.
- **The files:** each is a whole SQLite database, uploads included, made with `VACUUM INTO`, which copies the database as of one moment, page by page, so a snapshot of any size takes little memory. Its name is `snapshot_<YYYYMMDD_HHmmssSSS>_<hash>.db`: when it was taken, in UTC, and the start of the file's sha256, which tells an unchanged database from a changed one, and which the CLI checks on the way back. `sqlite3` opens one as it is.

```sh
bananacms snapshot list              # 1 is the newest
bananacms snapshot restore 2
```

`snapshot restore` works only while the site is stopped: `dev` and `start` keep a `.pid` file in the site's directory while they run, and warn when another server of the site has one. It copies the snapshot beside `database.db` and checks it, its hash and SQLite's integrity check, then snapshots the database as it is, so a restore can be undone, and swaps the copy in.

## Backups

`BACKUP_URL` turns them on: archives of the databases, sent to a backup agent, which keeps them wherever it keeps things. The CMS holds no credentials for the storage.

- **The request:** a multipart `POST` to `BACKUP_URL`, with the archive under `backup` and its name, `bananacms-<YYYYMMDD_HHmmss>.tgz`, under `name`. Any 2xx answer means the agent took it.
- **The archive:** a gzipped tar of `database.db`, and `derived.db` unless `BACKUP_MODE` is `main`. Each is copied with SQLite's `VACUUM INTO`, which gives the database as of one moment even while the site writes to it.
- **When:** while `dev` or `start` runs, every five minutes, and once more as it stops, only when `database.db` has changed since the archive the agent last took. Finding out costs a read: SQLite says whether anything was committed, and only then is a copy made and compared.
- **`BACKUP_MODE`:** `main` sends `database.db` alone; `relaxed`, the default, adds `derived.db`, so a restore keeps everybody signed in; `all` also sends every half hour, so the agent can tell a stalled site from a quiet one.

`bananacms backup now` sends an archive straight away, unless the agent has one of this database already. It can run while the site does. What the agent last took is recorded in `derived.db`'s `backup_state` table.

## Stopping

`dev` and `start` stop on SIGINT (Ctrl-C) or SIGTERM, which `docker stop` and systemd send, and `dev` on `q` too. In order, they:

1. stop taking requests; `start` gives those under way 5 seconds to finish;
2. close the app's databases, dropping a scheduled snapshot that's still waiting out its delay;
3. take a snapshot, when `SNAPSHOTS_COUNT` is set, with the writes that one was waiting for;
4. send a last backup, when `BACKUP_URL` is set and `database.db` has changed since the last one;
5. fold each database's `-wal` file into it, and remove its `-wal` and `-shm` files, so that while the site is down its `.db` files hold all of its data, and a copy of `DATA_PATH` misses nothing;
6. remove the `.pid` file, and exit with 0.

A second signal exits straight away, without the rest. The data is safe in the `-wal` files, which SQLite reads back as the site starts.

## Where it lives

- [`cms/src/lib/snapshots/`](../cms/src/lib/snapshots/): the files, the store that takes, removes and restores them, and the scheduler.
- [`cms/src/lib/backup/`](../cms/src/lib/backup/): the archives, the tar writer, and the loop that sends them.
- [`cms/src/framework/databases.ts`](../cms/src/framework/databases.ts): the scheduler, started with the site's databases, which the requests' writes wake.
- [`cms/src/cli/site_services.ts`](../cms/src/cli/site_services.ts): what `dev` and `start` run around the server: the `.pid` file, the snapshots as the site starts and stops, the backup loop, and the shutdown. [`cli/snapshot.ts`](../cms/src/cli/snapshot.ts): the `snapshot` and `backup` commands.
