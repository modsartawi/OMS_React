import { useEffect, useRef, useState } from 'react'
import { documentDirection } from '@/core/theme/direction'
import { INSPECTOR_WIDTH, maxInspectorWidth, separatorKeyWidth } from './inspector-pane'

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
}: {
  /** The pane's id. */
  controls: string
  label: string
  width: number
  viewport: number
  onWidth: (width: number) => void
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
      aria-valuemin={INSPECTOR_WIDTH.min}
      aria-valuemax={maxInspectorWidth(viewport)}
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
        // Dragging toward the inline start grows the pane.
        onWidth(drag.current.width + (rtl ? dx : -dx))
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => onWidth(INSPECTOR_WIDTH.default)}
      onKeyDown={(e) => {
        const next = separatorKeyWidth(e.key, width, { viewport, rtl })
        if (next === null) return
        e.preventDefault()
        onWidth(next)
      }}
      className="group absolute inset-y-0 -start-[3px] z-10 w-[6px] cursor-col-resize touch-none focus-visible:outline-none"
    >
      <div className="mx-auto h-full w-px group-hover:bg-primary group-focus-visible:w-[2px] group-focus-visible:bg-ring" />
    </div>
  )
}
