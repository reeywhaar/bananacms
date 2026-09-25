import type { Formatter, LogEntry, LogFields, LogLevel } from './Logger.ts'

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
  yellow: '\x1b[33m',
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

const LABEL_PALETTE: readonly string[] = [
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

// the same label always gets the same color
const labelColor = (label: string): string => {
  let hash = 0
  for (let i = 0; i < label.length; i++) {
    hash = (hash * 31 + label.charCodeAt(i)) | 0
  }
  return LABEL_PALETTE[Math.abs(hash) % LABEL_PALETTE.length]
}

const colorsEnabled = (): boolean => !process.env.NO_COLOR

const paint = (on: boolean, color: string, text: string): string =>
  on ? `${color}${text}${ANSI.reset}` : text

const serializePairs = (record: LogFields, colored: boolean): string =>
  Object.entries(record)
    .map(([key, value]) => `${paint(colored, ANSI.dim, `${key}=`)}${serializeValue(value)}`)
    .join(' ')

// the local time of day: 08:30:00.000
const timeOfDay = (timestamp: string): string => {
  const date = new Date(timestamp)
  const pad = (value: number, width = 2) => String(value).padStart(width, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

// One line per entry for a terminal:
// [08:30:00.000] [INF] [2c5ba1e4] [Request] [Auth] login.success userId=…
// The ids show their first 8 characters, each label gets its own bracket, and the
// call's fields come before the loggers'.
export class DevFormatter implements Formatter {
  private readonly colored: boolean

  constructor(colored: boolean = colorsEnabled()) {
    this.colored = colored
  }

  format(entry: LogEntry): string {
    const c = this.colored
    const { traceId, sessionId, ...fields } = entry.fields
    const ids = [sessionId, traceId]
      .map((id, index) =>
        typeof id === 'string'
          ? paint(c, index === 0 ? ANSI.magenta : ANSI.cyan, `[${id.slice(0, 8)}]`)
          : '',
      )
      .filter(Boolean)
    const labels = entry.labels.map((label) => paint(c, labelColor(label), `[${label}]`))
    const extras = [serializePairs(entry.args, c), serializePairs(fields, c)].filter(Boolean)
    return [
      paint(c, ANSI.yellow, `[${timeOfDay(entry.timestamp)}]`),
      paint(c, `${ANSI.bold}${LEVEL_COLOR[entry.level]}`, `[${LEVEL_SHORT[entry.level]}]`),
      ...ids,
      ...labels,
      entry.message,
      ...extras,
    ].join(' ')
  }
}

// One JSON object per entry, for log collectors:
// {"timestamp":…,"level":"info","labels":["Request","Auth"],"message":…,…fields}
export class JsonFormatter implements Formatter {
  format(entry: LogEntry): string {
    return JSON.stringify({
      timestamp: entry.timestamp,
      level: entry.level,
      labels: entry.labels,
      message: entry.message,
      ...entry.fields,
      ...entry.args,
    })
  }
}
