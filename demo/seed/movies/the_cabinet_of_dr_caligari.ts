import { group, html, image, meta, post, text } from '../content.ts'
import { expressionism, horror } from '../tags.ts'

export default post('the-cabinet-of-dr-caligari', {
  name: {
    en: 'The Cabinet of Dr. Caligari',
    fr: 'Le Cabinet du docteur Caligari',
    es: 'El gabinete del doctor Caligari',
  },
  tags: [horror, expressionism],
  attributes: {
    year: '1920',
    director: 'Robert Wiene',
    country: { en: 'Germany', fr: 'Allemagne', es: 'Alemania' },
  },
  blocks: [
    image('still', 'movies/the-cabinet-of-dr-caligari.jpg', {
      en: 'Dr. Caligari, in a top hat and cape, walking down a painted street of slanting walls',
      fr: 'Le docteur Caligari, en haut-de-forme et cape, descendant une rue peinte aux murs penchés',
      es: 'El doctor Caligari, con sombrero de copa y capa, bajando por una calle pintada de paredes inclinadas',
    }),
    text('summary', {
      en: 'At a fair, the showman Caligari shows off Cesare, a sleepwalker who can tell the future, and in the town people begin to die.',
      fr: 'Dans une foire, le forain Caligari exhibe Cesare, un somnambule qui prédit l’avenir, et en ville les morts commencent.',
      es: 'En una feria, el feriante Caligari exhibe a Cesare, un sonámbulo que predice el futuro, y en la ciudad empiezan las muertes.',
    }),
    html('notes', {
      en: '<p>Its streets are painted on canvas, all slants and shadows, and it made German Expressionism famous. Werner Krauss plays Caligari, and Conrad Veidt the sleepwalker Cesare.</p>',
      fr: '<p>Ses rues sont peintes sur toile, tout en biais et en ombres, et il a rendu célèbre l’expressionnisme allemand. Werner Krauss joue Caligari, et Conrad Veidt le somnambule Cesare.</p>',
      es: '<p>Sus calles están pintadas en lienzo, todo diagonales y sombras, y dio fama al expresionismo alemán. Werner Krauss interpreta a Caligari, y Conrad Veidt al sonámbulo Cesare.</p>',
    }),
    group('gallery', [
      image('still', 'movies/the-cabinet-of-dr-caligari-cesare.jpg', {
        en: 'Caligari and Cesare, the sleepwalker, side by side',
        fr: 'Caligari et Cesare, le somnambule, côte à côte',
        es: 'Caligari y Cesare, el sonámbulo, uno junto al otro',
      }),
      image('still', 'movies/the-cabinet-of-dr-caligari-face.jpg', {
        en: "Cesare's face, his eyes wide open",
        fr: 'Le visage de Cesare, les yeux grands ouverts',
        es: 'El rostro de Cesare, con los ojos muy abiertos',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/The_Cabinet_of_Dr._Caligari'),
  ],
})
