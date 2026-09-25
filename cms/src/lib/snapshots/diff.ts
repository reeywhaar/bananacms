import { applyPatch, createTwoFilesPatch } from 'diff'

/** Unified-diff patch that transforms `oldText` into `newText`. */
export const createDiff = (oldText: string, newText: string): string =>
  createTwoFilesPatch('a', 'b', oldText, newText)

/** Applies a patch produced by createDiff; null when it doesn't fit `baseText`. */
export const applyDiff = (baseText: string, patch: string): string | null => {
  const result = applyPatch(baseText, patch)
  return result === false ? null : result
}
