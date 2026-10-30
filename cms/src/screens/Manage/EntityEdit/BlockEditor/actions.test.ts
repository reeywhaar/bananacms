import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invokeAction } from '#cms/framework/actions.ts'
import { setAuth } from '#cms/framework/context.ts'
import { handleServerResult } from '#cms/lib/serverActions.ts'
import { AssetStore } from '#cms/services/AssetStore.ts'
import { createTestContext } from '#cms/test/context.ts'
import { createTestDb } from '#cms/test/db.ts'
import { silentWav } from '#cms/test/audio.ts'
import { retagAudio, uploadAsset } from './actions.ts'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('uploadAsset', () => {
  it('keeps the max size an image was given before it was first saved', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', '')
    using testDb = await createTestDb()
    const { ctx } = createTestContext({ testDb })
    setAuth(ctx, { user: { id: 'u1', name: 'alice' }, token: 't', tokenExpiresAt: '' })
    const data = await sharp({ create: { width: 40, height: 30, channels: 3, background: '#fc0' } })
      .png()
      .toBuffer()
    const formData = new FormData()
    formData.append('file', new File([data], 'yellow.png', { type: 'image/png' }))
    formData.append('maxSize', JSON.stringify({ width: 20, height: 15 }))

    const { id } = handleServerResult(
      (await invokeAction(uploadAsset, [formData], ctx)) as Awaited<ReturnType<typeof uploadAsset>>,
    )

    const meta = await new AssetStore(testDb.db).getMeta(id)
    expect(meta?.content).toMatchObject({ type: 'image', maxSize: { width: 20, height: 15 } })
  })
})

describe('retagAudio', () => {
  it('writes tags into a saved audio file as a new asset, and leaves the old one be', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', '')
    using testDb = await createTestDb()
    const { ctx } = createTestContext({ testDb })
    setAuth(ctx, { user: { id: 'u1', name: 'alice' }, token: 't', tokenExpiresAt: '' })
    const store = new AssetStore(testDb.db)
    await store.add('old', {
      filename: 'song.wav',
      mime: 'audio/wav',
      data: Buffer.from(silentWav()),
      content: { type: 'audio', duration: 1 },
    })

    const { id } = handleServerResult(
      (await invokeAction(
        retagAudio,
        ['old', JSON.stringify({ title: 'Coastal Service', year: 2026 })],
        ctx,
      )) as Awaited<ReturnType<typeof retagAudio>>,
    )

    expect(id).not.toBe('old')
    const meta = await store.getMeta(id)
    expect(meta?.filename).toBe('song.wav')
    expect(meta?.content).toMatchObject({
      type: 'audio',
      tags: { title: 'Coastal Service', year: 2026 },
    })
    expect(await store.getMeta('old')).not.toBeNull()
  })

  it('refuses a year that is not one', async () => {
    vi.stubEnv('ASSETS_DIRECTORY', '')
    using testDb = await createTestDb()
    const { ctx } = createTestContext({ testDb })
    setAuth(ctx, { user: { id: 'u1', name: 'alice' }, token: 't', tokenExpiresAt: '' })
    await new AssetStore(testDb.db).add('old', {
      filename: 'song.wav',
      mime: 'audio/wav',
      data: Buffer.from(silentWav()),
      content: { type: 'audio' },
    })
    const result = (await invokeAction(retagAudio, ['old', '{"year":2026.5}'], ctx)) as Awaited<
      ReturnType<typeof retagAudio>
    >
    expect(() => handleServerResult(result)).toThrow('A year is a whole number')
  })
})
