import { getTranslations } from 'next-intl/server'
import { contacts } from '@app/lib/contacts'

export default async function Footer() {
  const t = await getTranslations('main')
  const year = new Date().getFullYear()

  return (
    <footer className="flex flex-col items-end gap-3 px-2 md:px-4 py-8 text-sm">
      <hr className="w-full border-t border-gray-200" />
      <span className="font-medium">{t('name')}</span>
      <nav className="flex flex-wrap justify-center gap-4">
        {contacts.map((c) => (
          <a
            key={c.id}
            href={c.link}
            target="_blank"
            rel="noopener noreferrer"
            className="interactive opacity-60 capitalize"
          >
            {c.name}
          </a>
        ))}
      </nav>
      <span className="opacity-40">
        {year} {t('name')}
      </span>
    </footer>
  )
}
