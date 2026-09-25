import { tag, text } from './content.ts'

// the tags posts name, by slug

// recipes

export const breakfast = tag('breakfast', {
  name: { en: 'Breakfast', fr: 'Petit-déjeuner', es: 'Desayuno' },
})

export const baking = tag('baking', {
  name: { en: 'Baking', fr: 'Pâtisserie', es: 'Repostería' },
})

export const dessert = tag('dessert', {
  name: { en: 'Dessert', fr: 'Dessert', es: 'Postre' },
})

export const vegetarian = tag('vegetarian', {
  name: { en: 'Vegetarian', fr: 'Végétarien', es: 'Vegetariano' },
})

export const vegan = tag('vegan', {
  name: { en: 'Vegan', fr: 'Végétalien', es: 'Vegano' },
  blocks: [
    text('description', {
      en: 'Recipes without meat, fish, eggs or dairy.',
      fr: 'Des recettes sans viande, poisson, œufs ni produits laitiers.',
      es: 'Recetas sin carne, pescado, huevos ni lácteos.',
    }),
  ],
})

export const french = tag('french', {
  name: { en: 'French cuisine', fr: 'Cuisine française', es: 'Cocina francesa' },
})

export const spanish = tag('spanish', {
  name: { en: 'Spanish cuisine', fr: 'Cuisine espagnole', es: 'Cocina española' },
})

export const latinAmerican = tag('latin-american', {
  name: {
    en: 'Latin American cuisine',
    fr: 'Cuisine latino-américaine',
    es: 'Cocina latinoamericana',
  },
})

// movies

export const documentary = tag('documentary', {
  name: { en: 'Documentary', fr: 'Documentaire', es: 'Documental' },
})

export const scienceFiction = tag('science-fiction', {
  name: { en: 'Science fiction', fr: 'Science-fiction', es: 'Ciencia ficción' },
})

export const western = tag('western', {
  name: { en: 'Western', fr: 'Western', es: 'Wéstern' },
})

export const crime = tag('crime', {
  name: { en: 'Crime', fr: 'Policier', es: 'Policíaco' },
})

export const fantasy = tag('fantasy', {
  name: { en: 'Fantasy', fr: 'Fantastique', es: 'Fantasía' },
})

export const horror = tag('horror', {
  name: { en: 'Horror', fr: 'Épouvante', es: 'Terror' },
})

export const expressionism = tag('expressionism', {
  name: {
    en: 'German Expressionism',
    fr: 'Expressionnisme allemand',
    es: 'Expresionismo alemán',
  },
  blocks: [
    text('description', {
      en: 'A style of the German cinema of the 1920s: painted, distorted sets, deep shadows, and acting to match.',
      fr: "Un style du cinéma allemand des années 1920 : décors peints et déformés, ombres profondes, et un jeu à l'avenant.",
      es: 'Un estilo del cine alemán de los años veinte: decorados pintados y deformados, sombras profundas y una interpretación a juego.',
    }),
  ],
})
