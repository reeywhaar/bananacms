// a file's size to read: 1.25 MB, or 312.4 KB under a megabyte
export const formatSize = (bytes: number): string => {
  const mb = bytes / (1024 * 1024)
  if (mb >= 1) return `${mb.toFixed(2)} MB`
  return `${(bytes / 1024).toFixed(1)} KB`
}
