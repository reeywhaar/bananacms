import { group, html, image, meta, post, text } from '../content.ts'
import { documentary } from '../tags.ts'

export default post('workers-leaving-the-lumiere-factory', {
  name: {
    en: 'Workers Leaving the Lumière Factory',
    fr: "La Sortie de l'usine Lumière à Lyon",
    es: 'La salida de los obreros de la fábrica Lumière',
  },
  tags: [documentary],
  attributes: {
    year: '1895',
    director: 'Louis Lumière',
    country: { en: 'France', fr: 'France', es: 'Francia' },
  },
  blocks: [
    image('still', 'movies/workers-leaving-the-lumiere-factory.jpg', {
      en: 'Workers, most of them women in long skirts and hats, streaming out of the factory gates',
      fr: "Des ouvriers, surtout des femmes en jupes longues et chapeaux, sortant en foule par les portes de l'usine",
      es: 'Obreros, la mayoría mujeres con faldas largas y sombreros, saliendo en tropel por las puertas de la fábrica',
    }),
    text('summary', {
      en: 'At the end of a shift, the workers of the Lumière factory in Lyon stream out through its gates and head home.',
      fr: "À la fin de la journée, les ouvriers de l'usine Lumière de Lyon sortent en foule par ses portes et rentrent chez eux.",
      es: 'Al terminar la jornada, los obreros de la fábrica Lumière de Lyon salen en tropel por sus puertas y vuelven a casa.',
    }),
    html('notes', {
      en: '<p>One of the ten films at the first paid screening of the Cinématographe, at the Grand Café in Paris on 28 December 1895. Louis Lumière filmed the scene more than once: <strong>three versions</strong> survive, from 1895 and 1896.</p>',
      fr: "<p>L'un des dix films de la première projection payante du Cinématographe, au Grand Café à Paris, le 28 décembre 1895. Louis Lumière a tourné la scène plus d'une fois : <strong>trois versions</strong> nous sont parvenues, de 1895 et 1896.</p>",
      es: '<p>Una de las diez películas de la primera proyección de pago del cinematógrafo, en el Grand Café de París, el 28 de diciembre de 1895. Louis Lumière rodó la escena más de una vez: se conservan <strong>tres versiones</strong>, de 1895 y 1896.</p>',
    }),
    group('gallery', [
      image('still', 'movies/workers-leaving-the-lumiere-factory-versions.jpg', {
        en: 'Frames from the three versions of the film, side by side',
        fr: 'Des images des trois versions du film, côte à côte',
        es: 'Fotogramas de las tres versiones de la película, uno junto a otro',
      }),
    ]),
    meta('wikipedia', 'https://en.wikipedia.org/wiki/Workers_Leaving_the_Lumi%C3%A8re_Factory'),
  ],
})
