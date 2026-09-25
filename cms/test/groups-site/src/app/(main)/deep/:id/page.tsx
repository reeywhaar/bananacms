import { notFound, type Metadata, type PageProps } from '@reeywhaar/bananacms'

type Props = PageProps<{ id: string }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (id === 'missing') notFound()
  return { title: `Deep ${id}` }
}

export default async function DeepPage({ params }: Props) {
  const { id } = await params
  if (id === 'gone') notFound()
  return <h1>Deep {id}</h1>
}
