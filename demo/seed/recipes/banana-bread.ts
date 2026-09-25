import { asset, html, image, list, markdown, post, steps, text } from '../content.ts'
import { baking, vegetarian } from '../tags.ts'

export default post('banana-bread', {
  name: { en: 'Banana bread', fr: 'Pain à la banane', es: 'Pan de plátano' },
  tags: [baking, vegetarian],
  attributes: {
    time: '1 h 15 min',
    servings: '10',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/banana-bread.jpg', {
      en: 'A loaf of banana bread, partly sliced, on a wooden board',
      fr: 'Un pain à la banane en partie tranché, sur une planche en bois',
      es: 'Un pan de plátano en parte cortado, sobre una tabla de madera',
    }),
    text('summary', {
      en: 'The best use for very ripe bananas: moist, dense and lightly sweet.',
      fr: "La meilleure façon d'utiliser des bananes bien mûres : un cake moelleux, dense et juste sucré.",
      es: 'La mejor forma de aprovechar los plátanos muy maduros: un bizcocho jugoso, denso y ligeramente dulce.',
    }),
    markdown('ingredients', {
      en: list(
        '3 very ripe bananas, mashed',
        '75 g butter, melted',
        '150 g light brown sugar',
        '1 egg, beaten',
        '1 tsp vanilla extract',
        '1 tsp baking soda and a pinch of salt',
        '190 g plain flour',
        'A handful of walnuts or dark chocolate, if you like',
      ),
      fr: list(
        '3 bananes bien mûres, écrasées',
        '75 g de beurre fondu',
        '150 g de cassonade',
        '1 œuf battu',
        "1 c. à café d'extrait de vanille",
        '1 c. à café de bicarbonate et une pincée de sel',
        '190 g de farine',
        'Une poignée de noix ou de chocolat noir, si vous aimez',
      ),
      es: list(
        '3 plátanos muy maduros, machacados',
        '75 g de mantequilla derretida',
        '150 g de azúcar moreno',
        '1 huevo batido',
        '1 cucharadita de extracto de vainilla',
        '1 cucharadita de bicarbonato y una pizca de sal',
        '190 g de harina',
        'Un puñado de nueces o de chocolate negro, si te gusta',
      ),
    }),
    markdown('method', {
      en: steps(
        'Heat the oven to 175 °C and line a loaf tin.',
        'Stir the butter into the bananas, then the sugar, egg and vanilla.',
        'Sprinkle over the soda and salt, then fold in the flour.',
        'Pour into the tin and bake for 55 to 65 minutes, until a skewer comes out clean.',
        'Let it cool in the tin for 10 minutes before turning it out.',
      ),
      fr: steps(
        'Préchauffez le four à 175 °C et chemisez un moule à cake.',
        "Mélangez le beurre aux bananes, puis le sucre, l'œuf et la vanille.",
        'Saupoudrez de bicarbonate et de sel, puis incorporez la farine.',
        "Versez dans le moule et faites cuire 55 à 65 minutes, jusqu'à ce qu'une pique en ressorte sèche.",
        'Laissez tiédir 10 minutes dans le moule avant de démouler.',
      ),
      es: steps(
        'Calienta el horno a 175 °C y forra un molde alargado.',
        'Mezcla la mantequilla con los plátanos, y luego el azúcar, el huevo y la vainilla.',
        'Espolvorea el bicarbonato y la sal, y después incorpora la harina.',
        'Vierte en el molde y hornea de 55 a 65 minutos, hasta que un palillo salga limpio.',
        'Deja enfriar 10 minutos en el molde antes de desmoldar.',
      ),
    }),
    html('tip', {
      en: '<p>The browner the bananas, the better: <strong>black skins</strong> mean more sugar and more flavour.</p>',
      fr: '<p>Plus les bananes sont brunes, meilleur c’est : une <strong>peau noire</strong>, c’est plus de sucre et plus de goût.</p>',
      es: '<p>Cuanto más oscuros los plátanos, mejor: una <strong>piel negra</strong> significa más azúcar y más sabor.</p>',
    }),
    asset('card', 'recipes/banana-bread-card.pdf', 'Recipe card (PDF)'),
  ],
})
