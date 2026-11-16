import { lazy, Suspense } from 'react'
import type { MapPanelProps } from './MapPanel'

/**
 * The door every caller uses to draw a map (ticket 879, spec 3630 M35): MapLibre, the style and the base map's code
 * are a chunk of their own, fetched the first time a map is on screen. A board, a report or a panel answer with no
 * map loads none of it — `tools/check-map-build.mjs` proves that on the built app.
 *
 * Until the chunk arrives the panel's box is held at its size, empty, so the page does not jump.
 */
const MapPanel = lazy(() => import('./MapPanel'))

export default function LazyMapPanel(props: MapPanelProps) {
  return (
    <Suspense fallback={<div className={`rounded-md border ${props.className ?? 'h-80 w-full'}`} data-map-state="drawing" />}>
      <MapPanel {...props} />
    </Suspense>
  )
}
