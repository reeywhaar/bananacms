import { createCMS } from '@reeywhaar/bananacms'

export const cms = createCMS({
  locales: {
    default: 'en',
    locales: [
      { code: 'en', flag: '🇬🇧' },
      { code: 'ru', flag: '🇷🇺' },
    ],
  },
})
