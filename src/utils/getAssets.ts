import { readdir } from 'node:fs/promises'

export const getAssets = async (dir: string) => {
  return (await readdir(`./public/assets/${dir}`)).map((f) => `/assets/${dir}/${f}`)
}
