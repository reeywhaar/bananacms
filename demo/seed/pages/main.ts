import { group, image, meta, page, text } from '../content.ts'

// The home page's content, all of it editable in the admin: the hero, the poll,
// whose counts are JSON in a meta block the votes update, and the ripeness guide,
// whose stages have their colours as attributes.
export default page('Main page', {
  blocks: [
    group('hero', [
      text('eyebrow', {
        en: 'bananacms demo',
        fr: 'Démo de bananacms',
        es: 'Demo de bananacms',
      }),
      text('title', {
        en: 'Recipes and films',
        fr: 'Recettes et films',
        es: 'Recetas y películas',
      }),
      text('body', {
        en: 'Everything on this site comes from the CMS. Edit it at /manage, signed in as demo, with the password demo.',
        fr: 'Tout ce qui se trouve sur ce site vient du CMS. Modifiez-le dans /manage, connecté en tant que demo, avec le mot de passe demo.',
        es: 'Todo lo que hay en este sitio viene del CMS. Edítalo en /manage, con el usuario demo y la contraseña demo.',
      }),
      image('picture', 'pages/bananas.jpg', {
        en: 'Bunches of bananas at a market, from green to yellow',
        fr: 'Des régimes de bananes sur un marché, du vert au jaune',
        es: 'Racimos de plátanos en un mercado, del verde al amarillo',
      }),
    ]),
    group('poll', [
      text('question', {
        en: "What's the best banana dish?",
        fr: 'Quel est le meilleur plat à la banane ?',
        es: '¿Cuál es el mejor plato con plátano?',
      }),
      group('options', [
        text('bread', { en: 'Banana bread', fr: 'Pain à la banane', es: 'Pan de plátano' }),
        text('banoffee', { en: 'Banoffee pie', fr: 'Tarte banoffee', es: 'Tarta banoffee' }),
        text('plantains', {
          en: 'Fried plantains',
          fr: 'Bananes plantains frites',
          es: 'Plátanos fritos',
        }),
        text('smoothie', { en: 'Smoothie', fr: 'Smoothie', es: 'Batido' }),
      ]),
      meta('votes', JSON.stringify({ bread: 13, banoffee: 7, plantains: 5, smoothie: 3 })),
    ]),
    group('ripeness', [
      text('title', { en: 'Ripeness guide', fr: 'Guide de maturité', es: 'Guía de maduración' }),
      text('intro', {
        en: 'Drag the slider. The stages come from the CMS; the slider itself is a client component.',
        fr: 'Faites glisser le curseur. Les étapes viennent du CMS ; le curseur lui-même est un composant client.',
        es: 'Desliza el control. Las etapas vienen del CMS; el control en sí es un componente de cliente.',
      }),
      group('stages', [
        group(
          'green',
          [
            text('name', { en: 'Green', fr: 'Verte', es: 'Verde' }),
            text('description', {
              en: 'Firm and starchy. Great for cooking, not for snacking.',
              fr: 'Ferme et farineuse. Parfaite à cuire, moins à croquer.',
              es: 'Firme y harinoso. Ideal para cocinar, no tanto para comer tal cual.',
            }),
          ],
          { color: '#7cb342' },
        ),
        group(
          'yellow-green',
          [
            text('name', {
              en: 'Yellow with green tips',
              fr: 'Jaune aux pointes vertes',
              es: 'Amarillo con puntas verdes',
            }),
            text('description', {
              en: 'Slightly firm and mildly sweet. Lasts a few more days.',
              fr: 'Encore un peu ferme et légèrement sucrée. Elle tiendra quelques jours de plus.',
              es: 'Todavía algo firme y ligeramente dulce. Aguanta unos días más.',
            }),
          ],
          { color: '#c0ca33' },
        ),
        group(
          'yellow',
          [
            text('name', { en: 'Yellow', fr: 'Jaune', es: 'Amarillo' }),
            text('description', {
              en: 'Peak snacking banana: sweet, soft and easy to peel.',
              fr: 'La banane idéale à croquer : sucrée, tendre et facile à éplucher.',
              es: 'El plátano perfecto para comer: dulce, tierno y fácil de pelar.',
            }),
          ],
          { color: '#fdd835' },
        ),
        group(
          'spotted',
          [
            text('name', { en: 'Spotted', fr: 'Tachetée', es: 'Con manchas' }),
            text('description', {
              en: 'Sugar spots mean extra sweetness. Perfect for smoothies.',
              fr: 'Les taches de sucre la rendent encore plus douce. Parfaite pour les smoothies.',
              es: 'Las manchas de azúcar lo hacen aún más dulce. Perfecto para batidos.',
            }),
          ],
          { color: '#f9a825' },
        ),
        group(
          'brown',
          [
            text('name', { en: 'Brown', fr: 'Brune', es: 'Marrón' }),
            text('description', {
              en: 'Very soft and very sweet: time for banana bread.',
              fr: "Très tendre et très sucrée : c'est l'heure du pain à la banane.",
              es: 'Muy blando y muy dulce: hora de hacer pan de plátano.',
            }),
          ],
          { color: '#6d4c41' },
        ),
      ]),
    ]),
  ],
})
