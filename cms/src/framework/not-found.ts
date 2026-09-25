const NOT_FOUND = Symbol.for('cms.not-found')

// Like Next's notFound(): call it from a page to render src/app/not-found.tsx
// instead (with a 404 status on the initial HTML load).
export function notFound(): never {
  throw Object.assign(new Error('Not found'), { [NOT_FOUND]: true })
}

export function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && NOT_FOUND in error
}
