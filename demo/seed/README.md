# The demo's seed

`npm run demo:seed`, from the repo root, makes the demo's database again from this folder. It deletes the databases in the demo's `DATA_PATH`, their snapshots and its `ASSETS_DIRECTORY`, runs the migrations, and writes everything here through the CMS's stores, as the admin writes it. It also adds the user `demo`, password `demo`. Stop the demo before you run it.

The content is TypeScript, so the compiler checks it: `npm run typecheck` names a missing translation, a tag that doesn't exist, or a field with a typo.

## What's here

| Path                  |                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index.ts`            | everything the database starts with: the tags, the categories and the pages                                            |
| `content.ts`          | the functions the content is written with, and its languages: English, French and Spanish                              |
| `tags.ts`             | the tags                                                                                                               |
| `recipes/`, `movies/` | a category each: `index.ts` is the category, with its posts in the order the site lists them, and each post has a file |
| `pages/`              | the pages: `main.ts` is the home page's content                                                                        |
| `files/`              | the images and PDFs the blocks show, named by their path in this folder                                                |
| `credits.ts`          | who made each image, and where it comes from                                                                           |

## Adding a post

1. Copy a post of the category, like `recipes/gazpacho.ts`, to a file named after the new post's slug, and give `post()` that slug.
2. Import it in the category's `index.ts`, and put it in `posts` where the site should list it.
3. Put its images in `files/`, and add each image to `credits.ts`: `image()` fails for an image without a credit.

Each text is written in every language: `{ en: '…', fr: '…', es: '…' }`. A tag goes in `tags.ts`, and a post names it by the object: `tags: [vegan]`.

## Blocks

| Function                 | Block              |                                                                                                                 |
| ------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `text(key, texts)`       | text, plain        |                                                                                                                 |
| `markdown(key, texts)`   | text, markdown     | `list(…)` and `steps(…)` write a list and numbered steps                                                        |
| `html(key, texts)`       | text, HTML         |                                                                                                                 |
| `image(key, file, alt)`  | image              | with its credit from `credits.ts`, as the attributes `credit`, `creditUrl`, `source`, `sourceUrl` and `license` |
| `asset(key, file, name)` | a file, like a PDF | `name` is what a link to it says                                                                                |
| `meta(key, text)`        | meta               | a text with no translations, like a link, or JSON                                                               |
| `group(key, blocks)`     | group              | blocks in a block, like a gallery's images                                                                      |

Each one takes attributes last: `{ servings: '4' }`, or `{ difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' } }` for one in every language. Posts, categories, tags and pages take `attributes` too.

The site finds blocks by their key: a post's `cover` or `still` is its picture, its `summary` goes on the cards that list it, and its `gallery` is a group of images. The home page's poll keeps its counts as JSON in the `votes` meta block, which each vote updates.

## The check

`demo/test/seed.test.ts`, part of `npm test`, seeds a throwaway database and fails when the seed has fallen behind the CMS: when `bananacms db migration check` finds the database isn't what the migrations make, or when anything in the database isn't what these files say, every text in every language and every file included.
