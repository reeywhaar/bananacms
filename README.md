# bananacms

A CMS and React Server Components framework on Vite 8, plus a demo site built on it. The package is `@reeywhaar/bananacms`, on GitHub Packages ([Releasing](#releasing)). It opens the databases of the package's releases up to 0.0.1-alpha.5, which run on Next.js, as they are.

It requires Node 26.

```sh
npm install
cp demo/.env.example demo/.env
npm run demo:seed                # the demo's content, and the user demo, password demo
npm run dev                      # http://localhost:5173, admin at /manage
```

## Layout

```
cms/    the package, @reeywhaar/bananacms: CLI, RSC framework, /manage admin
demo/   a site built on it
```

## Scripts

Run these from the repo root.

| Script                          |                                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev \| build \| start` | run the demo through the CLI (`build` typechecks first)                               |
| `npm run demo:seed`             | make the demo's databases again from `demo/seed/` ([its README](demo/seed/README.md)) |
| `npm test`                      | unit tests (`cms/src/**/*.test.ts`) and end-to-end tests (`cms/test/`, `demo/test/`)  |
| `npm run test:watch`            | the same in watch mode                                                                |
| `npm run typecheck`             | TypeScript 7 over both workspaces                                                     |
| `npm run format`                | Prettier (`format:check` only checks)                                                 |
| `npm run release -- <bump>`     | release a new version of the package ([Releasing](#releasing))                        |
| `npm run tgz:pack`              | pack the package into `private/bananacms.tgz`, the tarball a release publishes        |

The end-to-end tests run the real CLI (`bananacms dev`, then `build` and `start`) against the demo, and against the sites in `cms/test/`, whose routes reach the framework's corners: `site/`, and `groups-site/`, laid out with root layouts in route groups. Each server gets a throwaway database, and the tests use it over HTTP the way a browser without JavaScript would.

## CLI

Run it in the site directory. It reads the site's `.env`.

| Command                                              |                                                                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bananacms dev [-p <port>] [--host [host]]`          | dev server with hot reload                                                                                                                        |
| `bananacms build`                                    | production build into `dist/`                                                                                                                     |
| `bananacms start [-p <port>] [--host <host>]`        | serve `dist/` (port defaults to `$PORT`, then 3000)                                                                                               |
| `bananacms db migration run [--force]`               | run the migrations that haven't run, as the server does on its first request; `--force` runs every down first, then every up, which can drop data |
| `bananacms db migration check`                       | fail unless the databases are what the migrations make: each one run, none unknown, and the same schema                                           |
| `bananacms db migration create <name>`               | create `src/lib/migrations/<Date.now()>_<name>.ts` ([docs/migrations.md](docs/migrations.md))                                                     |
| `bananacms db cleanup [--dry-run]`                   | delete posts in no category, and the blocks, attributes and assets that nothing uses, then vacuum                                                 |
| `bananacms db backfill image-dimensions [--dry-run]` | fill in the width and height of image assets that have none                                                                                       |
| `bananacms db backfill audio-meta [--dry-run]`       | fill in audio assets' duration, bitrate, sample rate, channels, codec and tags                                                                    |
| `bananacms db backfill post-fts`                     | build the search index of every post again                                                                                                        |
| `bananacms db backfill migration-ids [--dry-run]`    | give an older database's migrations table the ids its migration files have now                                                                    |
| `bananacms user create <name>`                       | print an invitation: a link where the user sets a password, which creates them, once, within 7 days                                               |
| `bananacms user reset <name>`                        | print a recovery link, where a user sets a new password, once, within 24 hours; it signs them out everywhere else                                 |
| `bananacms assets cleanup [--dry-run]`               | delete the files in `ASSETS_DIRECTORY` that belong to no asset                                                                                    |
| `bananacms snapshot list`                            | list the snapshots of `database.db`, 1 being the newest ([docs/snapshots-and-backups.md](docs/snapshots-and-backups.md))                          |
| `bananacms snapshot view <n> [--raw]`                | print snapshot `<n>` as the SQL that makes the database, or as its file has it                                                                    |
| `bananacms snapshot restore <n>`                     | replace `database.db` with snapshot `<n>`, snapshotting the current one first; the site must be stopped                                           |
| `bananacms backup now`                               | back the databases up to `BACKUP_URL` now                                                                                                         |

`dev` and `start` stop on Ctrl-C or SIGTERM, and `dev` on `q` too. They stop taking requests, take a last snapshot and send a last backup when those are on, fold each database's `-wal` file into its `.db` file, and exit with 0. A second signal exits straight away ([docs/snapshots-and-backups.md](docs/snapshots-and-backups.md#stopping)).

## Environment

| Variable           |                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATA_PATH`        | directory for the SQLite databases (`database.db` and `derived.db`), created on first use; `dev` and `start` need it          |
| `ASSETS_DIRECTORY` | directory that caches uploaded files and the image variants made from them; `dev` and `start` need it                         |
| `LOG_LEVEL`        | the lowest log level written: `debug`, `info` (default), `warn` or `error`                                                    |
| `LOG_FORMAT`       | `dev` for one line per entry, `json` for one JSON object; production defaults to `json`                                       |
| `SNAPSHOTS_COUNT`  | how many snapshots of `database.db` to keep, in `DATA_PATH/snapshots`; unset or 0, none are taken                             |
| `SNAPSHOTS_DELAY`  | how many seconds after a write its snapshot is taken, 600 by default                                                          |
| `BACKUP_URL`       | a backup agent that takes archives of the databases in a multipart POST; unset, none are sent                                 |
| `BACKUP_MODE`      | `main` sends `database.db`, `relaxed` (the default) adds `derived.db`, `all` also sends every half hour                       |
| `SERVER_URL`       | the site's address, like `https://example.com`, which the links of `user create` and `user reset` go on; unset, they're paths |

## Writing a site

A site has no Vite config of its own. Its routes are files in `src/app/`, like the Next.js App Router, with `:name` folders for dynamic segments:

```
src/app/layout.tsx           root layout: renders <html> and <body>
src/app/page.tsx             /
src/app/posts/:id/page.tsx   /posts/abc, with params.id = 'abc'
src/app/not-found.tsx        pages that call notFound(), and unknown URLs
src/app/error.tsx            what throws in a page or a layout below the root one
src/app/rss/route.ts         /rss, answered by its GET(ctx)
src/app/sitemap.ts           /sitemap.xml
```

[docs/routing.md](docs/routing.md) covers the whole scheme: catch-alls, route groups, precedence, layouts, not-found and navigation.

- Pages, layouts and server actions get the request's context, `ctx`: the request, its cookies, a logger, the databases and the signed-in user, through `getRequest(ctx)`, `getDb(ctx)` and the like. The site's `src/middleware.ts` can add values of its own. See [docs/context.md](docs/context.md).
- CMS content comes through the stores in `@reeywhaar/bananacms/stores`: `new PostStore(getDb(ctx))`. A site's own Node scripts, which have no request, open the databases with `openDatabases()` from there, as the demo's seed does.
- Pages and layouts declare their title and other `<head>` tags with `metadata` or `generateMetadata()`, as in Next.js ([docs/routing.md](docs/routing.md#metadata)).
- `route.ts` files answer HTTP requests with a function per method, and a `sitemap.ts` serves `sitemap.xml` ([docs/routing.md](docs/routing.md#route-handlers)).
- `src/cms.ts` names the languages content is translated into, with `createCMS({ locales })`.
- Client components can use `useRouter()`, `useSearchParams()`, `usePathname()`, `useNavigationPending()` and `<Link>` from `@reeywhaar/bananacms/client`. Pages, middleware and server actions can call `redirect()`.
- The site's own database migrations go in `src/lib/migrations/`, named `<Date.now()>_<name>.ts`. See [docs/migrations.md](docs/migrations.md).
- Add `"@reeywhaar/bananacms/types"` to `compilerOptions.types` in the site's tsconfig.
- Tailwind v4 is built in. Import a CSS file containing `@import 'tailwindcss'` from the root layout.
- CSS modules (`*.module.css`) work in server and client components alike. For Sass (`.scss`, `.sass`), add `sass` to the site's devDependencies. The demo styles its block frames and its loading bar this way.
- Fonts are self-hosted from [Fontsource](https://fontsource.org) packages: import a font's CSS from the root layout, like `@fontsource-variable/noto-sans-display/wdth.css`, and name its family in CSS. Its files are served from the site, like its other assets. The demo does this.
- The `paths` in the site's `tsconfig.json`, like `"@app/*": ["./src/*"]`, work in imports, and in CSS too: Sass's `@use '@app/styles/mixins.scss'` included.

## Docs

- [docs/routing.md](docs/routing.md): how files in `src/app/` become routes.
- [docs/context.md](docs/context.md): the request's `ctx`, middleware, server actions and logging.
- [docs/migrations.md](docs/migrations.md): database migrations, and the timestamp ids they need.
- [docs/snapshots-and-backups.md](docs/snapshots-and-backups.md): copies of the site's data, kept beside it and sent away.
- [docs/conventions.md](docs/conventions.md): commits, comments and code style.

## How it works

- `cms/src/framework/`: RSC plumbing adapted from the `@vitejs/plugin-rsc` starter. `entry.rsc.tsx` builds each request's `ctx`, runs the middleware, and handles RSC rendering and server actions. `entry.ssr.tsx` renders HTML, and `entry.browser.tsx` handles hydration and client navigation. `app.tsx` sends `/manage` to the admin and everything else to the site's routes, whose metadata `metadata.ts` resolves and `metadata-tags.tsx` renders. `route-handlers.ts` answers `route.ts` and `sitemap.ts` URLs. `routes.ts` finds those with `import.meta.glob`, and `route-table.ts` matches URLs to them with `URLPattern`. The admin and each page and layout are separate server chunks, so the site's and the admin's stylesheets stay separate.
- `cms/src/cli/`: the commander CLI. `vite-config.ts` is the Vite config every site runs with, and `site-services.ts` what `dev` and `start` run around the server: the `.pid` file, the snapshots and backups, and the shutdown.
- `cms/src/lib/` and `cms/src/services/`: the data layer: SQLite through `@libsql/client` and drizzle, the schema and migrations in `lib/`, and the stores with their query builder in `services/`. `framework/databases.ts` opens both databases on first use and runs the migrations.
- `cms/src/screens/Manage/` and `cms/src/components/`: the admin: its screens and components, which read through `ctx` and write through server actions. `screens/Manage/ManageApp.tsx` routes `/manage` URLs to the screens.
- `cms/src/lib/auth.ts`: sessions, in the `auth` cookie and derived.db's `authtoken` table, the gate that sends visitors of `/manage` to its login page, and the passwords set at the links of `user create` and `user reset`, whose tokens `services/PasswordTokenStore.ts` keeps in derived.db, hashed. `lib/assetDelivery.ts` serves uploaded files and image variants at `/d/…`, and `lib/assetFastPath.ts` serves a variant that's already encoded straight from its file in `ASSETS_DIRECTORY`, ahead of the databases and the session.
- `cms/src/lib/logger/`: the logger, with children whose labels join: `[Request] [Auth]`.
- Streamed blocks need JavaScript to swap in, so browsers without it are redirected to `?__nojs`, where the whole page is sent at once.

## The demo

A site of recipes and early films, in English, French and Spanish, whose content all comes from the CMS: `npm run demo:seed` writes it from `demo/seed/`, which [its README](demo/seed/README.md) describes. `/manage` is the admin, where the user demo, password demo, edits it.

- Each page's URL starts with its language: `/en`, `/fr`, `/es`. `/` goes to the one the browser asks for first, which `src/middleware.ts` puts in `ctx`.
- The home page's hero, poll and ripeness guide are the blocks of the CMS's "Main page". A vote is a server action that updates the poll's counts, kept as JSON in one of its blocks, and the slider is a client component.
- `/recipes` and `/movies` list a category's posts, and each post's page shows its blocks: text as markdown, HTML or plain, images in variants for each pixel density, galleries, a recipe card as a PDF, and links. Drafts show only to a signed-in user.
- The tags have pages, `/search` searches the posts' texts in the page's language, and `/credits` names the author of each photo and film still.

## Releasing

`npm run release -- <major|minor|patch|prealpha>`, on a clean working tree, bumps the version in `cms/package.json`, as `prealpha` does from 0.0.1-alpha.5 to 0.0.1-alpha.6. It commits the bump as `Release <version>`, tags the commit with the version, and pushes both. The tag starts [the publish workflow](.github/workflows/publish.yml), which publishes the package to GitHub Packages under the dist-tag of its prerelease, like `alpha`, or else `latest`.

A site installs it with an `.npmrc` that routes the `@reeywhaar` scope there, and a `GITHUB_TOKEN` with the `read:packages` scope in the environment:

```
@reeywhaar:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

Or from the tarball `npm run tgz:pack` makes, `private/bananacms.tgz`: `"@reeywhaar/bananacms": "file:<its path>"` in the site's dependencies.

The CLI and the framework run as TypeScript source. That works inside this workspace, but Node won't strip types in `node_modules`, so the package needs a build step before a site can run it as a dependency.

## Dev container

`.devcontainer/` runs the repo in a Debian container with the latest Node, in VS Code or any editor that supports dev containers. The `node_modules` folders and `demo/dist` live in Docker volumes named after the repo's folder, and so does the shell history.
