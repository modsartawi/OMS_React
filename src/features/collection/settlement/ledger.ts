import type {
  SettlementEntryKind,
  SettlementEntryStatus,
  SettlementLedgerCriteria,
} from '@/core/models/settlement'
import {
  BATCH_PARAM,
  ENTRY_PARAM,
  FROM_PARAM,
  KIND_PARAM,
  STATUS_PARAM,
  STORE_PARAM,
  TO_PARAM,
  VIEW_PARAM,
} from './addresses'
import { SCOPE_PARAM } from './scope'

/**
 * **The cross-estate lookup's rules** — what the URL is asking the ledger, and
 * whether it is asking anything at all.
 *
 * 🔑 **The door this serves is the answer to the one question the spec's own design
 * invited and could not answer.** BackOffice 1173 mints `entryNumber` and calls it
 * *"the handle finance and the branch settle by on the phone"*; `Settlement/Account`
 * takes the `storeId` the caller is ringing up to **ask for**. So *"entry 143 — which
 * branch is that?"* had no door until BackOffice 1199 §3 built one.
 *
 * ⚠️ **This module stood here in ticket 270 and was deleted by 274**, because the
 * door it addressed did not exist. It is back because the door is, and it is
 * deliberately *not* a restoration of 270's version: that one filtered a client-held
 * array, and this one describes a **server** query whose contract includes a refusal.
 *
 * 🚩 Pure: no React, no `t()`, no network, no clock. (⚠️ Note the last one — see
 * `hasCriterion`. Nothing here defaults a date to *today*, so this module's answers
 * do not change overnight.)
 */

/** SHORTAGE | SURPLUS, in the order the posting form offers them. */
export const LEDGER_KINDS: SettlementEntryKind[] = ['SHORTAGE', 'SURPLUS']

/**
 * The four states, **open first**.
 *
 * Not alphabetical and not the type's declaration order by accident: `OPEN` is the
 * one an accountant asks for by itself — *"what is still owed out there"* — and the
 * other three are what a specific investigation reaches for.
 */
export const LEDGER_STATUSES: SettlementEntryStatus[] = [
  'OPEN',
  'CONSUMED',
  'CANCELLED',
  'CLOSED_OUT',
]

/** Which keys belong to this view. Read by nothing but the tests and the docblock in
 *  `addresses.ts` — the drop rule there is a keep-list, so these fall away by not
 *  being on it rather than by being named. */
export const LEDGER_PARAMS = [
  ENTRY_PARAM,
  STORE_PARAM,
  KIND_PARAM,
  STATUS_PARAM,
  BATCH_PARAM,
  FROM_PARAM,
  TO_PARAM,
]

/**
 * Is the ledger being asked anything?
 *
 * 🔑 **The server refuses a bare call** (`SettlementLedgerCriterionRequired`, a 400),
 * and this mirrors that rule so the screen can draw *"tell me what to look for"*
 * instead of issuing a request it knows will be refused.
 *
 * ⚠️ **The mirror is a convenience and never the authority.** The refusal stays the
 * server's: a client-side guard that drifts from it is a screen that quietly stops
 * asking, which is strictly worse than one that asks and is told no. If these two
 * ever disagree, this one is wrong.
 *
 * 🚩 And the rule is not *"the ledger needs narrowing"* — `status: 'OPEN'` alone
 * satisfies it, and that is the ordinary estate-wide call this whole view exists to
 * make possible. What is refused is the **empty question**, because an unfiltered
 * ledger is bounded only by the row cap: it would answer *"the newest 500 entries in
 * the estate"* while looking like the ledger, and a reader who scrolled to the bottom
 * of it would carry away a wrong number with nothing on screen to say so.
 */
export function hasCriterion(criteria: SettlementLedgerCriteria): boolean {
  return (
    criteria.entryNumber !== undefined ||
    !!criteria.storeId ||
    !!criteria.entryKind ||
    !!criteria.status ||
    !!criteria.batchId ||
    !!criteria.postedFrom ||
    !!criteria.postedTo
  )
}

/**
 * What the URL is asking, as the criteria the door takes.
 *
 * 🚩 **An unreadable value is DROPPED, never passed through and never thrown on.**
 * A hand-edited `?status=OPENISH` would be a 400 from the door (it validates against
 * its own vocabulary, deliberately, so an ignored status filter can never hand back
 * cancelled entries under a chip reading *open*) — and a screen that turned a typo in
 * an address into an error banner would be answering the wrong question. Dropping it
 * leaves the other criteria intact and the chip visibly unset, which is the state the
 * reader can actually see and fix.
 *
 * ⚠️ It is the same reasoning `readEntryNumber` gives one module over, applied to
 * five more keys: *a hand-edited address should land on a screen, not on a broken
 * one*.
 */
export function readCriteria(params: URLSearchParams): SettlementLedgerCriteria {
  return {
    entryNumber: readEntry(params.get(ENTRY_PARAM)),
    storeId: text(params.get(STORE_PARAM)),
    entryKind: oneOf(params.get(KIND_PARAM), LEDGER_KINDS),
    status: oneOf(params.get(STATUS_PARAM), LEDGER_STATUSES),
    batchId: text(params.get(BATCH_PARAM)),
    postedFrom: readDate(params.get(FROM_PARAM)),
    postedTo: readDate(params.get(TO_PARAM)),
  }
}

/**
 * The ledger view's address, carrying one set of criteria.
 *
 * 🚩 **It keeps the scope and drops everything else**, the rule every address on this
 * screen follows (`addresses.ts`): widening to the estate is a decision the reader
 * made, and walking into a lookup must not quietly undo it.
 *
 * ⚠️ **An empty criterion removes its key rather than leaving `?status=` behind.**
 * A bare key is not *no filter* to `readCriteria` — it reads as empty and drops —
 * but it is a URL an accountant might paste into a ticket, and half of one that looks
 * like a filter is worse than none.
 */
export function ledgerSearch(
  params: URLSearchParams,
  criteria: SettlementLedgerCriteria,
): string {
  const next = new URLSearchParams()

  const scope = params.get(SCOPE_PARAM)
  if (scope) next.set(SCOPE_PARAM, scope)

  next.set(VIEW_PARAM, 'ledger')

  if (criteria.entryNumber !== undefined) next.set(ENTRY_PARAM, String(criteria.entryNumber))
  if (criteria.storeId) next.set(STORE_PARAM, criteria.storeId)
  if (criteria.entryKind) next.set(KIND_PARAM, criteria.entryKind)
  if (criteria.status) next.set(STATUS_PARAM, criteria.status)
  if (criteria.batchId) next.set(BATCH_PARAM, criteria.batchId)
  if (criteria.postedFrom) next.set(FROM_PARAM, criteria.postedFrom)
  if (criteria.postedTo) next.set(TO_PARAM, criteria.postedTo)

  return `?${next.toString()}`
}

/**
 * Is the URL asking for the ledger?
 *
 * ⚠️ **`view=ledger` is the whole test, and it must be consulted BEFORE `?store=`.**
 * The two views share the `store` key on purpose (*one word for one thing*), so the
 * view parameter is the only thing that may decide which screen draws — a body that
 * checked the branch first would silently open one branch's account for
 * `?view=ledger&store=0142`, which is a different screen answering a different
 * question.
 */
export function isLedgerView(params: URLSearchParams): boolean {
  return params.get(VIEW_PARAM) === 'ledger'
}

/**
 * A key for the query cache — the criteria, in a fixed order.
 *
 * 🚩 Built from the criteria rather than from the raw search string, so two URLs
 * naming the same question in a different key order are **one** cache entry and not
 * two, and a stray `?q=` left over from the door does not fork it.
 */
export function ledgerKey(criteria: SettlementLedgerCriteria): string {
  return [
    criteria.entryNumber ?? '',
    criteria.storeId ?? '',
    criteria.entryKind ?? '',
    criteria.status ?? '',
    criteria.batchId ?? '',
    criteria.postedFrom ?? '',
    criteria.postedTo ?? '',
  ].join('|')
}

// ── readers ─────────────────────────────────────────────────────────────────────

const text = (raw: string | null): string | undefined => {
  const value = (raw ?? '').trim()
  return value || undefined
}

/** ⚠️ The same shape `readEntryNumber` accepts — a positive integer of at most nine
 *  digits. `0` is not an entry number (the sequence starts at 1) and a leading zero
 *  is a branch code somebody pasted into the wrong box. */
const readEntry = (raw: string | null): number | undefined => {
  const value = (raw ?? '').trim()
  return /^[1-9]\d{0,8}$/.test(value) ? Number(value) : undefined
}

/**
 * A calendar date, as `YYYY-MM-DD`.
 *
 * 🚩 **Shape-checked and then checked for being a real day**, because `2026-02-31`
 * passes any regex and is not a date. It is compared back against its own
 * round-trip rather than trusted to `Date`'s parsing, which rolls February 31st
 * forward to March 3rd without complaint — a silent shift of the range an accountant
 * asked for.
 */
const readDate = (raw: string | null): string | undefined => {
  const value = (raw ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  // `T00:00:00Z` so the parse is UTC and the round-trip cannot be shifted a day by
  // the reader's own timezone. The VALUE is a calendar date either way — it is the
  // server that decides what a date means in wall-clock terms (the whole of that day).
  const parsed = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return undefined
  return parsed.toISOString().slice(0, 10) === value ? value : undefined
}

const oneOf = <T extends string>(raw: string | null, allowed: T[]): T | undefined => {
  const value = (raw ?? '').trim().toUpperCase()
  return allowed.find((a) => a === value)
}
