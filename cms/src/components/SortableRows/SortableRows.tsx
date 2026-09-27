'use client'

import { type ReactNode, useRef, useState } from 'react'
import {
  DndContext,
  type DragMoveEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { DropLine, draggedMiddle, gapAt, gapTop, setDragging } from './DropLine.tsx'

// the list's gap between rows, which the drop line sits in the middle of
const GAP_PX = 8

export type SortableRowsProps<T extends { id: string }> = {
  dndId: string
  items: T[]
  renderItem: (item: T) => ReactNode
  onMove: (id: string, anchor: { afterId: string } | { beforeId: string } | null) => Promise<void>
  onMoveError?: (error: unknown) => void
  onMoveSuccess?: () => void
  emptyMessage?: ReactNode
}

// Rows to reorder by dragging. A dragged row stays in place, greyed, and a line
// shows where it would go (DropLine.tsx); dropped, it moves there, and onMove
// saves it, next to the row it now follows, or leads when it's first.
export function SortableRows<T extends { id: string }>({
  dndId,
  items,
  renderItem,
  onMove,
  onMoveError,
  onMoveSuccess,
  emptyMessage = <div className="text-sm italic opacity-50">No items yet.</div>,
}: SortableRowsProps<T>) {
  const [localItems, setLocalItems] = useState(items)
  const [itemsRef, setItemsRef] = useState(items)
  if (items !== itemsRef) {
    setItemsRef(items)
    setLocalItems(items)
  }
  const listRef = useRef<HTMLDivElement>(null)
  const rows = useRef(new Map<string, HTMLElement>())
  const [activeId, setActiveId] = useState<string | null>(null)
  // the gap the dragged row would go in, and where its line goes in the list
  const [drop, setDrop] = useState<{ index: number; top: number } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  )

  const handleDragMove = (event: DragMoveEvent) => {
    const list = listRef.current
    const y = draggedMiddle(event)
    if (!list || y === null) return
    const rects = localItems.map((i) => rows.current.get(i.id)!.getBoundingClientRect())
    const index = gapAt(rects, y)
    const oldIndex = localItems.findIndex((i) => i.id === event.active.id)
    // the gaps either side of it would leave it where it is, so they show no line
    setDrop(
      index === oldIndex || index === oldIndex + 1
        ? null
        : { index, top: gapTop(rects, index, list, GAP_PX) },
    )
  }

  const stopDragging = () => {
    setActiveId(null)
    setDrop(null)
    setDragging(false)
  }

  const handleDragEnd = async () => {
    const id = activeId
    const index = drop?.index
    stopDragging()
    if (id === null || index === undefined) return

    const oldIndex = localItems.findIndex((i) => i.id === id)
    if (oldIndex === -1) return

    const previous = localItems
    const rest = localItems.filter((i) => i.id !== id)
    const at = index > oldIndex ? index - 1 : index
    const reordered = [...rest.slice(0, at), localItems[oldIndex], ...rest.slice(at)]
    setLocalItems(reordered)

    const anchor =
      at === 0
        ? reordered[1] != null
          ? { beforeId: String(reordered[1].id) }
          : null
        : { afterId: String(reordered[at - 1].id) }
    try {
      await onMove(id, anchor)
      onMoveSuccess?.()
    } catch (e) {
      setLocalItems(previous)
      onMoveError?.(e)
    }
  }

  if (localItems.length === 0) return <>{emptyMessage}</>

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      autoScroll={{ layoutShiftCompensation: false }}
      onDragStart={(event) => {
        setActiveId(String(event.active.id))
        setDragging(true)
      }}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={stopDragging}
    >
      <div ref={listRef} className="relative flex flex-col gap-2">
        {localItems.map((item) => (
          <SortableRow
            key={item.id}
            id={item.id}
            dragged={item.id === activeId}
            register={(el) => {
              if (el) rows.current.set(item.id, el)
              else rows.current.delete(item.id)
            }}
          >
            {renderItem(item)}
          </SortableRow>
        ))}
        {drop && <DropLine top={drop.top} />}
      </div>
    </DndContext>
  )
}

const SortableRow = ({
  id,
  dragged,
  register,
  children,
}: {
  id: string
  dragged: boolean
  register: (el: HTMLElement | null) => void
  children: ReactNode
}) => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id })
  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        register(el)
      }}
      className={`grid grid-cols-[auto_1fr] items-center gap-x-3 rounded-lg border px-3 py-2 transition-colors ${
        dragged ? 'border-gray-200 bg-gray-100 opacity-50' : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        className="cursor-grab select-none opacity-50 hover:opacity-100 touch-none"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      {children}
    </div>
  )
}
