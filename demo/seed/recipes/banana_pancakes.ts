import { asset, image, list, markdown, post, steps, text } from '../content.ts'
import { breakfast, vegetarian } from '../tags.ts'

export default post('banana-pancakes', {
  name: { en: 'Banana pancakes', fr: 'Pancakes à la banane', es: 'Tortitas de plátano' },
  tags: [breakfast, vegetarian],
  attributes: {
    time: '25 min',
    servings: '4',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/banana-pancakes.jpg', {
      en: 'A stack of banana pancakes with blueberries and banana slices, a fork cutting into it',
      fr: 'Une pile de pancakes à la banane avec des myrtilles et des rondelles de banane, une fourchette plantée dedans',
      es: 'Una pila de tortitas de plátano con arándanos y rodajas de plátano, y un tenedor cortándola',
    }),
    text('summary', {
      en: 'Ripe bananas go into the batter, and the pancakes come out soft, sweet and golden.',
      fr: 'Des bananes bien mûres dans la pâte, et des pancakes moelleux, sucrés et dorés.',
      es: 'Plátanos maduros en la masa, y unas tortitas tiernas, dulces y doradas.',
    }),
    markdown('ingredients', {
      en: list(
        '2 ripe bananas',
        '2 eggs',
        '150 ml milk',
        '100 g plain flour',
        '1 tsp baking powder and a pinch of salt',
        'Butter for the pan, maple syrup to serve',
      ),
      fr: list(
        '2 bananes bien mûres',
        '2 œufs',
        '150 ml de lait',
        '100 g de farine',
        '1 c. à café de levure chimique et une pincée de sel',
        "Du beurre pour la poêle, du sirop d'érable pour servir",
      ),
      es: list(
        '2 plátanos maduros',
        '2 huevos',
        '150 ml de leche',
        '100 g de harina',
        '1 cucharadita de levadura química y una pizca de sal',
        'Mantequilla para la sartén y sirope de arce para servir',
      ),
    }),
    markdown('method', {
      en: steps(
        'Mash the bananas, then whisk in the eggs and the milk.',
        'Stir in the flour, baking powder and salt until just combined.',
        'Butter a pan over a medium heat and pour in small ladlefuls.',
        'Cook for 2 minutes, until bubbles show, then flip for a minute more.',
        'Serve warm, with maple syrup.',
      ),
      fr: steps(
        'Écrasez les bananes, puis ajoutez les œufs et le lait en fouettant.',
        'Incorporez la farine, la levure et le sel, sans trop mélanger.',
        'Beurrez une poêle sur feu moyen et versez-y de petites louches de pâte.',
        'Laissez cuire 2 minutes, que des bulles apparaissent, puis retournez pour une minute de plus.',
        "Servez chaud, avec du sirop d'érable.",
      ),
      es: steps(
        'Machaca los plátanos y bate con los huevos y la leche.',
        'Añade la harina, la levadura y la sal, y mezcla lo justo.',
        'Unta una sartén con mantequilla a fuego medio y vierte pequeños cucharones de masa.',
        'Cocina 2 minutos, hasta que salgan burbujas, y dales la vuelta un minuto más.',
        'Sirve calientes, con sirope de arce.',
      ),
    }),
    asset('card', 'recipes/banana-pancakes-card.pdf', 'Recipe card (PDF)'),
  ],
})
