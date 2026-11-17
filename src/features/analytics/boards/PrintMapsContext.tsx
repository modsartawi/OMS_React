import { createContext, useCallback, useContext, useEffect, useId, useSyncExternalStore } from 'react'
import type { MapPrintState, PrintMaps } from './print-maps'

/**
 * The print page's maps (883, BackOffice spec 3630 M37, M38), handed down to every map block on the page. Only the
 * report print page provides it; on a screen (a view, a board, the runner's report page) a map block has none and
 * draws as before.
 */
export const PrintMapsContext = createContext<PrintMaps | null>(null)

/**
 * A map block on the print page: it joins the page's maps while mounted and reads its own state. Outside the print
 * page it reads `null`, and the `drawn` / `cannotDraw` it is handed do nothing.
 */
export function usePrintMap(): { state: MapPrintState | null; drawn: () => void; cannotDraw: () => void } {
  const maps = useContext(PrintMapsContext)
  const id = useId()
  useEffect(() => (maps ? maps.join(id) : undefined), [maps, id])
  const subscribe = useCallback((l: () => void) => (maps ? maps.subscribe(l) : () => {}), [maps])
  const read = useCallback(() => (maps ? maps.state(id) : null), [maps, id])
  const state = useSyncExternalStore(subscribe, read, read)
  return { state, drawn: () => maps?.drawn(id), cannotDraw: () => maps?.cannotDraw(id) }
}
