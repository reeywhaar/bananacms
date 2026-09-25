import { notFound, redirect, type Metadata, type PageProps } from '@reeywhaar/bananacms'
import { touch } from '../../../actions.ts'

type Props = PageProps<{ id: string }>

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (id === 'missing') notFound()
  if (id === 'old') redirect('/posts/new')
  return { title: `Post ${id}` }
}

export default async function PostPage({ params }: Props) {
  const { id } = await params
  // after its metadata has resolved
  if (id === 'gone') notFound()
  return (
    <>
      <h1>Post {id}</h1>
      <form action={touch}>
        <button>Touch</button>
      </form>
    </>
  )
}
