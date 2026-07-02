import { createHash, randomBytes, scrypt, type ScryptOptions } from 'node:crypto'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { v7 as uuidv7 } from 'uuid'
import { openDb } from '@cms/lib/db/client'

const scryptAsync = (password: string, salt: Buffer, keylen: number, options: ScryptOptions) =>
  new Promise<Buffer>((ok, fail) =>
    scrypt(password, salt, keylen, options, (err, hash) => (err ? fail(err) : ok(hash))),
  )
const N = 16384
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16

export async function run({ name, password }: { name: string; password: string }): Promise<void> {
  const dataPath = requireEnv('DATA_PATH')
  const dbPath = join(dataPath, 'database.db')

  await mkdir(resolve(dataPath), { recursive: true })

  const { client } = openDb(dbPath)

  const passwordHash = await hashPassword(sha256hex(password))

  const result = await client.execute({
    sql:
      'INSERT INTO user (id, name, password_hash) VALUES (?, ?, ?) ' +
      'ON CONFLICT(name) DO UPDATE SET password_hash = excluded.password_hash ' +
      'RETURNING id, (SELECT changes()) AS changed',
    args: [uuidv7(), name, passwordHash],
  })
  const row = result.rows[0]

  client.close()

  console.info(`bananacms: user "${name}" saved (id=${row?.id}).`)
}

async function hashPassword(input: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const hash = await scryptAsync(input, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$N=${N},r=${R},p=${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) {
    console.error(`${name} is not set. Provide it via .env or the environment.`)
    process.exit(1)
  }
  return v
}
