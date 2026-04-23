import type { Formatter, LogEntry, LogLevel } from './Logger'

const serializeValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
    return String(value)
  }
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

const LEVEL_COLOR: Record<LogLevel, string> = {
  debug: ANSI.gray,
  info: ANSI.cyan,
  warn: ANSI.yellow,
  error: ANSI.red,
}

const LEVEL_SHORT: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
}

const SERVICE_PALETTE: readonly string[] = [
  '\x1b[38;5;39m', // blue
  '\x1b[38;5;42m', // teal
  '\x1b[38;5;75m', // light blue
  '\x1b[38;5;108m', // sage
  '\x1b[38;5;141m', // violet
  '\x1b[38;5;147m', // lavender
  '\x1b[38;5;173m', // peach
  '\x1b[38;5;178m', // gold
  '\x1b[38;5;180m', // tan
  '\x1b[38;5;203m', // coral
  '\x1b[38;5;209m', // salmon
  '\x1b[38;5;213m', // pink
]

const serviceColor = (name: string): string => {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  const idx = Math.abs(hash) % SERVICE_PALETTE.length
  return SERVICE_PALETTE[idx]
}

const colorsEnabled = (): boolean => {
  if (process.env.NO_COLOR) return false
  return true
}

const paint = (on: boolean, color: string, text: string): string =>
  on ? `${color}${text}${ANSI.reset}` : text

const serializePairs = (record: Record<string, unknown>, colored: boolean): string =>
  Object.entries(record)
    .map(([k, v]) => `${paint(colored, ANSI.dim, `${k}=`)}${serializeValue(v)}`)
    .join(' ')

export class DevFormatter implements Formatter {
  private readonly colored: boolean

  constructor(colored: boolean = colorsEnabled()) {
    this.colored = colored
  }

  format(entry: LogEntry): string {
    const c = this.colored
    const traceId = typeof entry.context.traceId === 'string' ? entry.context.traceId : ''
    const sessionId = typeof entry.context.sessionId === 'string' ? entry.context.sessionId : ''
    const level = LEVEL_SHORT[entry.level]
    const { traceId: _t, sessionId: _s, ...restContext } = entry.context
    const contextStr = serializePairs(restContext, c)
    const argsStr = serializePairs(entry.args, c)
    const extras = [argsStr, contextStr].filter((s) => s.length > 0).join(' ')
    const base =
      `${paint(c, ANSI.yellow, `[${entry.timestamp}]`)} ` +
      `${paint(c, `${ANSI.bold}${LEVEL_COLOR[entry.level]}`, `[${level}]`)} ` +
      `${paint(c, ANSI.magenta, `[${sessionId}]`)} ` +
      `${paint(c, ANSI.cyan, `[${traceId}]`)} ` +
      `${paint(c, serviceColor(entry.service), `[${entry.service}]`)} ` +
      `${entry.message}`
    return extras.length > 0 ? `${base} ${extras}` : base
  }
}

export class JsonFormatter implements Formatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      service: entry.service,
      message: entry.message,
      ...entry.context,
      ...entry.args,
    })
  }
}
