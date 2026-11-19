import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { documentDirection } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { googleEngine } from './google-engine'
import { placeCard } from './map-drawing'
import { openMapPanel, type CannotDrawReason, type MapCardState, type MapGrouping, type MapLine, type MapPoint, type MapsAccess } from './map-panel'

/**
 * The map panel (ticket 879, BackOffice spec 3630; ticket 908, ADR 0139): given points, it draws them on Google's road
 * map, region Saudi Arabia. ⚠ Import it through `./LazyMapPanel`, never directly: a board, a report or a panel answer
 * with no map must load none of the map's code, and Google's script is fetched only when a map starts (M35).
 *
 * - Google's key is the model's `maps` part (BackOffice 3986), passed in by the caller; without one the panel cannot
 *   draw (`no-key`) and Google is never asked.
 * - Place names follow the screen's language (`i18n.language`), its zoom buttons the page's direction.
 * - Google's own logo and terms are drawn by Google on every map, and print (M34). The panel adds no credit of its own.
 * - `data-map-state` reads `drawing`, `drawn` or `cannot-draw`, for the print page (883) and the drives; the same
 *   moments reach the caller as `onDrawn` / `onCannotDraw`. On `cannot-draw` the caller shows the table.
 */

export type MapPanelState = 'drawing' | 'drawn' | 'cannot-draw'

export interface MapPanelProps {
  /** The points, each at its size and colour (881). Pass a STABLE array: a new identity restarts the map. */
  points: readonly MapPoint[]
  /** How a group of nearby stores reads (881): its count, and its sum when the size adds up. Stable, like `points`. */
  grouping?: MapGrouping | null
  /**
   * Lines between places (922): a case's legs, each in its colour with its words at its middle, beneath the points.
   * Stable, like `points`. Absent: none, and the map is drawn exactly as before.
   */
  lines?: readonly MapLine[]
  /** The model's `maps` part (BackOffice 3986): Google's key, and the map ID when served. Absent: "cannot draw" (`no-key`). */
  maps?: MapsAccess | null
  /** The map's accessible name, in the caller's words. */
  ariaLabel: string
  onDrawn?: () => void
  onCannotDraw?: (reason: CannotDrawReason) => void
  /** The panel's size. Defaults to the full width and a fixed height. */
  className?: string
}

/** A token's value on the page (Google takes a colour, not a CSS variable). */
const tokenOf = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

export default function MapPanel({ points, grouping = null, lines, maps = null, ariaLabel, onDrawn, onCannotDraw, className = 'h-80 w-full' }: MapPanelProps) {
  const { i18n } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MapPanelState>('drawing')
  const [card, setCard] = useState<MapCardState>(null)
  // The callers' latest handlers, without restarting the map when they change identity.
  const handlers = useRef({ onDrawn, onCannotDraw })
  handlers.current = { onDrawn, onCannotDraw }
  const lang = i18n.language?.split('-')[0] === 'ar' ? 'ar' : 'en'
  // The key's own value, not the part's identity: a model read again must not restart a drawn map.
  const key = maps?.key ?? ''
  const mapId = maps?.mapId

  useEffect(() => {
    const container = box.current
    if (!container) return
    setState('drawing')
    setCard(null)
    const panel = openMapPanel({
      engine: googleEngine(),
      container,
      maps: { key, ...(mapId ? { mapId } : {}) },
      points,
      grouping,
      lines,
      inkOf: (token) => tokenOf(container, token),
      onCard: setCard,
      lang,
      dir: documentDirection(),
      onDrawn: () => {
        setState('drawn')
        handlers.current.onDrawn?.()
      },
      onCannotDraw: (reason) => {
        setState('cannot-draw')
        handlers.current.onCannotDraw?.(reason)
      },
    })
    return () => panel.close()
  }, [points, grouping, lines, lang, key, mapId])
  const shown = card ? points.find((p) => p.id === card.id) : undefined

  return (
    <div ref={frame} className={`relative overflow-hidden rounded-md border ${className}`} data-map-state={state}>
      {/* Fills the frame by size, not by `absolute`: Google sets its container's position itself. */}
      <div ref={box} role="region" aria-label={ariaLabel} className="h-full w-full" />
      {card && shown?.card && <PointCard card={shown.card} at={card} frame={frame} />}
    </div>
  )
}

/**
 * A store's card (881, M23): its name and city, and its figures as the table formats them. Placed beside the point
 * pointed at, by the engine's pixel position: a physical `left`/`top`, since the canvas reports physical pixels in
 * either direction. Pointer events pass through, so the card never hides the point under it from the next tap.
 * Review W4: the panel moves it with its store as the map moves, and it is held inside the panel (`placeCard`).
 */
function PointCard({ card, at, frame }: { card: NonNullable<MapPoint['card']>; at: NonNullable<MapCardState>; frame: RefObject<HTMLDivElement | null> }) {
  const self = useRef<HTMLDivElement>(null)
  const [place, setPlace] = useState<{ left: number; top: number }>({ left: at.x + 12, top: at.y + 12 })
  useLayoutEffect(() => {
    const el = self.current
    const box = frame.current
    if (!el || !box) return
    setPlace(placeCard(at, { width: box.clientWidth, height: box.clientHeight }, { width: el.offsetWidth, height: el.offsetHeight }))
  }, [at, card, frame])
  return (
    <div
      ref={self}
      className="pointer-events-none absolute z-20 max-w-60 rounded-md border bg-card px-2.5 py-1.5 text-xs text-card-foreground shadow-(--shadow-pop)"
      style={place}
      data-map-card={at.pinned ? 'pinned' : 'shown'}
    >
      <div className="font-medium">
        <bdi>{card.title}</bdi>
      </div>
      {card.subtitle && (
        <div className="text-muted-foreground">
          <bdi>{card.subtitle}</bdi>
        </div>
      )}
      {card.figures.map((f) => (
        <div key={f.label} className="mt-0.5 flex justify-between gap-3">
          <bdi className="text-muted-foreground">{f.label}</bdi>
          <Ltr>{f.value}</Ltr>
        </div>
      ))}
    </div>
  )
}
