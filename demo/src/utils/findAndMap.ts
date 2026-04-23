export const findAndMap = <T, R>(
  items: T[],
  predicate: (item: T) => { data: R } | null,
): R | null => {
  for (const item of items) {
    const res = predicate(item)
    if (res) return res.data
  }
  return null
}
