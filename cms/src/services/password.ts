import { createHash, randomBytes, scrypt, type ScryptOptions, timingSafeEqual } from 'node:crypto'

// A user's stored hash is the scrypt of their password's SHA-256 hex.
export function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

const N = 16384
const R = 8
const P = 1
const KEYLEN = 64
const SALT_BYTES = 16

function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derived) => {
      if (err) reject(err)
      else resolve(derived)
    })
  })
}

export async function hashPassword(input: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const hash = await scryptAsync(input, salt, KEYLEN, { N, r: R, p: P })
  return `scrypt$N=${N},r=${R},p=${P}$${salt.toString('base64')}$${hash.toString('base64')}`
}

// The hash a user's row keeps of their password, which logIn checks it against
export async function hashUserPassword(password: string): Promise<string> {
  return hashPassword(sha256hex(password))
}

export async function verifyPassword(input: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 4 || parts[0] !== 'scrypt') return false
  const params = Object.fromEntries(
    parts[1].split(',').map((kv) => {
      const [k, v] = kv.split('=')
      return [k, Number(v)]
    }),
  ) as ScryptOptions
  const salt = Buffer.from(parts[2], 'base64')
  const expected = Buffer.from(parts[3], 'base64')
  const actual = await scryptAsync(input, salt, expected.length, params)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
