import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkServerEnv } from './site-services.ts'

afterEach(() => vi.unstubAllEnvs())

describe('checkServerEnv', () => {
  it('names each variable dev and start need that is not set', () => {
    vi.stubEnv('DATA_PATH', '')
    vi.stubEnv('ASSETS_DIRECTORY', '')
    expect(checkServerEnv).toThrow(
      "Set DATA_PATH, the directory for the databases, like ./private, and ASSETS_DIRECTORY, the directory for the uploads and their image variants, like ./private/assets, in the site's .env or the environment",
    )
    vi.stubEnv('DATA_PATH', 'private')
    expect(checkServerEnv).toThrow(/^Set ASSETS_DIRECTORY, /)
    vi.stubEnv('ASSETS_DIRECTORY', 'private/assets')
    expect(checkServerEnv).not.toThrow()
  })
})
