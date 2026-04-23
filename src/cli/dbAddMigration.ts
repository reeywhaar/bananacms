import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline/promises'

export async function run(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  let name: string
  try {
    name = (await rl.question('Migration name (snake_case): ')).trim()
  } finally {
    rl.close()
  }

  if (!name) {
    console.error('Error: migration name cannot be empty')
    process.exit(1)
  }
  if (!/^[a-z0-9_]+$/.test(name)) {
    console.error(
      'Error: migration name must be snake_case (lowercase letters, digits, underscores)',
    )
    process.exit(1)
  }

  const timestamp = String(Date.now()).padStart(12, '0')
  const filename = `${timestamp}_${name}.ts`
  const dir = join(process.cwd(), 'src', 'lib', 'migrations')

  await mkdir(dir, { recursive: true })

  const template = `import { createMigration } from '@reeywhaar/bananacms/lib/migrations/migration'

export default createMigration({
  async up(tx) {
    await tx.executeMultiple(\`
      -- TODO
    \`)
  },

  async down(tx) {
    await tx.executeMultiple(\`
      -- TODO
    \`)
  },
})
`

  const filepath = join(dir, filename)
  await writeFile(filepath, template, { flag: 'wx' })
  console.info(`Created: src/lib/migrations/${filename}`)
}
