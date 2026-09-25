export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export type LogFields = Record<string, unknown>

export interface LogEntry {
  timestamp: string
  level: LogLevel
  // one per logger, from the root down: ['Request', 'Auth']
  labels: readonly string[]
  message: string
  // the loggers' fields, merged from the root down
  fields: LogFields
  // this call's fields
  args: LogFields
}

export interface Formatter {
  format(entry: LogEntry): string
}

export interface Sink {
  write(level: LogLevel, line: string): void
}

export type LoggerOutput = { formatter: Formatter; sink: Sink; minLevel: LogLevel }

// A logger with labels and fields. `child()` makes one for a part of the work:
// its label goes after the parent's, and its fields merge over the parent's. A
// child reads its parent's fields as it logs, so fields set on the parent later
// show up in the child's lines too.
export class Logger {
  readonly labels: readonly string[]
  readonly #output: LoggerOutput
  readonly #parent: Logger | undefined
  #fields: LogFields

  constructor(
    output: LoggerOutput,
    fields: LogFields = {},
    labels: readonly string[] = [],
    parent?: Logger,
  ) {
    this.#output = output
    this.#fields = fields
    this.labels = labels
    this.#parent = parent
  }

  child(label: string, fields: LogFields = {}): Logger {
    return new Logger(this.#output, fields, [...this.labels, label], this)
  }

  // adds fields to this logger's lines and its children's
  set(fields: LogFields): void {
    this.#fields = mergeFields(this.#fields, fields)
  }

  get fields(): LogFields {
    return this.#parent ? mergeFields(this.#parent.fields, this.#fields) : { ...this.#fields }
  }

  debug(message: string, args: LogFields = {}): void {
    this.#log('debug', message, args)
  }

  info(message: string, args: LogFields = {}): void {
    this.#log('info', message, args)
  }

  warn(message: string, args: LogFields = {}): void {
    this.#log('warn', message, args)
  }

  error(message: string, args: LogFields = {}): void {
    this.#log('error', message, args)
  }

  #log(level: LogLevel, message: string, args: LogFields): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.#output.minLevel]) return
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      labels: this.labels,
      message,
      fields: this.fields,
      args,
    }
    this.#output.sink.write(level, this.#output.formatter.format(entry))
  }
}

// The value from `over` wins on the same key, and plain objects merge key by
// key: { request: { host } } and { request: { path } } give both.
export function mergeFields(base: LogFields, over: LogFields): LogFields {
  const merged = { ...base }
  for (const [key, value] of Object.entries(over)) {
    const current = merged[key]
    merged[key] =
      isPlainObject(current) && isPlainObject(value) ? mergeFields(current, value) : value
  }
  return merged
}

function isPlainObject(value: unknown): value is LogFields {
  if (typeof value !== 'object' || value === null) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

// the fields to log for a caught error
export function errorFields(error: unknown): LogFields {
  return error instanceof Error
    ? { error: error.message, stack: error.stack }
    : { error: String(error) }
}
