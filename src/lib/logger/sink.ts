import type { LogLevel, Sink } from './Logger'

export class ConsoleSink implements Sink {
  write(level: LogLevel, line: string): void {
    switch (level) {
      case 'error':
        console.error(line)
        return
      case 'warn':
        console.warn(line)
        return
      default:
        console.info(line)
    }
  }
}
