import {
  PASSWORD_TOKEN_PATHS,
  PASSWORD_TOKEN_TTL_MS,
  PasswordTokenStore,
  type PasswordTokenKind,
} from '../services/PasswordTokenStore.ts'
import { UserStore } from '../services/UserStore.ts'
import { openSiteDatabases } from './site-databases.ts'

// `user create <name>`: prints an invitation, a link where the user sets the
// password they sign in with, which creates them. The databases in DATA_PATH are
// created and migrated first, so this works on a fresh site.
export async function createUser(root: string, name: string): Promise<void> {
  const userName = trimmedName(name)
  const origin = siteOrigin()
  using databases = await openSiteDatabases(root, { migrate: true })
  if (await new UserStore(databases.main.db).findByName(userName)) {
    throw new Error(
      `There is a user "${userName}" already: \`bananacms user reset "${userName}"\` makes a link to set a new password`,
    )
  }
  const issued = await new PasswordTokenStore(databases.derived.db).issue({
    kind: 'invite',
    userName,
  })
  printLink('invite', issued, origin, `invited "${userName}", who sets a password at this link`)
}

// `user reset <name>`: prints a recovery link, where the user sets a new password.
// Their password works as before until then.
export async function resetUser(root: string, name: string): Promise<void> {
  const userName = trimmedName(name)
  const origin = siteOrigin()
  using databases = await openSiteDatabases(root, { migrate: true })
  const user = await new UserStore(databases.main.db).findByName(userName)
  if (!user) {
    throw new Error(
      `There is no user "${userName}": \`bananacms user create "${userName}"\` invites one`,
    )
  }
  const issued = await new PasswordTokenStore(databases.derived.db).issue({
    kind: 'recover',
    userId: user.id,
  })
  printLink(
    'recover',
    issued,
    origin,
    `"${userName}" sets a new password at this link`,
    'Their password works as before until then.',
  )
}

// `what` the link is for, how long it works, and `notes`, then the link
function printLink(
  kind: PasswordTokenKind,
  issued: { token: string; replaced: number },
  origin: URL | undefined,
  what: string,
  ...notes: string[]
): void {
  if (issued.replaced > 0) notes.push('It replaces the link made before.')
  const within = duration(PASSWORD_TOKEN_TTL_MS[kind])
  console.info([`bananacms: ${what}, once, within ${within}.`, ...notes].join(' '))
  const path = `${PASSWORD_TOKEN_PATHS[kind]}?token=${issued.token}`
  console.info(origin ? new URL(path, origin).href : path)
  if (!origin) {
    console.info(
      "It's a path on the site: with SERVER_URL set, like https://example.com, it's a link.",
    )
  }
}

// SERVER_URL, the site's address, which the links go on when it's set
function siteOrigin(): URL | undefined {
  const url = process.env.SERVER_URL
  if (!url) return undefined
  try {
    return new URL(url)
  } catch {
    throw new Error(`SERVER_URL is not a URL: ${url}`)
  }
}

function trimmedName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('The user name is empty')
  return trimmed
}

function duration(ms: number): string {
  const hours = ms / (60 * 60 * 1000)
  return hours >= 48 ? `${hours / 24} days` : `${hours} hours`
}
