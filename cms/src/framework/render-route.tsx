import type { ReactNode } from 'react'
import { ClientRedirect } from './client-redirect.tsx'
import { setResponseRedirect, setResponseStatus, type Context } from './context.ts'
import { isNotFoundError } from './not-found.ts'
import { redirectTarget } from './redirect.ts'

// Renders a page by calling it, so a notFound() or redirect() from the page's own
// body lands here: the not-found page renders in its place, or a ClientRedirect.
// Both also set the status or redirect of the HTML response, which entry.rsc.tsx
// sends once everything outside Suspense boundaries, this included, has rendered.
export async function renderRoute(
  ctx: Context,
  render: () => ReactNode | Promise<ReactNode>,
  renderNotFound: () => ReactNode,
): Promise<ReactNode> {
  try {
    return await render()
  } catch (error) {
    if (isNotFoundError(error)) {
      setResponseStatus(ctx, 404)
      return renderNotFound()
    }
    const target = redirectTarget(error)
    if (target) {
      setResponseRedirect(ctx, target)
      return <ClientRedirect url={target.url} />
    }
    throw error
  }
}
