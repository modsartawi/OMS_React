import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'

/**
 * The panel chrome's browser hooks (ticket 773). 780's TV mode reuses {@link useFullscreen} for the board.
 */

const onFullscreenChange = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}

/**
 * The browser's own full screen for `ref`'s element (the Fullscreen API: Escape leaves it, natively).
 * `on` follows the document, so leaving by Escape or by the browser's own control is seen too.
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>): { on: boolean; toggle: () => void } {
  const on = useSyncExternalStore(onFullscreenChange, () => !!ref.current && document.fullscreenElement === ref.current, () => false)
  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (document.fullscreenElement === el) void document.exitFullscreen().catch(() => {})
    else void el.requestFullscreen?.().catch(() => {})
  }, [ref])
  return useMemo(() => ({ on, toggle }), [on, toggle])
}

/** `Date.now()` that moves every `everyMs` — enough for "fetched N ago" and the "data is behind" chip. */
export function useNow(everyMs = 15_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}

/**
 * A permalink's `#panel-<id>`: bring the panel into view once its answer has landed (`ready`) — not on
 * mount, when the panels above it are still loading and have not reached their height. Once per page.
 */
export function useScrollToPanel(panelId: string, ref: RefObject<HTMLElement | null>, ready: boolean): void {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || !ready || window.location.hash !== `#panel-${panelId}`) return
    done.current = true
    ref.current?.scrollIntoView({ block: 'start' })
  }, [panelId, ref, ready])
}
