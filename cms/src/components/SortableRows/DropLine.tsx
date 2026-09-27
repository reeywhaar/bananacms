import type { FC } from 'react'
import type { DragMoveEvent } from '@dnd-kit/core'

// Dragging a row leaves it in place, greyed, and moves nothing else: this line
// shows where it would go, in the gap between the rows its middle is in.

// The middle of the row being dragged, as far down as it's been dragged, or the list
// scrolled under it
export const draggedMiddle = (event: DragMoveEvent): number | null => {
  const rect = event.active.rect.current.translated
  return rect ? (rect.top + rect.bottom) / 2 : null
}

// The gap a dragged row's middle `y` is in: before the row at the index, or after
// the last at the rows' count
export const gapAt = (rects: DOMRect[], y: number): number =>
  rects.filter((rect) => (rect.top + rect.bottom) / 2 < y).length

// Where the line for the gap at `index` goes, from the top of `list`, whose rows
// are `rects`, `gap` apart, and which the line is placed in
export const gapTop = (rects: DOMRect[], index: number, list: HTMLElement, gap: number): number => {
  const y =
    index < rects.length ? rects[index].top - gap / 2 : rects[rects.length - 1].bottom + gap / 2
  return y - list.getBoundingClientRect().top + list.scrollTop
}

// The line, in a list that's `relative`, and indented `left`
export const DropLine: FC<{ top: number; left?: number }> = ({ top, left = 0 }) => (
  <div
    className="pointer-events-none absolute right-0 h-0.5 -translate-y-1/2 rounded-full bg-accent"
    style={{ top, left }}
  />
)
