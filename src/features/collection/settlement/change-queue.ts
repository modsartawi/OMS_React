import type {
  SettlementChangeQueueRow,
  SettlementChangeRequest,
  SettlementChangeRequestActResult,
  SettlementChangeRequestKind,
  SettlementEntryKind,
  SettlementEntryStatus,
} from '@/core/models/settlement'
import { CHANGE_QUEUE_LIMIT, isCapReached } from './cap'
import { cardFor, type CardChange } from './change-request'

/**
 * **The supervisor's queue of waiting change requests** — what the *Change requests* tab
 * of Open settlements draws (spec 342 W9 / stories 19–20, ticket 353), off BackOffice
 * 2285's `GET Settlement/ChangeRequest/Open`.
 *
 * 🔑 **One row per waiting request, in the server's order** — oldest first (`requestedAt`,
 * then the ULID). Never re-sorted: the answer is capped at `CHANGE_QUEUE_LIMIT`, and
 * re-sorting a capped page changes which rows the cap kept (`open-lane.ts`'s rule).
 *
 * 🔑 **What is asked is `cardFor`'s** — the waiting card's own old → new, only the fields
 * that differ, read at holding scale. The queue and the entry panel's card cannot disagree
 * about what a request asks, because they are one function. A `DELETE` differs in nothing
 * (2285: `newAmount` = `oldAmount`, the same description) and is said by its kind.
 *
 * ⚠️ **The figures beside it are the entry NOW** (2285's committed reads), never
 * `oldAmount`: the supervisor decides against what the entry holds today, and Approve
 * re-checks the spent floor anyway.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock.
 */

/** One queue row, as the tab draws it. */
export type ChangeQueueRow = {
  changeRequestId: string
  settlementEntryId: string
  /** The branch code — 2285 has no separate code field. */
  storeId: string
  /** The Store master's name, or the code echoed back. */
  storeName: string
  /** The plant's — figures are drawn at the branch's scale. */
  currencyKey: string
  /** `null` when the entry is missing (the wire's `0`). */
  entryNumber: number | null
  /** `null` when the entry is missing (the wire's `''`). */
  entryKind: SettlementEntryKind | null
  entryStatus: SettlementEntryStatus | null
  kind: SettlementChangeRequestKind
  /** Only the fields that differ, amount · description · day — `cardFor`'s. */
  changes: CardChange[]
  /** The requester, under the name they had then. */
  by: string
  /** `null` when unstamped. Local wall clock, as received. */
  at: string | null
  /** The request's Reason — server text, unlocalised. */
  reason: string
  /** The entry as it stands now; `null` when the entry is missing. */
  now: { amount: number; remainingAmount: number; spentAmount: number } | null
  /** The request itself — what the inline acts send (`rejectBody`) and the dialog reads. */
  request: SettlementChangeRequest
}

/** One wire row → what the tab draws. */
export function queueRow(row: SettlementChangeQueueRow): ChangeQueueRow {
  const card = cardFor(row)
  const missing = !(row.entryNumber > 0)
  return {
    changeRequestId: row.changeRequestId,
    settlementEntryId: row.settlementEntryId,
    storeId: row.storeId,
    storeName: row.storeName,
    currencyKey: row.currencyKey,
    entryNumber: missing ? null : row.entryNumber,
    entryKind: row.entryKind || null,
    entryStatus: row.entryStatus || null,
    kind: card.kind,
    changes: card.changes,
    by: card.by,
    at: card.at,
    reason: card.reason,
    now: missing ? null : { amount: row.amount, remainingAmount: row.remainingAmount, spentAmount: row.spentAmount },
    request: row,
  }
}

/** What the tab draws: `failed` ≠ `empty` (good news) ≠ rows. */
export type ChangeQueueView = { kind: 'failed' } | { kind: 'empty' } | { kind: 'rows'; rows: ChangeQueueRow[] }

export type ChangeQueue = {
  /** `null` = not known, drawn as an em-dash — never `0`, which reads as *nothing waiting*. */
  count: number | null
  /** Measured against `CHANGE_QUEUE_LIMIT`. */
  capReached: boolean
  view: ChangeQueueView
}

export type ChangeQueueInput = {
  /** The one `Settlement/ChangeRequest/Open` answer. */
  rows: readonly SettlementChangeQueueRow[] | null | undefined
  /** ⚠️ Its OWN failure — the lanes' tabs are unaffected, and vice versa. */
  failed: boolean
}

/**
 * Did the read fail? Its own failure — or an answer that is not a list at all, which the
 * door never sends: it is not *nothing waiting*, and counting it as `0` would be the
 * screen inventing good news.
 */
const readFailed = ({ rows, failed }: ChangeQueueInput): boolean => failed || (rows != null && !Array.isArray(rows))

/** How big the queue is — split out for the tab strip, as `tallyPendingLane` is. */
export function tallyChangeQueue(input: ChangeQueueInput): Pick<ChangeQueue, 'count' | 'capReached'> {
  if (readFailed(input)) return { count: null, capReached: false }
  const { rows } = input
  return { count: waitingRows(rows).length, capReached: isCapReached(rows?.length ?? 0, CHANGE_QUEUE_LIMIT) }
}

export function buildChangeQueue(input: ChangeQueueInput): ChangeQueue {
  const tally = tallyChangeQueue(input)
  if (readFailed(input)) return { ...tally, view: { kind: 'failed' } }
  const rows = waitingRows(input.rows).map(queueRow)
  return { ...tally, view: rows.length === 0 ? { kind: 'empty' } : { kind: 'rows', rows } }
}

/**
 * **The answer on screen without one request** — an approve or reject the server applied
 * (`afterDecide`'s `decided`) leaves the queue at once, before the re-read lands (W8).
 */
export function withoutRequest<Row extends Pick<SettlementChangeRequest, 'changeRequestId'>>(
  rows: Row[] | undefined,
  changeRequestId: string,
): Row[] | undefined {
  return rows?.filter((r) => r.changeRequestId !== changeRequestId)
}

/**
 * **A refused act's answer, onto its row** (W8) — the entry's figures NOW (`amount`,
 * `remainingAmount`, `spentAmount`) from the answer, before the re-read lands, so a
 * `BELOW_SPENT` said on the row never stands beside an older spent figure. Only the row(s)
 * of the entry the answer names; the request's own figures (`old…` / `new…`) are what was
 * asked and never move. An answer naming no entry changes nothing.
 */
export function withEntryNow(
  rows: SettlementChangeQueueRow[] | undefined,
  answer: Pick<SettlementChangeRequestActResult, 'settlementEntryId' | 'amount' | 'remainingAmount' | 'spentAmount'>,
): SettlementChangeQueueRow[] | undefined {
  const id = (answer.settlementEntryId ?? '').trim()
  if (!rows || !id) return rows
  return rows.map((r) =>
    r.settlementEntryId === id
      ? { ...r, amount: answer.amount, remainingAmount: answer.remainingAmount, spentAmount: answer.spentAmount }
      : r,
  )
}

/** The rows still waiting — the queue's count must not include what it did not ask for. */
function waitingRows(rows: readonly SettlementChangeQueueRow[] | null | undefined): SettlementChangeQueueRow[] {
  return (rows ?? []).filter((r) => r.status === 'OPEN')
}
