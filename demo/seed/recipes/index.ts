import { category, image, text } from '../content.ts'
import bananaBread from './banana-bread.ts'
import bananaPancakes from './banana-pancakes.ts'
import bananaSmoothie from './banana-smoothie.ts'
import banoffeePie from './banoffee-pie.ts'
import crepes from './crepes.ts'
import friedPlantains from './fried-plantains.ts'
import gazpacho from './gazpacho.ts'
import ratatouille from './ratatouille.ts'
import spanishTortilla from './spanish-tortilla.ts'

export default category('recipes', {
  name: { en: 'Recipes', fr: 'Recettes', es: 'Recetas' },
  blocks: [
    text('intro', {
      en: 'Things to cook at home, from bananas to gazpacho.',
      fr: 'Des plats à cuisiner chez soi, des bananes au gaspacho.',
      es: 'Platos para cocinar en casa, de los plátanos al gazpacho.',
    }),
    image('cover', 'recipes/banana-bread.jpg', {
      en: 'A loaf of banana bread, partly sliced, on a wooden board',
      fr: 'Un pain à la banane en partie tranché, sur une planche en bois',
      es: 'Un pan de plátano en parte cortado, sobre una tabla de madera',
    }),
  ],
  posts: [
    bananaPancakes,
    bananaBread,
    banoffeePie,
    friedPlantains,
    bananaSmoothie,
    crepes,
    spanishTortilla,
    gazpacho,
    ratatouille,
  ],
})
