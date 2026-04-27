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
  TRow extends { id: string },
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

  /**
   * Apply a transformation to this query. Lets callers branch on conditions
   * inside a fluent chain without breaking it:
   *
   *   postStore.query()
   *     .inCategory({ id })
   *     .map((q) => loggedIn ? q : q.published())
   *     .limit(20)
   *     .all()
   */
  map(fn: (q: this) => this): this {
    return fn(this)
  }

  abstract all(): Promise<TRow[]>
  abstract count(): Promise<number>

  async first(): Promise<TRow | null> {
    const rows = await this.clone({ limit: 1, offset: 0 } as Partial<TState>).all()
    return rows[0] ?? null
  }

  /**
   * Run the query and return rows keyed by `id`. Honors the same limit/offset
   * /predicates as `.all()`. If two rows share the same id (shouldn't happen
   * for entity reads), the later one wins.
   */
  async dict(): Promise<Record<string, TRow>> {
    const rows = await this.all()
    const result: Record<string, TRow> = {}
    for (const row of rows) result[row.id] = row
    return result
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
