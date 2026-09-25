import { group, html, image, meta, post, text } from '../content.ts'
import { fantasy } from '../tags.ts'

export default post('alice-in-wonderland', {
  name: {
    en: 'Alice in Wonderland',
    fr: 'Alice au pays des merveilles',
    es: 'Alicia en el país de las maravillas',
  },
  tags: [fantasy],
  attributes: {
    year: '1903',
    director: 'Cecil Hepworth and Percy Stow',
    country: { en: 'United Kingdom', fr: 'Royaume-Uni', es: 'Reino Unido' },
  },
  blocks: [
    image('still', 'movies/alice-in-wonderland.jpg', {
      en: 'Alice, sitting on the grass, meets the White Rabbit in his checked jacket',
      fr: 'Alice, assise dans l’herbe, rencontre le Lapin blanc et sa veste à carreaux',
      es: 'Alicia, sentada en la hierba, se encuentra con el Conejo Blanco y su chaqueta de cuadros',
    }),
    text('summary', {
      en: "Alice follows the White Rabbit down the hole, grows and shrinks, and ends up in the Queen of Hearts' procession of playing cards.",
      fr: 'Alice suit le Lapin blanc dans son terrier, grandit, rapetisse, et se retrouve dans le cortège de cartes à jouer de la Reine de cœur.',
      es: 'Alicia sigue al Conejo Blanco por la madriguera, crece, encoge y acaba en el desfile de naipes de la Reina de Corazones.',
    }),
    html('notes', {
      en: "<p>The first film of Lewis Carroll's book, twelve minutes long when it was new. May Clark plays Alice. The one print known to survive is incomplete; the BFI restored it in 2010.</p>",
      fr: '<p>Le premier film tiré du livre de Lewis Carroll, qui durait douze minutes à sa sortie. May Clark y joue Alice. La seule copie connue est incomplète ; le BFI l’a restaurée en 2010.</p>',
      es: '<p>La primera película basada en el libro de Lewis Carroll, de doce minutos cuando se estrenó. May Clark interpreta a Alicia. La única copia conocida está incompleta; el BFI la restauró en 2010.</p>',
    }),
    group('gallery', [
      image('still', 'movies/alice-in-wonderland-cards.jpg', {
        en: 'Children dressed as playing cards, marching in the royal procession',
        fr: 'Des enfants déguisés en cartes à jouer, défilant dans le cortège royal',
        es: 'Niños disfrazados de naipes, desfilando en el cortejo real',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/Alice_in_Wonderland_(1903_film)'),
  ],
})
