import { image, list, markdown, post, steps, text } from '../content.ts'
import { dessert, vegetarian } from '../tags.ts'

export default post('banoffee-pie', {
  name: { en: 'Banoffee pie', fr: 'Tarte banoffee', es: 'Tarta banoffee' },
  tags: [dessert, vegetarian],
  attributes: {
    time: {
      en: '30 min, and 2 h in the fridge',
      fr: '30 min, et 2 h au frais',
      es: '30 min, y 2 h en la nevera',
    },
    servings: '8',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/banoffee-pie.jpg', {
      en: 'Banoffee in a glass bowl, with cream, toffee and walnuts on top',
      fr: 'Un banoffee dans un saladier en verre, garni de crème, de caramel et de noix',
      es: 'Un banoffee en un bol de cristal, con nata, toffee y nueces por encima',
    }),
    text('summary', {
      en: 'A biscuit base, soft toffee, sliced bananas and a cloud of cream: an English pudding from the 1970s.',
      fr: 'Un fond de biscuits, un caramel fondant, des bananes en rondelles et un nuage de crème : un dessert anglais des années 1970.',
      es: 'Una base de galleta, toffee suave, plátano en rodajas y una nube de nata: un postre inglés de los años setenta.',
    }),
    markdown('ingredients', {
      en: list(
        '250 g digestive biscuits',
        '100 g butter, melted',
        '1 tin (397 g) of dulce de leche',
        '3 bananas',
        '300 ml double cream',
        'Cocoa or grated chocolate, to finish',
      ),
      fr: list(
        '250 g de biscuits sablés',
        '100 g de beurre fondu',
        '1 boîte (397 g) de confiture de lait',
        '3 bananes',
        '30 cl de crème liquide entière',
        'Du cacao ou du chocolat râpé, pour finir',
      ),
      es: list(
        '250 g de galletas digestive',
        '100 g de mantequilla derretida',
        '1 lata (397 g) de dulce de leche',
        '3 plátanos',
        '300 ml de nata para montar',
        'Cacao o chocolate rallado, para terminar',
      ),
    }),
    markdown('method', {
      en: steps(
        'Crush the biscuits, mix them with the butter and press them into a 23 cm tin. Chill for 30 minutes.',
        'Spread the dulce de leche over the base.',
        'Slice the bananas over the top.',
        'Whip the cream to soft peaks and spread it over the bananas.',
        'Chill for 2 hours, then dust with cocoa.',
      ),
      fr: steps(
        'Écrasez les biscuits, mélangez-les au beurre et tassez-les dans un moule de 23 cm. Réservez 30 minutes au frais.',
        'Étalez la confiture de lait sur le fond.',
        'Coupez les bananes en rondelles par-dessus.',
        'Fouettez la crème en chantilly souple et étalez-la sur les bananes.',
        'Laissez 2 heures au frais, puis saupoudrez de cacao.',
      ),
      es: steps(
        'Tritura las galletas, mézclalas con la mantequilla y presiónalas en un molde de 23 cm. Enfría 30 minutos.',
        'Extiende el dulce de leche sobre la base.',
        'Corta los plátanos en rodajas por encima.',
        'Monta la nata a punto suave y extiéndela sobre los plátanos.',
        'Enfría 2 horas y espolvorea con cacao.',
      ),
    }),
  ],
})
