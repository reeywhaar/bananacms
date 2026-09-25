'use client'

import React from 'react'
import { usePathname, useRouter, type Router } from './navigation.ts'

// What an error.tsx or global-error.tsx gets, as in Next: the error, `reset()`,
// which renders what threw again, and `unstable_retry()`, which fetches the page
// from the server again first. An error from a server component keeps its message
// in development. In production its message is a generic one, and its `digest` is
// the request's trace id, which finds the error in the server's log.
export type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
  unstable_retry: () => void
}

export type ErrorComponent = React.ComponentType<ErrorPageProps>

// Shows `errorComponent` in place of its children when they throw, as Next's
// boundary around a folder's content does (app.tsx), and clears itself when the
// path changes. Around the whole document, it shows global-error.tsx
// (entry.browser.tsx).
export function ErrorBoundary(props: {
  errorComponent: ErrorComponent
  children?: React.ReactNode
}) {
  return (
    <ErrorBoundaryHandler
      pathname={usePathname()}
      router={useRouter()}
      errorComponent={props.errorComponent}
    >
      {props.children}
    </ErrorBoundaryHandler>
  )
}

type HandlerProps = {
  pathname: string
  router: Router
  errorComponent: ErrorComponent
  children?: React.ReactNode
}

type HandlerState = { error: Error | null; pathname: string }

// https://react.dev/reference/react/Component#catching-rendering-errors-with-an-error-boundary
class ErrorBoundaryHandler extends React.Component<HandlerProps, HandlerState> {
  state: HandlerState = { error: null, pathname: this.props.pathname }

  static getDerivedStateFromError(error: Error): Partial<HandlerState> {
    return { error }
  }

  static getDerivedStateFromProps(props: HandlerProps, state: HandlerState): HandlerState {
    // a navigation to another path shows that page instead
    if (props.pathname !== state.pathname) return { error: null, pathname: props.pathname }
    return state
  }

  reset = () => {
    this.setState({ error: null })
  }

  retry = () => {
    React.startTransition(() => {
      this.props.router.refresh()
      this.reset()
    })
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    const ErrorPage = this.props.errorComponent
    return <ErrorPage error={error} reset={this.reset} unstable_retry={this.retry} />
  }
}

// global-error.tsx for a site that has none, and for /manage
export function DefaultGlobalError(props: ErrorPageProps) {
  return (
    <html>
      <head>
        <title>Unexpected Error</title>
      </head>
      <body
        style={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          placeContent: 'center',
          placeItems: 'center',
          fontSize: '16px',
          fontWeight: 400,
          lineHeight: '24px',
        }}
      >
        <p>Caught an unexpected error</p>
        <pre>Error: {import.meta.env.DEV ? props.error.message : '(Unknown)'}</pre>
        <button onClick={props.unstable_retry}>Try again</button>
      </body>
    </html>
  )
}
