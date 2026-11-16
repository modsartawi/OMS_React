import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { documentDirection } from '@/core/theme/direction'
import Ltr from '@/core/ui/Ltr'
import { maplibreEngine } from './maplibre-engine'
import { openMapPanel, type CannotDrawReason, type MapPoint } from './map-panel'

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
  points: readonly MapPoint[]
  /** The map's accessible name, in the caller's words. */
  ariaLabel: string
  onDrawn?: () => void
  onCannotDraw?: (reason: CannotDrawReason) => void
  /** The panel's size. Defaults to the full width and a fixed height. */
  className?: string
}

/** A token's value on the page (MapLibre takes a colour, not a CSS variable). */
const tokenOf = (el: Element, name: string) => getComputedStyle(el).getPropertyValue(name).trim()

export default function MapPanel({ points, ariaLabel, onDrawn, onCannotDraw, className = 'h-80 w-full' }: MapPanelProps) {
  const { i18n } = useTranslation()
  const box = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<MapPanelState>('drawing')
  // The callers' latest handlers, without restarting the map when they change identity.
  const handlers = useRef({ onDrawn, onCannotDraw })
  handlers.current = { onDrawn, onCannotDraw }
  const lang = i18n.language?.split('-')[0] === 'ar' ? 'ar' : 'en'

  useEffect(() => {
    const container = box.current
    if (!container) return
    setState('drawing')
    const panel = openMapPanel({
      engine: maplibreEngine({ fill: tokenOf(container, '--chart-1'), outline: tokenOf(container, '--card') }),
      container,
      points,
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
  }, [points, lang])

  return (
    <div className={`relative overflow-hidden rounded-md border ${className}`} data-map-state={state}>
      {/* Fills the frame by size, not by `absolute`: MapLibre sets its container `position: relative`. */}
      <div ref={box} role="region" aria-label={ariaLabel} className="h-full w-full" />
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
