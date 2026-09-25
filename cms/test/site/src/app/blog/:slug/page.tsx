import type { Metadata, PageProps, ResolvingMetadata } from '@reeywhaar/bananacms'
import { Suspense } from 'react'

type Props = PageProps<{ slug: string }>

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { slug } = await params
  if (slug === 'meta-broken') throw new Error('Expected: the metadata broke')
  return { title: slug, description: `${(await parent).description} and ${slug}` }
}

export default async function BlogPost({ params }: Props) {
  const { slug } = await params
  if (slug === 'broken') throw new Error('Expected: the post broke')
  if (slug === 'deep') {
    return (
      <Suspense fallback={<p>Loading</p>}>
        <Deep />
      </Suspense>
    )
  }
  return <h1>{slug}</h1>
}

async function Deep(): Promise<never> {
  throw new Error('Expected: a part of the post broke')
}
