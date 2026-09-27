import type { Context } from '#cms/framework/context.ts'
import { getEntityDescriptor } from '#cms/lib/entities.ts'
import { notFound } from '#cms/framework/not_found.ts'

export default async function EntityAdd({
  ctx,
  params,
}: {
  ctx: Context
  params: Promise<{ entity: string }>
}) {
  const p = await params
  const entityDescriptor = getEntityDescriptor(p.entity)
  if (!entityDescriptor) notFound()

  return <entityDescriptor.editor ctx={ctx} />
}
