/**
 * Document Details' Insurance section, **Changes** (ticket 788, BackOffice 3393 / spec 3389 user
 * stories 59–63): the accepted acts on the order, oldest first, each with who and when, the item and
 * quantity before and after, the reason, and the money source and totals before and after — merged
 * with the order's document log so Ready, pick and close sit on the same line.
 *
 * Pure: no React, no network, no i18n.
 *
 * 🚩 An act accepted before 3393 has no money: it reads `notRecorded`, never `0.00` (spec 3389 user
 * story 62). 🚩 The act that moves the order off the channel's money (`CHANNEL` → `ENGINE`) is
 * marked: it is the moment the patient stopped paying what the insurer sent (user story 61).
 *
 * The log merge: 3393 says the read merges the document log (`kind: 'log'` entries). If the read
 * carries none, the client merges the page's own `documentApi.getLogs` rows instead — never both,
 * so a server-merged log is not drawn twice.
 */
import { formatDateTime } from '@/core/util/date-format'
import type { SdDocumentLogModel } from '@/core/models/sd-document'
import type { ChangeMoney, InsuranceTimelineEntry } from '@/core/models/order-insurance'
import { moneyCell, type MoneyCell } from './insurance-section'

/** The acts with their own words, under `document:insurance.changes.acts.*`. */
export const KNOWN_ACTS = ['PICK', 'SWAP', 'QUANTITY', 'VOID', 'RESTORE', 'CEILING'] as const

/** One side of an act's money: recorded, or not recorded (an act from before 3393). */
export type ChangeMoneyView =
  | { kind: 'notRecorded' }
  | { kind: 'recorded'; source: string; patient: MoneyCell; insurer: MoneyCell }

export interface BeforeAfter {
  before: string | null
  after: string | null
}

export interface ChangeRow {
  kind: 'change'
  key: string
  /** `yyyy-MM-dd HH:mm`, a machine value. */
  at: string
  by: string
  /** The act's code as sent. */
  act: string
  /** Its words' key, or `null` for an act this client does not know (shown by its code). */
  actKey: string | null
  lineNumber: number | null
  /** `null` when the act names no item on either side. */
  item: BeforeAfter | null
  /** Quantity with its unit, each side; `null` when neither side has one. */
  quantity: BeforeAfter | null
  reason: string | null
  before: ChangeMoneyView
  after: ChangeMoneyView
  /** The first change on channel money: `CHANNEL` before, `ENGINE` after. */
  channelToEngine: boolean
}

export interface LogRow {
  kind: 'log'
  key: string
  at: string
  by: string
  action: string
  description: string
  note: string
}

export type TimelineRow = ChangeRow | LogRow

const blank = (v: string | null | undefined) => v == null || v.trim() === ''

function moneyView(money: ChangeMoney | null | undefined, currency: string | null): ChangeMoneyView {
  // 3393's open question: an empty source may be the server's own "not recorded" marker.
  if (!money || blank(money.moneySource)) return { kind: 'notRecorded' }
  const none: MoneyCell = { kind: 'none' }
  return {
    kind: 'recorded',
    source: money.moneySource.trim().toUpperCase(),
    patient: moneyCell(money.patientTotal, currency, none),
    insurer: moneyCell(money.insurerTotal, currency, none),
  }
}

const sides = (before: string | null, after: string | null): BeforeAfter | null =>
  blank(before) && blank(after) ? null : { before: blank(before) ? null : before, after: blank(after) ? null : after }

const qty = (n: number | null, unit: string | null): string | null =>
  n == null ? null : [String(n), unit ?? ''].filter((p) => p.trim() !== '').join(' ')

/** A readable time, else `null`. */
const timeOf = (at: string) => {
  const ms = new Date(at).getTime()
  return Number.isNaN(ms) ? null : ms
}

/**
 * Each entry's sort time: its own when readable, else the last readable time before it in arrival
 * order (or the start of time when none). Sorting by (that time, arrival index) is a total order, so
 * an unreadable time stays beside the entry it arrived after instead of making the comparator
 * disagree with itself.
 */
function sortTimes(entries: readonly InsuranceTimelineEntry[]): number[] {
  let last = Number.NEGATIVE_INFINITY
  return entries.map((e) => {
    const t = timeOf(e.at)
    if (t != null) last = t
    return t ?? last
  })
}

/** The timeline's rows, oldest first: the read's entries, plus the document log when the read has none. */
export function timelineRows(
  timeline: readonly InsuranceTimelineEntry[],
  logs: readonly SdDocumentLogModel[] | null | undefined,
  currency: string | null,
): TimelineRow[] {
  const merged: InsuranceTimelineEntry[] = [...timeline]
  if (!timeline.some((e) => e.kind === 'log'))
    for (const l of logs ?? [])
      merged.push({ kind: 'log', at: l.entryTime, by: l.entryUser, action: l.actionType, actionDescription: l.actionTypeDescription, note: l.note })

  const rows = merged.map((e, i): TimelineRow & { order: number } => {
    const base = { key: `${e.kind}-${i}`, at: formatDateTime(e.at) || e.at, by: e.by, order: i }
    if (e.kind === 'log') return { ...base, kind: 'log', action: e.action, description: e.actionDescription, note: e.note }
    const act = (e.act ?? '').trim().toUpperCase()
    const before = moneyView(e.moneyBefore, currency)
    const after = moneyView(e.moneyAfter, currency)
    return {
      ...base,
      kind: 'change',
      act,
      actKey: (KNOWN_ACTS as readonly string[]).includes(act) ? `insurance.changes.acts.${act}` : null,
      lineNumber: e.lineNumber,
      item: sides(e.itemBefore, e.itemAfter),
      quantity: sides(qty(e.quantityBefore, e.unitBefore), qty(e.quantityAfter, e.unitAfter)),
      reason: blank(e.reason) ? null : e.reason,
      before,
      after,
      // Every CHANNEL → ENGINE act, here; only the first one in time keeps the mark, below.
      channelToEngine: before.kind === 'recorded' && after.kind === 'recorded' && before.source === 'CHANNEL' && after.source === 'ENGINE',
    }
  })

  const times = sortTimes(merged)
  const sorted = rows.sort((a, b) => times[a.order] - times[b.order] || a.order - b.order)
  // The moment the order left the channel's money is the FIRST such act (user story 61), not every one.
  let marked = false
  return sorted.map(({ order: _order, ...row }) => {
    if (row.kind === 'change' && row.channelToEngine) {
      if (marked) return { ...row, channelToEngine: false } as TimelineRow
      marked = true
    }
    return row as TimelineRow
  })
}
