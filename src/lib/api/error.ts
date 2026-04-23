export class ApiError extends Error {
  rawStatus?: number
  rawExposed?: boolean

  constructor(message: string) {
    super(message)
    this.name = 'ApiError'
  }

  get status(): number {
    return this.rawStatus || 500
  }

  get exposed(): boolean {
    return this.rawExposed || false
  }

  withStatus(status: number): this {
    this.rawStatus = status
    return this
  }

  expose(): this {
    this.rawExposed = true
    return this
  }
}
