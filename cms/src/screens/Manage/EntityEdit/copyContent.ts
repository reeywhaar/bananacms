import { v7 } from 'uuid'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import type { AttributeData } from '#cms/services/AttributeStore.ts'
import type { Translations } from '#cms/services/LocalizationStore.ts'
import { deserializeData, serializeBlocks } from './BlockEditor/serialize.ts'

type Content = {
  blocks: BlockData[]
  attributes: AttributeData[]
  translations: Translations
}

// A post's or a page's blocks, attributes and translations for a new one, `id`:
// each block and attribute under an id of its own, and the translations keyed by
// those, so saving the copy leaves the one it came from as it is. The blocks go through their JSON
// form, as the blocks' own copy and paste does, which gives them new ids; their
// images and files are the same assets. Translations of nothing the copy has, like
// a removed block's, are left behind.
export function copyContent(
  source: Content & { table: 'post' | 'page'; id: string },
  id: string,
  defaultLocale: string,
): Content {
  const { blocks, translations } = deserializeData(
    serializeBlocks(source.blocks, source.translations, defaultLocale),
    {},
    defaultLocale,
    [],
  )

  // its own keys, like a post's name's, and its attributes', from theirs to the copy's
  const renamed = new Map<string, string>()
  const attributes = source.attributes.map((attr) => {
    const copy = { ...attr, id: v7() }
    renamed.set('attribute:' + attr.id + ':', 'attribute:' + copy.id + ':')
    return copy
  })
  renamed.set(source.table + ':' + source.id + ':', source.table + ':' + id + ':')

  for (const [locale, entries] of Object.entries(source.translations)) {
    for (const [key, text] of Object.entries(entries)) {
      for (const [from, to] of renamed) {
        if (!key.startsWith(from)) continue
        translations[locale] = { ...translations[locale], [to + key.slice(from.length)]: text }
      }
    }
  }

  return { blocks, attributes, translations }
}
