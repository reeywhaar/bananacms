import { category, image, text } from '../content.ts'
import aTripToTheMoon from './a_trip_to_the_moon.ts'
import aliceInWonderland from './alice_in_wonderland.ts'
import frankenstein from './frankenstein.ts'
import lesVampires from './les_vampires.ts'
import nosferatu from './nosferatu.ts'
import theArrivalOfATrain from './the_arrival_of_a_train.ts'
import theCabinetOfDrCaligari from './the_cabinet_of_dr_caligari.ts'
import theGreatTrainRobbery from './the_great_train_robbery.ts'
import workersLeavingTheLumiereFactory from './workers_leaving_the_lumiere_factory.ts'

// in the order they came out
export default category('movies', {
  name: { en: 'Movies', fr: 'Films', es: 'Películas' },
  blocks: [
    text('intro', {
      en: "Films from cinema's first decades, all of them in the public domain.",
      fr: 'Des films des premières décennies du cinéma, tous dans le domaine public.',
      es: 'Películas de las primeras décadas del cine, todas de dominio público.',
    }),
    image('cover', 'movies/cinematographe-lumiere-poster.jpg', {
      en: 'An 1895 poster for the Cinématographe Lumière, with a crowd at the door',
      fr: 'Une affiche de 1895 pour le Cinématographe Lumière, avec une foule à la porte',
      es: 'Un cartel de 1895 del Cinematógrafo Lumière, con una multitud en la puerta',
    }),
  ],
  posts: [
    workersLeavingTheLumiereFactory,
    theArrivalOfATrain,
    aTripToTheMoon,
    theGreatTrainRobbery,
    aliceInWonderland,
    frankenstein,
    lesVampires,
    theCabinetOfDrCaligari,
    nosferatu,
  ],
})
