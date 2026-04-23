import { spawn } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function run(): Promise<void> {
  const cmsDir = fileURLToPath(new URL('../', import.meta.url))
  const consumerDir = process.cwd()

  const consumerPort = parsePort(process.env.SERVER_PORT, 3000)
  const cmsPort = consumerPort + 1
  const host = process.env.BANANACMS_HOST ?? 'localhost'

  // Resolve path env vars against the consumer cwd so both zones agree.
  const absolutePath = (v: string | undefined) => (v ? resolve(consumerDir, v) : undefined)

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL ?? `https://${host}`,
    CMS_INTERNAL_URL: process.env.CMS_INTERNAL_URL ?? `http://localhost:${cmsPort}`,
    ...(process.env.DB_PATH ? { DB_PATH: absolutePath(process.env.DB_PATH) } : {}),
    ...(process.env.ASSETS_DIRECTORY
      ? { ASSETS_DIRECTORY: absolutePath(process.env.ASSETS_DIRECTORY) }
      : {}),
  }

  // Published packages ship a prebuilt CMS zone in dist/.next/. Only rebuild
  // when running from a source tree (workspace dev) — installed consumers
  // skip the CMS build and just build their own zone.
  if (existsSync(join(cmsDir, '.next'))) {
    console.info('bananacms: CMS zone is prebuilt; skipping rebuild.')
  } else {
    console.info('bananacms: building CMS zone...')
    await buildAt(cmsDir, env)
    patchRelativeAppDir(cmsDir)
  }

  console.info('bananacms: building consumer zone...')
  await buildAt(consumerDir, env)

  console.info('bananacms: build complete.')
}

async function buildAt(dir: string, env: NodeJS.ProcessEnv): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['next', 'build'], {
      cwd: dir,
      stdio: 'inherit',
      env,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`next build exited with code ${code} in ${dir}`))
    })
  })
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isInteger(n) && n > 0 && n < 65535) return n
  throw new Error(`Invalid port number: ${raw}`)
}

// next build sets relativeAppDir relative to turbopackRoot (typically the
// monorepo/consumer root, several levels above dist/). next start then resolves
// the project dir as join(dir, relativeAppDir), which would point to dist/dist/
// or similar. Patch it to '.' so next start correctly uses dist/ as the project.
function patchRelativeAppDir(cmsDir: string): void {
  const file = join(cmsDir, '.next', 'required-server-files.json')
  if (!existsSync(file)) return
  const data = JSON.parse(readFileSync(file, 'utf-8'))
  if (data.relativeAppDir === '.') return
  data.relativeAppDir = '.'
  writeFileSync(file, JSON.stringify(data))
}
