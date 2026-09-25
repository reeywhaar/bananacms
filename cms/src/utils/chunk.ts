/**
 * Split into slices of at most `size` items. Multi-row inserts bind several
 * parameters per row, so batches must stay well under SQLite's per-statement
 * parameter limit.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}
