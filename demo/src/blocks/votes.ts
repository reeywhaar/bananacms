// The poll's counts are JSON in its `votes` meta block, { option key: count }
export const parseVotes = (text: string): Record<string, number> => {
  try {
    const votes: unknown = JSON.parse(text)
    return votes && typeof votes === 'object' ? (votes as Record<string, number>) : {}
  } catch {
    return {}
  }
}
