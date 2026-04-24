import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

export async function run(dev: boolean): Promise<void> {
  const cmsDir = fileURLToPath(new URL('../', import.meta.url))
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
  const consumerDir = process.cwd()

  const cmsPort = 3001
  const consumerPort = 3000
  const host = process.env.BANANACMS_HOST ?? 'localhost'

  const publicUrl = `http://${host}:${consumerPort}`
  const cmsInternalUrl = `http://localhost:${cmsPort}`

  const configModule = resolve(consumerDir, process.env.BANANACMS_CONFIG_MODULE ?? 'src/cms.ts')

  const env = {
    ...process.env,
    NEXT_PUBLIC_SERVER_URL: publicUrl,
    CMS_INTERNAL_URL: cmsInternalUrl,
    BANANACMS_CONFIG_MODULE: configModule,
  }

  const mode = dev ? 'development' : 'production'
  console.info(`bananacms [${mode}]`)
  console.info(`  CMS zone:      ${cmsInternalUrl}`)
  console.info(`  Consumer zone: ${publicUrl}`)

  const cmsChild = spawnZone('cms', cmsDir, cmsPort, dev, env)
  const consumerChild = spawnZone('demo', consumerDir, consumerPort, dev, env)
  const buildChild = dev ? maybeSpawnBuildWatch(packageRoot) : null

  let shuttingDown = false
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`\nbananacms: received ${signal}, stopping zones...`)
    cmsChild.kill(signal)
    consumerChild.kill(signal)
    buildChild?.kill(signal)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  const [cmsCode, consumerCode] = await Promise.all([
    waitForExit(cmsChild, 'cms'),
    waitForExit(consumerChild, 'demo'),
  ])

  buildChild?.kill('SIGTERM')
  process.exit(cmsCode || consumerCode)
}

function maybeSpawnBuildWatch(packageRoot: string): ChildProcess | null {
  const tsupBin = resolve(packageRoot, 'node_modules', '.bin', 'tsup')
  if (!existsSync(tsupBin)) return null
  const child = spawn(tsupBin, ['--watch', '--silent'], {
    cwd: packageRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  prefixStream('build', child.stdout, process.stdout)
  prefixStream('build', child.stderr, process.stderr)
  return child
}

function spawnZone(
  name: string,
  cwd: string,
  port: number,
  dev: boolean,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  const cmd = dev ? 'dev' : 'start'
  const child = spawn('npx', ['next', cmd, '--port', String(port)], {
    cwd,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  prefixStream(name, child.stdout, process.stdout)
  prefixStream(name, child.stderr, process.stderr)
  return child
}

function prefixStream(name: string, src: NodeJS.ReadableStream | null, dst: NodeJS.WriteStream) {
  if (!src) return
  const prefix = `[${name}] `
  let carry = ''
  src.on('data', (chunk: Buffer | string) => {
    const text = carry + (typeof chunk === 'string' ? chunk : chunk.toString())
    const lines = text.split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) dst.write(`${prefix}${line}\n`)
  })
  src.on('end', () => {
    if (carry) dst.write(`${prefix}${carry}\n`)
  })
}

function waitForExit(child: ChildProcess, name: string): Promise<number> {
  return new Promise((resolve) => {
    child.once('exit', (code, signal) => {
      if (signal) {
        console.info(`[${name}] exited via ${signal}`)
      } else {
        console.info(`[${name}] exited with code ${code ?? 0}`)
      }
      resolve(code ?? 0)
    })
  })
}
