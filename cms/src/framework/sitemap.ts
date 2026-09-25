// What a sitemap.ts returns, like Next's MetadataRoute.Sitemap: the URLs for
// search engines, which the CMS serves as sitemap.xml in the file's folder
// (sitemaps.org).
export type Sitemap = {
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number
  // the page in other languages, by language code
  alternates?: { languages?: Record<string, string> }
  images?: string[]
}[]

// The sitemap's XML, laid out as Next lays it out
export function sitemapXml(sitemap: Sitemap): string {
  const hasAlternates = sitemap.some(
    (entry) => Object.keys(entry.alternates?.languages ?? {}).length > 0,
  )
  const hasImages = sitemap.some((entry) => Boolean(entry.images?.length))

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'
  if (hasImages) xml += ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
  if (hasAlternates) xml += ' xmlns:xhtml="http://www.w3.org/1999/xhtml"'
  xml += '>\n'
  for (const entry of sitemap) {
    xml += '<url>\n'
    xml += `<loc>${escapeXml(entry.url)}</loc>\n`
    for (const [language, url] of Object.entries(entry.alternates?.languages ?? {})) {
      xml += `<xhtml:link rel="alternate" hreflang="${escapeXml(language)}" href="${escapeXml(url)}" />\n`
    }
    for (const image of entry.images ?? []) {
      xml += `<image:image>\n<image:loc>${escapeXml(image)}</image:loc>\n</image:image>\n`
    }
    if (entry.lastModified) {
      const lastModified =
        entry.lastModified instanceof Date ? entry.lastModified.toISOString() : entry.lastModified
      xml += `<lastmod>${escapeXml(lastModified)}</lastmod>\n`
    }
    if (entry.changeFrequency) xml += `<changefreq>${entry.changeFrequency}</changefreq>\n`
    if (typeof entry.priority === 'number') xml += `<priority>${entry.priority}</priority>\n`
    xml += '</url>\n'
  }
  xml += '</urlset>\n'
  return xml
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}
