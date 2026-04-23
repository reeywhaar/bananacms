'use server'

import { ApiDispatcher } from '@cms/lib/api/Dispatcher'
import { AuthTokenStore } from './AuthTokenStore'
import { UserStore } from './UserStore'
import { globalSetup, requestSetup } from '@cms/utils/globalSetup'
import { open } from 'sqlite'
import sqlite3 from 'sqlite3'
import { invariant } from '@cms/utils/invariant'
import { cookies, headers } from 'next/headers'
import { createRootLogger } from '@cms/lib/logger/root'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { v4 as uuid } from 'uuid'
import { isCMSInitialized, getCMS } from '@cms/config'

// Build the migrations path at runtime via path.resolve so bundlers don't
// statically analyze it as an asset module reference.
const MIGRATIONS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'migrations')

const resolveDbPath = (): string => {
  if (isCMSInitialized()) return getCMS().env.dbPath
  return process.env.DB_PATH ?? invariant('DB_PATH environment variable is not set')
}

// Resolve a stable (traceId, sessionId) pair for the current request. Falls
// back to fresh UUIDs when Next doesn't supply them (dev without a custom
// server / multi-zone rewrites arriving without these headers). Cached on the
// headers instance so repeat getServices() calls within one request share IDs.
const REQUEST_IDS = new WeakMap<object, { traceId: string; sessionId: string }>()

const resolveRequestIds = async (): Promise<{ traceId: string; sessionId: string }> => {
  const hdrs = await headers()
  const key = hdrs as unknown as object
  let ids = REQUEST_IDS.get(key)
  if (!ids) {
    ids = {
      traceId: hdrs.get('x-trace-id') ?? uuid(),
      sessionId: hdrs.get('x-session-id') ?? uuid(),
    }
    REQUEST_IDS.set(key, ids)
  }
  return ids
}

export interface AuthData {
  loggedIn: boolean
  user?: { id: string; name: string }
  token?: string
}

export const getServices = async () => {
  const { traceId, sessionId } = await resolveRequestIds()
  return requestSetup(sessionId, 'services', async () => {
    const db = await globalSetup('services', async () => {
      const db = await open({
        filename: resolveDbPath(),
        driver: sqlite3.Database,
      })
      await db.run('PRAGMA foreign_keys = ON')
      await db.run('PRAGMA recursive_triggers = ON')
      if (process.env.NODE_ENV !== 'production') {
        await db.migrate({ migrationsPath: MIGRATIONS_PATH })
      }
      return db
    })

    const authTokenStore = new AuthTokenStore(db)
    const userStore = new UserStore(db)

    const rootLogger = createRootLogger({ traceId, sessionId })
    const apiDispatcher = new ApiDispatcher(traceId)

    const token = (await cookies()).get('auth')?.value
    const resolvedUserId = token ? await authTokenStore.getUserId(token) : undefined
    const user = resolvedUserId ? await userStore.findById(resolvedUserId) : undefined
    const authData: AuthData = user
      ? { loggedIn: true, user: { id: user.id, name: user.name }, token }
      : { loggedIn: false }

    if (user) {
      rootLogger.setContext({ auth: { type: 'user', id: user.id } })
    } else if (token) {
      rootLogger.setContext({ auth: { type: 'invalidToken' } })
    } else {
      rootLogger.setContext({ auth: { type: 'guest' } })
    }

    rootLogger.info('start')

    return { db, apiDispatcher, rootLogger, traceId, authData }
  })
}
