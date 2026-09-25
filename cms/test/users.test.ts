import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { siteCli, submitForm } from './cli.ts'

// End-to-end tests of the CMS's users, on the site in cms/test/site: the links
// `bananacms user create` and `user reset` print, and the pages they open,
// used as a browser with JavaScript off does.

const { runCli, startServer } = siteCli(fileURLToPath(new URL('site', import.meta.url)))
const dataPath = mkdtempSync(join(tmpdir(), 'bananacms-users-'))
let server: Awaited<ReturnType<typeof startServer>>
const get = (path: string, cookie?: string) =>
  fetch(server.url + path, { redirect: 'manual', headers: cookie ? { cookie } : {} })
const cookieOf = (response: Response) => response.headers.get('set-cookie')?.split(';')[0] ?? ''

// the path of the link `bananacms user <args>` prints
const link = async (...args: string[]) => {
  const { stdout } = await runCli(['user', ...args], dataPath)
  const path = /\/manage\/(invite|recover)\?token=[\w-]+/.exec(stdout)?.[0]
  if (!path) throw new Error(`no link in:\n${stdout}`)
  return path
}
// posts the form on a link's page, with `password` and its confirmation
const setPassword = async (path: string, password: string, confirm = password) =>
  submitForm(server.url + path, await (await get(path)).text(), 'name="confirm"', {
    password,
    confirm,
  })
const logIn = async (username: string, password: string) =>
  submitForm(
    `${server.url}/manage/login`,
    await (await get('/manage/login')).text(),
    'name="password"',
    { username, password },
  )

beforeAll(async () => {
  server = await startServer('dev', dataPath)
})

afterAll(() => {
  server?.stop()
  rmSync(dataPath, { recursive: true, force: true })
})

describe('user create', () => {
  it('prints a link where the user sets a password, once, and is signed in', async () => {
    const path = await link('create', 'alice')
    const page = await (await get(path)).text()
    expect(page).toContain('Welcome')
    expect(page).toMatch(/name="username"[^>]*value="alice"/)

    const mismatch = await setPassword(path, 'alices-password', 'something-else')
    expect(await mismatch.text()).toContain('The passwords don&#x27;t match.')
    const short = await setPassword(path, 'short')
    expect(await short.text()).toContain('The password needs at least 8 characters.')

    const done = await setPassword(path, 'alices-password')
    expect(done.status).toBe(303)
    expect(done.headers.get('location')).toBe('/manage')
    expect(await (await get('/manage', cookieOf(done))).text()).toContain('>alice</a>')
    expect(await (await get(path)).text()).toContain('Link expired')
    expect((await logIn('alice', 'alices-password')).status).toBe(303)
  })

  it('makes a new link replace the one before', async () => {
    const first = await link('create', 'bob')
    const second = await link('create', 'bob')
    expect(await (await get(first)).text()).toContain('Link expired')
    expect(await (await get(second)).text()).toContain('Welcome')
  })

  it('says when there is a user with the name already', async () => {
    await expect(runCli(['user', 'create', 'alice'], dataPath)).rejects.toThrow(
      'There is a user "alice" already',
    )
  })
})

describe('user reset', () => {
  it("prints a link where the user sets a new password, which ends the user's sessions", async () => {
    const session = cookieOf(await logIn('alice', 'alices-password'))
    const path = await link('reset', 'alice')
    // the password works until the link is used
    expect((await logIn('alice', 'alices-password')).status).toBe(303)
    expect(await (await get(path)).text()).toContain('New password')

    const done = await setPassword(path, 'a-new-password')
    expect(done.status).toBe(303)
    expect(await (await get('/manage', cookieOf(done))).text()).toContain('>alice</a>')
    expect((await get('/manage', session)).status).toBe(307)
    expect(await (await logIn('alice', 'alices-password')).text()).toContain(
      'Wrong username or password.',
    )
    expect((await logIn('alice', 'a-new-password')).status).toBe(303)
  })

  it('says when there is no user with the name', async () => {
    await expect(runCli(['user', 'reset', 'nobody'], dataPath)).rejects.toThrow(
      'There is no user "nobody"',
    )
  })
})

it("shows a link whose token isn't one as expired", async () => {
  expect(await (await get('/manage/invite?token=nope')).text()).toContain('Link expired')
  expect(await (await get('/manage/recover')).text()).toContain('Link expired')
})
