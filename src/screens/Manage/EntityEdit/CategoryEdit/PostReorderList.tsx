'use client'

import { FC, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  KeyboardSensor,
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
import { useToast } from '@cms/components/Toast/Toast'
import { extractErrorMessage } from '@cms/utils/extractErrorMessage'
import { movePost } from './utils'

type Item = { id: string; name: string; url: string; status?: string }

export const PostReorderList: FC<{ posts: Item[] }> = ({ posts }) => {
  const [items, setItems] = useState(posts)
  const router = useRouter()
  const showToast = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(items, oldIndex, newIndex)
    setItems(reordered)

    const afterId = newIndex === 0 ? null : reordered[newIndex - 1].id
    try {
      await movePost(String(active.id), afterId)
      router.refresh()
    } catch (e) {
      setItems(items)
      showToast('error', extractErrorMessage(e), { timeout: 3000 })
    }
  }

  if (items.length === 0) {
    return <div className="text-sm italic opacity-50">No posts yet.</div>
  }

  return (
    <DndContext
      id="posts"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        {items.map((item) => (
          <SortableRow key={item.id} item={item} />
        ))}
      </SortableContext>
    </DndContext>
  )
}

const SortableRow: FC<{ item: Item }> = ({ item }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
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
        className="cursor-grab select-none px-1 opacity-50 hover:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <Link className="link" href={item.url}>
        {item.name}
      </Link>
      {item.status && (
        <span
          className={`text-xs px-1.5 py-0.5 rounded font-medium ${item.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {item.status}
        </span>
      )}
    </div>
  )
}
