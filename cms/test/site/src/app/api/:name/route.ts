import {
  getParams,
  getRequest,
  getUrl,
  notFound,
  redirect,
  type Context,
} from '@reeywhaar/bananacms'

export async function GET(ctx: Context) {
  const { name } = getParams<{ name: string }>(ctx)
  if (name === 'missing') notFound()
  if (name === 'old') redirect('/api/new')
  return Response.json({ name, q: getUrl(ctx).searchParams.get('q') })
}

export async function POST(ctx: Context) {
  return new Response(`${getParams(ctx).name} got ${await getRequest(ctx).text()}`)
}
