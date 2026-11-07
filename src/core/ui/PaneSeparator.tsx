import { useEffect, useRef, useState } from 'react'
import { documentDirection } from '@/core/theme/direction'
import { clampInspectorWidth, INSPECTOR_WIDTH, maxInspectorWidth, separatorKeyWidth, type PaneBounds } from './inspector-pane'

/** The viewport's width, kept current: an inspector pane is never more than 40% of it. */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => window.innerWidth)
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  return width
}

/**
 * The resize handle on an inspector pane's inline-start edge (367 §4), so it mirrors under RTL:
 * drag it, or focus it and step 16 px with the arrows, Home/End for min/max; a double-click
 * resets 360. Graduated from the Delivery inspector at ticket 432 (the Donor requests inspector
 * is its second pane). The pane is `relative`; this sits absolutely on its edge.
 *
 * `label` is the caller's translated accessible name — this component adds no `t()` call.
 */
export default function PaneSeparator({
  controls,
  label,
  width,
  viewport,
  onWidth,
  bounds = INSPECTOR_WIDTH,
  edge = 'start',
}: {
  /** The pane's id. */
  controls: string
  label: string
  width: number
  viewport: number
  onWidth: (width: number) => void
  /** 846: another pane's bounds (default the inspector's). */
  bounds?: PaneBounds
  /** 846: which inline edge of the pane the handle sits on: 'start' (a pane at the inline end, the inspector) or 'end' (a pane at the inline start). */
  edge?: 'start' | 'end'
}) {
  const drag = useRef<{ x: number; width: number } | null>(null)
  // Direction is a boot fact (383): a language switch reloads the page.
  const rtl = documentDirection() === 'rtl'
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-controls={controls}
      aria-label={label}
      aria-valuenow={width}
      aria-valuemin={bounds.min}
      aria-valuemax={maxInspectorWidth(viewport, bounds)}
      tabIndex={0}
      data-inspector-separator=""
      onPointerDown={(e) => {
        if (e.button !== 0) return
        drag.current = { x: e.clientX, width }
        e.currentTarget.setPointerCapture(e.pointerId)
        // No text selection across the grid while dragging.
        e.preventDefault()
      }}
      onPointerMove={(e) => {
        if (!drag.current) return
        const dx = e.clientX - drag.current.x
        // Dragging away from the pane grows it: toward the inline start for an end-side pane, the inline end for a start-side one.
        const towardEnd = rtl ? -dx : dx
        onWidth(drag.current.width + (edge === 'end' ? towardEnd : -towardEnd))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onWidth(bounds.default)}
      onKeyDown={(e) => {
        const next = separatorKeyWidth(e.key, width, { viewport, rtl, bounds, edge })
        if (next === null) return
        e.preventDefault()
        onWidth(next)
      }}
      className={(edge === 'end' ? '-end-[3px] ' : '-start-[3px] ') + 'group absolute inset-y-0 z-10 w-[6px] cursor-col-resize touch-none focus-visible:outline-none'}
    >
      <div className="mx-auto h-full w-px group-hover:bg-primary group-focus-visible:w-[2px] group-focus-visible:bg-ring" />
    </div>
  )
}

/**
 * 846: a side pane's width, remembered per browser under `key` (a convenience: storage may be
 * blocked, and the pane then opens at its default). Clamped to the viewport on every read.
 */
export function useRememberedPaneWidth(key: string, bounds: PaneBounds): [number, (width: number) => void] {
  const viewport = useViewportWidth()
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(key))
      return saved > 0 ? saved : bounds.default
    } catch {
      return bounds.default
    }
  })
  const set = (next: number) => {
    const w = clampInspectorWidth(next, viewport, bounds)
    setWidth(w)
    try {
      window.localStorage.setItem(key, String(w))
    } catch {
      // Storage blocked: the width lasts this visit.
    }
  }
  return [clampInspectorWidth(width, viewport, bounds), set]
}
