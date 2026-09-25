import { getUrl, type Context, type Metadata } from '@reeywhaar/bananacms'

export const metadata: Metadata = { title: '404 | Groups' }

// for URLs with no route: the whole document, since no layout wraps it
export default function GlobalNotFound({ ctx }: { ctx: Context }) {
  return (
    <html lang="en">
      <body>
        <h1>Nothing anywhere</h1>
        <p>No page at {getUrl(ctx).pathname}</p>
      </body>
    </html>
  )
}
