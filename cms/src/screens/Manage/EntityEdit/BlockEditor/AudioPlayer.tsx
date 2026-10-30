'use client'

import { type CSSProperties, type FC, useEffect, useRef, useState } from 'react'
import { Pause, Play } from '#cms/components/icons.tsx'
import { usePlayer } from '#cms/components/PlayerContext/PlayerContext.tsx'
import { formatDuration } from '#cms/lib/audioMeta.ts'

// A player of the admin's own over the browser's audio element: play and pause,
// where it's at, and a bar to move along, with no volume, which the device has.
// A saved file plays from its URL and loads nothing until it's played, showing the
// length measured at upload until then; a staged one plays from the browser's own
// copy, which gives its length at once. A click on the player is the player's,
// rather than what it sits in, which would open the block or pick another file.
// Starting one pauses any other that's playing (PlayerContext).
export const AudioPlayer: FC<({ src: string } | { file: File }) & { duration?: number }> = (
  props,
) => {
  const file = 'file' in props ? props.file : null
  const player = usePlayer()
  const [objectUrl, setObjectUrl] = useState<string | null>(null)
  const audio = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(props.duration ?? 0)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setObjectUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const src = 'src' in props ? props.src : objectUrl
  if (!src) return null

  const toggle = () => {
    const element = audio.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }

  // before a saved file has loaded, the browser keeps the position to start from
  const seek = (to: number) => {
    if (audio.current) audio.current.currentTime = to
    setTime(to)
  }

  const filled = duration > 0 ? `${Math.min(100, (time / duration) * 100)}%` : '0%'

  return (
    <div
      className="flex w-full items-center gap-3 rounded-full bg-gray-100 py-1.5 pr-4 pl-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        className="gradient-accent flex size-8 shrink-0 items-center justify-center rounded-full text-white hover:brightness-95"
        onClick={toggle}
      >
        {playing ? (
          <Pause size={14} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={14} fill="currentColor" strokeWidth={0} className="translate-x-px" />
        )}
      </button>
      <span className="w-10 shrink-0 text-right text-xs text-gray-600 tabular-nums">
        {formatDuration(time)}
      </span>
      <input
        type="range"
        aria-label="Position"
        className="range"
        min={0}
        max={duration || 1}
        step="any"
        value={time}
        disabled={duration === 0}
        style={{ '--filled': filled } as CSSProperties}
        onChange={(e) => seek(Number(e.target.value))}
      />
      <span className="w-10 shrink-0 text-xs text-gray-500 tabular-nums">
        {formatDuration(duration)}
      </span>
      <audio
        ref={audio}
        src={src}
        preload={file ? 'metadata' : 'none'}
        onPlay={(e) => {
          setPlaying(true)
          player.started(e.currentTarget)
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onDurationChange={(e) => {
          const length = e.currentTarget.duration
          if (Number.isFinite(length)) setDuration(length)
        }}
      />
    </div>
  )
}
