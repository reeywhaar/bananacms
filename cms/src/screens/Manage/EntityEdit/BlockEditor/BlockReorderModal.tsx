'use client'

import { type FC, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  type DragMoveEvent,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { BlockData, BlockType } from '#cms/lib/blocks/declarations.ts'
import { Dialog } from '#cms/components/Dialog/Dialog.tsx'
import {
  DropLine,
  draggedMiddle,
  gapAt,
  gapTop,
  setDragging,
} from '#cms/components/SortableRows/DropLine.tsx'

const INDENT_PX = 20
// the list's gap between rows, which the drop line sits in the middle of
const GAP_PX = 4

type FlatItem = {
  id: string
  depth: number
  parentId: string | null
  block: BlockData
}

// Where a dragged block would go: before the row at `index` of the list, or after
// the last one at its length, at `depth`, with the line that shows it `top` from
// the list's top.
type Drop = { index: number; depth: number; top: number }

type BlockReorderModalProps = {
  blocks: BlockData[]
  onSave: (blocks: BlockData[]) => void
  onClose: () => void
}

// The blocks as a list to reorder, a group's own under it. A dragged block, and a
// group's blocks with it, stay in place, greyed, and a line shows where it would
// go (DropLine.tsx), at the depth dragging it sideways picks.
export const BlockReorderModal: FC<BlockReorderModalProps> = ({ blocks, onSave, onClose }) => {
  const listRef = useRef<HTMLDivElement>(null)
  const rows = useRef(new Map<string, HTMLElement>())
  const initialFlat = useMemo(() => flatten(blocks), [blocks])
  const [flat, setFlat] = useState<FlatItem[]>(initialFlat)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const dragged = useMemo(
    () => (activeId ? new Set([activeId, ...getDescendantIds(flat, activeId)]) : new Set()),
    [flat, activeId],
  )

  // as it's dragged, and as the list scrolls under it
  const handleDragMove = (event: DragMoveEvent) => {
    const list = listRef.current
    const y = draggedMiddle(event)
    if (!list || y === null) return
    const id = String(event.active.id)
    const rects = flat.map((f) => rows.current.get(f.id)!.getBoundingClientRect())
    const found = findDrop(flat, id, gapAt(rects, y), event.delta.x)
    setDrop(found && { ...found, top: gapTop(rects, found.index, list, GAP_PX) })
  }

  const handleDragEnd = () => {
    if (activeId && drop) setFlat(applyDrop(flat, activeId, drop))
    handleDragCancel()
  }

  const handleDragCancel = () => {
    setActiveId(null)
    setDrop(null)
    setDragging(false)
  }

  const handleSave = () => {
    onSave(buildTree(flat))
    onClose()
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Reorder blocks"
      wide
      footer={
        <>
          <button type="button" className="button mr-auto" onClick={() => setFlat(initialFlat)}>
            Reset
          </button>
          <button type="button" className="button" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button" onClick={handleSave}>
            Save
          </button>
        </>
      }
    >
      <div
        ref={listRef}
        // pt-1 leaves the line before the first row room, which scrolling would clip
        className="relative flex flex-col gap-1 pt-1 pb-24 max-h-[70vh] overflow-y-auto overflow-x-hidden"
      >
        <DndContext
          sensors={sensors}
          autoScroll={{ canScroll: (el) => el === listRef.current }}
          onDragStart={(event) => {
            setActiveId(String(event.active.id))
            setDragging(true)
          }}
          onDragMove={handleDragMove}
          onDragEnd={handleDragEnd}
          onDragCancel={handleDragCancel}
        >
          {flat.map((item) => (
            <BlockRow
              key={item.id}
              item={item}
              dragged={dragged.has(item.id)}
              register={(el) => {
                if (el) rows.current.set(item.id, el)
                else rows.current.delete(item.id)
              }}
            />
          ))}
        </DndContext>
        {drop && <DropLine top={drop.top} left={drop.depth * INDENT_PX} />}
        {flat.length === 0 && <div className="text-sm italic opacity-50">No blocks.</div>}
      </div>
    </Dialog>
  )
}

const BlockRow: FC<{
  item: FlatItem
  // being dragged, or in a group that is
  dragged: boolean
  register: (el: HTMLElement | null) => void
}> = ({ item, dragged, register }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: item.id })
  const { content } = item.block
  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        register(el)
      }}
      style={{ marginLeft: item.depth * INDENT_PX }}
      className={`flex items-center gap-2 text-xs border rounded px-2 py-1 transition-colors ${
        dragged ? 'border-gray-200 bg-gray-100 opacity-50' : 'border-gray-200 bg-white'
      }`}
    >
      <button
        type="button"
        className="cursor-grab select-none px-1 opacity-50 hover:opacity-100 touch-none"
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

// Where the block `activeId` would go, dragged to the gap at `gap` and `offsetX`
// sideways: in that gap, but not among its own rows, a group's, which it goes
// before or after instead, and at its depth give or take one for each indent
// dragged, as deep as the row before allows and as shallow as the one after does.
// None where it would stay where it is, as it does until it's dragged anywhere.
function findDrop(
  flat: FlatItem[],
  activeId: string,
  gap: number,
  offsetX: number,
): { index: number; depth: number } | null {
  const start = flat.findIndex((f) => f.id === activeId)
  const end = start + getDescendantIds(flat, activeId).size
  let index = gap
  if (index > start && index <= end) index = index - start <= end + 1 - index ? start : end + 1

  const rest = [...flat.slice(0, start), ...flat.slice(end + 1)]
  const at = index <= start ? index : index - (end - start + 1)
  const previous = rest[at - 1]
  const next = rest[at]
  const max = !previous
    ? 0
    : previous.block.content.type === 'group'
      ? previous.depth + 1
      : previous.depth
  const min = next ? next.depth : 0
  const depth = Math.max(min, Math.min(flat[start].depth + Math.round(offsetX / INDENT_PX), max))
  if ((index === start || index === end + 1) && depth === flat[start].depth) return null
  return { index, depth }
}

// The list with the block `activeId`, and a group's blocks with it, moved to `drop`
function applyDrop(flat: FlatItem[], activeId: string, drop: Drop): FlatItem[] {
  const start = flat.findIndex((f) => f.id === activeId)
  const end = start + getDescendantIds(flat, activeId).size
  const moving = flat.slice(start, end + 1)
  const shift = drop.depth - moving[0].depth
  const rest = [...flat.slice(0, start), ...flat.slice(end + 1)]
  const at = drop.index <= start ? drop.index : drop.index - moving.length
  return rederiveParentIds([
    ...rest.slice(0, at),
    ...moving.map((f) => ({ ...f, depth: f.depth + shift })),
    ...rest.slice(at),
  ])
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
