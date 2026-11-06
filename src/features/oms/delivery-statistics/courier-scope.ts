/**
 * What a chosen courier hides (ticket 813, spec 811). Pure, pinned by `courier-scope.test.ts`.
 *
 * The courier scope is the SERVER's: under `Courier` it counts only the home deliveries actually
 * dispatched to that courier (by the dispatch it sent, never by the courier field's FarEye default).
 * The page only sends the code and hides what cannot belong to a courier — everything a pick-up owns:
 * the Pick-up lane, the Pick-up misses row and the table's Pick-up view. With all couriers (`''`)
 * nothing is hidden and the page is exactly the till's view.
 *
 * Kept apart from `lanes.ts` / `misses-rows.ts` / `store-rows.ts`: they read the wire as sent, and the
 * page applies this filter over what they return.
 */
import type { LaneTrack } from './lanes'
import { TABLE_TRACKS, type TableTrack } from './store-rows'

/** The couriers the picker offers, in its order: FarEye, OTO, SMSA, Starlinks. The retired `DAWA` is not offered. */
export const COURIERS = ['FREY', 'OTOX', 'SMSA', 'SLNK'] as const

/** Whether a courier is chosen, so whatever a pick-up owns is hidden. `''` is all couriers. */
export const hidesPickUp = (courier: string): boolean => courier !== ''

/** The lanes or misses rows the page draws under the courier: Pick-up's dropped when one is chosen. */
export function courierTracks<T extends { track: LaneTrack }>(items: readonly T[], courier: string): T[] {
  return hidesPickUp(courier) ? items.filter((item) => item.track !== 'pickUp') : [...items]
}

/** The table views offered under the courier: no Pick-up view when one is chosen. */
export function courierTableTracks(courier: string): TableTrack[] {
  return TABLE_TRACKS.filter((track) => !(hidesPickUp(courier) && track === 'pickUp'))
}

/** The table view as it reads under the courier: Pick-up reads as Delivery when one is chosen. */
export function courierTrack(track: TableTrack, courier: string): TableTrack {
  return hidesPickUp(courier) && track === 'pickUp' ? 'delivery' : track
}
