import { parseBuffer } from 'music-metadata'

export interface AudioMeta {
  /** Seconds, fractional — whatever the container's sample count works out to. */
  duration?: number
  /** Bits per second, rounded: a VBR file reports an average with a long tail. */
  bitrate?: number
  sampleRate?: number
  channels?: number
  /** What the bytes say the file is, which `mime` (from the browser) may not. */
  container?: string
  codec?: string
  tags?: AudioTags
}

export interface AudioTags {
  title?: string
  artist?: string
  album?: string
  year?: number
}

/**
 * Everything worth keeping from an audio file's headers, or null if it is not
 * readable as audio.
 *
 * Read from the container's own headers rather than by decoding, so it costs a
 * header parse and not the length of the track. Never throws: a file that is
 * not really audio, or is truncated, is missing metadata rather than a failed
 * upload — the asset itself is still worth storing. A malformed file parses
 * without complaint and simply reports nothing, so every field is checked
 * rather than trusted.
 */
export async function readAudioMeta(data: Buffer, mime?: string): Promise<AudioMeta | null> {
  try {
    const { format, common } = await parseBuffer(data, mime ? { mimeType: mime } : undefined)
    const meta: AudioMeta = {
      ...positive('duration', format.duration),
      ...positive('bitrate', format.bitrate, Math.round),
      ...positive('sampleRate', format.sampleRate, Math.round),
      ...positive('channels', format.numberOfChannels, Math.round),
      ...text('container', format.container),
      ...text('codec', format.codec),
    }
    const tags: AudioTags = {
      ...text('title', common.title),
      ...text('artist', common.artist),
      ...text('album', common.album),
      ...positive('year', common.year, Math.round),
    }
    if (Object.keys(tags).length > 0) meta.tags = tags
    return Object.keys(meta).length > 0 ? meta : null
  } catch {
    return null
  }
}

/**
 * Seconds as `m:ss`, or `h:mm:ss` past an hour — how a player writes it.
 *
 * Rounds to the nearest second, so a 59.6s track reads 1:00 rather than 0:59.
 */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds)
  const s = total % 60
  const m = Math.floor(total / 60) % 60
  const h = Math.floor(total / 3600)
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Omits the key entirely unless the value is a usable positive number. */
function positive<K extends string>(
  key: K,
  value: number | undefined,
  round?: (n: number) => number,
): Partial<Record<K, number>> {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return {}
  return { [key]: round ? round(value) : value } as Record<K, number>
}

/** Tags arrive padded or empty far more often than they arrive absent. */
function text<K extends string>(key: K, value: string | undefined): Partial<Record<K, string>> {
  if (typeof value !== 'string') return {}
  const trimmed = value.trim()
  return trimmed ? ({ [key]: trimmed } as Record<K, string>) : {}
}

/**
 * A one-line summary for the UI: "4:34 · 128 kbps · 44.1 kHz · stereo".
 *
 * Every field an audio file reports is optional — plenty of files declare
 * almost nothing — so this drops whatever is missing rather than rendering
 * "undefined kbps", and returns an empty string when nothing at all is known.
 * Callers can then fall back to the filename without checking six fields.
 */
export function describeAudio(meta: AudioMeta): string {
  const parts: string[] = []
  if (meta.duration !== undefined) parts.push(formatDuration(meta.duration))
  if (meta.bitrate !== undefined) parts.push(`${Math.round(meta.bitrate / 1000)} kbps`)
  if (meta.sampleRate !== undefined) parts.push(formatSampleRate(meta.sampleRate))
  if (meta.channels !== undefined) parts.push(formatChannels(meta.channels))
  return parts.join(' · ')
}

/** 44100 → "44.1 kHz", 48000 → "48 kHz". */
export function formatSampleRate(hz: number): string {
  const khz = hz / 1000
  return `${Number.isInteger(khz) ? khz : khz.toFixed(1)} kHz`
}

export function formatChannels(channels: number): string {
  if (channels === 1) return 'mono'
  if (channels === 2) return 'stereo'
  return `${channels} ch`
}

/**
 * What to call the asset: its embedded title if it has one, otherwise the
 * filename it was uploaded under.
 */
export function audioTitle(meta: AudioMeta | null | undefined, filename: string): string {
  return meta?.tags?.title ?? filename
}
