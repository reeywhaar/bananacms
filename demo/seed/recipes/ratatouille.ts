import { image, list, markdown, post, steps, text } from '../content.ts'
import { french, vegan } from '../tags.ts'

// a draft: signed-in users see it on the site, and visitors don't
export default post('ratatouille', {
  name: { en: 'Ratatouille', fr: 'Ratatouille', es: 'Ratatouille' },
  status: 'draft',
  tags: [french, vegan],
  attributes: {
    time: '1 h 30 min',
    servings: '6',
    difficulty: { en: 'Medium', fr: 'Moyen', es: 'Media' },
  },
  blocks: [
    image('cover', 'recipes/ratatouille.jpg', {
      en: 'A tower of sliced courgette, aubergine and tomato on a white plate, in a pepper sauce',
      fr: 'Une tour de courgette, d’aubergine et de tomate en tranches dans une assiette blanche, sur un coulis de poivron',
      es: 'Una torre de calabacín, berenjena y tomate en rodajas en un plato blanco, sobre una salsa de pimiento',
    }),
    text('summary', {
      en: 'Summer vegetables from Provence, baked slowly with olive oil and herbs until they are soft and sweet.',
      fr: "Les légumes d'été de Provence, cuits lentement à l'huile d'olive et aux herbes jusqu'à devenir fondants et sucrés.",
      es: 'Las verduras de verano de la Provenza, horneadas despacio con aceite de oliva y hierbas hasta quedar tiernas y dulces.',
    }),
    markdown('ingredients', {
      en: list(
        '2 courgettes',
        '1 aubergine',
        '4 tomatoes',
        '1 red pepper',
        '1 onion',
        '2 cloves of garlic',
        '4 tbsp olive oil',
        'Thyme, salt and pepper',
      ),
      fr: list(
        '2 courgettes',
        '1 aubergine',
        '4 tomates',
        '1 poivron rouge',
        '1 oignon',
        "2 gousses d'ail",
        "4 c. à soupe d'huile d'olive",
        'Du thym, du sel et du poivre',
      ),
      es: list(
        '2 calabacines',
        '1 berenjena',
        '4 tomates',
        '1 pimiento rojo',
        '1 cebolla',
        '2 dientes de ajo',
        '4 cucharadas de aceite de oliva',
        'Tomillo, sal y pimienta',
      ),
    }),
    markdown('method', {
      en: steps(
        'Heat the oven to 180 °C.',
        'Soften the chopped onion, pepper and garlic in half the oil, then spread them over the bottom of a baking dish.',
        'Slice the courgettes, aubergine and tomatoes thinly and lay them over in overlapping rows.',
        'Season, scatter with thyme and pour over the rest of the oil.',
        'Cover with baking paper and bake for an hour, then 15 minutes uncovered.',
      ),
      fr: steps(
        'Préchauffez le four à 180 °C.',
        "Faites fondre l'oignon, le poivron et l'ail hachés dans la moitié de l'huile, puis étalez-les au fond d'un plat à four.",
        "Coupez finement les courgettes, l'aubergine et les tomates, et disposez-les par-dessus en rangs serrés.",
        "Salez, poivrez, parsemez de thym et arrosez du reste d'huile.",
        'Couvrez de papier cuisson et enfournez une heure, puis 15 minutes à découvert.',
      ),
      es: steps(
        'Calienta el horno a 180 °C.',
        'Pocha la cebolla, el pimiento y el ajo picados en la mitad del aceite, y extiéndelos en el fondo de una fuente.',
        'Corta en láminas finas los calabacines, la berenjena y los tomates, y colócalos encima en filas solapadas.',
        'Salpimienta, espolvorea con tomillo y riega con el resto del aceite.',
        'Cubre con papel de horno y hornea una hora, y 15 minutos más sin tapar.',
      ),
    }),
  ],
})
