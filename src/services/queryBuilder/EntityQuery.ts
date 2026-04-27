import { type SQL } from 'drizzle-orm'
import { type Db } from '@cms/lib/db/client'

export type SortOrder = 'asc' | 'desc'

export type BaseQueryState<TOrderField extends string> = {
  predicates: SQL[]
  locale?: string
  order?: { field: TOrderField; direction: SortOrder }
  limit?: number
  offset?: number
}

export type Page<TRow> = {
  rows: TRow[]
  total: number
}

export abstract class EntityQuery<
  TRow,
  TOrderField extends string,
  TState extends BaseQueryState<TOrderField>,
> {
  protected constructor(
    protected readonly db: Db,
    protected readonly state: Readonly<TState>,
  ) {}

  limit(n: number): this {
    return this.clone({ limit: n } as Partial<TState>)
  }

  offset(n: number): this {
    return this.clone({ offset: n } as Partial<TState>)
  }

  locale(code: string): this {
    return this.clone({ locale: code } as Partial<TState>)
  }

  orderBy(field: TOrderField, direction: SortOrder = 'asc'): this {
    return this.clone({ order: { field, direction } } as Partial<TState>)
  }

  abstract all(): Promise<TRow[]>
  abstract count(): Promise<number>

  async first(): Promise<TRow | null> {
    const rows = await this.clone({ limit: 1, offset: 0 } as Partial<TState>).all()
    return rows[0] ?? null
  }

  async paginate(opts: { limit: number; offset?: number }): Promise<Page<TRow>> {
    const offset = opts.offset ?? 0
    const limited = this.clone({ limit: opts.limit, offset } as Partial<TState>)
    const [rows, total] = await Promise.all([limited.all(), this.count()])
    return { rows, total }
  }

  protected addPredicate(predicate: SQL): this {
    return this.clone({
      predicates: [...this.state.predicates, predicate],
    } as Partial<TState>)
  }

  protected abstract clone(patch: Partial<TState>): this
}
