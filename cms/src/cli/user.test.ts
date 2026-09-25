import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hashPassword, sha256hex } from '../services/password.ts'
import { PasswordTokenStore } from '../services/PasswordTokenStore.ts'
import { UserStore } from '../services/UserStore.ts'
import { openSiteDatabases } from './site-databases.ts'
import { createUser, resetUser } from './user.ts'

let root: string
let info: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'bananacms-user-'))
  vi.stubEnv('DATA_PATH', 'private')
  vi.stubEnv('SERVER_URL', '')
  info = vi.spyOn(console, 'info').mockImplementation(() => {})
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

const printed = () => info.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
// whom the token in the last link printed is for
const lastLinkFor = async () => {
  const token = [...printed().matchAll(/\?token=([\w-]+)/g)].at(-1)?.[1] ?? ''
  using databases = await openSiteDatabases(root)
  return await new PasswordTokenStore(databases.derived.db).find(token)
}
const addUser = async (name: string) => {
  using databases = await openSiteDatabases(root, { migrate: true })
  return await new UserStore(databases.main.db).create(
    name,
    await hashPassword(sha256hex('password')),
  )
}

describe('user create', () => {
  it('prints an invitation for the name, on a fresh site', async () => {
    await createUser(root, ' alice ')
    expect(printed()).toMatch(
      /^bananacms: invited "alice", who sets a password at this link, once, within 7 days\.\n\/manage\/invite\?token=[\w-]{43}\nIt's a path on the site/,
    )
    expect(await lastLinkFor()).toEqual({ kind: 'invite', userName: 'alice' })
  })

  it('prints the link on SERVER_URL', async () => {
    vi.stubEnv('SERVER_URL', 'https://example.com')
    await createUser(root, 'alice')
    expect(printed()).toMatch(/days\.\nhttps:\/\/example\.com\/manage\/invite\?token=[\w-]{43}$/)
  })

  it('says when its link replaces the one made before', async () => {
    await createUser(root, 'alice')
    await createUser(root, 'alice')
    expect(printed()).toContain('within 7 days. It replaces the link made before.')
  })

  it('says when there is a user with the name already', async () => {
    await addUser('alice')
    await expect(createUser(root, 'alice')).rejects.toThrow(
      'There is a user "alice" already: `bananacms user reset "alice"`',
    )
  })

  it('needs a name, and SERVER_URL to be a URL', async () => {
    await expect(createUser(root, ' ')).rejects.toThrow('The user name is empty')
    vi.stubEnv('SERVER_URL', 'example.com')
    await expect(createUser(root, 'alice')).rejects.toThrow('SERVER_URL is not a URL: example.com')
  })
})

describe('user reset', () => {
  it("prints a recovery link for the user's password", async () => {
    const { id } = await addUser('alice')
    await resetUser(root, 'alice')
    expect(printed()).toMatch(
      /^bananacms: "alice" sets a new password at this link, once, within 24 hours\. Their password works as before until then\.\n\/manage\/recover\?token=/,
    )
    expect(await lastLinkFor()).toEqual({ kind: 'recover', userId: id })
  })

  it('says when there is no user with the name', async () => {
    await expect(resetUser(root, 'bob')).rejects.toThrow(
      'There is no user "bob": `bananacms user create "bob"` invites one',
    )
  })
})
