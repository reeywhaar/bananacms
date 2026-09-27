import type { ServerMiddleware } from 'srvx'
import { staticMiddleware } from 'srvx/static'

// The directory of a build's client files that Vite writes its own to: the JS, the
// CSS, the fonts and the images, each named with a hash of its content. A site's
// public/assets/ leaves it to the build.
export const BUILD_ASSETS_DIR = 'assets/build'

// A year, as long as a browser keeps a file
const YEAR = 365 * 24 * 60 * 60

// A build's client files and the site's public ones, as `start` serves them. A
// file in BUILD_ASSETS_DIR gets another name when its content changes, so a
// browser keeps it for a year without asking again. The others keep their names,
// like a site's public/assets/logo.png, so a browser checks them with the server.
export function clientFilesMiddleware(dir: string): ServerMiddleware {
  const hashed = staticMiddleware({ dir, maxAge: YEAR, immutable: true })
  const others = staticMiddleware({ dir })
  const prefix = `/${BUILD_ASSETS_DIR}/`
  return (request, next) =>
    (new URL(request.url).pathname.startsWith(prefix) ? hashed : others)(request, next)
}
