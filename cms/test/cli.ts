import { execFile, spawn } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// For end-to-end tests: runs the bananacms CLI in a site's directory with a
// throwaway database, and talks to it over HTTP like a browser with JavaScript off.

const cli = fileURLToPath(new URL('../bin/bananacms.js', import.meta.url))

// the CLI's environment, minus the variables vitest sets for itself, with JSON logs
// and `more`
function cliEnv(dataPath: string, more: Record<string, string> = {}): NodeJS.ProcessEnv {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== 'NODE_ENV' && key !== 'TEST' && !key.startsWith('VITEST'),
    ),
  )
  return {
    ...env,
    DATA_PATH: dataPath,
    ASSETS_DIRECTORY: join(dataPath, 'assets'),
    LOG_FORMAT: 'json',
    LOG_LEVEL: 'info',
    NO_COLOR: '1',
    ...more,
  }
}

export function siteCli(siteDir: string) {
  function runCli(args: string[], dataPath: string, env: Record<string, string> = {}) {
    return promisify(execFile)(process.execPath, [cli, ...args], {
      cwd: siteDir,
      env: cliEnv(dataPath, env),
    })
  }

  // Runs `bananacms <command> --port 0` and resolves with the URL it listens on,
  // what it has printed so far, and its exit code once it has exited. stop() sends
  // it SIGTERM.
  function startServer(
    command: 'dev' | 'start',
    dataPath: string,
    env: Record<string, string> = {},
  ) {
    const child = spawn(process.execPath, [cli, command, '--port', '0'], {
      cwd: siteDir,
      env: cliEnv(dataPath, env),
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const exited = new Promise<number | null>((resolve) => child.on('exit', resolve))
    let output = ''
    return new Promise<{
      url: string
      stop: () => void
      output: () => string
      exited: Promise<number | null>
    }>((resolve, reject) => {
      const fail = (reason: string) => {
        child.kill()
        reject(new Error(`bananacms ${command} ${reason}:\n${output}`))
      }
      const timeout = setTimeout(() => fail('printed no URL within 30s'), 30_000)
      const collect = (chunk: Buffer) => {
        output += chunk
        const url = /http:\/\/localhost:\d+/.exec(output)?.[0]
        if (!url) return
        clearTimeout(timeout)
        resolve({ url, stop: () => child.kill(), output: () => output, exited })
      }
      child.stdout.on('data', collect)
      child.stderr.on('data', collect)
      child.on('exit', (code) => fail(`exited (${code})`))
    })
  }

  return { runCli, startServer }
}

// the JSON log lines a server has printed
export function logLines(output: string): Record<string, unknown>[] {
  return output
    .split('\n')
    .filter((line) => line.startsWith('{'))
    .map((line) => JSON.parse(line) as Record<string, unknown>)
}

// Submits the first form in `html` whose markup contains `marker`, as a browser
// with JavaScript off does: its hidden inputs (React's server action fields) plus
// `values`, posted to `pageUrl`. A redirect comes back as it is.
export function submitForm(
  pageUrl: string,
  html: string,
  marker: string,
  values: Record<string, string>,
  cookie?: string,
) {
  const form = [...html.matchAll(/<form\b[^>]*>([\s\S]*?)<\/form>/g)]
    .map((match) => match[1])
    .find((inner) => inner.includes(marker))
  if (!form) throw new Error(`No form containing ${marker}`)

  const body = new FormData()
  for (const [, name, value = ''] of form.matchAll(
    /<input type="hidden" name="([^"]+)"(?: value="([^"]*)")?\/>/g,
  )) {
    body.append(decodeEntities(name), decodeEntities(value))
  }
  for (const [name, value] of Object.entries(values)) body.append(name, value)
  return fetch(pageUrl, {
    method: 'POST',
    body,
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
  })
}

function decodeEntities(text: string) {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
}
