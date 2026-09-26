# Conventions

## Commits

One line, like `Add note pages`. No body, and no `Co-Authored-By` or other trailers.

## Comments

- Comments describe the code as it is. History, like what the code used to do, what changed and what was tried, belongs in commit messages.
- When code goes, its comment goes with it. A comment never gets a note that something used to be there.
- Comments describe what the code does and uses, and why. Leave out what it doesn't do or use, because that set is endless. "We don't use a steel cup here because it isn't needed" tells the reader nothing about the code in front of them.
- Negation is fine when it describes what the code does, like "returns undefined when the note doesn't exist".

## Code

These are enforced by the tooling:

- Prettier formats everything: single quotes, no semicolons, trailing commas, 100 columns. Run `npm run format`, or `npm run format:check` to check only.
- Node runs the TypeScript source directly, stripping the types. So code uses erasable syntax only: no enums, namespaces or parameter properties. Relative imports keep their `.ts` and `.tsx` extensions, and type-only imports use `import type`. `tsconfig.base.json` checks all three.
- Unit tests sit next to the code as `*.test.ts`. End-to-end tests of the demo live in `demo/test/`.

## File names

The words of a code file's name are joined with underscores, like `route_handlers.ts`, and never with dashes. A file named after the component, class or function it exports takes that name as it is, like `PostCard.tsx`, `AssetStore.ts` or `getAssetUrl.ts`.

A site's `src/app/` is the exception, since its names are routes: `not-found.tsx`, `global-error.tsx` and `global-not-found.tsx` are the files the framework looks for, and a folder's name is its URL's segment, like `server-error-page/`.

## Migrations

A migration's id is `Date.now()` at the time you create it, 13 digits, as in `1790312345678_post_summary.ts`. [migrations.md](migrations.md) explains why, and covers the rest.
