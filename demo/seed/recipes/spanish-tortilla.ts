import { asset, image, list, markdown, post, steps, text } from '../content.ts'
import { spanish, vegetarian } from '../tags.ts'

export default post('spanish-tortilla', {
  name: { en: 'Spanish tortilla', fr: 'Tortilla espagnole', es: 'Tortilla de patatas' },
  tags: [spanish, vegetarian],
  attributes: {
    time: '50 min',
    servings: '4',
    difficulty: { en: 'Medium', fr: 'Moyen', es: 'Media' },
  },
  blocks: [
    image('cover', 'recipes/spanish-tortilla.jpg', {
      en: 'A thick, golden potato omelette on a plate',
      fr: 'Une épaisse tortilla de pommes de terre dorée dans une assiette',
      es: 'Una tortilla de patatas gruesa y dorada en un plato',
    }),
    text('summary', {
      en: 'Potatoes and onion cooked slowly in olive oil, then set with eggs into a thick, soft omelette.',
      fr: "Des pommes de terre et de l'oignon cuits doucement dans l'huile d'olive, puis liés aux œufs en une omelette épaisse et fondante.",
      es: 'Patatas y cebolla pochadas despacio en aceite de oliva, cuajadas luego con huevo en una tortilla gruesa y jugosa.',
    }),
    markdown('ingredients', {
      en: list('600 g waxy potatoes', '1 onion', '6 eggs', '200 ml olive oil', 'Salt'),
      fr: list(
        '600 g de pommes de terre à chair ferme',
        '1 oignon',
        '6 œufs',
        "20 cl d'huile d'olive",
        'Du sel',
      ),
      es: list('600 g de patatas', '1 cebolla', '6 huevos', '200 ml de aceite de oliva', 'Sal'),
    }),
    markdown('method', {
      en: steps(
        'Peel the potatoes and slice them thinly, and slice the onion.',
        'Cook both gently in the olive oil for 20 minutes, until soft but not browned.',
        'Drain off the oil, keeping 2 tablespoons, and mix the potatoes into the beaten, salted eggs. Leave for 5 minutes.',
        'Heat the kept oil in a 24 cm pan, pour in the mixture and cook for 5 minutes on a low heat.',
        'Turn it out onto a plate, slide it back into the pan, and cook for 3 minutes more.',
      ),
      fr: steps(
        "Épluchez les pommes de terre et coupez-les en fines rondelles, et émincez l'oignon.",
        "Faites-les cuire doucement 20 minutes dans l'huile d'olive, qu'ils soient tendres sans dorer.",
        "Égouttez l'huile en en gardant 2 cuillerées, et mélangez les pommes de terre aux œufs battus et salés. Laissez reposer 5 minutes.",
        "Faites chauffer l'huile gardée dans une poêle de 24 cm, versez-y le mélange et laissez cuire 5 minutes à feu doux.",
        'Retournez la tortilla sur une assiette, faites-la glisser dans la poêle, et comptez 3 minutes de plus.',
      ),
      es: steps(
        'Pela las patatas y córtalas en láminas finas, y corta la cebolla.',
        'Pocha ambas a fuego suave en el aceite 20 minutos, hasta que estén tiernas sin dorarse.',
        'Escurre el aceite, guardando 2 cucharadas, y mezcla las patatas con los huevos batidos y salados. Deja reposar 5 minutos.',
        'Calienta el aceite reservado en una sartén de 24 cm, vierte la mezcla y cuaja 5 minutos a fuego lento.',
        'Dale la vuelta con ayuda de un plato, vuelve a deslizarla en la sartén y cuaja 3 minutos más.',
      ),
    }),
    asset('card', 'recipes/spanish-tortilla-card.pdf', 'Recipe card (PDF)'),
  ],
})
