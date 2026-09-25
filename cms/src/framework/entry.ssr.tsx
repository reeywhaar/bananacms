import { createFromReadableStream, getClientEntryUrl } from '@vitejs/plugin-rsc/ssr'
import React from 'react'
import type { ReactFormState } from 'react-dom/client'
import { renderToReadableStream } from 'react-dom/server.edge'
import { injectRSCPayload } from 'rsc-html-stream/server'
import type { RscPayload } from './entry.rsc.tsx'
import { NavigationContext } from './navigation.ts'

export async function renderHTML(
  rscStream: ReadableStream<Uint8Array>,
  options: {
    formState?: ReactFormState
    nojs?: boolean
    // called with errors thrown while rendering the HTML
    onError?: (error: unknown) => void
  },
): Promise<{ stream: ReadableStream<Uint8Array>; status?: number }> {
  // duplicate one RSC stream into two.
  // - one for SSR (ReactClient.createFromReadableStream below)
  // - another for browser hydration payload by injecting <script>...FLIGHT_DATA...</script>.
  const [rscStream1, rscStream2] = rscStream.tee()

  // deserialize RSC stream back to React VDOM
  let payload: Promise<RscPayload> | undefined
  function SsrRoot() {
    // deserialization needs to be kicked off inside ReactDOMServer context
    // for ReactDomServer preinit/preloading to work
    payload ??= createFromReadableStream<RscPayload>(rscStream1)
    const { root, pathname, search } = React.use(payload)
    return (
      <NavigationContext value={{ isPending: false, pathname, search }}>{root}</NavigationContext>
    )
  }

  // render html (traditional SSR).
  // the shell is sent as soon as it's ready; each <Suspense> boundary streams in later.
  const bootstrapScriptContent = `import(${JSON.stringify(getClientEntryUrl())})`
  let htmlStream: ReadableStream<Uint8Array>
  let status: number | undefined
  try {
    const stream = await renderToReadableStream(<SsrRoot />, {
      bootstrapScriptContent: options.nojs ? undefined : bootstrapScriptContent,
      formState: options.formState,
      onError: options.onError,
      // React streams a boundary bigger than this out of place, with a script to
      // put it in, even one that's ready with the shell
      progressiveChunkSize: options.nojs ? Number.POSITIVE_INFINITY : undefined,
    })
    if (options.nojs) {
      // Streamed Suspense content is swapped into place by inline scripts,
      // which need JavaScript. So wait for every boundary, and the whole
      // document goes out in order.
      await stream.allReady
    }
    htmlStream = stream
  } catch (e) {
    // fallback to render an empty shell and run pure CSR on browser,
    // which can replay server component error and trigger error boundary.
    status = 500
    htmlStream = await renderToReadableStream(
      <html>
        <body>
          <noscript>Internal Server Error: SSR failed</noscript>
        </body>
      </html>,
      {
        bootstrapScriptContent:
          `self.__NO_HYDRATE=1;` + (options.nojs ? '' : bootstrapScriptContent),
      },
    )
  }

  let responseStream: ReadableStream<Uint8Array> = htmlStream
  if (!options.nojs) {
    // initial RSC stream is injected in HTML stream as <script>...FLIGHT_DATA...</script>
    // using utility made by devongovett https://github.com/devongovett/rsc-html-stream
    responseStream = responseStream.pipeThrough(injectRSCPayload(rscStream2))
  }

  return { stream: responseStream, status }
}
