import { lazy, Suspense, useEffect, useRef, type ComponentType } from 'react'
import type { MapPanelProps } from './MapPanel'

/**
 * The door every caller uses to draw a map (ticket 879, spec 3630 M35; 908): the map's code is a chunk of its own,
 * fetched the first time a map is on screen, and Google's script is fetched only when that map starts (and only with a
 * key). A board, a report or a panel answer with no map loads none of it — `tools/check-map-build.mjs` proves that on
 * the built app.
 *
 * Until the chunk arrives the panel's box is held at its size, empty, so the page does not jump.
 */

/**
 * Review W10: the chunk's fetch can fail (a deploy replaced it, the network dropped). The app has no error boundary, so
 * a rejected import would take the page down; instead the map ends as "cannot draw" and its caller shows the table, as
 * for a screen with no graphics. React keeps a lazy component's first result: until the page is reloaded, every map
 * on it then reads "cannot draw".
 */
export function loadMapPanel(fetchCode: () => Promise<{ default: ComponentType<MapPanelProps> }>): Promise<{ default: ComponentType<MapPanelProps> }> {
  return fetchCode().catch(() => ({ default: MapCodeUnreadable }))
}

/** The panel when its code could not be fetched: the box at its size, and "cannot draw" told once. */
function MapCodeUnreadable({ onCannotDraw, className = 'h-80 w-full' }: MapPanelProps) {
  const told = useRef(onCannotDraw)
  told.current = onCannotDraw
  useEffect(() => told.current?.('no-graphics'), [])
  return <div className={`rounded-md border ${className}`} data-map-state="cannot-draw" />
}

const MapPanel = lazy(() => loadMapPanel(() => import('./MapPanel')))

export default function LazyMapPanel(props: MapPanelProps) {
  return (
    <Suspense fallback={<div className={`rounded-md border ${props.className ?? 'h-80 w-full'}`} data-map-state="drawing" />}>
      <MapPanel {...props} />
    </Suspense>
  )
}
