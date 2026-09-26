import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { siteCli } from './cli.ts'

// End-to-end test of the dev server with the site's data in its own directory, as
// demo/.env.example has it, and no .gitignore covering it: the databases' writes
// don't reload the server, which Tailwind would have it do, as it watches the
// site's files for its classes.

const site = fileURLToPath(new URL('site', import.meta.url))
const { runCli, startServer } = siteCli(site)
const dataPath = join(site, 'own_files_data')
let server: Awaited<ReturnType<typeof startServer>>

beforeAll(async () => {
  server = await startServer('dev', dataPath)
})

afterAll(async () => {
  server?.stop()
  await server?.exited
  rmSync(dataPath, { recursive: true, force: true })
})

it("doesn't reload for the writes to DATA_PATH and ASSETS_DIRECTORY in the site's directory", async () => {
  // the first request makes the databases, and the invitation writes to them
  expect((await fetch(server.url)).status).toBe(200)
  const { stdout } = await runCli(['user', 'create', 'alice'], dataPath)
  const invite = /\/manage\/invite\?token=[\w-]+/.exec(stdout)?.[0]
  expect((await fetch(server.url + invite)).status).toBe(200)
  expect(server.output()).not.toContain('program reload')
})
