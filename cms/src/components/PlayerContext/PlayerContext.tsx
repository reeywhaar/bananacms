'use client'

import { createContext, type FC, type PropsWithChildren, useContext, useMemo, useRef } from 'react'
import { invariant } from '#cms/utils/invariant.ts'

export type Player = {
  // says that `media` has started playing: the one that was playing pauses
  started(media: HTMLMediaElement): void
}

const PlayerContext = createContext<Player | null>(null)

// The admin plays one sound at a time: the players of a card and of the dialog
// open over it, or of two cards, don't play together.
export const PlayerProvider: FC<PropsWithChildren> = ({ children }) => {
  const playing = useRef<HTMLMediaElement | null>(null)
  const player = useMemo<Player>(
    () => ({
      started(media) {
        if (playing.current && playing.current !== media) playing.current.pause()
        playing.current = media
      },
    }),
    [],
  )
  return <PlayerContext.Provider value={player}>{children}</PlayerContext.Provider>
}

export const usePlayer = (): Player =>
  useContext(PlayerContext) ?? invariant('PlayerContext is not provided')
