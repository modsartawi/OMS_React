/**
 * The store record list's view model (ticket 969, BackOffice spec 4354 §6 and §14; owner's choice on the prototype:
 * variant C). Pure.
 *
 * The door sends a row per pair (`StoreRecordPair`). The screen has a tab per mode: what every store of the mode
 * shares — the counted-from date, the channels each measure counts, the like-store rate per band — is said once at the
 * top, and below it a row per store, a cell per measure. Figures are as sent: nothing is re-summed.
 */
import { RECORD_BANDS, type RecordBand, type RecordNeutralWhy, type StoreRecordPair, type StoreRecordReply, type StoreRecordShown } from '@/core/models/sourcing-store-record'

/** The modes that keep a record, each a tab, in the spec's order (§14). */
export const RECORD_MODES = ['SLOT', 'PICK_UP', 'DAWAA_NOW'] as const
export type RecordMode = (typeof RECORD_MODES)[number]

/** The measures each mode costs, in the spec's order (§14). A measure the door adds is shown after them. */
const MODE_MEASURES: Record<RecordMode, readonly string[]> = {
  SLOT: ['late', 'returned', 'cancelled'],
  PICK_UP: ['neverMadeReady', 'cancelled', 'readyLate'],
  DAWAA_NOW: ['calloutIgnored'],
}

/** The channels in the order the screen names them. */
const CHANNEL_ORDER = ['APP', 'SITE', 'CALL_CENTRE']

export interface BoardMeasure {
  measure: string
  price: number
  /** The channels the measure counts, said once for the mode. */
  channels: string[]
  /** The like-store rate per band; null for a band no store of the mode falls in. */
  likeByBand: Record<RecordBand, number | null>
}

export interface BoardCell {
  measure: string
  rate: number | null
  ownRate: number | null
  likeStores: number
  count: number
  bad: number
  cost: number
  neutral: RecordNeutralWhy | null
}

export interface BoardRow {
  store: string
  storeName: string
  band: StoreRecordPair['band']
  deliveries: number
  cost: number
  fallbackLeftOut: number
  /** One per measure of the board, in its order; null where the pair carries no such measure. */
  cells: (BoardCell | null)[]
  /** Any measure of the row ran on the neutral default. */
  neutral: boolean
  slot: StoreRecordPair['slot'] | null
  tillMoves: StoreRecordPair['tillMoves'] | null
  shown: StoreRecordShown | null
}

export interface ModeBoard {
  mode: RecordMode
  /** The mode's counted-from date; the earliest when stores differ; null with no store. */
  countedFrom: string | null
  measures: BoardMeasure[]
  rows: BoardRow[]
}

const channelRank = (c: string) => {
  const i = CHANNEL_ORDER.indexOf(c)
  return i < 0 ? CHANNEL_ORDER.length : i
}

/** Whether the nightly pass has built the record at least once. */
export const isBuilt = (reply: StoreRecordReply | null | undefined): reply is StoreRecordReply => !!reply && reply.builtAt !== null

/** One mode's tab: the shared figures said once, a row per store. */
export function recordBoard(reply: StoreRecordReply, mode: RecordMode): ModeBoard {
  const pairs = reply.pairs.filter((p) => p.mode === mode && p.measures.length > 0)
  const known = MODE_MEASURES[mode]
  const seen = new Set(pairs.flatMap((p) => p.measures.map((m) => m.measure)))
  const order = [...known.filter((m) => seen.has(m)), ...[...seen].filter((m) => !known.includes(m))]

  const measures: BoardMeasure[] = order.map((measure) => {
    const all = pairs.flatMap((p) => p.measures.filter((m) => m.measure === measure).map((m) => ({ m, band: p.band })))
    const channels = [...new Set(all.flatMap((x) => x.m.channels))].sort((a, b) => channelRank(a) - channelRank(b))
    const likeByBand = Object.fromEntries(RECORD_BANDS.map((b) => [b, all.find((x) => x.band === b)?.m.likeStores ?? null])) as Record<RecordBand, number | null>
    return { measure, price: all[0]?.m.price ?? 0, channels, likeByBand }
  })

  const shownOf = new Map(reply.shown.map((s) => [s.store, s]))
  const rows: BoardRow[] = pairs.map((p) => {
    const cells = order.map((measure): BoardCell | null => {
      const m = p.measures.find((x) => x.measure === measure)
      if (!m) return null
      return { measure, rate: m.rate, ownRate: m.ownRate, likeStores: m.likeStores, count: m.count, bad: m.bad, cost: m.cost, neutral: m.neutral }
    })
    return {
      store: p.store,
      storeName: p.storeName,
      band: p.band,
      deliveries: p.deliveries,
      cost: p.cost,
      fallbackLeftOut: p.fallbackLeftOut,
      cells,
      neutral: p.measures.some((m) => m.neutral !== null),
      slot: p.slot ?? null,
      tillMoves: p.tillMoves ?? null,
      shown: shownOf.get(p.store) ?? null,
    }
  })

  const dates = pairs.map((p) => p.countedFrom).sort()
  return { mode, countedFrom: dates[0] ?? null, measures, rows }
}

/** The pairs of the modes that keep no record (the carrier modes, beyond the border): on the neutral default, costing nothing. */
export const carrierPairs = (reply: StoreRecordReply): Pick<StoreRecordPair, 'store' | 'storeName' | 'mode'>[] =>
  reply.pairs.filter((p) => !(RECORD_MODES as readonly string[]).includes(p.mode)).map(({ store, storeName, mode }) => ({ store, storeName, mode }))
