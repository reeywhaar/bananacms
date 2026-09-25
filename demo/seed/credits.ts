// Who made each image in seed/files, and where it comes from. Their image blocks
// carry this as attributes (content.ts), which the site shows under each picture
// and on /credits. The photos from Unsplash are free to use under the Unsplash
// License; the stills and posters from Wikimedia Commons are in the public domain.

export type Credit = {
  author: string
  // the author's page, for the photos from Unsplash
  authorUrl?: string
  source: 'Unsplash' | 'Wikimedia Commons'
  // the file's own page there
  url: string
  license: 'Unsplash License' | 'Public domain'
}

const utm = '?utm_source=bananacms&utm_medium=referral'

const unsplash = (author: string, profile: string, photo: string): Credit => ({
  author,
  authorUrl: `https://unsplash.com/@${profile}${utm}`,
  source: 'Unsplash',
  url: `https://unsplash.com/photos/${photo}${utm}`,
  license: 'Unsplash License',
})

const commons = (author: string, file: string): Credit => ({
  author,
  source: 'Wikimedia Commons',
  url: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replaceAll(' ', '_'))}`,
  license: 'Public domain',
})

export const credits: Record<string, Credit> = {
  'pages/bananas.jpg': unsplash('Ries Bosch', 'ries_bosch', 'a-bunch-of-bananas-puP2IMOclo0'),

  'recipes/banana-pancakes.jpg': unsplash(
    'cleo stracuzza',
    'cleostra',
    'brown-bread-with-blue-berries-on-top-I-X7DAAcZns',
  ),
  'recipes/banana-bread.jpg': unsplash(
    'Evangelina Silina',
    'evangelinas_photography',
    'sliced-bread-on-brown-wooden-chopping-board-Dcrpmris9Yc',
  ),
  'recipes/banoffee-pie.jpg': unsplash(
    'Annie Spratt',
    'anniespratt',
    'ice-cream-in-clear-glass-cup-o2gSwEZeNFk',
  ),
  'recipes/fried-plantains.jpg': unsplash(
    'Griffin Wooldridge',
    'dzngriffin',
    'cooked-food-iZizDMsDeIo',
  ),
  'recipes/banana-smoothie.jpg': unsplash(
    'Elena Leya',
    'foodistika',
    'a-smoothie-in-a-glass-with-a-straw-O39Vx5yPaD4',
  ),
  'recipes/crepes.jpg': unsplash(
    'Paolo Cifuentes',
    'obitokamui',
    'sliced-tomato-on-white-ceramic-plate-jO586SsEfEA',
  ),
  'recipes/spanish-tortilla.jpg': unsplash(
    'blackieshoot',
    'blackieshoot',
    'a-close-up-of-a-piece-of-food-on-a-plate-z4CQtd07u5k',
  ),
  'recipes/gazpacho.jpg': unsplash(
    'Farhad Ibrahimzade',
    'ferhadd',
    'stainless-steel-spoon-on-white-ceramic-plate-3KHFUgr9Ckw',
  ),
  'recipes/ratatouille.jpg': unsplash(
    'amirali mirhashemian',
    'amir_v_ali',
    'cooked-food-R02KgL5Ti3Y',
  ),

  'movies/workers-leaving-the-lumiere-factory.jpg': commons(
    'Louis Lumière',
    'Sortieusinelumiere.jpg',
  ),
  'movies/workers-leaving-the-lumiere-factory-versions.jpg': commons(
    'Louis Lumière; frames put together by Manuel Schmalstieg',
    'Sortie-usine-Lumiere-versions.jpg',
  ),
  'movies/the-arrival-of-a-train.jpg': commons(
    'Auguste and Louis Lumière',
    'Llegada del tren a la estaci n de La Ciotat C-416912632-large.jpg',
  ),
  'movies/cinematographe-lumiere-poster.jpg': commons(
    'Henri Brispot',
    'Cinematograph Lumiere advertisement 1895.jpg',
  ),
  'movies/a-trip-to-the-moon.jpg': commons(
    'Georges Méliès',
    'A Trip to the Moon (Le Voyage dans la Lune).jpg',
  ),
  'movies/a-trip-to-the-moon-colour.jpg': commons(
    'Georges Méliès',
    'Melies color Voyage dans la lune.jpg',
  ),
  'movies/a-trip-to-the-moon-cannon.jpg': commons(
    'Georges Méliès',
    'Méliès Trip to the Moon cannon still.jpg',
  ),
  'movies/a-trip-to-the-moon-title.jpg': commons(
    'Georges Méliès',
    'Voyage dans la lune title card.png',
  ),
  'movies/the-great-train-robbery.jpg': commons(
    'Edwin S. Porter',
    'The-Great-Train-Robbery-1903.jpg',
  ),
  'movies/the-great-train-robbery-chase.jpg': commons(
    'Edwin S. Porter',
    'The Great Train Robbery 0018.jpg',
  ),
  'movies/the-great-train-robbery-dance-hall.jpg': commons(
    'Edwin S. Porter',
    'The Great Train Robbery 0015.jpg',
  ),
  'movies/alice-in-wonderland.jpg': commons(
    'Cecil Hepworth and Percy Stow',
    'Alice in Wonderland (1903) - White Rabbit.jpg',
  ),
  'movies/alice-in-wonderland-cards.jpg': commons(
    'Cecil Hepworth and Percy Stow',
    'Alice in Wonderland (1903) - Little Lizard Bill.jpg',
  ),
  'movies/frankenstein.jpg': commons('J. Searle Dawley', 'Frankenstein1910.jpg'),
  'movies/frankenstein-laboratory.jpg': commons('J. Searle Dawley', 'Victor frankenstein1910.jpg'),
  'movies/frankenstein-kinetogram.jpg': commons(
    'Edison Manufacturing Company',
    'Frankenstein (1910) poster.jpg',
  ),
  'movies/les-vampires.jpg': commons('Gaumont', 'Les Vampires - Irma Vep (Musidora).jpg'),
  'movies/les-vampires-kidnapping.jpg': commons(
    'Louis Feuillade',
    'Les Vampires - Les Yeux qui fascinent - Juan-José Moreno enlève Irma Vep.jpg',
  ),
  'movies/les-vampires-cabaret.jpg': commons(
    'Gaumont',
    'Les Vampires - Louis Feuillade - Gaumont.png',
  ),
  'movies/the-cabinet-of-dr-caligari.jpg': commons(
    'Decla-Bioscop',
    'Publicity still for The Cabinet of Dr. Caligari (1920) 03.jpg',
  ),
  'movies/the-cabinet-of-dr-caligari-cesare.jpg': commons(
    'Decla-Bioscop',
    'Publicity still for The Cabinet of Dr. Caligari (1920) 04.jpg',
  ),
  'movies/the-cabinet-of-dr-caligari-face.jpg': commons(
    'Willy Hameister',
    'Caligari 1920 still 02.jpg',
  ),
  'movies/nosferatu.jpg': commons(
    'F. W. Murnau',
    'Max Schreck as Count Orlok in Nosferatu – Eine Symphonie des Grauens (1922).jpg',
  ),
  'movies/nosferatu-doorway.jpg': commons('Prana Film', 'Nosferatu Doorway Frame.webp'),
}
