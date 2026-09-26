import path from 'node:path'
import { createServer, isRunnableDevEnvironment, type ViteDevServer } from 'vite'
import { pidFilePath } from '../lib/snapshots/pidfile.ts'
import { assetsDirectory, dataPath } from './site_databases.ts'
import {
  checkServerEnv,
  printUsersHint,
  shutDownOnSignals,
  startSiteServices,
} from './site_services.ts'
import { createViteConfig, frameworkFile } from './vite_config.ts'

export async function dev(
  root: string,
  options: { port?: number; host?: string | true },
): Promise<void> {
  checkServerEnv()
  // Vite closes its server and exits on SIGTERM. The shutdown below does that and
  // more, so the signal is left to it.
  const sigtermListeners = new Set(process.listeners('SIGTERM'))
  const server = await createServer({
    ...createViteConfig(root),
    server: {
      port: options.port,
      host: options.host,
      // Pages and their assets come from this one server, so it needs no CORS, and
      // OPTIONS requests reach the site's route.ts handlers, as in production.
      cors: false,
      // the hostnames it answers besides localhost and IP addresses (ALLOWED_HOSTS)
      allowedHosts: allowedHosts(),
      // The files the server writes as it runs aren't the site's code, and a change
      // to one reloads nothing. Tailwind, which watches the site's files for its
      // classes, would otherwise have the RSC environment reload at a database's
      // write, under the requests in flight.
      watch: { ignored: [serverFiles(root)] },
    },
  })
  for (const listener of process.listeners('SIGTERM')) {
    if (!sigtermListeners.has(listener)) process.off('SIGTERM', listener)
  }

  const services = await startSiteServices(root)
  await server.listen()
  server.printUrls()
  await printUsersHint(root)
  shutDownOnSignals(async () => {
    // the app as the server runs it: its databases close once the server has
    const app = await runningApp(server)
    await server.close()
    await app?.close()
    await services.stop()
  })
  server.bindCLIShortcuts({
    print: true,
    customShortcuts: [
      {
        key: 'q',
        description: 'quit',
        action: () => {
          process.kill(process.pid, 'SIGTERM')
        },
      },
    ],
  })
}

// The RSC entry's default export as the dev server runs it (framework/entry.rsc.tsx),
// which @vitejs/plugin-rsc imports for each request the same way. undefined when no
// request has loaded it: then the app has opened nothing.
async function runningApp(server: ViteDevServer): Promise<{ close(): Promise<void> } | undefined> {
  const environment = server.environments.rsc
  if (!environment || !isRunnableDevEnvironment(environment)) return undefined
  const resolved = await environment.pluginContainer.resolveId(frameworkFile('entry.rsc'))
  if (!resolved || !environment.runner.evaluatedModules.getModuleById(resolved.id)) {
    return undefined
  }
  const module: { default: { close(): Promise<void> } } = await environment.runner.import(
    resolved.id,
  )
  return module.default
}

// ALLOWED_HOSTS, comma-separated, like `corben.local` for the name another machine
// reaches the dev server by. A name with a leading dot, like `.example.com`, takes
// its subdomains too, as Vite's server.allowedHosts does.
function allowedHosts(): string[] {
  return (process.env.ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}

// Whether `file` is one the server writes: the databases in DATA_PATH, their
// snapshots included, the uploads and variants in ASSETS_DIRECTORY, and the .pid file
function serverFiles(root: string): (file: string) => boolean {
  const directories = [dataPath(root), assetsDirectory(root)].filter((dir) => dir !== undefined)
  const pidFile = pidFilePath(root)
  return (file) =>
    file === pidFile ||
    directories.some((dir) => file === dir || file.startsWith(`${dir}${path.sep}`))
}
