import { valita } from '@cms/utils/valita'

export type SortOrder = 'asc' | 'desc'

export const conditionSchema = valita.union(
  valita.literal('eq'),
  valita.literal('neq'),
  valita.literal('like'),
)
export type ParentCondition = valita.Infer<typeof conditionSchema>

export function parentDescriptorSchema<TTable extends string, TColumn extends string>(
  tableSchema: valita.Type<TTable>,
  columnSchema: valita.Type<TColumn>,
) {
  return valita.object({
    table: tableSchema,
    column: columnSchema,
    value: valita.string(),
    condition: conditionSchema.optional(),
  })
}

export type ParentDescriptor<TTable extends string, TColumn extends string> = {
  table: TTable
  column: TColumn
  value: string
  condition?: ParentCondition
}

export type GetByParentOptionsBase<TOrderField extends string> = {
  order?: { field: TOrderField; order: SortOrder }
  locale?: string
} & ({ limit?: undefined; offset?: undefined } | { limit: number; offset?: number })

export class InvalidIdentifierError extends Error {}

export function parseIdentifier<T>(
  schema: valita.Type<T>,
  value: unknown,
  label: string,
): T {
  try {
    return schema.parse(value)
  } catch (e) {
    if (e instanceof valita.ValitaError) {
      throw new InvalidIdentifierError(`Invalid ${label}: ${e.message}`)
    }
    throw e
  }
}

export type ChildJoinSpec = {
  childTable: string
  childAlias: string
  joinTable: string
  joinAlias: string
  joinChildKey: string
}

export type BuildQueryInput = {
  child: ChildJoinSpec
  selectColumns: string
  parentTable: string
  parentColumn: string
  condition: 'eq' | 'neq' | 'like'
  parentId: string
  extraWhere?: { sql: string; params: unknown[] }
  orderBy: string
  limit?: number
  offset?: number
  localeJoins?: { sql: string; params: unknown[] }
}

const conditionToSql = (c: 'eq' | 'neq' | 'like'): string =>
  c === 'eq' ? '=' : c === 'neq' ? '!=' : 'LIKE'

export function buildGetByParentQuery(input: BuildQueryInput): { sql: string; params: unknown[] } {
  const { child, parentTable, parentColumn, condition } = input
  const op = conditionToSql(condition)

  const params: unknown[] = []
  const lines: string[] = [
    `SELECT ${input.selectColumns}`,
    `  FROM ${child.childTable} ${child.childAlias}`,
    `  JOIN ${child.joinTable} ${child.joinAlias} ON ${child.joinAlias}.${child.joinChildKey} = ${child.childAlias}.id`,
  ]

  if (input.localeJoins) {
    lines.push(input.localeJoins.sql)
    params.push(...input.localeJoins.params)
  }

  const whereClauses = [`${child.joinAlias}.parentTable = ?`]
  params.push(parentTable)

  if (parentColumn === 'id') {
    whereClauses.push(`${child.joinAlias}.parentId ${op} ?`)
    params.push(input.parentId)
  } else {
    lines.push(`  JOIN ${parentTable} parent ON parent.id = ${child.joinAlias}.parentId`)
    whereClauses.push(`parent.${parentColumn} ${op} ?`)
    params.push(input.parentId)
  }

  if (input.extraWhere) {
    whereClauses.push(input.extraWhere.sql)
    params.push(...input.extraWhere.params)
  }

  lines.push(` WHERE ${whereClauses.join(' AND ')}`)
  lines.push(` ORDER BY ${input.orderBy}`)

  if (input.limit !== undefined) {
    lines.push(' LIMIT ?')
    params.push(input.limit)
    if (input.offset !== undefined) {
      lines.push(' OFFSET ?')
      params.push(input.offset)
    }
  }

  return { sql: lines.join('\n'), params }
}

export function sqlOrder(order: SortOrder): 'ASC' | 'DESC' {
  return order === 'asc' ? 'ASC' : 'DESC'
}
