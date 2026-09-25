import { image, list, markdown, post, steps, text } from '../content.ts'
import { spanish, vegan } from '../tags.ts'

export default post('gazpacho', {
  name: { en: 'Gazpacho', fr: 'Gaspacho', es: 'Gazpacho' },
  tags: [spanish, vegan],
  attributes: {
    time: {
      en: '15 min, and 2 h in the fridge',
      fr: '15 min, et 2 h au frais',
      es: '15 min, y 2 h en la nevera',
    },
    servings: '4',
    difficulty: { en: 'Easy', fr: 'Facile', es: 'Fácil' },
  },
  blocks: [
    image('cover', 'recipes/gazpacho.jpg', {
      en: 'A bowl of gazpacho, a spoon lifting some out, and bread on the side',
      fr: 'Un bol de gaspacho, une cuillère qui en soulève un peu, et du pain à côté',
      es: 'Un plato de gazpacho, una cuchara que lo levanta y pan al lado',
    }),
    text('summary', {
      en: 'The cold tomato soup of Andalusia: ripe tomatoes, cucumber, pepper, garlic, olive oil and a little vinegar, blended smooth.',
      fr: "La soupe froide de tomate andalouse : tomates mûres, concombre, poivron, ail, huile d'olive et un peu de vinaigre, mixés finement.",
      es: 'La sopa fría de Andalucía: tomates maduros, pepino, pimiento, ajo, aceite de oliva y un poco de vinagre, triturados hasta quedar finos.',
    }),
    markdown('ingredients', {
      en: list(
        '1 kg ripe tomatoes',
        '1 small cucumber',
        '1 green pepper',
        '1 clove of garlic',
        '100 ml olive oil',
        '2 tbsp sherry vinegar',
        'Salt',
        'A slice of stale bread, if you like',
      ),
      fr: list(
        '1 kg de tomates bien mûres',
        '1 petit concombre',
        '1 poivron vert',
        "1 gousse d'ail",
        "10 cl d'huile d'olive",
        '2 c. à soupe de vinaigre de Xérès',
        'Du sel',
        'Une tranche de pain rassis, si vous aimez',
      ),
      es: list(
        '1 kg de tomates maduros',
        '1 pepino pequeño',
        '1 pimiento verde',
        '1 diente de ajo',
        '100 ml de aceite de oliva',
        '2 cucharadas de vinagre de Jerez',
        'Sal',
        'Una rebanada de pan duro, si te gusta',
      ),
    }),
    markdown('method', {
      en: steps(
        'Roughly chop the tomatoes, cucumber, pepper and garlic.',
        'Blend them with the bread, the vinegar and a good pinch of salt.',
        'With the blender running, pour in the olive oil.',
        'Sieve, taste for salt and vinegar, and chill for at least 2 hours.',
        'Serve very cold.',
      ),
      fr: steps(
        "Coupez grossièrement les tomates, le concombre, le poivron et l'ail.",
        'Mixez-les avec le pain, le vinaigre et une bonne pincée de sel.',
        "Sans arrêter le blender, versez l'huile d'olive.",
        'Passez au chinois, rectifiez le sel et le vinaigre, et réservez au frais au moins 2 heures.',
        'Servez bien froid.',
      ),
      es: steps(
        'Trocea los tomates, el pepino, el pimiento y el ajo.',
        'Tritúralos con el pan, el vinagre y una buena pizca de sal.',
        'Con la batidora en marcha, añade el aceite de oliva.',
        'Cuela, rectifica de sal y vinagre, y enfría al menos 2 horas.',
        'Sirve muy frío.',
      ),
    }),
  ],
})
