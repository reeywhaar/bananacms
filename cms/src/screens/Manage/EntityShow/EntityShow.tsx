import type { Context } from '../../../framework/context.ts'
import { getEntityDescriptor } from '../../../lib/entities.ts'
import { notFound } from '../../../framework/not-found.ts'

export default async function EntityShow({
  ctx,
  params,
}: {
  ctx: Context
  params: Promise<{ entity: string; id: string }>
}) {
  const { entity, id } = await params
  const entityDescriptor = getEntityDescriptor(entity)
  if (!entityDescriptor || !entityDescriptor.show) notFound()
  return <entityDescriptor.show ctx={ctx} id={id} />
}
