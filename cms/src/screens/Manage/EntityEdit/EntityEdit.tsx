import type { Context } from '../../../framework/context.ts'
import { getEntityDescriptor } from '../../../lib/entities.ts'
import { notFound } from '../../../framework/not-found.ts'

export default async function EntityEdit({
  ctx,
  params,
}: {
  ctx: Context
  params: Promise<{ entity: string; id: string }>
}) {
  const p = await params
  const entityDescriptor = getEntityDescriptor(p.entity)
  if (!entityDescriptor) notFound()

  return <entityDescriptor.editor ctx={ctx} id={p.id} />
}
