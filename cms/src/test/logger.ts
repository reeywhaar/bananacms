import { Logger, type LogEntry, type LogLevel } from '../lib/logger/Logger.ts'

// a root logger that keeps its entries instead of writing them
export function captureLogger(minLevel: LogLevel = 'debug') {
  const entries: LogEntry[] = []
  const logger = new Logger({
    formatter: { format: (entry) => (entries.push(entry), '') },
    sink: { write: () => {} },
    minLevel,
  })
  return { logger, entries }
}
