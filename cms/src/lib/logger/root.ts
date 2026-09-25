import { Logger, type Formatter, type LogFields, type LogLevel } from './Logger.ts'
import { DevFormatter, JsonFormatter } from './formatters.ts'
import { ConsoleSink } from './sink.ts'

// A logger with no labels, writing to the console. LOG_FORMAT picks the format
// ('json' or 'dev'; production defaults to json), and LOG_LEVEL the lowest level
// that's written (default: info).
export function createRootLogger(fields: LogFields = {}): Logger {
  const formatter: Formatter =
    process.env.LOG_FORMAT === 'json'
      ? new JsonFormatter()
      : process.env.LOG_FORMAT === 'dev'
        ? new DevFormatter()
        : process.env.NODE_ENV === 'production'
          ? new JsonFormatter()
          : new DevFormatter()

  return new Logger(
    { formatter, sink: new ConsoleSink(), minLevel: parseLevel(process.env.LOG_LEVEL) },
    fields,
  )
}

function parseLevel(raw: string | undefined): LogLevel {
  const level = raw?.toLowerCase()
  return level === 'debug' || level === 'info' || level === 'warn' || level === 'error'
    ? level
    : 'info'
}
