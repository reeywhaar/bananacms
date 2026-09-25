import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AssetStore } from '../services/AssetStore.ts'
import { createTestContext } from '../test/context.ts'
import { createTestDb, type TestDb } from '../test/db.ts'
import { assetDelivery } from './assetDelivery.ts'
import { getAssetUrl, getOptimizedAssetUrl } from './getAssetUrl.ts'

const ID = '01a0d75d-70c6-75de-bf9b-e42213d15194'

let assetsDir: string
beforeEach(() => {
  assetsDir = mkdtempSync(join(tmpdir(), 'bananacms-assets-'))
})
afterEach(() => {
  vi.unstubAllEnvs()
  rmSync(assetsDir, { recursive: true, force: true })
})

// a 40×30 PNG, made for screens with two pixels to the point
async function addImage(testDb: TestDb) {
  const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#fc0' } })
    .png()
    .toBuffer()
  await new AssetStore(testDb.db).add(ID, {
    filename: 'yellow.png',
    mime: 'image/png',
    data,
    content: { type: 'image', resolution: '@2x', output_as: { type: 'original' }, width: 40 },
  })
}

async function get(testDb: TestDb, url: string) {
  const { ctx } = createTestContext({ url: `http://site.test${url}`, testDb })
  return assetDelivery(ctx, async () => new Response('the rest of the middleware'))
}

const widthOf = async (response: Response) =>
  (await sharp(Buffer.from(await response.arrayBuffer())).metadata()).width

describe('assetDelivery', () => {
  it('encodes a variant, keeps it in ASSETS_DIRECTORY, and serves it from there', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', assetsDir)
    using testDb = await createTestDb()
    await addImage(testDb)
    const url = getOptimizedAssetUrl(ID, { type: 'original' }, '@1x', '@2x')
    const response = await get(testDb, url)
    expect(response.headers.get('content-type')).toBe('image/png')
    // half the size, for a screen with a pixel to the point
    expect(await widthOf(response)).toBe(20)
    const hash = url.split('/')[3].split('?')[0]
    expect(existsSync(join(assetsDir, `${ID}-${hash}`))).toBe(true)
    expect(await widthOf(await get(testDb, url))).toBe(20)
  })

  it('serves the original as uploaded, with or without ASSETS_DIRECTORY', async () => {
    using testDb = await createTestDb()
    await addImage(testDb)
    for (const dir of ['', assetsDir]) {
      vi.stubEnv('ASSETS_DIRECTORY', dir)
      const response = await get(testDb, getAssetUrl(ID))
      expect(await widthOf(response), dir || 'no directory').toBe(40)
    }
  })

  it('fails a variant, saying why, without ASSETS_DIRECTORY', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', '')
    using testDb = await createTestDb()
    await addImage(testDb)
    await expect(
      get(testDb, getOptimizedAssetUrl(ID, { type: 'original' }, '@1x', '@2x')),
    ).rejects.toThrow('ASSETS_DIRECTORY is not set')
  })

  it("answers a variant whose hash isn't the asset's with a 404", async () => {
    vi.stubEnv('ASSETS_DIRECTORY', assetsDir)
    using testDb = await createTestDb()
    await addImage(testDb)
    expect((await get(testDb, `/d/${ID}/000000000000?res=@1x`)).status).toBe(404)
  })
})
