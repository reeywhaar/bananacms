type Held = { count: number; overflow: string; paddingRight: string }

const held = new Map<HTMLElement, Held>()

// Stops `el` scrolling until the returned function is called, which undoes it once
// however often it's called. A modal dialog makes the page inert to focus and
// clicks, and the wheel still scrolls it. Locks are counted, so an inner dialog
// closing leaves the page locked while the outer one is open. The padding makes
// up for the scrollbar that goes away, so nothing shifts.
export function lockScroll(el: HTMLElement): () => void {
  const lock = held.get(el)
  if (lock) {
    lock.count += 1
  } else {
    // read before overflow changes: the scrollbar's width is 0 once it's hidden
    const gap = scrollbarWidth(el)
    held.set(el, { count: 1, overflow: el.style.overflow, paddingRight: el.style.paddingRight })
    el.style.overflow = 'hidden'
    if (gap > 0) {
      const padding = Number.parseFloat(getComputedStyle(el).paddingRight) || 0
      el.style.paddingRight = `${padding + gap}px`
    }
  }

  let released = false
  return () => {
    if (released) return
    released = true
    const current = held.get(el)
    if (!current) return
    current.count -= 1
    if (current.count > 0) return
    held.delete(el)
    el.style.overflow = current.overflow
    el.style.paddingRight = current.paddingRight
  }
}

// The page's scrollbar belongs to the viewport, not to the body's box.
function scrollbarWidth(el: HTMLElement): number {
  if (el === document.body || el === document.documentElement) {
    return window.innerWidth - document.documentElement.clientWidth
  }
  return el.offsetWidth - el.clientWidth
}
