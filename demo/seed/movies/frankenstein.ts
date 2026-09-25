import { group, html, image, meta, post, text } from '../content.ts'
import { horror } from '../tags.ts'

export default post('frankenstein', {
  name: { en: 'Frankenstein', fr: 'Frankenstein', es: 'Frankenstein' },
  tags: [horror],
  attributes: {
    year: '1910',
    director: 'J. Searle Dawley',
    country: { en: 'United States', fr: 'États-Unis', es: 'Estados Unidos' },
  },
  blocks: [
    image('still', 'movies/frankenstein.jpg', {
      en: "The creature, ragged and wild-haired, in Frankenstein's study",
      fr: 'La créature, en haillons et les cheveux hirsutes, dans le cabinet de Frankenstein',
      es: 'La criatura, harapienta y despeinada, en el estudio de Frankenstein',
    }),
    text('summary', {
      en: 'A young scientist, Frankenstein, sets out to make a living man and makes a monster, which follows him home to his wedding.',
      fr: "Un jeune savant, Frankenstein, veut créer un homme vivant et crée un monstre, qui le suit jusqu'à ses noces.",
      es: 'Un joven científico, Frankenstein, se propone crear un hombre vivo y crea un monstruo, que lo sigue hasta su boda.',
    }),
    html('notes', {
      en: "<p>The first film of Mary Shelley's novel, made at Edison's studio in the Bronx. Charles Ogle plays the creature, which rises out of a vat of chemicals. The film was long thought lost, until a collector's print came to light in the 1970s.</p>",
      fr: '<p>Le premier film tiré du roman de Mary Shelley, tourné dans le studio d’Edison, dans le Bronx. Charles Ogle y joue la créature, qui naît d’une cuve de produits chimiques. On a longtemps cru le film perdu, jusqu’à ce que la copie d’un collectionneur refasse surface dans les années 1970.</p>',
      es: '<p>La primera película basada en la novela de Mary Shelley, rodada en el estudio de Edison en el Bronx. Charles Ogle interpreta a la criatura, que surge de una cuba de productos químicos. Durante mucho tiempo se creyó perdida, hasta que la copia de un coleccionista salió a la luz en los años setenta.</p>',
    }),
    group('gallery', [
      image('still', 'movies/frankenstein-laboratory.jpg', {
        en: 'Frankenstein at work in his laboratory, a skeleton sitting beside him',
        fr: 'Frankenstein au travail dans son laboratoire, un squelette assis à côté de lui',
        es: 'Frankenstein trabajando en su laboratorio, con un esqueleto sentado a su lado',
      }),
      image('cover', 'movies/frankenstein-kinetogram.jpg', {
        en: 'The cover of the Edison Kinetogram of March 1910, with a scene from Frankenstein',
        fr: "La couverture de l'Edison Kinetogram de mars 1910, avec une scène de Frankenstein",
        es: 'La portada del Edison Kinetogram de marzo de 1910, con una escena de Frankenstein',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/Frankenstein_(1910_film)'),
  ],
})
