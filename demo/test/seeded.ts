import { execFile } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

// For the demo's tests: its site directory, and `npm run seed` into a throwaway
// DATA_PATH, as npm runs it, without the variables vitest sets for itself

export const demoRoot = fileURLToPath(new URL('..', import.meta.url))
const bin = fileURLToPath(new URL('../../node_modules/.bin', import.meta.url))

export async function seedDemo(dataPath: string): Promise<void> {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => key !== 'NODE_ENV' && key !== 'TEST' && !key.startsWith('VITEST'),
    ),
  )
  await promisify(execFile)(process.execPath, ['scripts/seed.ts'], {
    cwd: demoRoot,
    env: {
      ...env,
      DATA_PATH: dataPath,
      ASSETS_DIRECTORY: path.join(dataPath, 'assets'),
      PATH: `${bin}${path.delimiter}${process.env.PATH}`,
    },
  })
}
