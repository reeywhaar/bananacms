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

  // Resolve path env vars against the consumer cwd (where `.env` lives), so
  // both zones agree regardless of their own cwd — CMS zone runs from the
  // package dir, which would otherwise resolve relative paths differently.
  const absolutePath = (v: string | undefined) => (v ? resolve(consumerDir, v) : undefined)

  const env = {
    ...process.env,
    NEXT_PUBLIC_SERVER_URL: publicUrl,
    CMS_INTERNAL_URL: cmsInternalUrl,
    BANANACMS_CONFIG_MODULE: configModule,
    ...(process.env.DB_PATH ? { DB_PATH: absolutePath(process.env.DB_PATH) } : {}),
    ...(process.env.ASSETS_DIRECTORY
      ? { ASSETS_DIRECTORY: absolutePath(process.env.ASSETS_DIRECTORY) }
      : {}),
  }

  const mode = dev ? 'development' : 'production'
  console.info(`bananacms [${mode}]`)
  console.info(`  CMS zone:      ${cmsInternalUrl}`)
  console.info(`  Consumer zone: ${publicUrl}`)

  const cmsChild = spawnZone('cms', cmsDir, cmsPort, dev, env)
  const consumerChild = spawnZone('demo', consumerDir, consumerPort, dev, env)
  const buildChildren = dev ? maybeSpawnBuildWatch(packageRoot) : []

  let shuttingDown = false
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`\nbananacms: received ${signal}, stopping zones...`)
    cmsChild.kill(signal)
    consumerChild.kill(signal)
    for (const child of buildChildren) child.kill(signal)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  const [cmsCode, consumerCode] = await Promise.all([
    waitForExit(cmsChild, 'cms'),
    waitForExit(consumerChild, 'demo'),
  ])

  for (const child of buildChildren) child.kill('SIGTERM')
  process.exit(cmsCode || consumerCode)
}

function maybeSpawnBuildWatch(packageRoot: string): ChildProcess[] {
  const tsupBin = resolve(packageRoot, 'node_modules', '.bin', 'tsup')
  const tscBin = resolve(packageRoot, 'node_modules', '.bin', 'tsc')
  const tscAliasBin = resolve(packageRoot, 'node_modules', '.bin', 'tsc-alias')
  if (!existsSync(tsupBin) || !existsSync(tscBin) || !existsSync(tscAliasBin)) return []

  // tsup emits .js; tsc emits .d.ts; tsc-alias rewrites @cms/* paths in the
  // emitted .d.ts. Demos and other consumers import the package via its
  // dist/*.d.ts entry, so without these declarations every CMS export degrades
  // to `any`.
  const tsup = spawn(tsupBin, ['--watch', '--silent'], {
    cwd: packageRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  prefixStream('build', tsup.stdout, process.stdout)
  prefixStream('build', tsup.stderr, process.stderr)

  const tsc = spawn(
    tscBin,
    [
      '-p',
      'tsconfig.build.json',
      '--emitDeclarationOnly',
      '--declaration',
      '--watch',
      '--preserveWatchOutput',
    ],
    { cwd: packageRoot, stdio: ['inherit', 'pipe', 'pipe'] },
  )
  prefixStream('types', tsc.stdout, process.stdout)
  prefixStream('types', tsc.stderr, process.stderr)

  // tsc-alias --watch races with tsc's bulk emit and silently misses files,
  // leaving @cms/* paths in some d.ts. Run it as a one-shot after each tsc pass
  // instead — tsc prints "Found N errors" when a pass finishes (initial or
  // incremental), which is our trigger.
  let aliasRunning = false
  let aliasPending = false
  const runAlias = () => {
    if (aliasRunning) { aliasPending = true; return }
    aliasRunning = true
    const child = spawn(tscAliasBin, ['-p', 'tsconfig.build.json'], {
      cwd: packageRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
    prefixStream('types', child.stdout, process.stdout)
    prefixStream('types', child.stderr, process.stderr)
    child.once('exit', () => {
      aliasRunning = false
      if (aliasPending) { aliasPending = false; runAlias() }
    })
  }
  let tscBuf = ''
  tsc.stdout?.on('data', (chunk: Buffer | string) => {
    tscBuf += typeof chunk === 'string' ? chunk : chunk.toString()
    if (/Found \d+ error/.test(tscBuf)) { tscBuf = ''; runAlias() }
  })

  return [tsup, tsc]
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
