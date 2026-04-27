import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export async function run(): Promise<void> {
  const cmsDir = fileURLToPath(new URL('../', import.meta.url))
  const consumerDir = process.cwd()

  // Published packages ship a prebuilt CMS zone in dist/.next/. Only rebuild
  // when running from a source tree (workspace dev) — installed consumers
  // skip the CMS build and just build their own zone.
  if (existsSync(join(cmsDir, '.next'))) {
    console.info('bananacms: CMS zone is prebuilt; skipping rebuild.')
  } else {
    console.info('bananacms: building CMS zone...')
    await buildAt(cmsDir)
  }

  console.info('bananacms: building consumer zone...')
  await buildAt(consumerDir)

  console.info('bananacms: build complete.')
}

async function buildAt(dir: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn('npx', ['next', 'build'], {
      cwd: dir,
      stdio: 'inherit',
      env: process.env,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) return resolve()
      reject(new Error(`next build exited with code ${code} in ${dir}`))
    })
  })
}
