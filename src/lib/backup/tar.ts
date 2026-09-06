import { createReadStream, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { createGzip } from 'node:zlib'

export interface TarEntry {
  /** Name inside the archive — the file's name in the data directory. */
  name: string
  /** File to read the contents from. */
  path: string
  size: number
}

const BLOCK = 512

/**
 * Writes entries as a gzipped tar, streaming.
 *
 * Hand-rolled rather than a dependency: a tar of a few regular files is one
 * 512-byte header apiece and two zero blocks at the end, and the archive
 * carries every password hash and asset in the instance — a format we can read
 * in full is worth more here than one we pull in.
 *
 * Streamed rather than built in memory because a bananacms database holds its
 * asset blobs, so the archive is as large as the site's media. Sizes come from
 * the vacuumed files on disk, which is what lets a tar header be written before
 * its contents are read.
 */
export async function writeTarGz(
  entries: TarEntry[],
  outPath: string,
  mtime: Date = new Date(),
): Promise<void> {
  const seconds = Math.floor(mtime.getTime() / 1000)
  await pipeline(
    Readable.from(tarBlocks(entries, seconds)),
    createGzip(),
    createWriteStream(outPath),
  )
}

async function* tarBlocks(entries: TarEntry[], mtime: number): AsyncGenerator<Buffer> {
  for (const entry of entries) {
    yield header(entry, mtime)
    let written = 0
    for await (const chunk of createReadStream(entry.path)) {
      const buf = chunk as Buffer
      written += buf.length
      yield buf
    }
    if (written !== entry.size) {
      throw new Error(`${entry.name} changed size while being archived (${written}/${entry.size})`)
    }
    const remainder = entry.size % BLOCK
    if (remainder !== 0) yield Buffer.alloc(BLOCK - remainder)
  }
  // Two zero blocks mark the end of the archive.
  yield Buffer.alloc(BLOCK * 2)
}

function header(entry: TarEntry, mtime: number): Buffer {
  const block = Buffer.alloc(BLOCK)
  const name = Buffer.from(entry.name, 'utf8')
  // 100 bytes, and the prefix field that would extend it is not worth carrying
  // for names we choose ourselves.
  if (name.length > 100) throw new Error(`Archive entry name is too long: ${entry.name}`)
  name.copy(block, 0)

  // 0600 throughout: the archive carries every password hash and asset in the
  // instance, so an extracted copy should not be readable by anyone else. No
  // directory entries, so extracting cannot re-chmod an existing data directory.
  writeOctal(block, 0o600, 100, 8)
  writeOctal(block, 0, 108, 8) // uid
  writeOctal(block, 0, 116, 8) // gid
  writeOctal(block, entry.size, 124, 12)
  // When the backup ran, not the vacuumed copy's own mtime, which is an
  // artefact of staging. Zero would leave everything extracting as 1970.
  writeOctal(block, mtime, 136, 12)
  block.write('0', 156, 1, 'ascii') // typeflag: regular file
  block.write('ustar\0', 257, 6, 'ascii')
  block.write('00', 263, 2, 'ascii')

  // The checksum is computed with its own field read as spaces, then written
  // back over them.
  block.fill(0x20, 148, 156)
  let sum = 0
  for (const byte of block) sum += byte
  block.write(sum.toString(8).padStart(6, '0'), 148, 6, 'ascii')
  block.write('\0 ', 154, 2, 'ascii')
  return block
}

/** Tar numbers are octal, NUL-terminated, right-aligned in their field. */
function writeOctal(block: Buffer, value: number, offset: number, length: number): void {
  block.write(value.toString(8).padStart(length - 1, '0'), offset, length - 1, 'ascii')
}
