import { DragEvent } from 'react'
import { BlockData } from '@cms/lib/blocks/declarations'
import { uploadAsset } from './actions'

export async function resolveBlocks(blocks: BlockData[]): Promise<BlockData[]> {
  return Promise.all(
    blocks.map(async (block) => {
      if (block.content.type === 'image' && block.content.pendingFile) {
        const formData = new FormData()
        formData.append('file', block.content.pendingFile)
        if (block.content.pendingResolution) {
          formData.append('resolution', block.content.pendingResolution)
        }
        if (block.content.pendingOutputAs) {
          formData.append('output_as', JSON.stringify(block.content.pendingOutputAs))
        }
        const { id } = await uploadAsset(formData)
        const {
          pendingFile: _pf,
          pendingResolution: _pr,
          pendingOutputAs: _po,
          ...rest
        } = block.content
        return { ...block, content: { ...rest, assetId: id } }
      }
      if (block.content.type === 'asset' && block.content.pendingFile) {
        const formData = new FormData()
        formData.append('file', block.content.pendingFile)
        const { id } = await uploadAsset(formData)
        const { pendingFile: _pf, ...rest } = block.content
        return { ...block, content: { ...rest, assetId: id } }
      }
      if (block.content.type === 'group') {
        const resolvedChildren = await resolveBlocks(block.content.blocks)
        return { ...block, content: { ...block.content, blocks: resolvedChildren } }
      }
      return block
    }),
  )
}

export const preventFileNavigation = (e: DragEvent<HTMLElement>) => {
  if (e.defaultPrevented) return
  if (!Array.from(e.dataTransfer.types).includes('Files')) return
  e.preventDefault()
}
