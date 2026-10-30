// What's wrong with `name` as an asset's filename, which a download is saved as,
// or null when nothing is: it has to say something, and a slash would read as a
// folder to whoever saves the file.
export function filenameError(name: string): string | null {
  if (!name.trim()) return 'A file needs a name'
  if (/[/\\]/.test(name)) return "A name can't have / or \\ in it"
  return null
}
