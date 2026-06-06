'use client'

import { ReactNode, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

export type SortableRowsProps<T extends { id: string }> = {
  dndId: string
  items: T[]
  renderItem: (item: T) => ReactNode
  onMove: (id: string, anchor: { afterId: string } | { beforeId: string } | null) => Promise<void>
  onMoveError?: (error: unknown) => void
  onMoveSuccess?: () => void
  emptyMessage?: ReactNode
}

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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = localItems.findIndex((i) => i.id === active.id)
    const newIndex = localItems.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const previous = localItems
    const reordered = arrayMove(localItems, oldIndex, newIndex)
    setLocalItems(reordered)

    const anchor =
      newIndex === 0
        ? reordered[1] != null
          ? { beforeId: String(reordered[1].id) }
          : null
        : { afterId: String(reordered[newIndex - 1].id) }
    try {
      await onMove(String(active.id), anchor)
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
      collisionDetection={closestCenter}
      autoScroll={{ layoutShiftCompensation: false }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={localItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {localItems.map((item) => (
          <SortableRow key={item.id} id={item.id}>
            {renderItem(item)}
          </SortableRow>
        ))}
      </SortableContext>
    </DndContext>
  )
}

const SortableRow = ({ id, children }: { id: string; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 py-1">
      <button
        type="button"
        className="cursor-grab select-none px-1 opacity-50 hover:opacity-100 touch-none"
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
