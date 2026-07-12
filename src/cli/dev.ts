import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { removePidFile, writePidFile } from '../lib/snapshots/pidfile.ts'
import { startFrontServer } from '../lib/frontServer.ts'
import { createRootLogger } from '../lib/logger/root.ts'
import { binEntry } from './binResolve.ts'

export async function run(dev: boolean, opts: { watchCms?: boolean } = {}): Promise<void> {
  // `next start` sets NODE_ENV=production only inside the zone processes;
  // this wrapper gets nothing. Without the default, the zones log JSON while
  // the front server and the zone-line wrapping stay in dev format.
  if (!dev) (process.env as Record<string, string | undefined>).NODE_ENV ??= 'production'

  const cmsDir = fileURLToPath(new URL('../', import.meta.url))
  const packageRoot = fileURLToPath(new URL('../../', import.meta.url))
  const consumerDir = process.cwd()

  // The front server owns the public port; both Next zones are internal.
  const frontPort = parsePort(process.env.SERVER_PORT, 3000)
  const cmsPort = frontPort + 1
  const pubPort = frontPort + 2
  const host = process.env.BANANACMS_HOST ?? 'localhost'

  const publicUrl = `http://${host}:${frontPort}`
  const cmsInternalUrl = `http://localhost:${cmsPort}`
  const pubInternalUrl = `http://localhost:${pubPort}`

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
    ...(process.env.DATA_PATH ? { DATA_PATH: absolutePath(process.env.DATA_PATH) } : {}),
    ...(process.env.ASSETS_DIRECTORY
      ? { ASSETS_DIRECTORY: absolutePath(process.env.ASSETS_DIRECTORY) }
      : {}),
  }

  const mode = dev ? 'development' : 'production'
  console.info(`bananacms [${mode}]`)
  console.info(`  Front:    ${publicUrl}`)
  console.info(`  Pub zone: ${pubInternalUrl} (internal)`)
  console.info(`  CMS zone: ${cmsInternalUrl} (internal)`)

  // Marks the app as running so `snapshot restore` refuses to touch the DB
  // underneath it. The exit hook also covers signal-triggered shutdowns —
  // process.exit below fires it.
  writePidFile()
  process.on('exit', removePidFile)

  // In-process on purpose: it's pure I/O (no encodes — those stay in the CMS
  // zone), and a third Node process is real memory on the small hosts this
  // targets. Binds the public port before the zones spawn so the origin is
  // never a connection-refused while Next boots.
  const frontLog = createRootLogger({ zone: 'front' }).child('Front')
  const frontServer = await startFrontServer(frontPort, {
    assetsDir: env.ASSETS_DIRECTORY,
    upstreamUrl: pubInternalUrl,
    onRequest: (e) => {
      // Proxied statics are zone noise; asset traffic stays at debug. 'nav'
      // logs at info: it is the only accurate render-latency metric — the
      // zones' middleware timing returns before the RSC render.
      if (e.kind === 'proxy' && !e.url.startsWith('/d/')) return
      const args = {
        method: e.method,
        url: e.url,
        status: e.status,
        durationMs: Math.round(e.ms),
      }
      if (e.kind === 'nav') frontLog.info('nav', args)
      else frontLog.debug(e.kind, args)
    },
  })

  const cmsChild = spawnZone('cms', cmsDir, cmsPort, dev, env)
  const consumerChild = spawnZone('pub', consumerDir, pubPort, dev, env)
  // The CMS source watch (tsup + tsc + tsc-alias) is only relevant when the
  // package source is local and being modified — i.e. the workspace's own demo.
  // External consumers install bananacms as a pre-built dependency; rebuilding
  // its source there is impossible (no devDeps) and undesirable (no source).
  // Default off; opt in via `--watch-cms` from the workspace demo script.
  const buildChildren = dev && opts.watchCms ? maybeSpawnBuildWatch(packageRoot) : []

  let shuttingDown = false
  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) return
    shuttingDown = true
    console.info(`\nbananacms: received ${signal}, stopping zones...`)
    frontServer.close()
    cmsChild.kill(signal)
    consumerChild.kill(signal)
    for (const child of buildChildren) child.kill(signal)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  const [cmsCode, consumerCode] = await Promise.all([
    waitForExit(cmsChild, 'cms'),
    waitForExit(consumerChild, 'pub'),
  ])

  for (const child of buildChildren) child.kill('SIGTERM')
  process.exit(cmsCode || consumerCode)
}

function maybeSpawnBuildWatch(packageRoot: string): ChildProcess[] {
  // External consumers install bananacms prebuilt, without these devDeps —
  // resolution throws and there's nothing to watch. Run each via
  // process.execPath so the watchers use the current runtime (the .bin shims
  // carry a `#!/usr/bin/env node` shebang, which a bun-only host can't run).
  let tsupBin: string
  let tscBin: string
  let tscAliasBin: string
  try {
    tsupBin = binEntry(packageRoot, 'tsup')
    tscBin = binEntry(packageRoot, 'typescript:tsc')
    tscAliasBin = binEntry(packageRoot, 'tsc-alias')
  } catch {
    return []
  }

  // tsup emits .js; tsc emits .d.ts; tsc-alias rewrites @cms/* paths in the
  // emitted .d.ts. Demos and other consumers import the package via its
  // dist/*.d.ts entry, so without these declarations every CMS export degrades
  // to `any`.
  const tsup = spawn(process.execPath, [tsupBin, '--watch', '--silent'], {
    cwd: packageRoot,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  prefixStream('build', tsup.stdout, process.stdout)
  prefixStream('build', tsup.stderr, process.stderr)

  const tsc = spawn(
    process.execPath,
    [
      tscBin,
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
    if (aliasRunning) {
      aliasPending = true
      return
    }
    aliasRunning = true
    const child = spawn(process.execPath, [tscAliasBin, '-p', 'tsconfig.build.json'], {
      cwd: packageRoot,
      stdio: ['inherit', 'pipe', 'pipe'],
    })
    prefixStream('types', child.stdout, process.stdout)
    prefixStream('types', child.stderr, process.stderr)
    child.once('exit', () => {
      aliasRunning = false
      if (aliasPending) {
        aliasPending = false
        runAlias()
      }
    })
  }
  let tscBuf = ''
  tsc.stdout?.on('data', (chunk: Buffer | string) => {
    tscBuf += typeof chunk === 'string' ? chunk : chunk.toString()
    if (/Found \d+ error/.test(tscBuf)) {
      tscBuf = ''
      runAlias()
    }
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
  const child = spawn(process.execPath, [binEntry(cwd, 'next'), cmd, '--port', String(port)], {
    cwd,
    env,
    stdio: ['inherit', 'pipe', 'pipe'],
  })
  prefixStream(name, child.stdout, process.stdout)
  prefixStream(name, child.stderr, process.stderr)
  return child
}

function jsonLogFormat(): boolean {
  if (process.env.LOG_FORMAT === 'json') return true
  if (process.env.LOG_FORMAT === 'dev') return false
  return process.env.NODE_ENV === 'production'
}

// Child lines that are themselves JSON objects get the zone merged in (without
// clobbering an existing key); everything else is wrapped as {zone, message}.
function formatLine(json: boolean, name: string, line: string): string {
  if (!json) return `[${name}] ${line}`
  if (line.startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(line)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const record = parsed as Record<string, unknown>
        return JSON.stringify('zone' in record ? record : { zone: name, ...record })
      }
    } catch {
      // not JSON — fall through to the wrapped form
    }
  }
  return JSON.stringify({ zone: name, message: line })
}

function prefixStream(name: string, src: NodeJS.ReadableStream | null, dst: NodeJS.WriteStream) {
  if (!src) return
  const json = jsonLogFormat()
  let carry = ''
  src.on('data', (chunk: Buffer | string) => {
    const text = carry + (typeof chunk === 'string' ? chunk : chunk.toString())
    const lines = text.split('\n')
    carry = lines.pop() ?? ''
    for (const line of lines) dst.write(`${formatLine(json, name, line)}\n`)
  })
  src.on('end', () => {
    if (carry) dst.write(`${formatLine(json, name, carry)}\n`)
  })
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = Number.parseInt(raw, 10)
  if (Number.isInteger(n) && n > 0 && n < 65535) return n
  throw new Error(`Invalid port number: ${raw}`)
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
