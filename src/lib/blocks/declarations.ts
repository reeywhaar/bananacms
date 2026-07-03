import type { Translations } from '@cms/services/LocalizationStore'
import type { AttributeData } from '@cms/services/AttributeStore'
import { valita } from '@cms/utils/valita'
import type { AssetOutputFormat, AssetResolution } from '@cms/services/AssetStore'

// ─── Block types ─────────────────────────────────────────────────────────────

export type TextBlockContentType = 'plain' | 'markdown' | 'html'

export type BlockTypeText = {
  type: 'text'
  key: string
  contentType: TextBlockContentType
  text: string
}

export type BlockTypeGroup = {
  type: 'group'
  key: string
  blocks: BlockData[]
}

export type BlockTypeImage = {
  type: 'image'
  key: string
  name: string
  alt: string
  assetId: string
  pendingFile?: File
  pendingResolution?: AssetResolution
  pendingOutputAs?: AssetOutputFormat
  pendingMaxSize?: { width: number; height: number }
}

export type BlockTypeMeta = {
  type: 'meta'
  key: string
  text: string
}

export type BlockTypeAsset = {
  type: 'asset'
  key: string
  name: string
  assetId: string
  pendingFile?: File
}

export type BlockType =
  | BlockTypeText
  | BlockTypeGroup
  | BlockTypeImage
  | BlockTypeMeta
  | BlockTypeAsset

export const blockParentSchema = valita.object({
  type: valita.union(
    valita.literal('block'),
    valita.literal('post'),
    valita.literal('page'),
    valita.literal('category'),
    valita.literal('tag'),
  ),
  id: valita.string(),
})
export type BlockParent = valita.Infer<typeof blockParentSchema>

export type BlockData = {
  id: string
  parent: BlockParent
  content: BlockType
  attributes: AttributeData[]
}

// ─── Serialized types ────────────────────────────────────────────────────────

/**
 * Attribute in blocks-JSON form. Ids are not serialized (they are regenerated
 * on deserialize); translatable attributes carry per-locale values like text
 * blocks do, plain ones carry `text`.
 */
export type SerializedAttribute = {
  key: string
  translatable?: boolean
  text?: string
  translations?: Record<string, string>
}

export type SerializedTextBlock = {
  type: 'text'
  key: string
  contentType?: TextBlockContentType
  translations: Record<string, string>
  attributes?: SerializedAttribute[]
}

export type SerializedGroupBlock = {
  type: 'group'
  key: string
  blocks: SerializedBlock[]
  attributes?: SerializedAttribute[]
}

export type SerializedImageBlock = {
  type: 'image'
  key: string
  name: string
  alt: Record<string, string>
  assetId: string
  attributes?: SerializedAttribute[]
}

export type SerializedMetaBlock = {
  type: 'meta'
  key: string
  text: string
  attributes?: SerializedAttribute[]
}

export type SerializedAssetBlock = {
  type: 'asset'
  key: string
  name: string
  assetId: string
  attributes?: SerializedAttribute[]
}

export type SerializedBlock =
  | SerializedTextBlock
  | SerializedGroupBlock
  | SerializedImageBlock
  | SerializedMetaBlock
  | SerializedAssetBlock

// ─── Matcher ─────────────────────────────────────────────────────────────────

/**
 * Undefined (rather than []) when a block has no attributes so JSON.stringify
 * omits the field and hand-written snippets stay valid without it.
 */
export function serializeAttributes(
  block: BlockData,
  translations: Translations,
  defaultLocale: string,
): SerializedAttribute[] | undefined {
  if (block.attributes.length === 0) return undefined
  return block.attributes.map((attr) => {
    if (!attr.translatable) return { key: attr.key, text: attr.text }

    const attrTranslations: Record<string, string> = {}
    if (attr.text) attrTranslations[defaultLocale] = attr.text
    for (const [locale, entries] of Object.entries(translations)) {
      if (locale === defaultLocale) continue
      const text = entries['attribute:' + attr.id + ':text']
      if (text) attrTranslations[locale] = text
    }
    return { key: attr.key, translatable: true, translations: attrTranslations }
  })
}

export interface Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
    serialize: (
      block: BlockData,
      translations: Translations,
      defaultLocale: string,
    ) => SerializedBlock,
  ): SerializedBlock | null
}

class TextBlockMatcher implements Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
  ): SerializedBlock | null {
    if (block.content.type !== 'text') return null

    const blockTranslations: Record<string, string> = {}

    if (block.content.text) {
      blockTranslations[defaultLocale] = block.content.text
    }

    for (const [locale, entries] of Object.entries(translations)) {
      if (locale === defaultLocale) continue
      const text = entries['block:' + block.id + ':text']
      if (text) blockTranslations[locale] = text
    }

    return {
      type: 'text',
      key: block.content.key,
      contentType: block.content.contentType,
      translations: blockTranslations,
      attributes: serializeAttributes(block, translations, defaultLocale),
    }
  }
}

class GroupBlockMatcher implements Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
    serialize: (
      block: BlockData,
      translations: Translations,
      defaultLocale: string,
    ) => SerializedBlock,
  ): SerializedBlock | null {
    if (block.content.type !== 'group') return null

    return {
      type: 'group',
      key: block.content.key,
      blocks: block.content.blocks.map((b) => serialize(b, translations, defaultLocale)),
      attributes: serializeAttributes(block, translations, defaultLocale),
    }
  }
}

class ImageBlockMatcher implements Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
  ): SerializedBlock | null {
    if (block.content.type !== 'image') return null

    const altTranslations: Record<string, string> = {}

    if (block.content.alt) {
      altTranslations[defaultLocale] = block.content.alt
    }

    for (const [locale, entries] of Object.entries(translations)) {
      if (locale === defaultLocale) continue
      const alt = entries['block:' + block.id + ':alt']
      if (alt) altTranslations[locale] = alt
    }

    return {
      type: 'image',
      key: block.content.key,
      name: block.content.name,
      alt: altTranslations,
      assetId: block.content.assetId,
      attributes: serializeAttributes(block, translations, defaultLocale),
    }
  }
}

class MetaBlockMatcher implements Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
  ): SerializedBlock | null {
    if (block.content.type !== 'meta') return null
    return {
      type: 'meta',
      key: block.content.key,
      text: block.content.text,
      attributes: serializeAttributes(block, translations, defaultLocale),
    }
  }
}

class AssetBlockMatcher implements Matcher {
  serialize(
    block: BlockData,
    translations: Translations,
    defaultLocale: string,
  ): SerializedBlock | null {
    if (block.content.type !== 'asset') return null
    return {
      type: 'asset',
      key: block.content.key,
      name: block.content.name,
      assetId: block.content.assetId,
      attributes: serializeAttributes(block, translations, defaultLocale),
    }
  }
}

export const matchers: Matcher[] = [
  new TextBlockMatcher(),
  new GroupBlockMatcher(),
  new ImageBlockMatcher(),
  new MetaBlockMatcher(),
  new AssetBlockMatcher(),
]

// ─── Serialization schema ─────────────────────────────────────────────────────

const serializedAttributeSchema: valita.Type<SerializedAttribute> = valita.object({
  key: valita.string(),
  translatable: valita.boolean().optional(),
  text: valita.string().optional(),
  translations: valita.record(valita.string()).optional(),
})

const serializedAttributesField = valita.array(serializedAttributeSchema).optional()

export const serializedBlockSchema: valita.Type<SerializedBlock> = valita.union(
  valita.object({
    type: valita.literal('text'),
    key: valita.string(),
    contentType: valita
      .union(valita.literal('plain'), valita.literal('markdown'), valita.literal('html'))
      .optional(),
    translations: valita.record(valita.string()),
    attributes: serializedAttributesField,
  }),
  valita.object({
    type: valita.literal('group'),
    key: valita.string(),
    blocks: valita.array(valita.lazy(() => serializedBlockSchema)),
    attributes: serializedAttributesField,
  }),
  valita.object({
    type: valita.literal('image'),
    key: valita.string(),
    name: valita.string(),
    alt: valita.record(valita.string()),
    assetId: valita.string(),
    attributes: serializedAttributesField,
  }),
  valita.object({
    type: valita.literal('meta'),
    key: valita.string(),
    text: valita.string(),
    attributes: serializedAttributesField,
  }),
  valita.object({
    type: valita.literal('asset'),
    key: valita.string(),
    name: valita.string(),
    assetId: valita.string(),
    attributes: serializedAttributesField,
  }),
)
