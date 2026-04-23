import { getEntityDescriptor } from '@cms/lib/entities'
import { notFound } from 'next/navigation'

export default async function EntityEdit({
  params,
}: {
  params: Promise<{ entity: string; id: string }>
}) {
  const p = await params
  const entityDescriptor = getEntityDescriptor(p.entity)
  if (!entityDescriptor) notFound()

  return <entityDescriptor.editor id={p.id} />
}
