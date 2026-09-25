import type { BlockData } from '@reeywhaar/bananacms'
import { attributeOf, byKey, childrenOf, textOf } from '@app/lib/content.ts'
import { BlockFrame } from './BlockFrame.tsx'
import { RipenessSlider, type RipenessStage } from './RipenessSlider.tsx'

// The Main page's ripeness group: a title, an intro, and a group of stages, each
// a group with a name and a description, and its colour as an attribute
export function RipenessBlock(props: { ripeness: BlockData | undefined; label: string }) {
  const blocks = childrenOf(props.ripeness)
  const stages = childrenOf(byKey(blocks, 'stages')).map((stage): RipenessStage => ({
    name: textOf(childrenOf(stage), 'name') ?? '',
    description: textOf(childrenOf(stage), 'description') ?? '',
    color: attributeOf(stage, 'color') ?? '#fdd835',
  }))
  if (stages.length === 0) return null
  return (
    <BlockFrame source="CMS: page “Main page”, group ripeness">
      <h2 className="text-xl font-semibold">{textOf(blocks, 'title')}</h2>
      <p className="mt-1 text-sm text-stone-600">{textOf(blocks, 'intro')}</p>
      {/* client component: the server loads the stages, the browser handles the slider */}
      <RipenessSlider stages={stages} label={props.label} />
    </BlockFrame>
  )
}
