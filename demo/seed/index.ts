import type { Seed } from './content.ts'
import movies from './movies/index.ts'
import about from './pages/about.ts'
import main from './pages/main.ts'
import recipes from './recipes/index.ts'
import * as tags from './tags.ts'

// everything the demo's database starts with, which scripts/seed.ts writes
export default {
  tags: Object.values(tags),
  categories: [recipes, movies],
  pages: [main, about],
} satisfies Seed
