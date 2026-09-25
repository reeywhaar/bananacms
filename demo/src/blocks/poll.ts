'use server'

import { defineAction, getDb } from '@reeywhaar/bananacms'
import { BlockStore } from '@reeywhaar/bananacms/stores'
import { parseVotes } from './votes.ts'

// A vote for `option`: its count, in the votes block `blockId`, goes up by one.
// The page renders again with the new counts, in the same request.
export const vote = defineAction(async (ctx, blockId: string, option: string): Promise<void> => {
  const blocks = new BlockStore(getDb(ctx))
  const block = await blocks.query().byId(blockId).first()
  if (block?.content.type !== 'meta' || block.content.key !== 'votes') {
    throw new Error(`No poll's votes in block ${blockId}`)
  }
  const votes = parseVotes(block.content.text)
  votes[option] = (votes[option] ?? 0) + 1
  await blocks.updateContent(blockId, { ...block.content, text: JSON.stringify(votes) })
})
