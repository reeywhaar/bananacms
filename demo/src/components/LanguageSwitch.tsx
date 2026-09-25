'use client'

import { usePathname, useSearchParams } from '@reeywhaar/bananacms/client'

// Links to this page in the site's other languages: the same path, after another
// language. They load as documents, as each language's pages have their own
// <html lang>.
export function LanguageSwitch(props: { locale: string; languages: [string, string][] }) {
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const rest = pathname.split('/').slice(2).join('/')
  return (
    <div className="flex gap-1 text-sm">
      {props.languages.map(([code, name]) => (
        <a
          key={code}
          href={`/${code}${rest ? `/${rest}` : ''}${search ? `?${search}` : ''}`}
          hrefLang={code}
          lang={code}
          title={name}
          aria-current={code === props.locale ? 'true' : undefined}
          className="rounded px-1.5 py-0.5 text-stone-500 uppercase hover:text-stone-900 aria-[current=true]:bg-amber-200 aria-[current=true]:text-stone-900"
        >
          {code}
        </a>
      ))}
    </div>
  )
}
