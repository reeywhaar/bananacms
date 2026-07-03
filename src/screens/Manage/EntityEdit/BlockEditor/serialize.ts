import { Translations } from '@cms/services/LocalizationStore'
import { AttributeData } from '@cms/services/AttributeStore'
import { valita } from '@cms/utils/valita'
import {
  BlockData,
  BlockType,
  SerializedAttribute,
  SerializedBlock,
  SerializedTextBlock,
  SerializedGroupBlock,
  SerializedImageBlock,
  SerializedAssetBlock,
  matchers,
  serializedBlockSchema,
} from '@cms/lib/blocks/declarations'
import { v7 } from 'uuid'

// ─── Public API ──────────────────────────────────────────────────────────────

export type {
  SerializedTextBlock,
  SerializedGroupBlock,
  SerializedImageBlock,
  SerializedAssetBlock,
  SerializedBlock,
}

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
  previousBlocks: BlockData[],
): { blocks: BlockData[]; translations: Translations } {
  const serialized = valita.array(serializedBlockSchema).parse(data)
  // Deserialized blocks (and their attributes) get fresh ids, so translations
  // keyed by the replaced blocks' ids would otherwise linger as dead entries.
  const newTranslations = stripBlockTranslations(
    existingTranslations,
    collectAttributeIds(previousBlocks),
  )
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

function stripBlockTranslations(
  translations: Translations,
  blockAttributeIds: Set<string>,
): Translations {
  // Attribute keys are shared with entity-level attributes, so only the ids
  // belonging to the replaced blocks may be stripped.
  const isBlockAttributeKey = (key: string) => {
    const match = /^attribute:(.+):text$/.exec(key)
    return match !== null && blockAttributeIds.has(match[1])
  }
  const result: Translations = {}
  for (const [locale, entries] of Object.entries(translations)) {
    const filtered: Record<string, string> = {}
    for (const [key, text] of Object.entries(entries)) {
      if (!key.startsWith('block:') && !isBlockAttributeKey(key)) filtered[key] = text
    }
    result[locale] = filtered
  }
  return result
}

function collectAttributeIds(blocks: BlockData[], into = new Set<string>()): Set<string> {
  for (const block of blocks) {
    for (const attr of block.attributes) into.add(attr.id)
    if (block.content.type === 'group') collectAttributeIds(block.content.blocks, into)
  }
  return into
}

function deserializeAttributes(
  serialized: SerializedAttribute[] | undefined,
  translations: Translations,
  defaultLocale: string,
): AttributeData[] {
  if (!serialized) return []
  return serialized.map((attr) => {
    const id = v7()
    if (!attr.translatable) {
      return { id, key: attr.key, translatable: false, text: attr.text ?? '' }
    }
    const values = attr.translations ?? {}
    for (const [locale, value] of Object.entries(values)) {
      if (locale === defaultLocale) continue
      if (!translations[locale]) translations[locale] = {}
      translations[locale]['attribute:' + id + ':text'] = value
    }
    return { id, key: attr.key, translatable: true, text: values[defaultLocale] ?? attr.text ?? '' }
  })
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
  const attributes = deserializeAttributes(serialized.attributes, translations, defaultLocale)

  if (serialized.type === 'text') {
    const text = serialized.translations[defaultLocale] ?? ''

    for (const [locale, value] of Object.entries(serialized.translations)) {
      if (locale === defaultLocale) continue
      if (!translations[locale]) translations[locale] = {}
      translations[locale]['block:' + id + ':text'] = value
    }

    const content: BlockType = {
      type: 'text',
      key: serialized.key,
      contentType: serialized.contentType ?? 'plain',
      text,
    }
    return { id, parent: { type: 'post', id: '' }, content, attributes }
  }

  if (serialized.type === 'image') {
    return deserializeImageBlock(id, serialized, translations, defaultLocale, attributes)
  }

  if (serialized.type === 'meta') {
    const content: BlockType = {
      type: 'meta',
      key: serialized.key,
      text: serialized.text,
    }
    return { id, parent: { type: 'post', id: '' }, content, attributes }
  }

  if (serialized.type === 'asset') {
    const content: BlockType = {
      type: 'asset',
      key: serialized.key,
      name: serialized.name,
      assetId: serialized.assetId,
    }
    return { id, parent: { type: 'post', id: '' }, content, attributes }
  }

  const children = deserializeBlockList(serialized.blocks, translations, defaultLocale)
  const content: BlockType = { type: 'group', key: serialized.key, blocks: children }
  return { id, parent: { type: 'post', id: '' }, content, attributes }
}

function deserializeImageBlock(
  id: string,
  serialized: SerializedImageBlock,
  translations: Translations,
  defaultLocale: string,
  attributes: AttributeData[],
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
  return { id, parent: { type: 'post', id: '' }, content, attributes }
}
