import { openAsBlob } from 'node:fs'

/**
 * Enough of a rejection to carry a sentence from the other end, and not enough
 * for a server answering with a page of HTML to put a page of HTML in the log.
 */
const MAX_REPLY = 2048

/**
 * Posts one archive to a backup agent.
 *
 * Multipart, with the file under `backup` and the name beside it. A POST rather
 * than a PUT because the agent keeps a series: each one is a new archive rather
 * than a replacement for the last.
 *
 * The body is streamed from disk — `openAsBlob` hands fetch a Blob backed by
 * the file rather than its contents, so an archive the size of the site's media
 * never lands in memory.
 */
export async function pushArchive(
  url: string,
  name: string,
  archivePath: string,
  signal?: AbortSignal,
): Promise<void> {
  const form = new FormData()
  form.append('backup', await openAsBlob(archivePath), name)
  form.append('name', name)

  const response = await fetch(url, { method: 'POST', body: form, signal })
  if (response.ok) return

  // What it said, not just that it said no. "The agent answered 500" is a fact
  // nobody can act on; the body underneath is where the rejected token and the
  // unreachable remote live.
  const said = (await response.text().catch(() => '')).slice(0, MAX_REPLY).trim()
  throw new Error(`the backup agent answered ${response.status} ${response.statusText}: ${said}`)
}
