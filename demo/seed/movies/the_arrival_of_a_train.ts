import { group, html, image, meta, post, text } from '../content.ts'
import { documentary } from '../tags.ts'

export default post('the-arrival-of-a-train', {
  name: {
    en: 'The Arrival of a Train',
    fr: "L'Arrivée d'un train en gare de La Ciotat",
    es: 'La llegada de un tren a la estación de La Ciotat',
  },
  tags: [documentary],
  attributes: {
    year: '1896',
    director: 'Auguste and Louis Lumière',
    country: { en: 'France', fr: 'France', es: 'Francia' },
  },
  blocks: [
    image('still', 'movies/the-arrival-of-a-train.jpg', {
      en: 'A steam locomotive pulling into La Ciotat station, travellers waiting on the platform',
      fr: 'Une locomotive à vapeur entrant en gare de La Ciotat, des voyageurs attendant sur le quai',
      es: 'Una locomotora de vapor entrando en la estación de La Ciotat, con viajeros esperando en el andén',
    }),
    text('summary', {
      en: 'A steam train pulls into the station at La Ciotat, and the passengers step down onto the platform, all in one fifty-second shot.',
      fr: 'Un train à vapeur entre en gare de La Ciotat et les voyageurs descendent sur le quai, en un seul plan de cinquante secondes.',
      es: 'Un tren de vapor entra en la estación de La Ciotat y los viajeros bajan al andén, en un único plano de cincuenta segundos.',
    }),
    html('notes', {
      en: '<p>The camera stands on the platform, and the engine comes almost straight at it. The story of audiences running from the screen is <em>probably a legend</em>, but the depth of the shot still startles.</p>',
      fr: '<p>La caméra est posée sur le quai, et la locomotive arrive presque droit sur elle. L’histoire des spectateurs fuyant la salle est <em>sans doute une légende</em>, mais la profondeur du plan saisit encore.</p>',
      es: '<p>La cámara está en el andén, y la locomotora llega casi de frente hacia ella. La historia del público huyendo de la sala es <em>probablemente una leyenda</em>, pero la profundidad del plano todavía sorprende.</p>',
    }),
    group('gallery', [
      image('poster', 'movies/cinematographe-lumiere-poster.jpg', {
        en: 'An 1895 poster for the Cinématographe Lumière, with a crowd at the door',
        fr: 'Une affiche de 1895 pour le Cinématographe Lumière, avec une foule à la porte',
        es: 'Un cartel de 1895 del Cinematógrafo Lumière, con una multitud en la puerta',
      }),
    ]),
    meta(
      'wikipedia',
      'https://en.wikipedia.org/wiki/L%27Arriv%C3%A9e_d%27un_train_en_gare_de_La_Ciotat',
    ),
  ],
})
