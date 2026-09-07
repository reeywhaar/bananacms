import { describe, expect, it } from 'vitest'
import {
  audioTitle,
  describeAudio,
  formatChannels,
  formatDuration,
  formatSampleRate,
  readAudioMeta,
} from './audioMeta'

/** A minimal PCM WAV of an exact duration, built here so the expectation is known. */
function wav(seconds: number, { rate = 8000, channels = 1 } = {}): Buffer {
  const samples = Math.round(seconds * rate)
  const bytesPerFrame = 2 * channels
  const dataBytes = samples * bytesPerFrame
  const b = Buffer.alloc(44 + dataBytes)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + dataBytes, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(1, 20)
  b.writeUInt16LE(channels, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * bytesPerFrame, 28)
  b.writeUInt16LE(bytesPerFrame, 32)
  b.writeUInt16LE(16, 34)
  b.write('data', 36)
  b.writeUInt32LE(dataBytes, 40)
  return b
}

describe('readAudioMeta', () => {
  it('reads duration and the technical fields from the headers', async () => {
    const meta = await readAudioMeta(wav(274.3, { rate: 44100, channels: 2 }), 'audio/wav')
    expect(meta?.duration).toBeCloseTo(274.3, 3)
    expect(meta?.sampleRate).toBe(44100)
    expect(meta?.channels).toBe(2)
    expect(meta?.container).toBeTruthy()
    // Rounded, so a VBR average never lands a long float in the database.
    expect(Number.isInteger(meta?.bitrate)).toBe(true)
  })

  it('handles a sub-second file without rounding it away', async () => {
    const meta = await readAudioMeta(wav(0.25), 'audio/wav')
    expect(meta?.duration).toBeCloseTo(0.25, 3)
  })

  it('returns null for bytes that are not audio, rather than throwing', async () => {
    // A truncated or mislabelled file parses without complaint and reports
    // nothing — the upload must survive it.
    expect(await readAudioMeta(Buffer.from('not audio at all'), 'audio/mpeg')).toBeNull()
    expect(await readAudioMeta(Buffer.alloc(0), 'audio/mpeg')).toBeNull()
  })

  it('omits absent fields entirely instead of storing undefined', async () => {
    const meta = await readAudioMeta(wav(1), 'audio/wav')
    expect(meta).not.toBeNull()
    for (const value of Object.values(meta ?? {})) expect(value).toBeDefined()
    // A file with no embedded tags carries no tags key at all.
    expect(meta && 'tags' in meta).toBe(false)
  })
})

/** An MP3 carrying real ID3v2.3 frames, so the tag path is exercised for real. */
function taggedMp3(tags: Record<string, string>): Buffer {
  const frame = (id: string, text: string) => {
    const body = Buffer.concat([
      Buffer.from([0x00]),
      Buffer.from(text, 'latin1'),
      Buffer.from([0x00]),
    ])
    const head = Buffer.alloc(10)
    head.write(id, 0, 4, 'latin1')
    head.writeUInt32BE(body.length, 4)
    return Buffer.concat([head, body])
  }
  const frames = Buffer.concat(Object.entries(tags).map(([id, text]) => frame(id, text)))
  const syncsafe = (n: number) =>
    Buffer.from([(n >>> 21) & 0x7f, (n >>> 14) & 0x7f, (n >>> 7) & 0x7f, n & 0x7f])
  const header = Buffer.concat([
    Buffer.from('ID3'),
    Buffer.from([3, 0, 0]),
    syncsafe(frames.length),
  ])
  // One 128kbps 44.1kHz MPEG-1 Layer III frame, repeated.
  const f = Buffer.alloc(417)
  f[0] = 0xff
  f[1] = 0xfb
  f[2] = 0x90
  f[3] = 0xc4
  const audio = Buffer.concat(Array.from({ length: 40 }, () => f))
  return Buffer.concat([header, frames, audio])
}

describe('embedded tags', () => {
  it('reads title, artist, album and year', async () => {
    const meta = await readAudioMeta(
      taggedMp3({
        TIT2: 'Episode 12: The WAL Files',
        TPE1: 'bananacms radio',
        TALB: 'Season 2',
        TYER: '2026',
      }),
      'audio/mpeg',
    )
    expect(meta?.tags).toEqual({
      title: 'Episode 12: The WAL Files',
      artist: 'bananacms radio',
      album: 'Season 2',
      year: 2026,
    })
    expect(meta?.codec).toContain('Layer 3')
  })

  it('trims padded tags and drops empty ones', async () => {
    // Tags arrive padded or blank far more often than they arrive absent.
    const meta = await readAudioMeta(
      taggedMp3({ TIT2: '  Padded Title  ', TPE1: '   ', TALB: '' }),
      'audio/mpeg',
    )
    expect(meta?.tags).toEqual({ title: 'Padded Title' })
  })
})

describe('formatDuration', () => {
  it('writes m:ss, and h:mm:ss past an hour', () => {
    expect(formatDuration(274.3)).toBe('4:34')
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(9)).toBe('0:09')
    expect(formatDuration(60)).toBe('1:00')
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3725)).toBe('1:02:05')
  })

  it('rounds to the nearest second rather than truncating', () => {
    // 59.6s is a minute to anybody looking at it.
    expect(formatDuration(59.6)).toBe('1:00')
    expect(formatDuration(0.4)).toBe('0:00')
  })

  it('degrades instead of rendering nonsense', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(-5)).toBe('0:00')
    expect(formatDuration(Number.POSITIVE_INFINITY)).toBe('0:00')
  })
})

describe('describeAudio', () => {
  it('joins what is known', () => {
    expect(
      describeAudio({ duration: 274.3, bitrate: 128000, sampleRate: 44100, channels: 2 }),
    ).toBe('4:34 · 128 kbps · 44.1 kHz · stereo')
  })

  it('drops missing fields rather than showing gaps', () => {
    expect(describeAudio({ duration: 274.3, channels: 1 })).toBe('4:34 · mono')
    expect(describeAudio({ bitrate: 320000 })).toBe('320 kbps')
  })

  it('returns an empty string when the file declared nothing', () => {
    // The caller's cue to fall back to the filename, without testing six fields.
    expect(describeAudio({})).toBe('')
  })
})

describe('display helpers', () => {
  it('names channel counts', () => {
    expect(formatChannels(1)).toBe('mono')
    expect(formatChannels(2)).toBe('stereo')
    expect(formatChannels(6)).toBe('6 ch')
  })

  it('writes sample rates in kHz without a trailing .0', () => {
    expect(formatSampleRate(44100)).toBe('44.1 kHz')
    expect(formatSampleRate(48000)).toBe('48 kHz')
  })

  it('falls back to the filename when there is no embedded title', () => {
    expect(audioTitle({ tags: { title: 'Episode 12' } }, 'ep12.mp3')).toBe('Episode 12')
    expect(audioTitle({ tags: {} }, 'ep12.mp3')).toBe('ep12.mp3')
    expect(audioTitle({}, 'ep12.mp3')).toBe('ep12.mp3')
    expect(audioTitle(null, 'ep12.mp3')).toBe('ep12.mp3')
  })
})
