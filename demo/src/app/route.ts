import { redirect, type Context } from '@reeywhaar/bananacms'
import { getPreferredLocale } from '@app/lib/locale.ts'

// / goes on to the home page in the language the browser asks for first
export function GET(ctx: Context): Response {
  redirect(`/${getPreferredLocale(ctx)}`)
}
