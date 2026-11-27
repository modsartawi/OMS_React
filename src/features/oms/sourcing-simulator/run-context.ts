import { createContext, useContext } from 'react'
import type { MapPlace } from '@/core/map/map-panel'

/**
 * What a tab panel may ask of the run (ticket 964): the map tab moves the customer — a click places, a drag moves — and
 * the run plans again from that point, in a replay too. Provided by the page; a panel outside it moves nothing.
 */
export interface SimulatorRun {
  /** Plan again with the customer at this place. */
  moveCustomer(place: MapPlace): void
}

export const SimulatorRunContext = createContext<SimulatorRun | null>(null)

export const useSimulatorRun = () => useContext(SimulatorRunContext)
