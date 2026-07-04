'use server'

import { join } from 'node:path'
import { ApiDispatcher } from '@cms/lib/api/Dispatcher'
import { AuthTokenStore } from './AuthTokenStore'
import { UserStore } from './UserStore'
import { globalSetup, requestSetup } from '@cms/utils/globalSetup'
import { invariant } from '@cms/utils/invariant'
import { cookies, headers } from 'next/headers'
import { createRootLogger } from '@cms/lib/logger/root'
import { v4 as uuid } from 'uuid'
import { isCMSInitialized, getCMS } from '@cms/config'
import { openDb, openDerivedDb, runMigrations } from '@cms/lib/db/client'
import { setupSnapshotScheduler, wrapDbWithWriteHook } from '@cms/lib/snapshots/setup'
import { ApiError } from '@cms/lib/api/error'

const resolveDbPath = (): string => {
  if (isCMSInitialized()) return getCMS().env.dbPath
  const dataPath = process.env.DATA_PATH ?? invariant('DATA_PATH environment variable is not set')
  return join(dataPath, 'database.db')
}

const resolveDerivedDbPath = (): string => {
  if (isCMSInitialized()) return getCMS().env.derivedDbPath
  const dataPath = process.env.DATA_PATH ?? invariant('DATA_PATH environment variable is not set')
  return join(dataPath, 'derived.db')
}

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

const resolveRequestInfo = async (): Promise<Record<string, string>> => {
  const hdrs = await headers()
  const ip =
    hdrs.get('x-forwarded-for')?.split(',')[0]?.trim() || hdrs.get('x-real-ip') || undefined
  const info: Record<string, string | undefined> = {
    host: hdrs.get('host') ?? undefined,
    ip,
    ua: hdrs.get('user-agent') ?? undefined,
    proto: hdrs.get('x-forwarded-proto') ?? undefined,
    referer: hdrs.get('referer') ?? undefined,
    origin: hdrs.get('origin') ?? undefined,
    lang: hdrs.get('accept-language') ?? undefined,
  }
  return Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined)) as Record<
    string,
    string
  >
}

export type AuthData =
  | { user: { id: string; name: string }; token: string; tokenExpiresAt: string }
  | undefined

/**
 * Request-scoped logger without the auth lookup getServices performs.
 * Middleware logging runs for every matched request — public pages and
 * extensionless asset URLs included — and must not cost DB queries.
 */
export const getRequestLogger = async () => {
  const hdrs = await headers()
  const { traceId, sessionId } = await resolveRequestIds()
  const requestInfo = await resolveRequestInfo()
  return requestSetup(hdrs, 'requestLogger', () =>
    createRootLogger({ traceId, sessionId, request: requestInfo }),
  )
}

export const getServices = async () => {
  const hdrs = await headers()
  const { traceId, sessionId } = await resolveRequestIds()
  const requestInfo = await resolveRequestInfo()
  return requestSetup(hdrs, 'services', async () => {
    const { db, derivedDb } = await globalSetup('cms.databases', async () => {
      const { client, db } = await openDb(resolveDbPath())
      const { client: derivedClient, db: derivedDb } = await openDerivedDb(resolveDerivedDbPath())
      await runMigrations(client, derivedClient)
      const snapshotScheduler = setupSnapshotScheduler(client)
      const trackedDb = snapshotScheduler
        ? wrapDbWithWriteHook(db, () => snapshotScheduler.markDirty())
        : db
      return { client, db: trackedDb, derivedDb }
    })

    const authTokenStore = new AuthTokenStore(derivedDb)
    const userStore = new UserStore(db)

    const rootLogger = createRootLogger({ traceId, sessionId, request: requestInfo })
    const apiDispatcher = new ApiDispatcher(traceId)

    const token = (await cookies()).get('auth')?.value
    const tokenData = token ? await authTokenStore.getTokenData(token) : undefined
    const user = tokenData ? await userStore.findById(tokenData.userId) : undefined
    const authData: AuthData = user
      ? {
          user: { id: user.id, name: user.name },
          token: token ?? invariant('token must be present when user is resolved'),
          tokenExpiresAt:
            tokenData?.expiresAt ?? invariant('tokenData must be present when user is resolved'),
        }
      : undefined

    if (user) {
      rootLogger.setContext({ auth: { type: 'user', id: user.id } })
    } else if (token) {
      rootLogger.setContext({ auth: { type: 'invalidToken' } })
    } else {
      rootLogger.setContext({ auth: { type: 'guest' } })
    }

    rootLogger.info('start')

    return {
      db,
      derivedDb,
      apiDispatcher,
      rootLogger,
      traceId,
      authData,
    }
  })
}

export const requireAuth = async (): Promise<void> => {
  const services = await getServices()
  if (!services.authData) {
    throw new ApiError('Unauthorized').expose().withStatus(401)
  }
}
