import { randomBytes } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { request as httpRequest, type IncomingMessage } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'

/**
 * Enough of a rejection to carry a sentence from the other end, and not enough
 * for a server answering with a page of HTML to put a page of HTML in the log.
 */
const MAX_REPLY = 2048

/**
 * How long the agent may go without a word. An agent with a remote store
 * answers once the archive is there, which for one the size of the site's media
 * can be minutes after it was sent. fetch gives up after five, and the agent
 * would then keep an archive this end had counted as failed, and been sent again.
 */
const ANSWER_TIMEOUT_MS = 30 * 60_000

/**
 * Posts one archive to a backup agent.
 *
 * Multipart, with the file under `backup` and the name beside it. A POST rather
 * than a PUT because the agent keeps a series: each one is a new archive rather
 * than a replacement for the last.
 *
 * The body is written out here, the archive streamed from disk between its
 * part's header and the name, with its length known up front. A FormData would
 * be simpler, but fetch reads a file in one into memory whole, even a Blob from
 * `openAsBlob`, and an archive is the size of the site's media.
 */
export async function pushArchive(
  url: string,
  name: string,
  archivePath: string,
  signal?: AbortSignal,
): Promise<void> {
  const boundary = `bananacms-${randomBytes(16).toString('hex')}`
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="backup"; filename="${name}"\r\n` +
      'Content-Type: application/octet-stream\r\n\r\n',
  )
  const tail = Buffer.from(
    `\r\n--${boundary}\r\n` +
      'Content-Disposition: form-data; name="name"\r\n\r\n' +
      `${name}\r\n--${boundary}--\r\n`,
  )
  const size = (await stat(archivePath)).size
  async function* parts() {
    yield head
    yield* createReadStream(archivePath)
    yield tail
  }

  const target = new URL(url)
  const request = target.protocol === 'https:' ? httpsRequest : httpRequest
  const response = await new Promise<IncomingMessage>((resolve, reject) => {
    const req = request(target, {
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': head.length + size + tail.length,
      },
      signal,
      timeout: ANSWER_TIMEOUT_MS,
    })
    req.on('response', resolve)
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy(
        new Error(`the backup agent hasn't answered in ${ANSWER_TIMEOUT_MS / 60_000} minutes`),
      )
    })
    // an agent that turns the archive away can answer before it has all of it,
    // and stop reading: its answer is the one that counts
    pipeline(Readable.from(parts()), req).catch(reject)
  })

  const said = await readSome(response)
  const status = response.statusCode ?? 0
  if (status >= 200 && status < 300) return

  // What it said, not just that it said no. "The agent answered 500" is a fact
  // nobody can act on; the body underneath is where the rejected token and the
  // unreachable remote live.
  throw new Error(`the backup agent answered ${status} ${response.statusMessage ?? ''}: ${said}`)
}

// the start of the answer's body, as text, and the rest of it read and dropped
async function readSome(response: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of response) {
    if (length >= MAX_REPLY) continue
    chunks.push(chunk as Buffer)
    length += (chunk as Buffer).length
  }
  return Buffer.concat(chunks).toString('utf8').slice(0, MAX_REPLY).trim()
}
