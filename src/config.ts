import { join } from 'node:path'
import type { ComponentType } from 'react'

export interface CMSLocale {
  code: string
  flag?: string
}

export interface CMSLocalesConfig {
  default: string
  locales: CMSLocale[]
}

export interface CMSPaths {
  admin: string
  api: string
  assetDelivery: string
  assetPrefix: string
}

export interface CMSEnv {
  dbPath: string
  assetsDir: string
}

export interface CMSErrorPages {
  notFound?: ComponentType
  error?: ComponentType
}

export interface CreateCMSInput {
  env?: Partial<CMSEnv>
  locales: CMSLocalesConfig
  paths?: Partial<CMSPaths>
  errorPages?: CMSErrorPages
}

export interface CMSInstance {
  env: CMSEnv
  locales: CMSLocalesConfig
  paths: CMSPaths
  errorPages: CMSErrorPages
}

const DEFAULT_PATHS: CMSPaths = {
  admin: '/manage',
  api: '/api',
  assetDelivery: '/d',
  assetPrefix: '/cms-static',
}

// Stored on globalThis so the singleton survives module duplication between
// the Next.js bundler graph and raw Node.js ESM (e.g. instrumentation.ts
// loading the consumer's config module with turbopackIgnore).
const INSTANCE_KEY = Symbol.for('bananacms.cms.instance')
type Host = { [INSTANCE_KEY]?: CMSInstance | null }
const host = globalThis as unknown as Host

export function createCMS(input: CreateCMSInput): CMSInstance {
  const env: CMSEnv = {
    dbPath: input.env?.dbPath ?? join(requireEnv('DATA_PATH', 'dataPath'), 'database.db'),
    assetsDir: input.env?.assetsDir ?? requireEnv('ASSETS_DIRECTORY', 'assetsDir'),
  }
  const resolved: CMSInstance = {
    env,
    locales: input.locales,
    paths: { ...DEFAULT_PATHS, ...input.paths },
    errorPages: input.errorPages ?? {},
  }
  host[INSTANCE_KEY] = resolved
  return resolved
}

export function getCMS(): CMSInstance {
  const instance = host[INSTANCE_KEY]
  if (!instance) {
    throw new Error(
      'bananacms: createCMS() has not been called. Initialize the CMS at application startup before any request-time code runs.',
    )
  }
  return instance
}

export function isCMSInitialized(): boolean {
  return host[INSTANCE_KEY] != null
}

function requireEnv(envName: string, optionName: string): string {
  const v = process.env[envName]
  if (!v) {
    throw new Error(
      `bananacms: env.${optionName} is required — set the ${envName} environment variable or pass env.${optionName} to createCMS().`,
    )
  }
  return v
}
