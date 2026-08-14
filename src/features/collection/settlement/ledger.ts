import type { SettlementEntryKind, SettlementEntryStatus } from '@/core/models/settlement'

/**
 * The **flat cross-estate ledger** — the door's support view (ticket 270, spec 267
 * D2), and the pure half of it.
 *
 * It answers exactly one question: *"find entry 143, whichever branch it is on"*.
 *
 * ⚠️ **It is explicitly not the account.** A row here is an entry torn out of its
 * branch, so the view can state what an entry *is* but never what a branch's
 * position *is* — it can only assert a total nobody owes and nobody consumes. The
 * position stays on 269's account, and every row here is a way through to it.
 *
 * **Filter-first**, like the four collection inquiries: nothing is fetched until a
 * criterion is set. A 1394-branch ledger opened on nothing would be the estate list
 * this whole design refused, arriving through the back door.
 *
 * 🚩 Pure: no React, no `t()`, no network.
 */

export type LedgerCriteria = {
  /** The phone-call reference. A string, because it comes from an `<input>` and an
   *  empty one must be *absent* rather than `0`. */
  entryNumber: string
  storeId: string
  entryKind: '' | SettlementEntryKind
  status: '' | SettlementEntryStatus
  /**
   * The **batch's handle** — ticket 273's criterion, and the whole of how an
   * uploaded month is reachable an hour later.
   *
   * 🔑 A batch is *"a handle and a provenance fact, never a second lifecycle"*: an
   * entry already carries its `batchId` on D8's contract, so the batch needs no
   * door of its own. This is the estate-wide lookup that already answers *"find
   * this entry, whichever branch it is on"*, asked one field wider — and a *list my
   * batches* door would be a second lifecycle in all but name.
   */
  batchId: string
}

export const EMPTY_LEDGER_CRITERIA: LedgerCriteria = {
  entryNumber: '',
  storeId: '',
  entryKind: '',
  status: '',
  batchId: '',
}

/**
 * Is there anything to search on?
 *
 * 🔑 The **filter-first** rule as a predicate, so the Page can hold the query
 * disabled rather than remembering to. Blank criteria are not a search for
 * everything; they are the absence of a question.
 */
export function hasLedgerCriteria(criteria: LedgerCriteria): boolean {
  return Object.values(criteria).some((v) => v.trim() !== '')
}

/**
 * The criteria on the wire.
 *
 * Blanks are left in and dropped by `buildQuery` in `@/core/api` — the
 * `api-envelope` rule says not to pre-filter them here, and doing so twice is how
 * one of the two filters ends up subtly different.
 */
export function buildLedgerParams(criteria: LedgerCriteria): Record<string, unknown> {
  return {
    entryNumber: criteria.entryNumber.trim(),
    storeId: criteria.storeId.trim(),
    entryKind: criteria.entryKind,
    status: criteria.status,
    batchId: criteria.batchId.trim(),
  }
}

/**
 * The URL keys the criteria live in — 🚩 **the ledger's filter is an address too.**
 *
 * The same ruling 269 made for `?store=`: a reader who found entry 143 across the
 * estate can paste that search into a ticket, and pressing Back out of the account
 * they opened brings the filter back rather than a blank form and a fresh
 * estate-wide query.
 *
 * ⚠️ **`branch`, not `store`.** `?store=` already means *open this branch's
 * account*; reusing it here would make one address mean two screens.
 */
export const LEDGER_PARAMS = ['entryNumber', 'branch', 'kind', 'status', 'batch'] as const

const KINDS: readonly string[] = ['SHORTAGE', 'SURPLUS']
const STATUSES: readonly string[] = ['OPEN', 'CONSUMED', 'CANCELLED', 'CLOSED_OUT']

/** The criteria a URL carries. An unknown enum value reads as *any* rather than as
 *  an error — a hand-edited address should degrade to a wider search, never to a
 *  broken screen. */
export function readLedgerCriteria(params: URLSearchParams): LedgerCriteria {
  const kind = (params.get('kind') ?? '').toUpperCase()
  const status = (params.get('status') ?? '').toUpperCase()
  return {
    entryNumber: (params.get('entryNumber') ?? '').trim(),
    storeId: (params.get('branch') ?? '').trim(),
    entryKind: KINDS.includes(kind) ? (kind as LedgerCriteria['entryKind']) : '',
    status: STATUSES.includes(status) ? (status as LedgerCriteria['status']) : '',
    batchId: (params.get('batch') ?? '').trim(),
  }
}

/** …and the same criteria written back into a URL, blanks omitted so a cleared
 *  filter leaves no trace of itself in the address bar. */
export function writeLedgerCriteria(
  params: URLSearchParams,
  criteria: LedgerCriteria,
): URLSearchParams {
  const next = new URLSearchParams(params)
  const pairs: [string, string][] = [
    ['entryNumber', criteria.entryNumber.trim()],
    ['branch', criteria.storeId.trim()],
    ['kind', criteria.entryKind],
    ['status', criteria.status],
    ['batch', criteria.batchId.trim()],
  ]
  for (const [key, value] of pairs) {
    if (value) next.set(key, value)
    else next.delete(key)
  }
  return next
}

/** The criteria that find one entry by its number — what the search box hands the
 *  ledger when the query is an entry number. */
export function criteriaForEntryNumber(entryNumber: number): LedgerCriteria {
  return { ...EMPTY_LEDGER_CRITERIA, entryNumber: String(entryNumber) }
}

/** …and the criteria that find **one uploaded batch**, whichever branches it
 *  landed on — what the withdrawal view (273) asks the ledger for. */
export function criteriaForBatch(batchId: string): LedgerCriteria {
  return { ...EMPTY_LEDGER_CRITERIA, batchId: batchId.trim() }
}
