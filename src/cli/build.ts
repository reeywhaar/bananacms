import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

export async function run(): Promise<void> {
  const cmsDir = fileURLToPath(new URL('../', import.meta.url))
  const consumerDir = process.cwd()

  console.info('bananacms: building CMS zone...')
  await buildAt(cmsDir)

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
