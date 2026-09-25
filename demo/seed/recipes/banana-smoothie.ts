import { image, list, markdown, post, steps, text } from '../content.ts'
import { breakfast, vegetarian } from '../tags.ts'

export default post('banana-smoothie', {
  name: { en: 'Banana smoothie', fr: 'Smoothie à la banane', es: 'Batido de plátano' },
  tags: [breakfast, vegetarian],
  attributes: {
    time: '5 min',
    servings: '2',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/banana-smoothie.jpg', {
      en: 'A banana smoothie with a straw, topped with granola, beside slices of caramelised banana',
      fr: 'Un smoothie à la banane avec une paille, parsemé de granola, à côté de bananes caramélisées',
      es: 'Un batido de plátano con pajita y granola por encima, junto a rodajas de plátano caramelizado',
    }),
    text('summary', {
      en: 'Frozen banana, milk, oats and a spoon of peanut butter, blended until thick.',
      fr: "Banane congelée, lait, flocons d'avoine et une cuillerée de beurre de cacahuète, mixés jusqu'à ce que ce soit épais.",
      es: 'Plátano congelado, leche, copos de avena y una cucharada de crema de cacahuete, triturados hasta que espese.',
    }),
    markdown('ingredients', {
      en: list(
        '2 bananas, sliced and frozen',
        '300 ml milk',
        '2 tbsp rolled oats',
        '1 tbsp peanut butter',
        '1 tsp honey, if you like',
      ),
      fr: list(
        '2 bananes en rondelles, congelées',
        '30 cl de lait',
        "2 c. à soupe de flocons d'avoine",
        '1 c. à soupe de beurre de cacahuète',
        '1 c. à café de miel, si vous aimez',
      ),
      es: list(
        '2 plátanos en rodajas, congelados',
        '300 ml de leche',
        '2 cucharadas de copos de avena',
        '1 cucharada de crema de cacahuete',
        '1 cucharadita de miel, si te gusta',
      ),
    }),
    markdown('method', {
      en: steps(
        'Put everything in a blender.',
        'Blend for a minute, until smooth and thick.',
        'Pour into glasses and drink straight away.',
      ),
      fr: steps(
        'Mettez tout dans un blender.',
        "Mixez une minute, jusqu'à obtenir un mélange lisse et épais.",
        'Versez dans des verres et buvez aussitôt.',
      ),
      es: steps(
        'Pon todo en la batidora.',
        'Tritura un minuto, hasta que quede suave y espeso.',
        'Sirve en vasos y bebe enseguida.',
      ),
    }),
  ],
})
