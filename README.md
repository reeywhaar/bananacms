# bananacms

A CMS and a React Server Components framework on Vite 8, in one package, `@reeywhaar/bananacms`, plus a demo site built on it. A site is its routes in `src/app/`, as in the Next.js App Router, and the CMS brings the admin at `/manage`, the stores that read its content, the files and images at `/d/`, and a CLI that runs it all as one server. It opens the databases of the package's releases up to 0.0.1-alpha.5, which run on Next.js, as they are.

> **Status:** alpha. What the package exports can change from one release to the next.

## Contents

- [What's in the box](#whats-in-the-box)
- [How a request runs](#how-a-request-runs)
- [Layout](#layout)
- [Requirements](#requirements)
- [Quick start](#quick-start)
- [Installation](#installation)
- [Setting up a site](#setting-up-a-site)
- [Writing a site](#writing-a-site)
- [CLI](#cli)
- [Environment](#environment)
- [Running in production](#running-in-production)
- [Moving a site from bananacms on Next.js](#moving-a-site-from-bananacms-on-nextjs)
- [The demo](#the-demo)
- [How it works](#how-it-works)
- [Development](#development)
- [Releasing](#releasing)
- [Dev container](#dev-container)
- [Docs](#docs)
- [License](#license)

## What's in the box

- **The admin** at `/manage`: posts, categories, tags and pages, each with blocks: text (plain, markdown or HTML), images, files, meta values and groups of blocks. Each has attributes, and a translation into each of the site's languages, and posts can be drafts. Its users are invited from the CLI.
- **The stores** in `@reeywhaar/bananacms/stores`: `PostStore`, `CategoryStore`, `TagStore`, `PageStore`, `BlockStore`, `AttributeStore`, `AssetStore`, `LocalizationStore`, `PostSearchStore`, `UserStore` and `AuthTokenStore`, with a query builder for posts, categories, tags and pages.
- **Files and images** at `/d/…`: a file as it was uploaded, with range requests, and an image in variants for screens of 1, 2 and 3 pixels per point, in the original's format, JPEG or WebP. A variant is encoded on its first request and kept in `ASSETS_DIRECTORY`.
- **The framework:** file routes in `src/app/`, with layouts, not-found and error pages, metadata, route handlers and sitemaps. The request's context, `ctx`, reaches pages, layouts, server actions and middleware. Client-side navigation goes through `<Link>`, content streams in through Suspense, and a no-JS mode sends each page whole.
- **The data:** SQLite, in `database.db` for the content and users, and `derived.db` for sessions, password links and backup state, through `@libsql/client` and drizzle. The CMS and the site each have migrations. Snapshots are kept beside the data, and backups go to an agent.
- **The CLI:** `bananacms dev`, `build` and `start`, and commands for migrations, users, cleanups, backfills, snapshots and backups.
- **Safe defaults:** `/manage` is for signed-in users only, and a visitor without a session runs only public server actions. A request's body takes up to 100 MB with a session and 1 MB without. Sessions are kept as their tokens' SHA-256, and the login makes a username wait after 5 wrong passwords in 15 minutes.

## How a request runs

One process serves the site, the admin and the files, on one port: `bananacms dev` through Vite's dev server, with hot reload, and `bananacms start` through srvx, from the build in `dist/`.

```
request
  │  the CMS's middleware
  ├─ the request log
  ├─ an image variant already in ASSETS_DIRECTORY ──────▶ the file
  ├─ the databases
  ├─ /d/: an uploaded file, or a variant encoded now ───▶ the file
  ├─ the session, from the auth cookie
  ├─ the /manage gate, for a visitor without one ───────▶ the login page
  │  the site's middleware, src/middleware.ts
  ├─ route.ts, sitemap.ts ──────────────────────────────▶ their Response
  └─ a page, /manage's included, or an action and the page it renders again
       ──▶ React Server Components ──▶ HTML, or the RSC payload of a client-side navigation
```

## Layout

```
cms/                       the package, @reeywhaar/bananacms
  bin/bananacms.js         the CLI
  src/cli/                 its commands; the Vite config every site runs with
  src/framework/           routes, rendering, middleware, ctx, server actions, navigation
  src/lib/                 the schema and migrations, auth, asset delivery, snapshots, backups, the logger
  src/services/            the stores and their query builder
  src/screens/Manage/      the admin's screens, and src/components/ their parts
  src/*.ts                 the package's exports: index.ts, client.ts, stores.ts, types.d.ts
  dist/                    not in git: the build a site installs, JavaScript and type declarations
  scripts/                 the build's copy of what tsc doesn't write
  test/                    end-to-end tests, and the sites they run: site/ and groups_site/
demo/                      a site built on it
  src/                     its routes, blocks, components, cms.ts and middleware.ts
  seed/                    its content, as TypeScript, with its images and PDFs
  scripts/seed.ts          what npm run demo:seed runs
  test/                    its end-to-end tests
docs/                      the framework's and the CMS's docs
scripts/                   release and pack_latest
.github/workflows/         the publish workflow
.devcontainer/             the dev container
private/                   not in git: local files, like the tarball tgz:pack makes
```

## Requirements

- Node 26 or newer. The CLI and the framework are TypeScript, which Node runs by stripping the types.
- npm.

## Quick start

From the repo root:

```sh
npm install
cp demo/.env.example demo/.env
npm run demo:seed                # the demo's content, and the user demo, password demo
npm run dev                      # the demo on the dev server
```

The dev server says where it listens, and logs each request:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
11:41:18 PM [vite] (rsc) connected.
11:41:18 PM [vite] (ssr) connected.
[23:41:19.321] [INF] [67e85bf6] [Request] end status=200 durationMs=818.1 request={"method":"GET","path":"/en"} auth={"type":"guest"}
```

- http://localhost:5173 goes to the demo in the language the browser asks for first.
- http://localhost:5173/manage is the admin: sign in as demo, password demo.

## Installation

### In this repo

```sh
git clone git@github.com:Reeywhaar/bananacms.git
cd bananacms
npm install
```

npm's workspaces link `cms/` into `node_modules/@reeywhaar/bananacms`, where the demo finds it through its dependency `"@reeywhaar/bananacms": "*"`. A site of your own can live here the same way: a folder with a `package.json` like the demo's, added to `workspaces` in the root `package.json`.

### As a dependency

`@reeywhaar/bananacms` is published to GitHub Packages. A site routes the `@reeywhaar` scope there in its `.npmrc`:

```
@reeywhaar:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Packages needs a token even for public packages: create one with the `read:packages` scope at https://github.com/settings/tokens, and export it as `GITHUB_TOKEN` before installing.

```sh
npm install @reeywhaar/bananacms@alpha react react-dom
```

The releases are prereleases for now, under the dist-tag `alpha`, which a plain `npm install @reeywhaar/bananacms` or a range like `*` doesn't pick.

A site can also install the tarball `npm run tgz:pack` makes in this repo, `private/bananacms.tgz`, with `"@reeywhaar/bananacms": "file:<its path>"` in its dependencies.

The package ships its build, JavaScript and type declarations in `dist/`, so a site's typecheck covers its own code, and reads only the package's declarations.

## Setting up a site

A site is a folder like this one. It has no Vite config of its own: the CMS brings it.

```
my-site/
  package.json
  tsconfig.json
  .env
  src/cms.ts             the languages content is translated into; without it, English only
  src/index.css
  src/app/layout.tsx     the root layout
  src/app/page.tsx       /
```

```json
{
  "name": "my-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bananacms dev",
    "build": "bananacms build",
    "start": "bananacms start"
  },
  "dependencies": {
    "@reeywhaar/bananacms": "alpha",
    "react": "^19.3.0",
    "react-dom": "^19.3.0",
    "tailwindcss": "^4.3.3"
  },
  "devDependencies": {
    "@types/node": "^26.6.2",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "typescript": "^7.0.2"
  }
}
```

The `tsconfig.json` takes the CMS's ambient types, and runs as the CMS's code does: Node strips the types, so code uses erasable syntax only, and imports keep their `.ts` and `.tsx` extensions. `paths` are optional, and work in CSS too.

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ESNext", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true,
    "skipLibCheck": true,
    "types": ["node", "@reeywhaar/bananacms/types"],
    "paths": { "@app/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

```sh
# .env
DATA_PATH=./private
ASSETS_DIRECTORY=./private/assets
SERVER_URL=http://localhost:5173
```

```ts
// src/cms.ts
import { createCMS } from '@reeywhaar/bananacms'

export const cms = createCMS({
  locales: { default: 'en', locales: [{ code: 'en' }, { code: 'fr', flag: '🇫🇷' }] },
})
```

```css
/* src/index.css */
@import 'tailwindcss';
```

```tsx
// src/app/layout.tsx
import type { LayoutProps } from '@reeywhaar/bananacms'
import '../index.css'

export default function RootLayout(props: LayoutProps) {
  return (
    <html lang="en">
      <body>{props.children}</body>
    </html>
  )
}
```

```tsx
// src/app/page.tsx
import { getDb, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { PostStore } from '@reeywhaar/bananacms/stores'

export const metadata: Metadata = { title: 'Posts' }

export default async function Home(props: PageProps) {
  const posts = await new PostStore(getDb(props.ctx)).query().published().all()
  return (
    <ul>
      {posts.map((post) => (
        <li key={post.id}>{post.name}</li>
      ))}
    </ul>
  )
}
```

Then:

```sh
npm run dev                          # http://localhost:5173
npx bananacms user create admin      # a link where admin sets a password
```

- The server makes the databases in `DATA_PATH` on its first request, and runs the CMS's migrations and the site's. `bananacms db migration run` does the same without the server.
- The CMS creates no user. `dev` and `start` say so while the site has none, and `bananacms user create <name>` prints an invitation: a link on `SERVER_URL`, `/manage/invite?token=…`, where the user sets a password, once, within 7 days, and lands in the admin, signed in.
- In `/manage`, the admin creates the categories, posts, tags and pages that the site's routes read through the stores.

## Writing a site

Its routes are files in `src/app/`, like the Next.js App Router, with `:name` folders for dynamic segments:

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
- Server actions get `ctx` through `defineAction()`. One that visitors without a session run, like a poll's vote, is `defineAction(fn, { public: true })`; the others run only with a session ([docs/context.md](docs/context.md#server-actions)).
- `src/cms.ts` names the languages content is translated into, with `createCMS({ locales })`.
- Client components can use `useRouter()`, `useSearchParams()`, `usePathname()`, `useNavigationPending()` and `<Link>` from `@reeywhaar/bananacms/client`. Pages, middleware and server actions can call `redirect()`.
- The site's own database migrations go in `src/lib/migrations/`, named `<Date.now()>_<name>.ts`. See [docs/migrations.md](docs/migrations.md).
- Tailwind v4 is built in. Import a CSS file containing `@import 'tailwindcss'` from the root layout.
- CSS modules (`*.module.css`) work in server and client components alike. For Sass (`.scss`, `.sass`), add `sass` to the site's devDependencies. The demo styles its block frames and its loading bar this way.
- Fonts are self-hosted from [Fontsource](https://fontsource.org) packages: import a font's CSS from the root layout, like `@fontsource-variable/noto-sans-display/wdth.css`, and name its family in CSS. Its files are served from the site, like its other assets. The demo does this.
- The `paths` in the site's `tsconfig.json`, like `"@app/*": ["./src/*"]`, work in imports, and in CSS too: Sass's `@use '@app/styles/mixins.scss'` included.

The package's exports:

| Import                        | For                                                                                                                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@reeywhaar/bananacms`        | server code: the context's getters (`getDb`, `getAuth`, `getRequest`, …), `defineAction`, `notFound`, `redirect`, `createMigration`, `createCMS`, the asset URLs, and the types of pages, layouts, metadata, blocks and middleware |
| `@reeywhaar/bananacms/client` | client components: `Link`, `useRouter`, `usePathname`, `useSearchParams`, `useNavigationPending`, and `ErrorPageProps` for error pages                                                                                             |
| `@reeywhaar/bananacms/stores` | the stores, `openDatabases()` for a site's scripts, and `hashUserPassword()`                                                                                                                                                       |
| `@reeywhaar/bananacms/types`  | the ambient types, for `compilerOptions.types`                                                                                                                                                                                     |

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

`bananacms --help` lists them, and `bananacms help <command>` explains one.

## Environment

The CLI reads the site's `.env`, and the environment's variables go over it.

| Variable           |                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `DATA_PATH`        | directory for the SQLite databases (`database.db` and `derived.db`), created on first use; `dev` and `start` need it          |
| `ASSETS_DIRECTORY` | directory that caches uploaded files and the image variants made from them; `dev` and `start` need it                         |
| `SERVER_URL`       | the site's address, like `https://example.com`, which the links of `user create` and `user reset` go on; unset, they're paths |
| `PORT`             | the port `start` listens on when `-p` doesn't say, 3000 when unset                                                            |
| `LOG_LEVEL`        | the lowest log level written: `debug`, `info` (default), `warn` or `error`                                                    |
| `LOG_FORMAT`       | `dev` for one line per entry, `json` for one JSON object; production defaults to `json`                                       |
| `NO_COLOR`         | set, the `dev` log format writes no colors                                                                                    |
| `SNAPSHOTS_COUNT`  | how many snapshots of `database.db` to keep, in `DATA_PATH/snapshots`; unset or 0, none are taken                             |
| `SNAPSHOTS_DELAY`  | how many seconds after a write its snapshot is taken, 600 by default                                                          |
| `BACKUP_URL`       | a backup agent that takes archives of the databases in a multipart POST; unset, none are sent                                 |
| `BACKUP_MODE`      | `main` sends `database.db`, `relaxed` (the default) adds `derived.db`, `all` also sends every half hour                       |

## Running in production

```sh
npm run build          # bananacms build: the site and the admin, into dist/
npm run start          # bananacms start: serves dist/ on $PORT, or 3000
```

- `start` serves static files from `dist/client` only, and hands every other request to the app. Put a reverse proxy in front for TLS and connection limits, and set `SERVER_URL` to the site's address.
- `DATA_PATH` is the site's data: keep it on a disk that lasts, and turn on snapshots, and backups to an agent ([docs/snapshots-and-backups.md](docs/snapshots-and-backups.md)). `ASSETS_DIRECTORY` is a cache: the uploads live in the database too, and the variants are encoded again when asked for.
- `dev` and `start` stop on Ctrl-C or SIGTERM, and `dev` on `q` too. They stop taking requests, take a last snapshot and send a last backup when those are on, fold each database's `-wal` file into its `.db` file, and exit with 0. A second signal exits straight away ([docs/snapshots-and-backups.md](docs/snapshots-and-backups.md#stopping)).
- `dev --host` opens the dev server to the network, and it serves the files in the site's workspace to whoever reaches it, so keep it to networks you trust. `start` is what serves a site in production.

## Moving a site from bananacms on Next.js

- **The data:** point `DATA_PATH` at the folder with the site's `database.db` and `derived.db`, and `ASSETS_DIRECTORY` at its assets. If its `migrations` table lists ids like 1 to 20, run `bananacms db backfill migration-ids` first ([docs/migrations.md](docs/migrations.md#the-older-ids)). Then `bananacms db migration run` brings the databases up to date, and `bananacms db migration check` says whether they're what the migrations make. The users sign in as before, and their sessions carry on.
- **Snapshots and backups** keep their formats, so the snapshots already there restore as before.
- **The environment:** `NEXT_PUBLIC_SERVER_URL` is `SERVER_URL`. `SERVER_PORT`, `CMS_INTERNAL_URL` and `ALLOWED_HOSTS` go, since one server serves it all, on `-p` or `$PORT`.
- **The code:** `next.config.ts` and `createConfig()` go, as the CMS brings the Vite config. `src/cms.ts` keeps `createCMS({ locales })`. `src/proxy.ts` becomes `src/middleware.ts`, and `getServices()` becomes the context: `new PostStore(getDb(ctx))`. The asset helpers and block types of `@reeywhaar/bananacms/runtime` are in `@reeywhaar/bananacms`, and `combineProxies()` goes with the zones. Routes and Next's APIs map as the table in [docs/routing.md](docs/routing.md#migrating-from-nextjs) lists: `[id]` folders become `:id`, `next/navigation` becomes `@reeywhaar/bananacms/client`, and so on.

## The demo

A site of recipes and early films, in English, French and Spanish, whose content all comes from the CMS: `npm run demo:seed` writes it from `demo/seed/`, which [its README](demo/seed/README.md) describes. `/manage` is the admin, where the user demo, password demo, edits it.

- Each page's URL starts with its language: `/en`, `/fr`, `/es`. `/` goes to the one the browser asks for first, which `src/middleware.ts` puts in `ctx`.
- The home page's hero, poll and ripeness guide are the blocks of the CMS's "Main page". A vote is a public server action that updates the poll's counts, kept as JSON in one of its blocks, and the slider is a client component.
- `/recipes` and `/movies` list a category's posts, and each post's page shows its blocks: text as markdown, HTML or plain, images in variants for each pixel density, galleries, a recipe card as a PDF, and links. Drafts show only to a signed-in user.
- The tags have pages, `/search` searches the posts' texts in the page's language, and `/credits` names the author of each photo and film still.

## How it works

- `cms/src/framework/`: RSC plumbing adapted from the `@vitejs/plugin-rsc` starter. `entry.rsc.tsx` builds each request's `ctx`, runs the middleware, and handles RSC rendering and server actions. `entry.ssr.tsx` renders HTML, and `entry.browser.tsx` handles hydration and client navigation. `app.tsx` sends `/manage` to the admin and everything else to the site's routes, whose metadata `metadata.ts` resolves and `metadata_tags.tsx` renders. `route_handlers.ts` answers `route.ts` and `sitemap.ts` URLs. `routes.ts` finds those with `import.meta.glob`, and `route_table.ts` matches URLs to them with `URLPattern`. The admin and each page and layout are separate server chunks, so the site's and the admin's stylesheets stay separate.
- `cms/src/cli/`: the commander CLI. `vite_config.ts` is the Vite config every site runs with, and `site_services.ts` what `dev` and `start` run around the server: the `.pid` file, the snapshots and backups, and the shutdown.
- `cms/src/lib/` and `cms/src/services/`: the data layer: SQLite through `@libsql/client` and drizzle, the schema and migrations in `lib/`, and the stores with their query builder in `services/`. `framework/databases.ts` opens both databases on first use and runs the migrations.
- `cms/src/screens/Manage/` and `cms/src/components/`: the admin: its screens and components, which read through `ctx` and write through server actions. `screens/Manage/ManageApp.tsx` routes `/manage` URLs to the screens.
- `cms/src/lib/auth.ts`: sessions, in the `auth` cookie and derived.db's `authtoken` table, which keeps each token's SHA-256 (`services/AuthTokenStore.ts`), the login, which makes a username wait after 5 wrong passwords in 15 minutes (`lib/LoginThrottle.ts`), the gate that sends visitors of `/manage` to its login page, and the passwords set at the links of `user create` and `user reset`, whose tokens `services/PasswordTokenStore.ts` keeps in derived.db, hashed. `lib/assetDelivery.ts` serves uploaded files and image variants at `/d/…`, and `lib/assetFastPath.ts` serves a variant that's already encoded straight from its file in `ASSETS_DIRECTORY`, ahead of the databases and the session.
- `cms/src/framework/body_limit.ts`: the limit on request bodies, which `entry.rsc.tsx` puts on each request before anything reads its body. `entry.rsc.tsx` also turns away an action that a visitor without a session may not run, before decoding it: only one `defineAction()` made public runs (`actions.ts`).
- `cms/src/lib/logger/`: the logger, with children whose labels join: `[Request] [Auth]`.
- Streamed blocks need JavaScript to swap in, so browsers without it are redirected to `?__nojs`, where the whole page is sent at once.

## Development

Run these from the repo root.

| Script                          |                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run dev \| build \| start` | run the demo through the CLI (`build` typechecks first)                                |
| `npm run demo:seed`             | make the demo's databases again from `demo/seed/` ([its README](demo/seed/README.md))  |
| `npm test`                      | unit tests (`cms/src/**/*.test.ts`) and end-to-end tests (`cms/test/`, `demo/test/`)   |
| `npm run test:watch`            | the same in watch mode                                                                 |
| `npm run typecheck`             | TypeScript 7 over both workspaces                                                      |
| `npm run format`                | Prettier (`format:check` only checks)                                                  |
| `npm run release -- <bump>`     | release a new version of the package ([Releasing](#releasing))                         |
| `npm run build -w cms`          | build the package into `cms/dist/`, which `npm pack` and `npm publish` do first        |
| `npm run tgz:pack`              | pack the package, built, into `private/bananacms.tgz`, the tarball a release publishes |

The end-to-end tests run the real CLI (`bananacms dev`, then `build` and `start`) against the demo, and against the sites in `cms/test/`, whose routes reach the framework's corners: `site/`, and `groups_site/`, laid out with root layouts in route groups. Each server gets a throwaway database, and the tests use it over HTTP the way a browser without JavaScript would. The demo's tests also seed a database from `demo/seed/` and check it against the migrations and the seed, so a seed left behind by a change to the CMS fails them.

In this repo, everything runs the CMS from its source, and the build is only for a site that installs the package: the exports' `bananacms-source` condition points `@reeywhaar/bananacms` at `cms/src/`. The TypeScript config turns it on (`customConditions`), as do the Vite config the CLI runs with and the tests' config. The CLI's own process gets it from `bin/bananacms.js`, which runs the source here and `dist/` in a site's `node_modules`. A Node script that imports the package, like the demo's seed, runs with `node --conditions=bananacms-source`.

[docs/conventions.md](docs/conventions.md) has the conventions for commits, comments, code and file names.

## Releasing

`npm run release -- <major|minor|patch|prealpha>`, on a clean working tree, bumps the version in `cms/package.json`, as `prealpha` does from 0.0.1-alpha.5 to 0.0.1-alpha.6. It commits the bump as `Release <version>`, tags the commit with the version, and pushes both. The tag starts [the publish workflow](.github/workflows/publish.yml), which builds the package and publishes it to GitHub Packages under the dist-tag of its prerelease, like `alpha`, or else `latest`. A site installs it as [As a dependency](#as-a-dependency) says.

## Dev container

`.devcontainer/` runs the repo in a Debian container with the latest Node, in VS Code or any editor that supports dev containers. The `node_modules` folders and `demo/dist` live in Docker volumes named after the repo's folder, and so does the shell history.

## Docs

- [docs/routing.md](docs/routing.md): how files in `src/app/` become routes, and how Next.js's map onto them.
- [docs/context.md](docs/context.md): the request's `ctx`, middleware, server actions and logging.
- [docs/migrations.md](docs/migrations.md): database migrations, and the timestamp ids they need.
- [docs/snapshots-and-backups.md](docs/snapshots-and-backups.md): copies of the site's data, kept beside it and sent away.
- [docs/conventions.md](docs/conventions.md): commits, comments, code style and file names.
- [demo/seed/README.md](demo/seed/README.md): the demo's content, and how to add to it.

## License

ISC, as `cms/package.json` says.
