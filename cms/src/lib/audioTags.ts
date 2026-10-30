import { applyTags } from 'taglib-wasm/simple'
import type { AudioTagEdits } from './audioMeta.ts'

// Writes `edits` into an audio file's own tags, ID3 in an MP3, atoms in an M4A and
// so on, which a player shows once the file is downloaded, and gives back the file
// as it is then. TagLib, compiled to WebAssembly, does it on the server only, with
// the one file in memory, as an upload has it.
export async function writeAudioTags(data: Uint8Array, edits: AudioTagEdits): Promise<Uint8Array> {
  return await applyTags(data, {
    ...(edits.title !== undefined && { title: edits.title }),
    ...(edits.artist !== undefined && { artist: edits.artist }),
    ...(edits.album !== undefined && { album: edits.album }),
    ...(edits.year !== undefined && { year: edits.year }),
  })
}
