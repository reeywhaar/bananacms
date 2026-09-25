import type { AttributeData } from '@reeywhaar/bananacms/stores'
import { t } from '@app/lib/i18n.ts'

// A post's attributes, like a recipe's time and servings or a film's year, under
// their labels, in the order the labels come in (i18n.ts)
export function Attributes(props: { attributes: AttributeData[]; locale: string }) {
  const { labels } = t(props.locale)
  if (props.attributes.length === 0) return null
  const order = Object.keys(labels)
  const rank = (attribute: AttributeData) => {
    const index = order.indexOf(attribute.key)
    return index === -1 ? order.length : index
  }
  return (
    <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
      {props.attributes
        .toSorted((a, b) => rank(a) - rank(b))
        .map((attribute) => (
          <div key={attribute.id}>
            <dt className="text-xs tracking-wide text-stone-500 uppercase">
              {labels[attribute.key as keyof typeof labels] ?? attribute.key}
            </dt>
            <dd className="font-medium">{attribute.text}</dd>
          </div>
        ))}
    </dl>
  )
}
