import { getLocale } from 'next-intl/server'
import { langConfig } from '@app/lib/langconfig'

export const getLangContext = async () => {
  const locale = await getLocale()
  const langContext = langConfig
  return { ...langContext, currentLocale: locale }
}
