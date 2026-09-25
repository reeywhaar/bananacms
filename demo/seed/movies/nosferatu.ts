import { group, html, image, meta, post, text } from '../content.ts'
import { expressionism, horror } from '../tags.ts'

export default post('nosferatu', {
  name: { en: 'Nosferatu', fr: 'Nosferatu le vampire', es: 'Nosferatu' },
  tags: [horror, expressionism],
  attributes: {
    year: '1922',
    director: 'F. W. Murnau',
    country: { en: 'Germany', fr: 'Allemagne', es: 'Alemania' },
  },
  blocks: [
    image('still', 'movies/nosferatu.jpg', {
      en: 'Max Schreck as Count Orlok, bald, with long, claw-like fingers',
      fr: 'Max Schreck en comte Orlok, chauve, aux longs doigts crochus',
      es: 'Max Schreck como el conde Orlok, calvo, con largos dedos como garras',
    }),
    text('summary', {
      en: 'An estate agent travels to the Carpathians to sell a house to Count Orlok, who follows him home and brings the plague.',
      fr: 'Un agent immobilier part dans les Carpates vendre une maison au comte Orlok, qui le suit jusque chez lui et apporte la peste.',
      es: 'Un agente inmobiliario viaja a los Cárpatos para venderle una casa al conde Orlok, que lo sigue hasta su ciudad y trae la peste.',
    }),
    html('notes', {
      en: "<p>An unauthorised <em>Dracula</em>, with the names changed. Bram Stoker's widow sued, and a court ordered every print destroyed; some copies survived, and the film with them.</p>",
      fr: '<p>Un <em>Dracula</em> sans autorisation, aux noms changés. La veuve de Bram Stoker a porté plainte, et un tribunal a ordonné la destruction de toutes les copies ; quelques-unes ont survécu, et le film avec elles.</p>',
      es: '<p>Un <em>Drácula</em> sin autorización, con los nombres cambiados. La viuda de Bram Stoker demandó, y un tribunal ordenó destruir todas las copias; algunas sobrevivieron, y la película con ellas.</p>',
    }),
    group('gallery', [
      image('still', 'movies/nosferatu-doorway.jpg', {
        en: 'Orlok, standing in an arched doorway',
        fr: 'Orlok, debout dans l’encadrement d’une porte en ogive',
        es: 'Orlok, de pie bajo el arco de una puerta',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/Nosferatu'),
  ],
})
