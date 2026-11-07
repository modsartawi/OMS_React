import { useCallback, useEffect, useRef } from 'react'
import { edgeSpeed, scrollParentOf } from './auto-scroll'

/**
 * 846: the edge auto-scroller for a drag (`./auto-scroll`). Call `follow(clientX, clientY)` on every pointer move or
 * `dragover` while dragging, and `stop()` when the drag ends. While the pointer is in an edge band a frame loop scrolls
 * the element that scrolls `target`, and after each scroll calls `onScrolled(lastPointer)` so the caller can work out
 * the drop cell again: the content moved under a still pointer.
 *
 * It works for a pointer-captured drag and for native HTML5 drag and drop alike (the browser's own drag auto-scroll
 * still runs at the window's very edge; ours starts earlier and is gentler, so it is the one the owner feels).
 */
export function useAutoScroll(target: React.RefObject<Element | null>, onScrolled?: (pointer: { clientX: number; clientY: number }) => void) {
  const pointer = useRef<{ clientX: number; clientY: number } | null>(null)
  const frame = useRef<number | null>(null)
  const since = useRef<number | null>(null)
  const scrolled = useRef(onScrolled)
  scrolled.current = onScrolled

  const stop = useCallback(() => {
    pointer.current = null
    since.current = null
    if (frame.current !== null) cancelAnimationFrame(frame.current)
    frame.current = null
  }, [])

  const tick = useCallback((now: number) => {
    frame.current = null
    const p = pointer.current
    if (!p) return
    const scroller = scrollParentOf(target.current)
    const isDoc = scroller === document.scrollingElement || scroller === document.documentElement
    const box = isDoc ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect()
    if (since.current === null) since.current = now
    const step = edgeSpeed(p.clientY, box, now - since.current)
    if (step === 0) {
      since.current = null
      return
    }
    const before = scroller.scrollTop
    scroller.scrollTop = before + step
    if (scroller.scrollTop !== before) scrolled.current?.(p)
    frame.current = requestAnimationFrame(tick)
  }, [target])

  const follow = useCallback(
    (clientX: number, clientY: number) => {
      pointer.current = { clientX, clientY }
      if (frame.current === null) frame.current = requestAnimationFrame(tick)
    },
    [tick],
  )

  useEffect(() => stop, [stop])
  return { follow, stop }
}
