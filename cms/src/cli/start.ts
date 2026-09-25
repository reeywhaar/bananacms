import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { setTimeout as sleep } from 'node:timers/promises'
import { serve, type Server } from 'srvx'
import { staticMiddleware } from 'srvx/static'
import {
  checkServerEnv,
  printUsersHint,
  shutDownOnSignals,
  startSiteServices,
} from './site-services.ts'

export async function start(
  root: string,
  options: { port?: number; host?: string },
): Promise<void> {
  checkServerEnv()
  const dist = path.join(root, 'dist')
  const entry = path.join(dist, 'rsc/index.js')
  if (!existsSync(entry)) {
    console.error('No production build in dist/. Run `bananacms build` first.')
    process.exitCode = 1
    return
  }

  process.env.NODE_ENV = 'production'
  // the rsc entry's default export is the request handler (framework/entry.rsc.tsx)
  const app: {
    default: { fetch(request: Request): Promise<Response>; close(): Promise<void> }
  } = await import(pathToFileURL(entry).href)

  const services = await startSiteServices(root)
  const server = serve({
    port: options.port,
    hostname: options.host,
    // client assets and public files; every other request goes to the app
    middleware: [staticMiddleware({ dir: path.join(dist, 'client') })],
    fetch: app.default.fetch,
    // the listening line is printed below, so it also shows when $TEST is set
    silent: true,
    // the shutdown below closes the server, and more
    gracefulShutdown: false,
  })
  await server.ready()

  const url = new URL(server.url!)
  const allInterfaces = url.hostname === '[::]' || url.hostname === '0.0.0.0'
  if (allInterfaces) url.hostname = 'localhost'
  console.log(`➜ Listening on ${url.href}${allInterfaces ? ' (all interfaces)' : ''}`)
  await printUsersHint(root)

  shutDownOnSignals(async () => {
    await closeServer(server)
    await app.default.close()
    await services.stop()
  })
}

// Stops taking requests, and gives those in flight 5 seconds to finish
async function closeServer(server: Server): Promise<void> {
  const closed = server.close().then(() => true)
  if (!(await Promise.race([closed, sleep(5000).then(() => false)]))) await server.close(true)
}
