import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { writeTarGz } from './tar'

const dirs: string[] = []
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

const makeDir = () => {
  const dir = mkdtempSync(join(tmpdir(), 'bananacms-tar-'))
  dirs.push(dir)
  return dir
}

describe('writeTarGz', () => {
  it('writes an archive the system tar can read back byte for byte', () => {
    const dir = makeDir()
    // Sizes that straddle the 512-byte block boundary in both directions, since
    // padding is where a hand-rolled tar goes wrong.
    const files = {
      'database.db': Buffer.from('a'.repeat(1000)),
      'derived.db': Buffer.from('b'.repeat(512)),
    }
    for (const [name, data] of Object.entries(files)) writeFileSync(join(dir, name), data)

    const out = join(dir, 'archive.tgz')
    return writeTarGz(
      Object.keys(files).map((name) => ({
        name,
        path: join(dir, name),
        size: statSync(join(dir, name)).size,
      })),
      out,
    ).then(() => {
      const extractTo = join(dir, 'out')
      mkdirSync(extractTo)
      execFileSync('tar', ['-xzf', out, '-C', extractTo])

      for (const [name, data] of Object.entries(files)) {
        expect(readFileSync(join(extractTo, name)).equals(data)).toBe(true)
      }
      // Listed in the order given: the main database is the first thing out.
      const listing = execFileSync('tar', ['-tzf', out]).toString().trim().split('\n')
      expect(listing).toEqual(['database.db', 'derived.db'])
    })
  })

  it('handles an empty file and refuses a name that will not fit', async () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'empty.db'), '')
    const out = join(dir, 'a.tgz')
    await writeTarGz([{ name: 'empty.db', path: join(dir, 'empty.db'), size: 0 }], out)
    const extractTo = join(dir, 'out')
    mkdirSync(extractTo)
    execFileSync('tar', ['-xzf', out, '-C', extractTo])
    expect(statSync(join(extractTo, 'empty.db')).size).toBe(0)

    await expect(
      writeTarGz([{ name: 'x'.repeat(101), path: join(dir, 'empty.db'), size: 0 }], out),
    ).rejects.toThrow(/too long/)
  })

  it('rejects a file that changed size underneath it', async () => {
    const dir = makeDir()
    writeFileSync(join(dir, 'a.db'), 'four')
    await expect(
      writeTarGz([{ name: 'a.db', path: join(dir, 'a.db'), size: 999 }], join(dir, 'a.tgz')),
    ).rejects.toThrow(/changed size/)
  })
})
