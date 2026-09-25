import { createCMS } from '@reeywhaar/bananacms'

// The languages content is translated into, which the admin edits each of, and
// which the seed's content is in (seed/content.ts).
export const cms = createCMS({
  locales: {
    default: 'en',
    locales: [
      { code: 'en', flag: '🇬🇧' },
      { code: 'fr', flag: '🇫🇷' },
      { code: 'es', flag: '🇪🇸' },
    ],
  },
})
