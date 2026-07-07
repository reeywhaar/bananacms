export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export interface LogEntry {
  timestamp: string
  level: LogLevel
  service: string
  message: string
  context: Record<string, unknown>
  args: Record<string, unknown>
}

export interface Formatter {
  format(entry: LogEntry): string
}

export interface Sink {
  write(level: LogLevel, line: string): void
}

export class LoggerContext {
  parent?: LoggerContext
  value: Record<string, unknown>

  constructor(value: Record<string, unknown> = {}, parent?: LoggerContext) {
    this.value = value
    this.parent = parent
  }

  set(extra: Record<string, unknown>): void {
    this.value = { ...this.value, ...extra }
  }

  resolve(): Record<string, unknown> {
    return this.parent ? { ...this.value, ...this.parent.resolve() } : { ...this.value }
  }
}

export class Logger {
  readonly system: string
  private readonly ctx: LoggerContext
  private readonly formatter: Formatter
  private readonly sink: Sink
  private readonly minLevel: LogLevel

  // No parameter properties: the CLI loads this file via Node's strip-only
  // TypeScript mode, which rejects them.
  constructor(
    system: string,
    ctx: LoggerContext,
    formatter: Formatter,
    sink: Sink,
    minLevel: LogLevel = 'debug',
  ) {
    this.system = system
    this.ctx = ctx
    this.formatter = formatter
    this.sink = sink
    this.minLevel = minLevel
  }

  get context(): LoggerContext {
    return this.ctx
  }

  setContext(extra: Record<string, unknown>): void {
    this.ctx.set(extra)
  }

  child(system: string, context: Record<string, unknown> = {}): Logger {
    return new Logger(
      system,
      new LoggerContext(context, this.ctx),
      this.formatter,
      this.sink,
      this.minLevel,
    )
  }

  debug(message: string, args: Record<string, unknown> = {}): void {
    this.log('debug', message, args)
  }

  info(message: string, args: Record<string, unknown> = {}): void {
    this.log('info', message, args)
  }

  warn(message: string, args: Record<string, unknown> = {}): void {
    this.log('warn', message, args)
  }

  error(message: string, args: Record<string, unknown> = {}): void {
    this.log('error', message, args)
  }

  private log(level: LogLevel, message: string, args: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.minLevel]) return
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.system,
      message,
      context: this.ctx.resolve(),
      args,
    }
    this.sink.write(level, this.formatter.format(entry))
  }
}
