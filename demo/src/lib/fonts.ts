import { IBM_Plex_Sans as MainFont, Titan_One as SecFont } from 'next/font/google'

export const mainFont = MainFont({
  subsets: ['latin', 'cyrillic-ext'],
  weight: ['100', '300', '500', '700'],
})

export const secFont = SecFont({
  subsets: ['latin'],
  weight: ['400'],
})

export const secFontTitle = `${secFont.className} [font-variant:small-caps] tracking-wider`
