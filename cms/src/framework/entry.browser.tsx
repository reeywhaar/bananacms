import {
  createFromReadableStream,
  createFromFetch,
  setServerCallback,
  createTemporaryReferenceSet,
  encodeReply,
} from '@vitejs/plugin-rsc/browser'
import React from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import { rscStream } from 'rsc-html-stream/client'
import type { RscPayload } from './entry.rsc.tsx'
import {
  DefaultGlobalError,
  ErrorBoundary,
  type ErrorComponent,
  type ErrorPageProps,
} from './error-boundary.tsx'
import { NavigationContext, RouterContext, type Router } from './navigation.ts'
import { createRscRenderRequest, isAssetPath, isManagePath } from './request.ts'

async function main() {
  // stash `setPayload` and `startTransition` to trigger re-rendering
  // from outside of `BrowserRoot` component (e.g. server function call, navigation, hmr)
  let setPayload: (v: RscPayload) => void
  let startTransition: React.TransitionStartFunction

  // deserialize RSC stream back to React VDOM for CSR
  const initialPayload = await createFromReadableStream<RscPayload>(
    // initial RSC stream is injected in SSR stream as <script>...FLIGHT_DATA...</script>
    rscStream,
  )

  // Where the page back or forward brings back was scrolled to, from its history
  // entry, for BrowserRoot to return to once it's on screen; on a reload, the
  // page's own
  let restoreScroll: Scroll | undefined = history.state?.scroll

  // what useRouter() returns
  const router: Router = {
    push: (href) => navigate(href, 'push'),
    replace: (href) => navigate(href, 'replace'),
    refresh: () => fetchRscPayload(),
    back: () => history.back(),
  }

  // browser root component to (re-)render RSC payload as state
  function BrowserRoot() {
    const [payload, setPayload_] = React.useState(initialPayload)
    const [isPending, startTransition_] = React.useTransition()
    const shownPathname = React.useRef(payload.pathname)

    // A page with a new path starts at its top, or at the element its URL's hash
    // names, and one that back or forward brings back where it was left. The
    // same page, refreshed or rendered again by an action, stays as it's
    // scrolled.
    React.useLayoutEffect(() => {
      const restore = restoreScroll
      restoreScroll = undefined
      if (restore) window.scrollTo(restore.x, restore.y)
      else if (payload.pathname !== shownPathname.current) scrollToHashOrTop()
      shownPathname.current = payload.pathname
    }, [payload])

    React.useEffect(() => {
      setPayload = (v) => startTransition_(() => setPayload_(v))
      startTransition = startTransition_
    }, [setPayload_, startTransition_])

    // re-fetch/render on client side navigation
    React.useEffect(() => {
      return listenNavigation((scroll) => {
        restoreScroll = scroll
        fetchRscPayload()
      })
    }, [])

    // client components read these through the hooks in navigation.ts
    return (
      <RouterContext value={router}>
        <NavigationContext
          value={{ isPending, pathname: payload.pathname, search: payload.search }}
        >
          <ErrorBoundary errorComponent={GlobalError}>{payload.root}</ErrorBoundary>
        </NavigationContext>
      </RouterContext>
    )
  }

  // the latest request updates the page, so the newest navigation
  // wins over a slow earlier response
  let latestRequestId = 0
  // the root layout of the page on screen
  let rootLayout = initialPayload.rootLayout

  // re-fetch RSC and trigger re-rendering.
  // the fetch runs inside the transition, so `isPending` also covers the round trip.
  function fetchRscPayload() {
    const requestId = ++latestRequestId
    startTransition(async () => {
      const renderRequest = createRscRenderRequest(window.location.href)
      const payload = await createFromFetch<RscPayload>(fetch(renderRequest))
      if (requestId !== latestRequestId) return
      // middleware redirected this navigation, so it goes on to the target instead
      if (payload.redirect) navigate(payload.redirect, 'replace')
      // the URL, already in the address bar, isn't a page, or its page has another
      // root layout
      else if (payload.document || payload.rootLayout !== rootLayout) location.reload()
      else setPayload(payload)
    })
  }

  // register a handler which will be internally called by React
  // on server function request after hydration.
  setServerCallback(async (id, args) => {
    const requestId = ++latestRequestId
    const temporaryReferences = createTemporaryReferenceSet()
    const renderRequest = createRscRenderRequest(window.location.href, {
      id,
      body: await encodeReply(args, { temporaryReferences }),
    })
    const payload = await createFromFetch<RscPayload>(fetch(renderRequest), {
      temporaryReferences,
    })
    if (requestId === latestRequestId) {
      // the action called redirect(): its page comes from the target's own request
      if (payload.redirect) navigate(payload.redirect, 'push')
      else setPayload(payload)
    }
    const { ok, data } = payload.returnValue ?? { ok: true, data: undefined }
    if (!ok) throw data
    return data
  })

  // hydration
  const browserRoot = (
    <React.StrictMode>
      <BrowserRoot />
    </React.StrictMode>
  )
  if ('__NO_HYDRATE' in globalThis) {
    createRoot(document).render(browserRoot)
  } else {
    hydrateRoot(document, browserRoot, {
      formState: initialPayload.formState,
    })
  }

  // implement server HMR by triggering re-fetch/render of RSC upon server code change
  if (import.meta.hot) {
    import.meta.hot.on('rsc:update', () => {
      fetchRscPayload()
    })
  }
}

// the site's src/app/global-error.tsx, loaded once an error reaches it
const loadSiteGlobalError = Object.values(
  import.meta.glob<{ default: ErrorComponent }>('/src/app/global-error.tsx'),
)[0]
const SiteGlobalError = loadSiteGlobalError && React.lazy(loadSiteGlobalError)

// In place of the whole document, for an error no error.tsx catches: the site's
// global-error.tsx on its pages, and a plain page for /manage or a site without one.
function GlobalError(props: ErrorPageProps) {
  if (!SiteGlobalError || isManagePath(location.pathname)) return <DefaultGlobalError {...props} />
  return (
    <React.Suspense
      fallback={
        <html>
          <body />
        </html>
      }
    >
      <SiteGlobalError {...props} />
    </React.Suspense>
  )
}

// Navigates within the app the page is in (the site, or /manage) through the
// history methods listenNavigation patches, and to anywhere else with a full page
// load, since the apps have their own layouts and styles; to an uploaded file too,
// which isn't a page.
function navigate(href: string, mode: 'push' | 'replace') {
  const url = new URL(href, location.href)
  if (
    url.origin !== location.origin ||
    isAssetPath(url.pathname) ||
    isManagePath(url.pathname) !== isManagePath(location.pathname)
  ) {
    if (mode === 'push') location.assign(url)
    else location.replace(url)
  } else if (mode === 'push') {
    history.pushState(null, '', url)
  } else {
    history.replaceState(null, '', url)
  }
}

type Scroll = { x: number; y: number }

// the element the URL's hash names, or else the top of the page
function scrollToHashOrTop() {
  const id = decodeURIComponent(location.hash.slice(1))
  const target = id ? document.getElementById(id) : null
  if (target) target.scrollIntoView()
  else window.scrollTo(0, 0)
}

// A little helper to set up events interception for client side navigation. Back
// and forward call onNavigation with where their page was scrolled to: each
// history entry keeps that in its state, saved as a page is left.
function listenNavigation(onNavigation: (scroll?: Scroll) => void) {
  // the browser would scroll right away, over the page being left
  history.scrollRestoration = 'manual'

  const oldPushState = window.history.pushState
  const oldReplaceState = window.history.replaceState
  const saveScroll = () =>
    oldReplaceState.call(history, { ...history.state, scroll: { x: scrollX, y: scrollY } }, '')
  const onPopState = () => onNavigation(history.state?.scroll)
  window.addEventListener('popstate', onPopState)
  // for a reload, and a return from another site
  window.addEventListener('pagehide', saveScroll)

  window.history.pushState = function (...args) {
    saveScroll()
    const res = oldPushState.apply(this, args)
    onNavigation()
    return res
  }

  window.history.replaceState = function (...args) {
    const res = oldReplaceState.apply(this, args)
    onNavigation()
    return res
  }

  function onClick(e: MouseEvent) {
    let link = (e.target as Element).closest('a')
    if (
      link &&
      link instanceof HTMLAnchorElement &&
      link.href &&
      (!link.target || link.target === '_self') &&
      link.origin === location.origin &&
      !link.hasAttribute('download') &&
      e.button === 0 && // left clicks only
      !e.metaKey && // open in new tab (mac)
      !e.ctrlKey && // open in new tab (windows)
      !e.altKey && // download
      !e.shiftKey &&
      !e.defaultPrevented &&
      // the site and /manage are separate apps (own layout and styles): switch with a full load
      isManagePath(link.pathname) === isManagePath(location.pathname) &&
      // an uploaded file, like a PDF, isn't a page
      !isAssetPath(link.pathname) &&
      // a link to a part of this page is the browser's to follow
      !(link.hash && link.pathname === location.pathname && link.search === location.search)
    ) {
      e.preventDefault()
      history.pushState(null, '', link.href)
    }
  }
  document.addEventListener('click', onClick)

  return () => {
    document.removeEventListener('click', onClick)
    window.removeEventListener('popstate', onPopState)
    window.removeEventListener('pagehide', saveScroll)
    window.history.pushState = oldPushState
    window.history.replaceState = oldReplaceState
  }
}

main()
