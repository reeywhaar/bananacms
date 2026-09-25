import { getUrl, type Context, type Metadata, type SegmentProps } from '@reeywhaar/bananacms'
import { Link } from '@reeywhaar/bananacms/client'
import { t } from '@app/lib/i18n.ts'
import { localeOfPath } from '@app/lib/locale.ts'

export const generateMetadata = (props: SegmentProps): Metadata => ({
  title: t(localeOfPath(getUrl(props.ctx).pathname)).notFound,
})

// for pages that call notFound(), in the language the URL starts with
export default function NotFound(props: { ctx: Context }) {
  const locale = localeOfPath(getUrl(props.ctx).pathname)
  const strings = t(locale)
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-6 shadow-sm">
      <h1 className="text-3xl font-bold">{strings.notFound}</h1>
      <p className="mt-3 text-stone-600">
        {strings.notFoundText}{' '}
        <Link href={`/${locale}`} className="text-amber-700 underline">
          {strings.home}
        </Link>
      </p>
    </section>
  )
}
