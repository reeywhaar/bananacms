import { Translations } from '@cms/services/LocalizationStore'
import { valita } from '@cms/utils/valita'
import {
  BlockData,
  BlockType,
  SerializedBlock,
  SerializedTextBlock,
  SerializedGroupBlock,
  SerializedImageBlock,
  matchers,
  serializedBlockSchema,
} from '@cms/lib/blocks/declarations'
import { v7 } from 'uuid'

// ─── Public API ──────────────────────────────────────────────────────────────

export type { SerializedTextBlock, SerializedGroupBlock, SerializedImageBlock, SerializedBlock }

export function serializeBlocks(
  blocks: BlockData[],
  translations: Translations,
  defaultLocale: string,
): SerializedBlock[] {
  return blocks.map((block) => serializeBlock(block, translations, defaultLocale))
}

export function deserializeData(
  data: unknown,
  existingTranslations: Translations,
  defaultLocale: string,
): { blocks: BlockData[]; translations: Translations } {
  const serialized = valita.array(serializedBlockSchema).parse(data)
  const newTranslations = stripBlockTranslations(existingTranslations)
  const blocks = deserializeBlockList(serialized, newTranslations, defaultLocale)
  return { blocks, translations: newTranslations }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function serializeBlock(
  block: BlockData,
  translations: Translations,
  defaultLocale: string,
): SerializedBlock {
  for (const matcher of matchers) {
    const result = matcher.serialize(block, translations, defaultLocale, serializeBlock)
    if (result !== null) return result
  }
  throw new Error(`No matcher found for block type: ${block.content.type}`)
}

function stripBlockTranslations(translations: Translations): Translations {
  const result: Translations = {}
  for (const [locale, entries] of Object.entries(translations)) {
    const filtered: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries)) {
      if (!key.startsWith('block:')) filtered[key] = text
    }
    result[locale] = filtered
  }
  return result
}

function deserializeBlockList(
  serialized: SerializedBlock[],
  translations: Translations,
  defaultLocale: string,
): BlockData[] {
  return serialized.map((s) => deserializeBlock(s, translations, defaultLocale))
}

function deserializeBlock(
  serialized: SerializedBlock,
  translations: Translations,
  defaultLocale: string,
): BlockData {
  const id = v7()

  if (serialized.type === 'text') {
    const text = serialized.translations[defaultLocale] ?? ''

    for (const [locale, value] of Object.entries(serialized.translations)) {
      if (locale === defaultLocale) continue
      if (!translations[locale]) translations[locale] = {}
      translations[locale]['block:' + id + ':text'] = value
    }

    const content: BlockType = { type: 'text', key: serialized.key, text }
    return { id, parent: { type: 'post', id: '' }, type: 'text', content }
  }

  if (serialized.type === 'image') {
    return deserializeImageBlock(id, serialized, translations, defaultLocale)
  }

  if (serialized.type === 'meta') {
    const content: BlockType = {
      type: 'meta',
      key: serialized.key,
      text: serialized.text,
    }
    return { id, parent: { type: 'post', id: '' }, type: 'meta', content }
  }

  const children = deserializeBlockList(serialized.blocks, translations, defaultLocale)
  const content: BlockType = { type: 'group', key: serialized.key, blocks: children }
  return { id, parent: { type: 'post', id: '' }, type: 'group', content }
}

function deserializeImageBlock(
  id: string,
  serialized: SerializedImageBlock,
  translations: Translations,
  defaultLocale: string,
): BlockData {
  const alt = serialized.alt[defaultLocale] ?? ''

  for (const [locale, value] of Object.entries(serialized.alt)) {
    if (locale === defaultLocale) continue
    if (!translations[locale]) translations[locale] = {}
    translations[locale]['block:' + id + ':alt'] = value
  }

  const content: BlockType = {
    type: 'image',
    key: serialized.key,
    name: serialized.name,
    alt,
    assetId: serialized.assetId,
  }
  return { id, parent: { type: 'post', id: '' }, type: 'image', content }
}
