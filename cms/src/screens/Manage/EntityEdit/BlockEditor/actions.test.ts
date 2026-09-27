import sharp from 'sharp'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { invokeAction } from '../../../../framework/actions.ts'
import { setAuth } from '../../../../framework/context.ts'
import { handleServerResult } from '../../../../lib/serverActions.ts'
import { AssetStore } from '../../../../services/AssetStore.ts'
import { createTestContext } from '../../../../test/context.ts'
import { createTestDb } from '../../../../test/db.ts'
import { uploadAsset } from './actions.ts'

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
