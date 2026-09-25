import { group, html, image, meta, post, text } from '../content.ts'
import { fantasy, scienceFiction } from '../tags.ts'

export default post('a-trip-to-the-moon', {
  name: { en: 'A Trip to the Moon', fr: 'Le Voyage dans la Lune', es: 'Viaje a la Luna' },
  tags: [scienceFiction, fantasy],
  attributes: {
    year: '1902',
    director: 'Georges Méliès',
    country: { en: 'France', fr: 'France', es: 'Francia' },
  },
  blocks: [
    image('still', 'movies/a-trip-to-the-moon.jpg', {
      en: "The Moon's face, with a space shell stuck in its eye",
      fr: "Le visage de la Lune, un obus planté dans l'œil",
      es: 'La cara de la Luna, con un proyectil clavado en el ojo',
    }),
    text('summary', {
      en: 'A congress of astronomers fires itself at the Moon in a shell, lands in the eye of the man in the Moon, meets the Selenites who live there, and falls back home to a parade.',
      fr: "Un congrès d'astronomes se fait tirer vers la Lune dans un obus, atterrit dans l'œil de la Lune, rencontre les Sélénites qui y vivent, puis retombe sur Terre, accueilli par une parade.",
      es: 'Un congreso de astrónomos se lanza a la Luna dentro de un proyectil, aterriza en el ojo de la Luna, conoce a los selenitas que la habitan y cae de vuelta a la Tierra, donde lo recibe un desfile.',
    }),
    html('notes', {
      en: '<p>Méliès shot it in his glass-walled studio at Montreuil. Some prints were <em>coloured by hand</em>, frame by frame; one of them turned up in 1993 and was restored in 2011.</p>',
      fr: '<p>Méliès l’a tourné dans son studio vitré de Montreuil. Certaines copies ont été <em>coloriées à la main</em>, image par image ; l’une d’elles a été retrouvée en 1993 et restaurée en 2011.</p>',
      es: '<p>Méliès lo rodó en su estudio acristalado de Montreuil. Algunas copias se <em>colorearon a mano</em>, fotograma a fotograma; una de ellas apareció en 1993 y se restauró en 2011.</p>',
    }),
    group('gallery', [
      image('still', 'movies/a-trip-to-the-moon-colour.jpg', {
        en: 'The same shot in colour, from a print coloured by hand',
        fr: 'Le même plan en couleurs, tiré d’une copie coloriée à la main',
        es: 'El mismo plano en color, de una copia coloreada a mano',
      }),
      image('still', 'movies/a-trip-to-the-moon-cannon.jpg', {
        en: 'Chorus girls in sailor suits loading the space shell into the cannon',
        fr: 'Des figurantes en costume de marin chargeant l’obus dans le canon',
        es: 'Figurantes vestidas de marinero cargando el proyectil en el cañón',
      }),
      image('still', 'movies/a-trip-to-the-moon-title.jpg', {
        en: 'The title card: Le Voyage dans la Lune, Star Film, Geo. Méliès, Paris',
        fr: 'Le carton-titre : Le Voyage dans la Lune, Star Film, Geo. Méliès, Paris',
        es: 'El rótulo del título: Le Voyage dans la Lune, Star Film, Geo. Méliès, París',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/A_Trip_to_the_Moon'),
  ],
})
