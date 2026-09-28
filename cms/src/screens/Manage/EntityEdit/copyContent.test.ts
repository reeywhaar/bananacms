import { describe, expect, it } from 'vitest'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { copyContent } from './copyContent.ts'

const blocks: BlockData[] = [
  {
    id: 'block-text',
    parent: { type: 'post', id: 'post-1' },
    content: { type: 'text', key: 'intro', contentType: 'markdown', text: 'Hello' },
    attributes: [{ id: 'attr-block', key: 'label', translatable: true, text: 'Label' }],
  },
  {
    id: 'block-group',
    parent: { type: 'post', id: 'post-1' },
    content: {
      type: 'group',
      key: 'gallery',
      blocks: [
        {
          id: 'block-image',
          parent: { type: 'block', id: 'block-group' },
          content: {
            type: 'image',
            key: 'still',
            name: 'a.jpg',
            alt: 'A train',
            assetId: 'asset-1',
          },
          attributes: [],
        },
      ],
    },
    attributes: [],
  },
]

const attributes: AttributeData[] = [
  { id: 'attr-post', key: 'country', translatable: true, text: 'France' },
  { id: 'attr-plain', key: 'year', translatable: false, text: '1896' },
]

const translations: Translations = {
  fr: {
    'post:post-1:name': 'Le train',
    'attribute:attr-post:text': 'La France',
    'attribute:attr-block:text': 'Libellé',
    'block:block-text:text': 'Bonjour',
    'block:block-image:alt': 'Un train',
    'block:block-gone:text': 'from a removed block',
  },
}

const copy = () =>
  copyContent({ table: 'post', id: 'post-1', blocks, attributes, translations }, 'post-2', 'en')

const allIds = (list: BlockData[]): string[] =>
  list.flatMap((b) => [
    b.id,
    ...b.attributes.map((a) => a.id),
    ...(b.content.type === 'group' ? allIds(b.content.blocks) : []),
  ])

describe('copyContent', () => {
  it('copies the blocks and attributes, with ids of their own', () => {
    const result = copy()
    const [text, group] = result.blocks
    expect(text.content).toEqual(blocks[0].content)
    expect(group.content.type === 'group' && group.content.blocks[0].content).toEqual(
      blocks[1].content.type === 'group' && blocks[1].content.blocks[0].content,
    )
    expect(
      result.attributes.map(({ key, text, translatable }) => ({ key, text, translatable })),
    ).toEqual(attributes.map(({ key, text, translatable }) => ({ key, text, translatable })))

    const before = new Set([...allIds(blocks), ...attributes.map((a) => a.id)])
    for (const id of [...allIds(result.blocks), ...result.attributes.map((a) => a.id)]) {
      expect(before.has(id)).toBe(false)
    }
  })

  it('keys the translations by the copy’s ids, and leaves out stray ones', () => {
    const result = copy()
    const [text, group] = result.blocks
    const image = group.content.type === 'group' ? group.content.blocks[0] : undefined
    const postAttr = result.attributes.find((a) => a.key === 'country')!

    expect(result.translations.fr).toEqual({
      'post:post-2:name': 'Le train',
      ['attribute:' + postAttr.id + ':text']: 'La France',
      ['attribute:' + text.attributes[0].id + ':text']: 'Libellé',
      ['block:' + text.id + ':text']: 'Bonjour',
      ['block:' + image!.id + ':alt']: 'Un train',
    })
  })

  it('leaves the post it copies as it is', () => {
    const snapshot = JSON.stringify({ blocks, attributes, translations })
    copy()
    expect(JSON.stringify({ blocks, attributes, translations })).toBe(snapshot)
  })
})
