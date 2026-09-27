import type { FC } from 'react'
import type { AttributeData } from '#cms/services/AttributeStore.ts'

type MetaViewProps = {
  // a block's key; an entity has none
  keyName?: string
  attributes: AttributeData[]
}

// A block's key and attributes, or an entity's attributes, to read: the texts
// are in the default language.
export const MetaView: FC<MetaViewProps> = ({ keyName, attributes }) => {
  if (!keyName && attributes.length === 0) {
    return <span className="text-sm italic text-gray-400">No attributes</span>
  }
  return (
    <div className="flex flex-col gap-1 text-sm">
      {keyName && (
        <span className="self-start rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-600">
          {keyName}
        </span>
      )}
      {attributes.length > 0 && (
        <dl className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] gap-x-4 gap-y-1">
          {attributes.map((attr) => (
            <div key={attr.id} className="contents">
              <dt className="truncate text-gray-500">{attr.key || '—'}</dt>
              <dd className="truncate text-gray-800">{attr.text}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}
