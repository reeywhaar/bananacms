import { expect, it } from 'vitest'
import { silentWav } from '#cms/test/audio.ts'
import { readAudioMeta } from './audioMeta.ts'
import { writeAudioTags } from './audioTags.ts'

const read = async (data: Uint8Array) => readAudioMeta(Buffer.from(data), 'audio/wav')

it('writes the tags into the file, which reads them back, and its sound stays', async () => {
  const tagged = await writeAudioTags(silentWav(2), {
    title: 'Coastal Service',
    artist: 'Vyrtsev Mikhail',
    album: 'Songs',
    year: 2026,
  })
  const meta = await read(tagged)
  expect(meta?.tags).toEqual({
    title: 'Coastal Service',
    artist: 'Vyrtsev Mikhail',
    album: 'Songs',
    year: 2026,
  })
  expect(meta?.duration).toBeCloseTo(2, 1)
})

it('keeps what an edit leaves out, and clears what it empties', async () => {
  const tagged = await writeAudioTags(silentWav(), {
    title: 'Coastal Service',
    artist: 'Vyrtsev Mikhail',
    year: 2026,
  })
  const edited = await writeAudioTags(tagged, { title: 'Renamed', artist: '', year: 0 })
  expect((await read(edited))?.tags).toEqual({ title: 'Renamed' })
})
