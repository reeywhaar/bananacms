'use client'

import type { DragEvent } from 'react'
import type { BlockData } from '#cms/lib/blocks/declarations.ts'
import { renameAsset, uploadAsset } from './actions.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'

export const resolveBlocks = async (blocks: BlockData[]): Promise<BlockData[]> => {
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
        if (block.content.pendingMaxSize) {
          formData.append('maxSize', JSON.stringify(block.content.pendingMaxSize))
        }
        if (block.content.pendingFilename !== undefined) {
          formData.append('filename', block.content.pendingFilename)
        }
        const { id } = handleServerResult(await uploadAsset(formData))
        const {
          pendingFile: _pf,
          pendingResolution: _pr,
          pendingOutputAs: _po,
          pendingMaxSize: _pm,
          pendingFilename: _pn,
          ...rest
        } = block.content
        return { ...block, content: { ...rest, assetId: id } }
      }
      if (block.content.type === 'asset' && block.content.pendingFile) {
        const formData = new FormData()
        formData.append('file', block.content.pendingFile)
        if (block.content.pendingFilename !== undefined) {
          formData.append('filename', block.content.pendingFilename)
        }
        const { id } = handleServerResult(await uploadAsset(formData))
        const { pendingFile: _pf, pendingFilename: _pn, ...rest } = block.content
        return { ...block, content: { ...rest, assetId: id } }
      }
      // a saved file given another name: its asset is renamed
      if (block.content.type === 'image' && block.content.pendingFilename !== undefined) {
        handleServerResult(await renameAsset(block.content.assetId, block.content.pendingFilename))
        const { pendingFilename: _pn, ...rest } = block.content
        return { ...block, content: rest }
      }
      if (block.content.type === 'asset' && block.content.pendingFilename !== undefined) {
        handleServerResult(await renameAsset(block.content.assetId, block.content.pendingFilename))
        const { pendingFilename: _pn, ...rest } = block.content
        return { ...block, content: rest }
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
