// A WAV of silence, mono 16-bit at 8 kHz, `seconds` long, with no tags: an audio
// file a test can tag without a fixture on disk
export function silentWav(seconds = 1): Uint8Array {
  const sampleRate = 8000
  const dataBytes = sampleRate * 2 * seconds
  const view = new DataView(new ArrayBuffer(44 + dataBytes))
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i))
  }
  ascii(0, 'RIFF')
  view.setUint32(4, 36 + dataBytes, true)
  ascii(8, 'WAVE')
  ascii(12, 'fmt ')
  view.setUint32(16, 16, true) // the format chunk's size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // one channel
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // bytes a second
  view.setUint16(32, 2, true) // bytes a frame
  view.setUint16(34, 16, true) // bits a sample
  ascii(36, 'data')
  view.setUint32(40, dataBytes, true)
  return new Uint8Array(view.buffer)
}
