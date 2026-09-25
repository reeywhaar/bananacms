import { describe, expect, it } from 'vitest'
import { sitemapXml } from './sitemap.ts'

describe('sitemapXml', () => {
  it('lays a sitemap out as Next does', () => {
    // the start of vyrtsev.com's sitemap.xml, as Next serves it
    expect(
      sitemapXml([
        { url: 'https://vyrtsev.com/' },
        {
          url: 'https://vyrtsev.com/p/81de8591/bravo',
          lastModified: new Date('2026-06-06T01:38:36.000Z'),
        },
      ]),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        '<url>',
        '<loc>https://vyrtsev.com/</loc>',
        '</url>',
        '<url>',
        '<loc>https://vyrtsev.com/p/81de8591/bravo</loc>',
        '<lastmod>2026-06-06T01:38:36.000Z</lastmod>',
        '</url>',
        '</urlset>',
        '',
      ].join('\n'),
    )
  })

  it('adds languages, images, change frequency and priority, with the namespaces they need', () => {
    expect(
      sitemapXml([
        {
          url: 'https://site.test/en',
          alternates: { languages: { ru: 'https://site.test/ru' } },
          images: ['https://site.test/a.png'],
          lastModified: '2026-01-02',
          changeFrequency: 'weekly',
          priority: 0.5,
        },
      ]),
    ).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
        '<url>',
        '<loc>https://site.test/en</loc>',
        '<xhtml:link rel="alternate" hreflang="ru" href="https://site.test/ru" />',
        '<image:image>',
        '<image:loc>https://site.test/a.png</image:loc>',
        '</image:image>',
        '<lastmod>2026-01-02</lastmod>',
        '<changefreq>weekly</changefreq>',
        '<priority>0.5</priority>',
        '</url>',
        '</urlset>',
        '',
      ].join('\n'),
    )
  })

  it('escapes URLs for XML', () => {
    expect(sitemapXml([{ url: 'https://site.test/?a=1&b=2' }])).toContain(
      '<loc>https://site.test/?a=1&amp;b=2</loc>',
    )
  })
})
