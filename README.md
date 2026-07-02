# bananacms

A small, pluggable CMS built on Next.js 16 + SQLite. Ships as a package you install into a Next.js consumer app; the consumer owns public routing and content, the CMS provides admin UI, services, asset delivery, migrations, and a CLI.

> **Status:** work in progress. The public surface (`@reeywhaar/bananacms`, `@reeywhaar/bananacms/runtime`, `@reeywhaar/bananacms/stores`) is in flux. Don't pin to a version yet.

---

## What's in the box

- **Admin UI** at `/manage/*` — CRUD for Posts, Categories, Tags, Pages, and a block editor (text, image, group, meta).
- **Services layer** — a set of `Store` classes (`PostStore`, `CategoryStore`, `BlockStore`, `AssetStore`, `PageStore`, `TagStore`, `AuthTokenStore`, `UserStore`, `LocalizationStore`) over a single SQLite database.
- **Asset delivery** at `/d/[id]` with on-the-fly image optimization (webp/jpeg, `@1x` / `@2x` / `@3x`).
- **Auth** (session cookies, scrypt password hashing) at `/api/auth`, `/api/me/*`.
- **CLI** — `cms dev`, `cms start`, `cms build`, `cms migrate`, `cms db:*`, `cms assets:cleanup`.
- **Block system** — serializable content blocks with translations, rendered however the consumer wants.

## Architecture: two Next zones, one repo

```
┌────────────────────── one HTTP origin ──────────────────────┐
│                                                             │
│  Consumer zone (port 3000)                                  │
│    app/[locale]/…   ← consumer's public content             │
│    next.config.ts: rewrites(/manage, /api, /d → :4001)      │
│                                                             │
│  CMS zone (port 4001, internal)                             │
│    app/manage/…     ← admin UI                              │
│    app/api/…        ← auth + me routes                      │
│    app/d/[id]/…     ← asset delivery                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

Each zone is a Next.js 16 app; each runs as its own child process so Turbopack's
per-process singletons don't collide. The consumer zone rewrites `/manage`,
`/api`, and `/d` paths internally to the CMS zone, so from the browser it looks
like one site on port 3000.

Both zones open the same SQLite DB (POSIX file locking; safe for multi-process).

### This repo's layout

```
/workspace
├── src/                     # bananacms package
│   ├── app/                 # CMS Next zone: manage/, api/, d/
│   ├── screens/Manage/      # admin UI components
│   ├── services/            # stores
│   ├── lib/                 # blocks, migrations, logger, routeHandler, …
│   ├── cli/                 # cms CLI
│   ├── config.ts            # createCMS, getCMS
│   ├── nextConfig.ts        # createConfig, cmsRewrites
│   ├── proxy.ts             # Next proxy (middleware) for the CMS zone
│   ├── cmsProxy.ts          # middleware factory used by proxy.ts
│   ├── next.config.ts       # Next config for the CMS zone
│   ├── index.ts             # package main (config-time API)
│   ├── runtime.ts           # package runtime API (bundler-loaded only)
│   └── stores.ts            # public stores barrel
├── demo/                    # consumer Next zone — a working example
│   ├── src/
│   │   ├── app/[locale]/    # public pages
│   │   ├── screens/Main/    # public frontend components
│   │   ├── cms.ts           # createCMS(...) — consumer's CMS config
│   │   └── proxy.ts         # Next proxy (middleware) for the consumer zone
│   ├── messages/            # next-intl messages
│   ├── public/              # static assets
│   ├── next.config.ts       # consumer Next config (imports ./src/cms)
│   └── package.json         # { "@reeywhaar/bananacms": "file:.." }
├── private/                 # dev DB + asset files (shared between zones)
├── scripts/                 # repo-level shell scripts (e.g. seed generation)
├── seed/                    # committed seed DB dump (database.sql)
└── package.json             # bananacms package manifest
```

---

## Requirements

- Node.js ≥ 24 (uses native TypeScript module loading)
- npm (other package managers not tested yet)

## Installation

### As a consumer dependency

`@reeywhaar/bananacms` is published to GitHub Packages. In your consumer project, add an `.npmrc` that routes the `@reeywhaar` scope:

```
@reeywhaar:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

GitHub Packages requires authentication even for public packages. Create a personal access token with the `read:packages` scope at https://github.com/settings/tokens and export it as `GITHUB_TOKEN` before installing:

```bash
npm install @reeywhaar/bananacms
```

Then follow [Writing a consumer](#writing-a-consumer) to wire up `src/cms.ts` and `next.config.ts`.

### For local development of this repo

```bash
git clone git@github.com:Reeywhaar/bananacms.git
cd bananacms
npm install

# Link the package into the demo consumer.
cd demo && npm install && cd ..
```

The second `npm install` creates `demo/node_modules/@reeywhaar/bananacms` as a symlink to the repo root via the `"@reeywhaar/bananacms": "file:.."` dependency in [demo/package.json](demo/package.json).

## Environment

Each consumer owns a `.env`. A template is provided:

```bash
cp demo/.env.example demo/.env
```

| Variable                 | Required | Notes                                                                              |
| ------------------------ | -------- | ---------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SERVER_URL` | yes      | Public origin (e.g. `http://localhost:3000`). Used for CORS, metadata, asset URLs. |
| `ALLOWED_HOSTS`          | no       | Extra dev-mode hostnames, comma-separated.                                         |
| `DATA_PATH`              | yes      | Directory for data storage. SQLite database is stored inside as `database.db`.     |
| `ASSETS_DIRECTORY`       | yes      | Directory for asset storage.                                                       |
| `PORT`                   | no       | Consumer zone port (default `3000`).                                               |
| `CMS_INTERNAL_PORT`      | no       | CMS zone port (default `4001`).                                                    |
| `CMS_INTERNAL_URL`       | no       | Derived from `CMS_INTERNAL_PORT` by default.                                       |
| `LOG_FORMAT`             | no       | `dev` or `json`. Defaults: `dev` in development, `json` in production.             |
| `LOG_LEVEL`              | no       | `debug` / `info` / `warn` / `error`. Default `info`.                               |
| `NO_COLOR`               | no       | Disable ANSI colors in the dev log formatter.                                      |

## Quick start

From the repo root, after [Installation](#for-local-development-of-this-repo) and copying `demo/.env.example` → `demo/.env`:

```bash
# Seed the dev DB from the committed snapshot in seed/database.sql.
# (For an empty schema with no data, swap `db:seed` for `migrate`.)
npm run demo -- db:seed

# Create an admin user.
npm run demo -- db:set-user admin hunter2

# Start both zones.
npm run demo -- dev
```

`npm run demo` is a thin wrapper for `cd demo && node ../src/cli/index.ts`; everything after `--` is passed to the CLI.

You should see:

```
bananacms [development]
  CMS zone:      http://localhost:4001
  Consumer zone: http://localhost:3000
[cms]  ▲ Next.js 16.x — Turbopack
[cms]  - Local:        http://localhost:4001
[demo] ▲ Next.js 16.x — Turbopack
[demo] - Local:        http://localhost:3000
```

Then:

- http://localhost:3000 → public site served by the consumer zone
- http://localhost:3000/manage → admin UI (rewritten to the CMS zone)
- http://localhost:3000/manage/login → sign in with the user you created

---

## Writing a consumer

A consumer is a Next.js 16 app with a `src/cms.ts` that calls `createCMS()` and a
`next.config.ts` that uses `createConfig()` from `@reeywhaar/bananacms` to wire the rewrites.

Minimum setup:

```ts
// src/cms.ts
import { createCMS } from '@reeywhaar/bananacms'

export const cms = createCMS({
  locales: {
    default: 'en',
    locales: [{ code: 'en' }],
  },
})
```

```ts
// next.config.ts
import { createConfig } from '@reeywhaar/bananacms'
import './src/cms' // side-effect: calls createCMS before the rest of config resolves

export default createConfig()
```

```ts
// src/proxy.ts
import { combineProxies } from '@reeywhaar/bananacms/runtime'

export default combineProxies(/* your middleware chain */)

// Static literal required by Next.js
export const config = {
  matcher: '/((?!manage|api|d/|cms-static|_next|.*\\..*).*)',
}
```

Everything under `/manage`, `/api`, and `/d` is then handled by the CMS zone
via rewrites — you don't write any routes for those paths.

### Using CMS services in consumer code

```tsx
// Server component in app/[locale]/page.tsx
import { getServices } from '@reeywhaar/bananacms/runtime'
import { PostStore } from '@reeywhaar/bananacms/stores'

export default async function Page() {
  const { db } = await getServices()
  const posts = await new PostStore(db).getPublic()
  return (
    <ul>
      {posts.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  )
}
```

### Package exports

| Path                           | What's there                                                                                                                          | Loaded by                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `@reeywhaar/bananacms`         | `createCMS`, `getCMS`, `createConfig`, `cmsRewrites`, `mergeRewrites`, all config types                                               | Next config loader + bundler |
| `@reeywhaar/bananacms/runtime` | `getServices`, asset helpers, block types, `combineProxies`, middleware factories                                                     | bundler only                 |
| `@reeywhaar/bananacms/stores`  | `PostStore`, `CategoryStore`, `BlockStore`, `AssetStore`, `PageStore`, `TagStore`, `UserStore`, `AuthTokenStore`, `LocalizationStore` | bundler only                 |

The split exists so Next.js's config transpiler (which pulls `@reeywhaar/bananacms` into
CJS at boot) doesn't eagerly load request-time code like DB services.

---

## CLI reference

Always run from the consumer directory (`cd demo && cms <command>`), or via
the `demo:*` scripts at the repo root.

| Command                                        | Purpose                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `cms dev`                                      | Boot CMS + consumer zones (dev mode).                                                                                              |
| `cms start`                                    | Same, production mode.                                                                                                             |
| `cms build`                                    | Build both zones.                                                                                                                  |
| `cms migrate [--force]`                        | Apply SQL migrations to `DATA_PATH/database.db`.                                                                                   |
| `cms db:set-user <name> <password>`            | Create or update an admin user.                                                                                                    |
| `cms db:seed`                                  | Apply `seed/database.sql` from the `@reeywhaar/bananacms` package, but only if `DATA_PATH/database.db` is absent or has no tables. |
| `cms db:cleanup [--dry-run]`                   | Remove orphaned posts, blocks, assets, then `VACUUM`.                                                                              |
| `cms db:backfill-image-dimensions [--dry-run]` | Populate width/height on image assets using `sharp`.                                                                               |
| `cms assets:cleanup [--dry-run]`               | Remove files in `ASSETS_DIRECTORY` with no DB record.                                                                              |

---

## Seed database

The repo ships a committed SQL dump at [seed/database.sql](seed/database.sql) that `cms db:seed` applies to a fresh `DATA_PATH/database.db`. Run it from the consumer after `migrate` is _not_ needed — the dump includes the full schema.

To regenerate the seed from the current dev DB (at repo root):

```bash
npm run seed:create
```

This calls [scripts/create_seed](scripts/create_seed), which takes a `.backup` copy of `DATA_PATH/database.db` (default `private/database.db`), strips `user` + `authtoken` rows, and writes `seed/database.sql`. The live DB is never modified.

## Development

```bash
npm run tsc      # type-check both zones
npm run lint     # eslint both zones
```

ESLint rule enforces that `src/` never imports from `demo/` (one-way package
boundary). TypeScript checks each zone independently against its own tsconfig.

### Known trade-offs

- **Child processes in dev.** Next 16's Turbopack has a process-global
  singleton worker pool — two Next instances in one Node process crash with
  "Worker creator already registered". The CLI spawns each zone as its own
  child so Turbopack is isolated. SQLite handles cross-process access fine.
- **Block matchers are not yet pluggable** — custom block types need
  package-level changes. The built-in `matchers` array in
  [src/lib/blocks/declarations.ts](src/lib/blocks/declarations.ts) is fixed
  (text, group, image, meta) and isn't exported from `@reeywhaar/bananacms/runtime`.

These are tracked and will be addressed in follow-up work.

---

## License

ISC (see [package.json](package.json))
