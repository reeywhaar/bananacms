import { createBuilder } from 'vite'
import { createViteConfig } from './vite-config.ts'

export async function build(root: string): Promise<void> {
  // builds all three environments (rsc, ssr, client) into dist/
  const builder = await createBuilder(createViteConfig(root))
  await builder.buildApp()
}
