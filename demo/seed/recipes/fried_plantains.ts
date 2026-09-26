import { image, list, markdown, post, steps, text } from '../content.ts'
import { latinAmerican, vegan } from '../tags.ts'

export default post('fried-plantains', {
  name: { en: 'Fried plantains', fr: 'Bananes plantains frites', es: 'Plátanos maduros fritos' },
  tags: [latinAmerican, vegan],
  attributes: {
    time: '20 min',
    servings: '4',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/fried-plantains.jpg', {
      en: 'Caramelised slices of fried plantain in paper, with a plastic fork',
      fr: 'Des tranches de banane plantain frites et caramélisées dans du papier, avec une fourchette en plastique',
      es: 'Rodajas de plátano maduro frito y caramelizado en papel, con un tenedor de plástico',
    }),
    text('summary', {
      en: 'Very ripe plantains, black-skinned and soft, fried until the edges caramelise: sweet, salty and crisp.',
      fr: "Des plantains très mûrs, à la peau noire, frits jusqu'à ce que les bords caramélisent : sucrés, salés et croustillants.",
      es: 'Plátanos machos muy maduros, de piel negra, fritos hasta que los bordes se caramelizan: dulces, salados y crujientes.',
    }),
    markdown('ingredients', {
      en: list(
        '2 very ripe plantains, their skins mostly black',
        'Vegetable oil, for frying',
        'Flaky salt',
      ),
      fr: list(
        '2 bananes plantains très mûres, à la peau presque noire',
        "De l'huile végétale, pour la friture",
        'De la fleur de sel',
      ),
      es: list(
        '2 plátanos machos muy maduros, con la piel casi negra',
        'Aceite vegetal, para freír',
        'Sal en escamas',
      ),
    }),
    markdown('method', {
      en: steps(
        'Cut off the ends, slit the skin lengthwise and peel.',
        'Slice on the diagonal, about 1 cm thick.',
        'Heat 1 cm of oil in a frying pan over a medium heat.',
        'Fry the slices for 2 to 3 minutes a side, until deep golden.',
        'Drain on paper, and salt while hot.',
      ),
      fr: steps(
        'Coupez les extrémités, incisez la peau dans la longueur et épluchez.',
        "Taillez en biais des tranches d'environ 1 cm.",
        "Faites chauffer 1 cm d'huile dans une poêle à feu moyen.",
        "Faites frire 2 à 3 minutes de chaque côté, jusqu'à ce qu'elles soient bien dorées.",
        "Égouttez sur du papier, et salez tant que c'est chaud.",
      ),
      es: steps(
        'Corta los extremos, haz un corte a lo largo de la piel y pela.',
        'Corta en diagonal en rodajas de 1 cm.',
        'Calienta 1 cm de aceite en una sartén a fuego medio.',
        'Fríe las rodajas 2 o 3 minutos por cada lado, hasta que estén bien doradas.',
        'Escurre sobre papel y sala en caliente.',
      ),
    }),
  ],
})
