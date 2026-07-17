import { NextResponse } from 'next/server'

export type ByteRange = { start: number; end: number }

/**
 * Parse a single-range HTTP `Range` header against a known total size.
 * Browsers only ever send the single-range form, so multipart is not handled.
 *
 * Returns an inclusive `{ start, end }` for a satisfiable range, the string
 * `'unsatisfiable'` when the range is well-formed but out of bounds (→ 416),
 * or `null` when there is no range or it is malformed (→ serve the full 200).
 */
export function parseRange(
  header: string | null,
  size: number,
): ByteRange | 'unsatisfiable' | null {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return null
  const [, startStr, endStr] = match

  if (startStr === '') {
    // suffix range: the final `endStr` bytes
    if (endStr === '') return null
    const suffix = Number(endStr)
    if (suffix === 0) return 'unsatisfiable'
    return { start: Math.max(0, size - suffix), end: size - 1 }
  }

  const start = Number(startStr)
  if (start >= size) return 'unsatisfiable'
  const end = endStr === '' ? size - 1 : Math.min(Number(endStr), size - 1)
  if (start > end) return null
  return { start, end }
}

type RangeResponseInit = {
  range: string | null
  size: number
  headers: Record<string, string>
  /** Produce the body for the inclusive byte range `[start, end]`. */
  body: (start: number, end: number) => BodyInit
}

/**
 * Build a `Response` that honors an HTTP `Range` header:
 *   - no / malformed range → `200` full body with `Accept-Ranges: bytes`
 *   - satisfiable range     → `206` with `Content-Range` and a sliced body
 *   - out-of-bounds range   → `416` with `Content-Range: bytes *\/total`
 */
export function rangeResponse({ range, size, headers, body }: RangeResponseInit): NextResponse {
  const parsed = parseRange(range, size)

  if (parsed === 'unsatisfiable') {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes */${size}` },
    })
  }

  if (parsed) {
    const { start, end } = parsed
    return new NextResponse(body(start, end), {
      status: 206,
      headers: {
        ...headers,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  return new NextResponse(body(0, size - 1), {
    status: 200,
    headers: { ...headers, 'Accept-Ranges': 'bytes', 'Content-Length': String(size) },
  })
}
