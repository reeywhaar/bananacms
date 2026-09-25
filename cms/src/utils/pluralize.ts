export type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>> & {
  other: string
}

export function pluralize(count: number, forms: PluralForms, locale?: string | string[]): string {
  const n = Math.abs(Math.floor(Number(count)) || 0)

  if (n === 0 && forms.zero !== undefined) {
    return forms.zero
  }

  const rule = new Intl.PluralRules(locale).select(n)

  if (rule !== 'other' && forms[rule] !== undefined) {
    return forms[rule]!
  }

  return forms.other
}
