import { getEntityDescriptor } from '@cms/lib/entities'
import { notFound } from 'next/navigation'

export default async function EntityAdd({ params }: { params: Promise<{ entity: string }> }) {
  const p = await params
  const entityDescriptor = getEntityDescriptor(p.entity)
  if (!entityDescriptor) notFound()

  return <entityDescriptor.editor />
}
