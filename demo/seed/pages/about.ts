import { group, list, markdown, meta, page, text } from '../content.ts'

// A page the site doesn't show, to edit in the admin: what the demo is, a few
// questions and answers, each a group, and a link as a meta block. Its attributes
// are a label for a menu, in every language, and when it was last looked over.
export default page('About', {
  attributes: {
    menuLabel: { en: 'About', fr: 'À propos', es: 'Acerca de' },
    reviewed: '2026-09-28',
  },
  blocks: [
    text('title', {
      en: 'About this demo',
      fr: 'À propos de cette démo',
      es: 'Acerca de esta demo',
    }),
    markdown('body', {
      en: [
        'This site shows what bananacms does with a little content: recipes and old films, in three languages.',
        list(
          'Recipes and films are **categories**, and each dish or film is a **post**.',
          'The home page, and this one, are **pages**: blocks under a key.',
          'Everything is in English, French and Spanish.',
        ),
      ].join('\n\n'),
      fr: [
        'Ce site montre ce que bananacms fait avec un peu de contenu : des recettes et de vieux films, en trois langues.',
        list(
          'Les recettes et les films sont des **catégories**, et chaque plat ou film est un **article**.',
          "La page d'accueil, et celle-ci, sont des **pages** : des blocs sous une clé.",
          'Tout est en anglais, en français et en espagnol.',
        ),
      ].join('\n\n'),
      es: [
        'Este sitio muestra lo que hace bananacms con un poco de contenido: recetas y películas antiguas, en tres idiomas.',
        list(
          'Las recetas y las películas son **categorías**, y cada plato o película es una **entrada**.',
          'La página de inicio, y esta, son **páginas**: bloques bajo una clave.',
          'Todo está en inglés, francés y español.',
        ),
      ].join('\n\n'),
    }),
    group('faq', [
      group('pictures', [
        text('question', {
          en: 'Where do the pictures come from?',
          fr: "D'où viennent les images ?",
          es: '¿De dónde vienen las imágenes?',
        }),
        text('answer', {
          en: 'The photos are from Unsplash, and the film stills and posters, in the public domain, from Wikimedia Commons. Each picture names its author and source.',
          fr: 'Les photos viennent d’Unsplash, et les images et affiches de films, dans le domaine public, de Wikimedia Commons. Chaque image indique son auteur et sa source.',
          es: 'Las fotos son de Unsplash, y los fotogramas y carteles de películas, de dominio público, de Wikimedia Commons. Cada imagen indica su autor y su origen.',
        }),
      ]),
      group('editing', [
        text('question', {
          en: 'How do I change this page?',
          fr: 'Comment modifier cette page ?',
          es: '¿Cómo cambio esta página?',
        }),
        text('answer', {
          en: 'Sign in at /manage as demo, with the password demo, and open Pages.',
          fr: 'Connectez-vous dans /manage en tant que demo, avec le mot de passe demo, et ouvrez Pages.',
          es: 'Entra en /manage con el usuario demo y la contraseña demo, y abre Pages.',
        }),
      ]),
    ]),
    meta('repository', 'https://github.com/Reeywhaar/bananacms'),
  ],
})
