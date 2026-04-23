import { getEntityDescriptor } from '@cms/lib/entities'
import { notFound } from 'next/navigation'

export default async function EntityShow({
  params,
}: {
  params: Promise<{ entity: string; id: string }>
}) {
  const { entity, id } = await params
  const entityDescriptor = getEntityDescriptor(entity)
  if (!entityDescriptor || !entityDescriptor.show) notFound()
  return <entityDescriptor.show id={id} />
}
