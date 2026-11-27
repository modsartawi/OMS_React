/**
 * Nearby stock on the highlighted search row (ticket 991, spec 983 D12) — **when** the
 * console asks `StockElsewhere` from the search list, and **what the one line says**.
 *
 * 🚩 **On demand, never fanned out.** `StockElsewhere` is the one read on the contract
 * that is a remote hop out of SIS.Api (`stock-view.ts`). The search list holds up to a
 * capped page of rows, so asking per row would be that many hops per keystroke. Only the
 * row the agent's keyboard or mouse has SETTLED on for `NEARBY_SETTLE_MS` asks, and an
 * agent holding the down arrow through ten rows asks once, for the tenth.
 *
 * 🚩 **Cached per item and plant.** Coming back to a row already asked about asks
 * nothing; a store change is a new question (the list is ranked from the order's plant),
 * so the plant is part of the key.
 *
 * The line's states are `stock-view.ts`'s, untouched: `unknown` says *could not check*,
 * never *nobody has it*.
 */
import type { StockElsewhereResult } from '@/core/models/callcenter'
import type { GuidancePhrase } from './guidance-view'
import type { Availability } from './item-search'
import type { StockPanel } from './stock-view'

/** How long a row must stay aimed at before it asks. Longer than one arrow repeat
 *  (~30–60 ms) and than a mouse crossing a row, short enough to land while the agent
 *  is still reading the row's name. */
export const NEARBY_SETTLE_MS = 300

/** How long one answer stands for the same item at the same plant. Long enough that
 *  arrowing back up a list re-asks nothing; short enough that a long call re-reads a
 *  number the agent is about to say out loud. The expanded panel (`ItemPanel`) keeps
 *  its own always-fresh read. */
export const NEARBY_FRESH_MS = 60_000

/** Stores named on the line. The rest is a count — the line is read mid-sentence. */
export const NEARBY_SHOWN = 3

export const nearbyStockKey = (transactionId: string, plant: string, itemNumber: string) =>
  ['callcenter', 'nearbyStock', transactionId, plant, itemNumber] as const

/**
 * The query the settled row runs — the same options object for the component's
 * `useQuery` and for the test's `QueryClient`, so the cache rule proven is the one used.
 * The fetcher is passed in (`callCenterApi.stockElsewhere` in the app).
 */
export function nearbyStockQuery(
  ask: (transactionId: string, itemNumber: string) => Promise<StockElsewhereResult>,
  transactionId: string,
  plant: string,
  itemNumber: string,
) {
  return {
    queryKey: nearbyStockKey(transactionId, plant, itemNumber),
    queryFn: () => ask(transactionId, itemNumber),
    staleTime: NEARBY_FRESH_MS,
    // The server already raced its own timeout and answers `available: false` rather
    // than throwing; a throw is a considered refusal, and retrying it is a second hop.
    retry: false as const,
  }
}

/** The clock, injectable so the rule can be proven without a DOM. */
export interface SettleTimers {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const realTimers: SettleTimers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * A trailing debounce over *what is aimed at*. Every `aim` restarts the clock; only a
 * value that is still aimed at `ms` later is settled. `aim(null)` (nothing aimed) and
 * `cancel()` (unmount, a new question) settle nothing.
 */
export function createSettle<T>(ms: number, onSettle: (value: T) => void, timers: SettleTimers = realTimers) {
  let pending: unknown = null
  const cancel = () => {
    if (pending !== null) timers.clear(pending)
    pending = null
  }
  return {
    aim(value: T | null) {
      cancel()
      if (value === null) return
      pending = timers.set(() => {
        pending = null
        onSettle(value)
      }, ms)
    },
    cancel,
  }
}

export interface NearbyStore {
  plant: string
  /** The area name the agent says (*Malqa*), else the city, else the store code. */
  name: string
  atp: number
}

/**
 * The line under the row's price, closed. `here` is the row's OWN availability at the
 * order's plant (`StockElsewhere` excludes that plant by construction), `null` where it
 * is unknown — never a stand-in zero.
 */
export type NearbyLine =
  | { kind: 'shut' }
  | { kind: 'pending' }
  | { kind: 'refused'; refusal: GuidancePhrase }
  /** 🚩 The hop did not answer: *could not check*, never *nobody has it*. */
  | { kind: 'unknown' }
  | { kind: 'none'; here: number | null }
  | { kind: 'listed'; here: number | null; stores: NearbyStore[]; more: number }

export function nearbyLine(here: Availability, panel: StockPanel): NearbyLine {
  switch (panel.kind) {
    case 'shut':
    case 'pending':
    case 'unknown':
      return { kind: panel.kind }
    case 'refused':
      return { kind: 'refused', refusal: panel.refusal }
    case 'none':
      return { kind: 'none', here: here.quantity === null ? null : Math.max(here.quantity, 0) }
    case 'listed': {
      const stores = panel.rows.slice(0, NEARBY_SHOWN).map((row) => ({
        plant: row.plant,
        name: row.areaName || row.city || row.plant,
        atp: row.atp,
      }))
      return {
        kind: 'listed',
        here: here.quantity === null ? null : Math.max(here.quantity, 0),
        stores,
        // From the server's honest total, never from the list's length.
        more: Math.max(panel.withStock - stores.length, 0),
      }
    }
  }
}
