import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The measured width of an element, for the one rule on this screen that cannot be a
 * container query: the elements trace's shed (ticket 119).
 *
 * Everything else the rework does responsively IS a `@container` query on the work
 * area — the 66/34 split, the stacked order, the header form's field grid. The trace
 * is the exception because spec 110 rules its shed order a **pure module** (`level →
 * ColumnId[]`) rather than CSS, precisely so "no numeric column is ever shed" is
 * assertable in one line. A pure function needs a number, and CSS cannot hand one to
 * JavaScript — so the width is measured and the module decides.
 *
 * This is not a return to reading the viewport: the element measured is the trace's
 * own wrapper, which is narrower than the work area and does not track it linearly
 * (at a 780 px work area the trace is stacked and full-width; at 960 it is inside a
 * 66% column and *narrower*). It is the most local measurement on the screen.
 *
 * `useLayoutEffect` rather than `useEffect`: the first measurement lands before paint,
 * so an expansion opens at its settled level instead of rendering eleven columns and
 * dropping two a frame later. Shedding a column does not change the wrapper's width
 * (it is a block-level child that fills its column), so there is no feedback loop.
 */
export function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setWidth(el.getBoundingClientRect().width)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width)
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
