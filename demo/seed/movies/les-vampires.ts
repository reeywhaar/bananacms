import { group, html, image, meta, post, text } from '../content.ts'
import { crime } from '../tags.ts'

export default post('les-vampires', {
  name: { en: 'Les Vampires', fr: 'Les Vampires', es: 'Los vampiros' },
  tags: [crime],
  attributes: {
    year: '1915',
    director: 'Louis Feuillade',
    country: { en: 'France', fr: 'France', es: 'Francia' },
  },
  blocks: [
    image('still', 'movies/les-vampires.jpg', {
      en: 'Musidora as Irma Vep, in a black bodysuit and hood',
      fr: 'Musidora en Irma Vep, en collant noir et cagoule',
      es: 'Musidora como Irma Vep, con malla negra y capucha',
    }),
    text('summary', {
      en: 'A reporter and his friend take on the Vampires, a Paris gang of thieves and killers who never seem to run short of disguises.',
      fr: 'Un reporter et son ami affrontent les Vampires, une bande parisienne de voleurs et d’assassins qui ne semble jamais à court de déguisements.',
      es: 'Un periodista y su amigo se enfrentan a los Vampiros, una banda parisina de ladrones y asesinos que nunca parece quedarse sin disfraces.',
    }),
    html('notes', {
      en: '<p>A crime serial in ten episodes, nearly seven hours in all. Musidora plays Irma Vep, whose name is an anagram of <em>vampire</em>, in a black bodysuit that outlived the serial.</p>',
      fr: '<p>Un feuilleton criminel en dix épisodes, près de sept heures en tout. Musidora y joue Irma Vep, dont le nom est l’anagramme de <em>vampire</em>, dans un collant noir qui a survécu au feuilleton.</p>',
      es: '<p>Un serial criminal en diez episodios, casi siete horas en total. Musidora interpreta a Irma Vep, cuyo nombre es un anagrama de <em>vampire</em>, con una malla negra que sobrevivió al serial.</p>',
    }),
    group('gallery', [
      image('still', 'movies/les-vampires-kidnapping.jpg', {
        en: 'Juan-José Moreno carries off Irma Vep, in the episode The Eyes That Fascinate',
        fr: 'Juan-José Moreno enlève Irma Vep, dans l’épisode Les Yeux qui fascinent',
        es: 'Juan-José Moreno rapta a Irma Vep, en el episodio Los ojos que fascinan',
      }),
      image('still', 'movies/les-vampires-cabaret.jpg', {
        en: 'A scene in a Paris cabaret',
        fr: 'Une scène dans un cabaret parisien',
        es: 'Una escena en un cabaret de París',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/Les_Vampires'),
  ],
})
