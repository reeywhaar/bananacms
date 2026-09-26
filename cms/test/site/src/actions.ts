'use server'

import { defineAction } from '@reeywhaar/bananacms'

// does nothing: the tests post it to pages, signed out, to see what comes after
export const touch = defineAction(async () => {}, { public: true })

// a server function that isn't public, so a visitor without a session can't run it
export async function boom(): Promise<void> {
  throw new Error('boom ran')
}
