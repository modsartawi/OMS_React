/**
 * Edge auto-scroll while something is dragged (846; research `docs/research/846-canvas-editor-drag-drop-ux.md`,
 * after Atlassian's Pragmatic drag and drop auto-scroller): the page scrolls only while the pointer is inside a band
 * at the top or bottom of the visible area, faster the deeper it is in the band, full speed a little BEFORE the edge,
 * and it ramps up over the first moments of a hold, so a pointer passing through the band does not throw the page.
 *
 * Pure: the caller hands in where the pointer is, the visible area and how long the pointer has been in the band.
 */

export interface AutoScrollTuning {
  /** The band's depth in px from each edge of the visible area. */
  readonly band: number
  /** Full speed, in px per animation frame. */
  readonly maxSpeed: number
  /** How long a hold takes to reach full speed, in ms. */
  readonly rampMs: number
  /** The share of the band, nearest the edge, that already scrolls at full speed. */
  readonly fullAt: number
}

export const AUTO_SCROLL: AutoScrollTuning = { band: 96, maxSpeed: 18, rampMs: 500, fullAt: 0.2 }

/**
 * The scroll step for this frame: negative scrolls up, positive down, 0 outside both bands. `held` is the ms the
 * pointer has been in a band (0 on its first frame there).
 */
export function edgeSpeed(pointerY: number, area: { top: number; bottom: number }, held: number, tune: AutoScrollTuning = AUTO_SCROLL): number {
  const band = Math.min(tune.band, (area.bottom - area.top) / 4)
  if (band <= 0) return 0
  const intoTop = area.top + band - pointerY
  const intoBottom = pointerY - (area.bottom - band)
  const into = Math.max(intoTop, intoBottom)
  if (into <= 0) return 0
  // 0 at the band's inner edge, 1 from `fullAt` of the band before the edge (and past it, outside the area).
  const depth = Math.min(1, into / (band * (1 - tune.fullAt)))
  const ramp = Math.min(1, Math.max(0.15, held / tune.rampMs))
  const speed = Math.max(1, Math.round(tune.maxSpeed * depth * depth * ramp))
  return intoTop > intoBottom ? -speed : speed
}

/** The element that scrolls `el` vertically: the nearest scrollable ancestor, or the document. */
export function scrollParentOf(el: Element | null): Element {
  for (let e = el?.parentElement ?? null; e; e = e.parentElement) {
    const y = getComputedStyle(e).overflowY
    if ((y === 'auto' || y === 'scroll') && e.scrollHeight > e.clientHeight) return e
  }
  return document.scrollingElement ?? document.documentElement
}
