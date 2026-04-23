import { Logger, LoggerContext, type Formatter, type LogLevel, type Sink } from './Logger'
import { DevFormatter, JsonFormatter } from './formatters'
import { ConsoleSink } from './sink'

export const createRootLogger = (context: Record<string, unknown> = {}): Logger => {
  const formatter: Formatter =
    process.env.LOG_FORMAT === 'json'
      ? new JsonFormatter()
      : process.env.LOG_FORMAT === 'dev'
        ? new DevFormatter()
        : process.env.NODE_ENV === 'production'
          ? new JsonFormatter()
          : new DevFormatter()

  const sink: Sink = new ConsoleSink()

  const parseLevel = (raw: string | undefined): LogLevel => {
    switch (raw?.toLowerCase()) {
      case 'debug':
        return 'debug'
      case 'info':
        return 'info'
      case 'warn':
        return 'warn'
      case 'error':
        return 'error'
      default:
        return 'info'
    }
  }

  const minLevel: LogLevel = parseLevel(process.env.LOG_LEVEL)

  return new Logger('Bootstrap', new LoggerContext(context), formatter, sink, minLevel)
}
