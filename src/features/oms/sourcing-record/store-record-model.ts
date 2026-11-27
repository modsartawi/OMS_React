/**
 * The store record list's view model (ticket 969, BackOffice spec 4354 §6 and §14; owner's choice on the prototype:
 * variant C; the door is BackOffice 4373's `GET SourcingAdvisor/StoreRecords`). Pure.
 *
 * The door sends a row per pair (`StoreRecordPair`), only for the modes that keep a record. The screen has a tab per
 * mode: what every store of the mode shares — the counted-from date, the channels each measure counts, the like-store
 * rate per band — is said once at the top, and below it a row per store, a cell per measure. Figures are as sent:
 * nothing is re-summed or re-worked.
 */
import { bandOf, RECORD_BANDS, type RecordBand, type StoreRecordPair, type StoreRecordReply } from '@/core/models/sourcing-store-record'

/** The modes that keep a record, each a tab, in the spec's order (§14). */
export const RECORD_MODES = ['SLOT', 'PICK_UP', 'DAWAA_NOW'] as const
export type RecordMode = (typeof RECORD_MODES)[number]

/** The measures each mode costs, in the spec's order (§14; server `StoreRecordMeasures`). A measure the door adds follows. */
const MODE_MEASURES: Record<RecordMode, readonly string[]> = {
  SLOT: ['LATE', 'RETURNED', 'CANCELLED'],
  PICK_UP: ['NEVER_READY', 'CANCELLED', 'READY_LATE'],
  DAWAA_NOW: ['CALLOUT_IGNORED'],
}

/** A web-JSON time (`2026-08-29T00:00:00`) as its date. */
export const dateOf = (at: string | null | undefined): string => (at ? at.slice(0, 10) : '')

/** A web-JSON time as local wall clock `yyyy-MM-dd HH:mm:ss`. */
export const wallTime = (at: string | null | undefined): string => (at ? at.slice(0, 19).replace('T', ' ') : '')

/** The hours regular slots start at, as sent (`"10,12,16"`). */
export const slotHours = (hours: string | null | undefined): string[] =>
  (hours ?? '')
    .split(',')
    .map((h) => h.trim())
    .filter((h) => h !== '')

export interface BoardMeasure {
  measure: string
  /** The channels the measure counts, as sent, said once for the mode. */
  channels: string[]
  /** The like-store rate per band; null for a band no store of the mode falls in. */
  likeByBand: Record<RecordBand, number | null>
}

export interface BoardCell {
  measure: string
  /** The store's rate steadied toward like stores': the rate the cost is worked on. */
  steadied: number
  /** The store's own rate. */
  own: number
  like: number
  deliveries: number
  bad: number
  band: RecordBand | null
  /** Nothing counted: the measure sits on the like-store rate (the neutral default). */
  neutral: boolean
}

export interface BoardSlot {
  /** Deliveries standing in one slot; null when none (the door's 0). */
  usual: number | null
  /** The hours regular slots start at. */
  regularHours: string[]
  tillMoves: number
  tillMovesCustomer: number
}

export interface BoardRow {
  store: string
  city: string
  /** The deliveries the cost measures count. */
  deliveries: number
  /** The callout fallback, left out of the record and counted. */
  fallback: number
  /** One per measure of the board, in its order; null where the pair carries no such measure. */
  cells: (BoardCell | null)[]
  /** Any measure of the row ran on the neutral default. */
  neutral: boolean
  slot: BoardSlot | null
}

export interface ModeBoard {
  mode: RecordMode
  /** The mode's counted-from date; the earliest when stores differ; null with no store. */
  countedFrom: string | null
  measures: BoardMeasure[]
  rows: BoardRow[]
}

/** Whether the nightly pass has built the record at least once. */
export const isBuilt = (reply: StoreRecordReply | null | undefined): reply is StoreRecordReply => !!reply && reply.builtAt !== null

const slotOf = (s: StoreRecordPair['slot']): BoardSlot | null =>
  s ? { usual: s.usualSlot > 0 ? s.usualSlot : null, regularHours: slotHours(s.regularSlotHours), tillMoves: s.tillMoves, tillMovesCustomer: s.tillMovesCustomer } : null

/** One mode's tab: the shared figures said once, a row per store. */
export function recordBoard(reply: StoreRecordReply, mode: RecordMode): ModeBoard {
  const pairs = reply.pairs.filter((p) => p.mode === mode)
  const known = MODE_MEASURES[mode]
  const seen = new Set(pairs.flatMap((p) => p.measures.map((m) => m.measure)))
  const order = [...known.filter((m) => seen.has(m)), ...[...seen].filter((m) => !known.includes(m))]

  const measures: BoardMeasure[] = order.map((measure) => {
    const all = pairs.flatMap((p) => p.measures.filter((m) => m.measure === measure))
    const likeByBand = Object.fromEntries(RECORD_BANDS.map((b, i) => [b, all.find((m) => m.band === i)?.likeRate ?? null])) as Record<RecordBand, number | null>
    return { measure, channels: all[0]?.countedChannels ?? [], likeByBand }
  })

  const rows: BoardRow[] = pairs.map((p) => {
    const cells = order.map((measure): BoardCell | null => {
      const m = p.measures.find((x) => x.measure === measure)
      if (!m) return null
      return { measure, steadied: m.steadiedRate, own: m.storeRate, like: m.likeRate, deliveries: m.deliveries, bad: m.badEndings, band: bandOf(m.band), neutral: m.isNeutral }
    })
    return {
      store: p.storeCode,
      city: p.city,
      deliveries: p.costDeliveries,
      fallback: p.fallbackDeliveries,
      cells,
      neutral: p.measures.some((m) => m.isNeutral),
      slot: slotOf(p.slot),
    }
  })

  const dates = pairs.map((p) => dateOf(p.countedFrom)).sort()
  return { mode, countedFrom: dates[0] ?? null, measures, rows }
}
