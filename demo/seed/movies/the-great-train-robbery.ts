import { group, html, image, meta, post, text } from '../content.ts'
import { crime, western } from '../tags.ts'

export default post('the-great-train-robbery', {
  name: {
    en: 'The Great Train Robbery',
    fr: 'Le Vol du grand rapide',
    es: 'Asalto y robo de un tren',
  },
  tags: [western, crime],
  attributes: {
    year: '1903',
    director: 'Edwin S. Porter',
    country: { en: 'United States', fr: 'États-Unis', es: 'Estados Unidos' },
  },
  blocks: [
    image('still', 'movies/the-great-train-robbery.jpg', {
      en: 'A bandit holding up the telegraph operator at the station',
      fr: 'Un bandit tenant en joue le télégraphiste de la gare',
      es: 'Un bandido encañona al telegrafista de la estación',
    }),
    text('summary', {
      en: 'A gang of bandits holds up a train, robs its passengers and escapes on horseback, until a posse from the town catches up with them.',
      fr: "Une bande de hors-la-loi attaque un train, dépouille les voyageurs et s'enfuit à cheval, jusqu'à ce qu'une milice venue de la ville les rattrape.",
      es: 'Una banda de forajidos asalta un tren, roba a los pasajeros y huye a caballo, hasta que una partida del pueblo les da alcance.',
    }),
    html('notes', {
      en: '<p>Twelve minutes, fourteen scenes, and a closing shot that became famous on its own: a bandit, played by Justus D. Barnes, <strong>fires straight at the audience</strong>. Porter shot it in New Jersey for the Edison company.</p>',
      fr: '<p>Douze minutes, quatorze scènes, et un dernier plan devenu célèbre à lui seul : un bandit, joué par Justus D. Barnes, <strong>tire droit sur le public</strong>. Porter l’a tourné dans le New Jersey pour la compagnie d’Edison.</p>',
      es: '<p>Doce minutos, catorce escenas y un plano final que se hizo famoso por sí solo: un bandido, interpretado por Justus D. Barnes, <strong>dispara directamente al público</strong>. Porter la rodó en Nueva Jersey para la compañía de Edison.</p>',
    }),
    group('gallery', [
      image('still', 'movies/the-great-train-robbery-chase.jpg', {
        en: 'The bandits galloping through the woods, with the posse firing after them',
        fr: 'Les bandits galopant dans les bois, poursuivis sous les tirs de la milice',
        es: 'Los bandidos galopan por el bosque, perseguidos a tiros por la partida',
      }),
      image('still', 'movies/the-great-train-robbery-dance-hall.jpg', {
        en: 'A dance hall, where a newcomer is made to dance at gunpoint',
        fr: 'Un bal de saloon, où l’on fait danser un nouveau venu sous la menace des revolvers',
        es: 'Un baile de salón, donde obligan a bailar a un recién llegado a punta de pistola',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/The_Great_Train_Robbery_(1903_film)'),
  ],
})
