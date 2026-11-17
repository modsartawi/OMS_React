import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { documentDirection } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { maplibreEngine } from './maplibre-engine'
import { placeCard } from './map-drawing'
import { openMapPanel, type CannotDrawReason, type MapCardState, type MapGrouping, type MapPoint } from './map-panel'

/**
 * The map panel (ticket 879, BackOffice spec 3630; ADR 0135): given points, it draws them on our own base map of KSA
 * and Bahrain. ⚠ Import it through `./LazyMapPanel`, never directly: this module pulls MapLibre in, and a board, a
 * report or a panel answer with no map must load none of it (M35).
 *
 * - Place names follow the screen's language (`i18n.language`), its zoom buttons the page's direction.
 * - "© OpenStreetMap" is drawn by the panel as an ordinary element, so it is on every map and prints (M34).
 * - `data-map-state` reads `drawing`, `drawn` or `cannot-draw`, for the print page (883) and the drives; the same
 *   moments reach the caller as `onDrawn` / `onCannotDraw`. On `cannot-draw` the caller shows the table.
 */

/** The licence's own credit (ODbL; BackOffice 3634): the same words on every screen language, so not a locale key. */
export const MAP_CREDIT = { text: '© OpenStreetMap', href: 'https://www.openstreetmap.org/copyright' } as const

export type MapPanelState = 'drawing' | 'drawn' | 'cannot-draw'

export interface MapPanelProps {
  /** The points, each at its size and colour (881). Pass a STABLE array: a new identity restarts the map. */
  points: readonly MapPoint[]
  /** How a group of nearby stores reads (881): its count, and its sum when the size adds up. Stable, like `points`. */
  grouping?: MapGrouping | null
  /** The map's accessible name, in the caller's words. */
  ariaLabel: string
  onDrawn?: () => void
  onCannotDraw?: (reason: CannotDrawReason) => void
  /** The panel's size. Defaults to the full width and a fixed height. */
  className?: string
}

/** A token's value on the page (MapLibre takes a colour, not a CSS variable). */
const tokenOf = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

export default function MapPanel({ points, grouping = null, ariaLabel, onDrawn, onCannotDraw, className = 'h-80 w-full' }: MapPanelProps) {
  const { i18n } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MapPanelState>('drawing')
  const [card, setCard] = useState<MapCardState>(null)
  // The callers' latest handlers, without restarting the map when they change identity.
  const handlers = useRef({ onDrawn, onCannotDraw })
  handlers.current = { onDrawn, onCannotDraw }
  const lang = i18n.language?.split('-')[0] === 'ar' ? 'ar' : 'en'

  useEffect(() => {
    const container = box.current
    if (!container) return
    setState('drawing')
    setCard(null)
    const panel = openMapPanel({
      engine: maplibreEngine(),
      container,
      points,
      grouping,
      inkOf: (token) => tokenOf(container, token),
      onCard: setCard,
      lang,
      dir: documentDirection(),
      origin: window.location.origin,
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
  }, [points, grouping, lang])
  const shown = card ? points.find((p) => p.id === card.id) : undefined

  return (
    <div ref={frame} className={`relative overflow-hidden rounded-md border ${className}`} data-map-state={state}>
      {/* Fills the frame by size, not by `absolute`: MapLibre sets its container `position: relative`. */}
      <div ref={box} role="region" aria-label={ariaLabel} className="h-full w-full" />
      {card && shown?.card && <PointCard card={shown.card} at={card} frame={frame} />}
      <div className="absolute bottom-0 end-0 z-10 bg-card/80 px-1.5 py-0.5 text-[10px] leading-tight text-muted-foreground">
        {/* The credit is one LTR value: under Arabic, unisolated, its "©" runs to the far end. */}
        <Ltr>
          <a href={MAP_CREDIT.href} target="_blank" rel="noreferrer">
            {MAP_CREDIT.text}
          </a>
        </Ltr>
      </div>
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
