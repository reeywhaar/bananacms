import { describe, expect, it } from 'vitest'
import type { BlockData } from '@cms/lib/blocks/declarations'
import type { Translations } from '@cms/services/LocalizationStore'
import { deserializeData, serializeBlocks } from './serialize'

const DEFAULT_LOCALE = 'en'

const makeBlocks = (): BlockData[] => [
  {
    id: 'block-text',
    parent: { type: 'post', id: 'post-1' },
    content: { type: 'text', key: 'intro', contentType: 'plain', text: 'Hello' },
    attributes: [
      { id: 'attr-plain', key: 'style', translatable: false, text: 'wide' },
      { id: 'attr-i18n', key: 'label', translatable: true, text: 'Label' },
    ],
  },
  {
    id: 'block-group',
    parent: { type: 'post', id: 'post-1' },
    content: {
      type: 'group',
      key: 'gallery',
      blocks: [
        {
          id: 'block-child',
          parent: { type: 'block', id: 'block-group' },
          content: { type: 'meta', key: 'note', text: 'child' },
          attributes: [{ id: 'attr-child', key: 'tone', translatable: false, text: 'calm' }],
        },
      ],
    },
    attributes: [],
  },
]

const makeTranslations = (): Translations => ({
  ru: {
    'post:post-1:name': 'Пост',
    'attribute:attr-i18n:text': 'Надпись',
    'attribute:attr-entity:text': 'Атрибут поста',
    'block:block-text:text': 'Привет',
  },
})

describe('blocks JSON serialization of attributes', () => {
  it('round-trips attributes, including translatable values and nested groups', () => {
    const serialized = serializeBlocks(makeBlocks(), makeTranslations(), DEFAULT_LOCALE)

    expect(serialized[0].attributes).toEqual([
      { key: 'style', text: 'wide' },
      { key: 'label', translatable: true, translations: { en: 'Label', ru: 'Надпись' } },
    ])
    const group = serialized[1]
    if (group.type !== 'group') throw new Error('unreachable')
    expect(group.blocks[0].attributes).toEqual([{ key: 'tone', text: 'calm' }])

    const result = deserializeData(
      JSON.parse(JSON.stringify(serialized)),
      makeTranslations(),
      DEFAULT_LOCALE,
      makeBlocks(),
    )

    const [text, groupBlock] = result.blocks
    expect(
      text.attributes.map(({ key, translatable, text }) => ({ key, translatable, text })),
    ).toEqual([
      { key: 'style', translatable: false, text: 'wide' },
      { key: 'label', translatable: true, text: 'Label' },
    ])
    if (groupBlock.content.type !== 'group') throw new Error('unreachable')
    expect(groupBlock.content.blocks[0].attributes).toMatchObject([
      { key: 'tone', translatable: false, text: 'calm' },
    ])

    // Attribute ids are regenerated; the translatable value follows the new id.
    const newAttrId = text.attributes[1].id
    expect(newAttrId).not.toBe('attr-i18n')
    expect(result.translations.ru['attribute:' + newAttrId + ':text']).toBe('Надпись')
  })

  it('strips stale block-attribute translations but keeps entity-level ones', () => {
    const serialized = serializeBlocks(makeBlocks(), makeTranslations(), DEFAULT_LOCALE)
    const result = deserializeData(serialized, makeTranslations(), DEFAULT_LOCALE, makeBlocks())

    expect(result.translations.ru['attribute:attr-i18n:text']).toBeUndefined()
    expect(result.translations.ru['block:block-text:text']).toBeUndefined()
    expect(result.translations.ru['attribute:attr-entity:text']).toBe('Атрибут поста')
    expect(result.translations.ru['post:post-1:name']).toBe('Пост')
  })

  it('accepts JSON without attributes fields (older snippets)', () => {
    const result = deserializeData(
      [{ type: 'text', key: 'intro', translations: { en: 'Hi' } }],
      {},
      DEFAULT_LOCALE,
      [],
    )
    expect(result.blocks[0].attributes).toEqual([])
  })
})
