'use client'

import { FC, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { BlockData, BlockType } from '@cms/lib/blocks/declarations'

const INDENT_PX = 20

type FlatItem = {
  id: string
  depth: number
  parentId: string | null
  block: BlockData
}

type BlockReorderModalProps = {
  blocks: BlockData[]
  onSave: (blocks: BlockData[]) => void
  onClose: () => void
}

export const BlockReorderModal: FC<BlockReorderModalProps> = ({ blocks, onSave, onClose }) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const initialFlat = useMemo(() => flatten(blocks), [blocks])
  const [flat, setFlat] = useState<FlatItem[]>(initialFlat)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [offsetLeft, setOffsetLeft] = useState(0)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handler = () => onClose()
    dialog.addEventListener('close', handler)
    return () => dialog.removeEventListener('close', handler)
  }, [onClose])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const descendantIds = useMemo(
    () => (activeId ? getDescendantIds(flat, activeId) : new Set<string>()),
    [flat, activeId],
  )

  const visible = useMemo(
    () => (activeId ? flat.filter((f) => !descendantIds.has(f.id)) : flat),
    [flat, activeId, descendantIds],
  )

  const projection = useMemo(() => {
    if (!activeId || !overId) return null
    return getProjection(visible, activeId, overId, offsetLeft)
  }, [visible, activeId, overId, offsetLeft])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
    setOverId(String(event.active.id))
    setOffsetLeft(0)
  }

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null)
  }

  const handleDragMove = (event: DragMoveEvent) => {
    setOffsetLeft(event.delta.x)
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event
    const activeStr = String(active.id)
    const overStr = over ? String(over.id) : null
    setActiveId(null)
    setOverId(null)
    setOffsetLeft(0)
    if (!overStr) return

    const activeItem = flat.find((f) => f.id === activeStr)
    if (!activeItem) return

    const descendants = getDescendantIds(flat, activeStr)
    if (descendants.has(overStr)) return

    const visibleFlat = flat.filter((f) => !descendants.has(f.id))
    const proj = getProjection(visibleFlat, activeStr, overStr, delta.x)
    if (!proj) return

    const activeIdx = visibleFlat.findIndex((f) => f.id === activeStr)
    const overIdx = visibleFlat.findIndex((f) => f.id === overStr)
    const reordered = arrayMove(visibleFlat, activeIdx, overIdx)
    const finalIdx = reordered.findIndex((f) => f.id === activeStr)
    const shift = proj.depth - activeItem.depth
    reordered[finalIdx] = { ...activeItem, depth: proj.depth, parentId: proj.parentId }

    const descendantItems = flat
      .filter((f) => descendants.has(f.id))
      .map((d) => ({ ...d, depth: d.depth + shift }))

    const merged = [
      ...reordered.slice(0, finalIdx + 1),
      ...descendantItems,
      ...reordered.slice(finalIdx + 1),
    ]
    setFlat(rederiveParentIds(merged))
  }

  const handleSave = () => {
    onSave(buildTree(flat))
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={handleBackdropClick}
      className="m-auto w-full max-w-xl rounded-lg shadow-xl p-4 backdrop:bg-black/50 flex flex-col gap-3 open:flex"
    >
      <h2 className="text-sm font-semibold text-gray-700">Reorder blocks</h2>
      <div
        ref={listRef}
        className="flex flex-col gap-1 pb-24 max-h-[70vh] overflow-y-auto overflow-x-hidden"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          autoScroll={{ canScroll: (el) => el === listRef.current }}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          <SortableContext items={visible.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            {visible.map((item) => (
              <SortableBlockRow
                key={item.id}
                item={item}
                depth={item.id === activeId && projection ? projection.depth : item.depth}
              />
            ))}
          </SortableContext>
        </DndContext>
        {visible.length === 0 && <div className="text-sm italic opacity-50">No blocks.</div>}
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="button mr-auto" onClick={() => setFlat(initialFlat)}>
          Reset
        </button>
        <button type="button" className="button" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="button" onClick={handleSave}>
          Save
        </button>
      </div>
    </dialog>
  )
}

const SortableBlockRow: FC<{ item: FlatItem; depth: number }> = ({ item, depth }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    marginLeft: depth * INDENT_PX,
  }
  const { content } = item.block
  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 text-xs border border-gray-200 rounded bg-white px-2 py-1"
    >
      <button
        type="button"
        className="cursor-grab select-none px-1 opacity-50 hover:opacity-100"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      <span className="uppercase tracking-wide text-gray-400 w-12 shrink-0">{content.type}</span>
      <span className="font-mono text-gray-700 w-28 truncate shrink-0">{content.key || '—'}</span>
      <span className="text-gray-500 truncate flex-1 min-w-0">{getPreview(content)}</span>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function flatten(
  blocks: BlockData[],
  parentId: string | null = null,
  depth = 0,
  out: FlatItem[] = [],
): FlatItem[] {
  for (const block of blocks) {
    out.push({ id: block.id, depth, parentId, block })
    if (block.content.type === 'group') {
      flatten(block.content.blocks, block.id, depth + 1, out)
    }
  }
  return out
}

function getDescendantIds(flat: FlatItem[], id: string): Set<string> {
  const result = new Set<string>()
  const index = flat.findIndex((f) => f.id === id)
  if (index === -1) return result
  const startDepth = flat[index].depth
  for (let i = index + 1; i < flat.length; i++) {
    if (flat[i].depth <= startDepth) break
    result.add(flat[i].id)
  }
  return result
}

type Projection = { depth: number; parentId: string | null }

function getProjection(
  visible: FlatItem[],
  activeId: string,
  overId: string,
  dragOffset: number,
): Projection | null {
  const activeIndex = visible.findIndex((f) => f.id === activeId)
  const overIndex = visible.findIndex((f) => f.id === overId)
  if (activeIndex === -1 || overIndex === -1) return null

  const moved = arrayMove(visible, activeIndex, overIndex)
  const newIndex = moved.findIndex((f) => f.id === activeId)
  const active = moved[newIndex]
  const previous = moved[newIndex - 1]
  const next = moved[newIndex + 1]

  const dragDepth = Math.round(dragOffset / INDENT_PX)
  const projectedDepth = active.depth + dragDepth

  let maxDepth: number
  if (!previous) {
    maxDepth = 0
  } else if (previous.block.content.type === 'group') {
    maxDepth = previous.depth + 1
  } else {
    maxDepth = previous.depth
  }
  const minDepth = next ? next.depth : 0
  const depth = Math.max(minDepth, Math.min(projectedDepth, maxDepth))

  let parentId: string | null = null
  if (depth > 0 && previous) {
    if (depth === previous.depth + 1) {
      parentId = previous.id
    } else {
      for (let i = newIndex - 1; i >= 0; i--) {
        if (moved[i].depth === depth - 1) {
          parentId = moved[i].id
          break
        }
      }
    }
  }
  return { depth, parentId }
}

function rederiveParentIds(flat: FlatItem[]): FlatItem[] {
  const stack: FlatItem[] = []
  return flat.map((item) => {
    while (stack.length > 0 && stack[stack.length - 1].depth >= item.depth) {
      stack.pop()
    }
    const parent = stack[stack.length - 1]
    const parentId = parent ? parent.id : null
    const updated: FlatItem = { ...item, parentId }
    stack.push(updated)
    return updated
  })
}

function buildTree(flat: FlatItem[]): BlockData[] {
  const nodes = new Map<string, BlockData>()
  for (const item of flat) {
    const parent: BlockData['parent'] = item.parentId
      ? { type: 'block', id: item.parentId }
      : { type: 'post', id: '' }
    const block = item.block
    if (block.content.type === 'group') {
      nodes.set(item.id, {
        ...block,
        parent,
        content: { ...block.content, blocks: [] },
      })
    } else {
      nodes.set(item.id, { ...block, parent })
    }
  }
  const roots: BlockData[] = []
  for (const item of flat) {
    const node = nodes.get(item.id)
    if (!node) continue
    if (item.parentId == null) {
      roots.push(node)
      continue
    }
    const parent = nodes.get(item.parentId)
    if (parent && parent.content.type === 'group') {
      parent.content.blocks.push(node)
    }
  }
  return roots
}

function getPreview(content: BlockType): string {
  if (content.type === 'text' || content.type === 'meta') {
    const text = content.text.replace(/\s+/g, ' ').trim()
    return text.length > 50 ? text.slice(0, 50) + '…' : text
  }
  if (content.type === 'image' || content.type === 'asset') {
    return content.name || '(no name)'
  }
  return `(${content.blocks.length} items)`
}
