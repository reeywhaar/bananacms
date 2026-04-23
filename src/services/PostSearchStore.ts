import { and, eq, sql } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'
import { post, parentTag } from '@cms/lib/db/schema'
import { LocalizationStore } from './LocalizationStore'

export class PostSearchStore {
  constructor(private db: Db) {}

  async rebuildPostIndex(postId: string): Promise<void> {
    const postRow = await this.db
      .select({ name: post.name, slug: post.slug })
      .from(post)
      .where(eq(post.id, postId))
      .get()
    if (!postRow) return

    const translations = await new LocalizationStore(this.db).getByParentId('post', postId)

    // Base block texts (non-localized content from block JSON, recursive)
    const blockRows = await this.db.all<{ text: string | null; alt: string | null }>(sql`
      WITH RECURSIVE block_tree(id) AS (
        SELECT blockId FROM parent_block
         WHERE parentTable = 'post' AND parentId = ${postId}
        UNION ALL
        SELECT pb.blockId FROM parent_block pb
          INNER JOIN block_tree bt ON pb.parentTable = 'block' AND pb.parentId = bt.id
      )
      SELECT
        json_extract(b.content, '$.text') AS text,
        json_extract(b.content, '$.alt')  AS alt
      FROM block b
      WHERE b.id IN (SELECT id FROM block_tree)
        AND (
          json_extract(b.content, '$.text') IS NOT NULL OR
          json_extract(b.content, '$.alt')  IS NOT NULL
        )
    `)

    // Tag names + their localizations for tags attached to this post
    const tagRows = await this.db.all<{
      name: string
      locale: string | null
      translatedName: string | null
    }>(sql`
      SELECT t.name, l.locale, l.text AS translatedName
      FROM tag t
      JOIN parent_tag pt ON pt.tagId = t.id
      LEFT JOIN localizations l ON l.key = 'tag:' || t.id || ':name'
      WHERE pt.parentTable = 'post' AND pt.parentId = ${postId}
    `)

    // Base attribute texts (translations already covered by getByParentId above)
    const attrRows = await this.db.all<{ text: string | null }>(sql`
      SELECT a.text
      FROM attribute a
      JOIN parent_attribute pa ON pa.attributeId = a.id
      WHERE pa.parentTable = 'post' AND pa.parentId = ${postId}
        AND a.text IS NOT NULL AND a.text != ''
    `)

    // Build base tokens — included in every locale row as a fallback
    const baseTokens: string[] = [postRow.name, postRow.slug]
    for (const r of blockRows) {
      if (r.text) baseTokens.push(r.text)
      if (r.alt) baseTokens.push(r.alt)
    }
    const tagBaseNames = [...new Set(tagRows.map((r) => r.name))]
    baseTokens.push(...tagBaseNames)
    for (const r of attrRows) {
      if (r.text) baseTokens.push(r.text)
    }

    // Build per-locale map: each locale row includes base tokens + locale-specific text
    const localeMap = new Map<string, string[]>()

    for (const [locale, entries] of Object.entries(translations)) {
      if (!localeMap.has(locale)) localeMap.set(locale, [...baseTokens])
      localeMap.get(locale)!.push(...Object.values(entries).filter(Boolean))
    }

    for (const r of tagRows) {
      if (r.locale && r.translatedName) {
        if (!localeMap.has(r.locale)) localeMap.set(r.locale, [...baseTokens])
        localeMap.get(r.locale)!.push(r.translatedName)
      }
    }

    // Replace existing FTS rows for this post
    await this.db.run(sql`DELETE FROM post_fts WHERE postId = ${postId}`)

    // Base row (locale = '') — matched when no locale is specified
    const baseContent = baseTokens.filter(Boolean).join(' ')
    if (baseContent) {
      await this.db.run(
        sql`INSERT INTO post_fts(postId, locale, content) VALUES (${postId}, '', ${baseContent})`,
      )
    }

    // Per-locale rows
    for (const [locale, tokens] of localeMap) {
      const content = tokens.filter(Boolean).join(' ')
      if (content) {
        await this.db.run(
          sql`INSERT INTO post_fts(postId, locale, content) VALUES (${postId}, ${locale}, ${content})`,
        )
      }
    }
  }

  async deletePostIndex(postId: string): Promise<void> {
    await this.db.run(sql`DELETE FROM post_fts WHERE postId = ${postId}`)
  }

  async rebuildPostsWithTag(tagId: string): Promise<void> {
    const rows = await this.db
      .select({ postId: parentTag.parentId })
      .from(parentTag)
      .where(and(eq(parentTag.tagId, tagId), eq(parentTag.parentTable, 'post')))
    for (const { postId } of rows) {
      await this.rebuildPostIndex(postId)
    }
  }
}
