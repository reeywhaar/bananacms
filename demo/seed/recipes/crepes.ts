import { image, list, markdown, post, steps, text } from '../content.ts'
import { dessert, french, vegetarian } from '../tags.ts'

export default post('crepes', {
  name: { en: 'Crêpes', fr: 'Crêpes', es: 'Crepes' },
  tags: [french, dessert, vegetarian],
  attributes: {
    time: '45 min',
    servings: '12',
    difficulty: { en: 'Medium', fr: 'Moyen', es: 'Media' },
  },
  blocks: [
    image('cover', 'recipes/crepes.jpg', {
      en: 'Folded crêpes on a white plate, with strawberries and sliced banana',
      fr: 'Des crêpes pliées dans une assiette blanche, avec des fraises et des rondelles de banane',
      es: 'Crepes dobladas en un plato blanco, con fresas y plátano en rodajas',
    }),
    text('summary', {
      en: 'Thin French pancakes, best straight from the pan, with banana, strawberries and a spoon of chocolate spread.',
      fr: 'Les fines crêpes françaises, à manger à la sortie de la poêle, avec banane, fraises et une cuillerée de pâte à tartiner.',
      es: 'Las finas crepes francesas, mejor recién hechas, con plátano, fresas y una cucharada de crema de cacao.',
    }),
    markdown('ingredients', {
      en: list(
        '250 g plain flour',
        '4 eggs',
        '500 ml milk',
        'A pinch of salt',
        '50 g butter, melted, and more for the pan',
      ),
      fr: list(
        '250 g de farine',
        '4 œufs',
        '50 cl de lait',
        'Une pincée de sel',
        '50 g de beurre fondu, et un peu plus pour la poêle',
      ),
      es: list(
        '250 g de harina',
        '4 huevos',
        '500 ml de leche',
        'Una pizca de sal',
        '50 g de mantequilla derretida, y un poco más para la sartén',
      ),
    }),
    markdown('method', {
      en: steps(
        'Whisk the flour, eggs and salt, then pour in the milk bit by bit, whisking, until smooth.',
        'Stir in the melted butter and let the batter rest for 30 minutes.',
        'Heat a lightly buttered pan and pour in a small ladleful, tilting it to cover the base.',
        'Cook for a minute, flip, and give it 30 seconds more.',
        'Fill with banana and strawberries, fold, and serve.',
      ),
      fr: steps(
        "Fouettez la farine, les œufs et le sel, puis versez le lait petit à petit en fouettant, jusqu'à obtenir une pâte lisse.",
        'Ajoutez le beurre fondu et laissez reposer la pâte 30 minutes.',
        "Faites chauffer une poêle légèrement beurrée et versez-y une petite louche de pâte en l'inclinant pour en couvrir le fond.",
        'Laissez cuire une minute, retournez, et comptez 30 secondes de plus.',
        'Garnissez de banane et de fraises, pliez, et servez.',
      ),
      es: steps(
        'Bate la harina, los huevos y la sal, y añade la leche poco a poco sin dejar de batir, hasta que quede una masa lisa.',
        'Incorpora la mantequilla derretida y deja reposar la masa 30 minutos.',
        'Calienta una sartén untada con un poco de mantequilla y vierte un cucharón pequeño, inclinándola para cubrir el fondo.',
        'Cocina un minuto, dale la vuelta y deja 30 segundos más.',
        'Rellena con plátano y fresas, dobla y sirve.',
      ),
    }),
  ],
})
