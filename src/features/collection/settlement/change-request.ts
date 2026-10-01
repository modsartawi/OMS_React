import { ApiError } from '@/core/api'
import { roundMoney } from '@/core/money'
import type {
  SettlementChangeRequest,
  SettlementChangeRequestActResult,
  SettlementChangeRequestHistory,
  SettlementChangeRequestKind,
  SettlementChangeRequestRaiseBody,
  SettlementEntry,
  SettlementEntryKind,
  SettlementEntryStatus,
} from '@/core/models/settlement'
import { isStamped, supervisionFailure } from './approval'
import { checkDescription, parseAmount } from './posting'

/**
 * **The change-request decision** — what the entry panel's change-request pane offers,
 * and what a raise sends (spec 342 W3 / W4, ticket 343; BackOffice 2191–2195).
 *
 * 🔑 **One function, one tagged union — `correction.ts`'s discipline.** `offerFor`
 * decides the WHOLE of W3's table, including the cells later tickets render: the
 * supervisor's *Change now* / *Delete now* (348), *Withdraw* for the requester (345),
 * Approve / Reject (346) and *reduce to the spent figure* (347). There is deliberately
 * no *"can this be deleted"* beside a *"can this be changed"*: two predicates a caller
 * could ask independently are two a caller can combine wrongly.
 *
 * ⚠️ **The rule is the server's; this is its shadow.** It only chooses which buttons are
 * drawn. Every refusal is the server's, and *"applied at once"* is read from the act
 * answer's `requestStatus: "APPLIED"` (`afterRaise`), never from the supervision flag.
 *
 * 🔑 **Spent is the server's `spentAmount`** (the History read, or an act answer) —
 * never `amount − remaining` computed here. Money is compared at the scale it is HELD
 * at (`roundMoney`, three places): a BHD entry spent by `0.001` is spent.
 *
 * ⚠️ **No branch-currency rounding** (owner ruling 2026-10-01): the account reads carry
 * no currency (274 §B6), so the form cannot round SAR to whole riyals as the server
 * does. It compares at holding scale, never claims the server's rounded figure, and the
 * pane redraws from the act answer's `amount`.
 *
 * 🚩 Pure: no React, no `t()`, no clock, no call. `ApiError` is imported only to
 * RECOGNISE a failure (`changeRequestFailure`).
 */

/** The session, as the pane reads it — two probe flags and the UserId claim. */
export type ChangeRequestSession = {
  /** `canOpenSettlement` — Raise, Withdraw and History sit behind it (W1). */
  canOpenSettlement: boolean
  /** `canSuperviseSettlement` — Approve / Reject, and a raise that applies at once. */
  canSuperviseSettlement: boolean
  /** `useSession`'s `userId`; `null` before `Auth/Me` lands. */
  userId: string | null
}

/** What the History read (or a fresher act answer) says, as `offerFor` needs it. */
export type ChangeRequestRead = {
  openRequest: SettlementChangeRequest | null
  spentAmount: number | null
}

/** Why a finished entry offers nothing — distinguished, because the sentence is the
 *  only thing telling a reader what happened to the money (D2). */
export type FinishedReason = 'cancelled' | 'written-off' | 'rejected'

/**
 * What stands in for *delete* on an entry.
 *
 * - **`delete`** — nothing spent: *Request delete* (or *Delete now*).
 * - **`reduce`** — something spent: no delete; *"Reduce it to X"* opens the change form
 *   with `X` filled in (W5).
 * - **`spent-whole`** — the branch spent ALL of it (a `CONSUMED` entry). There is no
 *   delete, and reducing to the spent figure would change nothing — so the pane says it
 *   cannot be deleted and offers no reduce.
 */
export type RemoveOffer =
  | { kind: 'delete' }
  | { kind: 'reduce'; to: number }
  | { kind: 'spent-whole'; spent: number }

/**
 * **W3's table, as one union.**
 *
 * | case | when | draws |
 * |---|---|---|
 * | `finished` | `CANCELLED` / `CLOSED_OUT` / `REJECTED` | nothing; the sentence says why |
 * | `waiting` | a request is open | the card; `withdraw` for its requester, `decide` for a supervisor |
 * | `ask` | `PENDING_APPROVAL` / `OPEN` / `CONSUMED`, nothing waiting | `mode` `request` (accountant) or `now` (supervisor), with `floor` and `remove` |
 * | `read-only` | the session cannot raise | nothing to press |
 * | `unstated` | no usable read (no spent figure) | nothing decided |
 */
export type ChangeRequestOffer =
  | { kind: 'finished'; because: FinishedReason }
  | { kind: 'waiting'; request: SettlementChangeRequest; withdraw: boolean; decide: boolean }
  | { kind: 'ask'; mode: 'request' | 'now'; floor: number; remove: RemoveOffer }
  | { kind: 'read-only' }
  | { kind: 'unstated' }

/** The server's *no time* — `NOT NULL` with a default (2191). */
const UNSTAMPED = '0001-01-01T00:00:00'

const isFigure = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const FINISHED: Partial<Record<SettlementEntryStatus, FinishedReason>> = {
  CANCELLED: 'cancelled',
  CLOSED_OUT: 'written-off',
  REJECTED: 'rejected',
}

const LIVE: readonly SettlementEntryStatus[] = ['PENDING_APPROVAL', 'OPEN', 'CONSUMED']

/**
 * The one offer an entry makes to this session.
 *
 * ⚠️ **Finished wins over a waiting request.** A direct act supersedes the request in
 * the same transaction (2194), so the pair should not occur; if it does, the entry is
 * never changed (D2) and nothing is offered on it.
 *
 * ⚠️ **No spent figure, no offer.** A read without `spentAmount` (an SIS.Api older than
 * 2192, or a malformed answer) is `unstated` — never a floor of `0`, which would offer
 * a delete on an entry the branch may have spent from.
 *
 * 🚩 **Withdraw is drawn only for the requester**: the session's `userId` equals
 * `requestedByStaffId` (W6). Both are the session's UserId claim on the server; that
 * they are the same claim is confirmed live by 345. The server's `NOT_REQUESTER` is
 * the guard. An unknown or empty user id is never the requester.
 */
export function offerFor(
  entry: Pick<SettlementEntry, 'status' | 'amount' | 'remainingAmount'> & { entryKind?: SettlementEntryKind } | null | undefined,
  read: Partial<ChangeRequestRead> | null | undefined,
  session: ChangeRequestSession,
): ChangeRequestOffer {
  if (!entry || !read) return { kind: 'unstated' }

  const finished = FINISHED[entry.status]
  if (finished) return { kind: 'finished', because: finished }
  if (!LIVE.includes(entry.status)) return { kind: 'unstated' }

  const open = read.openRequest ?? null
  if (open) {
    const me = (session.userId ?? '').trim()
    return {
      kind: 'waiting',
      request: open,
      withdraw: session.canOpenSettlement && me !== '' && me === (open.requestedByStaffId ?? '').trim(),
      decide: session.canSuperviseSettlement,
    }
  }

  if (!isFigure(read.spentAmount)) return { kind: 'unstated' }
  // Raise sits behind the settlement grant; supervision alone cannot raise.
  if (!session.canOpenSettlement) return { kind: 'read-only' }

  const spent = Math.max(0, roundMoney(read.spentAmount))
  const amount = roundMoney(entry.amount)
  const remove: RemoveOffer =
    spent <= 0
      ? { kind: 'delete' }
      : spent >= amount
        ? { kind: 'spent-whole', spent }
        : { kind: 'reduce', to: spent }

  return { kind: 'ask', mode: session.canSuperviseSettlement ? 'now' : 'request', floor: spent, remove }
}

/**
 * **The entry as the pane should draw it now** (W8) — the freshest word on it.
 *
 * 1. an act answer about THIS entry (drawn at once, before any re-read lands);
 * 2. the History read, when it found the entry (`entryStatus` not `''`);
 * 3. the account row.
 *
 * 🔑 `spentAmount` comes only from the first two — the row carries none, and none is
 * computed here. `null` means no server has said.
 */
export type EntryNow = {
  settlementEntryId: string
  entryNumber: number
  storeId: string
  entryKind: SettlementEntryKind
  status: SettlementEntryStatus
  amount: number
  remainingAmount: number
  /** The entry's own text (the wire's `reason` on an account row, `description` on an answer). */
  description: string
  businessDay: string
  spentAmount: number | null
}

export function entryNow(
  row: Pick<
    SettlementEntry,
    'settlementEntryId' | 'entryNumber' | 'storeId' | 'entryKind' | 'status' | 'amount' | 'remainingAmount' | 'reason' | 'businessDay'
  >,
  history: Partial<SettlementChangeRequestHistory> | null | undefined,
  answer: SettlementChangeRequestActResult | null | undefined,
): EntryNow {
  const base: EntryNow = {
    settlementEntryId: row.settlementEntryId,
    entryNumber: row.entryNumber,
    storeId: row.storeId,
    entryKind: row.entryKind,
    status: row.status,
    amount: row.amount,
    remainingAmount: row.remainingAmount,
    description: row.reason,
    businessDay: row.businessDay,
    spentAmount: null,
  }

  if (answer && answer.settlementEntryId === row.settlementEntryId && answer.entryStatus)
    return {
      ...base,
      status: answer.entryStatus,
      amount: answer.amount,
      remainingAmount: answer.remainingAmount,
      description: answer.description,
      businessDay: answer.businessDay || base.businessDay,
      spentAmount: isFigure(answer.spentAmount) ? answer.spentAmount : null,
    }

  if (!history) return base
  const spentAmount = isFigure(history.spentAmount) ? history.spentAmount : null
  if (history.entryStatus && isFigure(history.amount) && isFigure(history.remainingAmount))
    return {
      ...base,
      status: history.entryStatus,
      amount: history.amount,
      remainingAmount: history.remainingAmount,
      spentAmount,
    }
  return { ...base, spentAmount }
}

/* ── the change form (W4) ────────────────────────────────────────────────────── */

/** What the accountant has typed — the three boxes, as strings. */
export type ChangeDraft = { amount: string; description: string; reason: string }

/**
 * Whether the form may be sent, and if so, what.
 *
 * - **`ready`** — the body, carrying only what differs (`null` for the rest).
 * - **`held`** — why not: a field problem, a missing Reason, or `unchanged` (nothing
 *   differs — the server's `NO_CHANGE`, shadowed).
 */
export type ChangeDraftCheck =
  | { kind: 'ready'; body: SettlementChangeRequestRaiseBody }
  | {
      kind: 'held'
      /** `invalid` — not a figure above zero; `below-floor` — under what was spent. */
      amount: 'invalid' | 'below-floor' | null
      description: 'blank' | 'too-long' | null
      reason: 'blank' | 'too-long' | null
      unchanged: boolean
    }

/**
 * **The change body** — only the fields that differ, as `newAmount` / `newDescription`.
 *
 * 🔑 **"Differs" is decided at holding scale.** `500.0004` against `500` is no change,
 * and the figure sent is the typed one at three places — never a branch-currency
 * rounding the web cannot know (owner ruling 2026-10-01).
 *
 * ⚠️ The floor is the server's `spentAmount`; asking for exactly it is allowed (an
 * `OPEN` entry lowered to it becomes `CONSUMED`, 2192). A figure ≤ 0 or below the floor
 * is held here, and the server still decides.
 *
 * A theft's day (`newBusinessDay`) is 349's and is not sent from here.
 */
export function changeRequestBody(
  entry: { settlementEntryId: string; amount: number; description: string; spentAmount: number },
  draft: ChangeDraft,
): ChangeDraftCheck {
  const typed = parseAmount(draft.amount)
  const asked = typed === null ? null : roundMoney(typed)
  const amountProblem =
    asked === null || asked <= 0 ? 'invalid' : asked < roundMoney(entry.spentAmount) ? 'below-floor' : null

  const description = checkDescription(draft.description)
  const reason = checkDescription(draft.reason)

  const newAmount = asked !== null && asked !== roundMoney(entry.amount) ? asked : null
  const newDescription = description.text !== (entry.description ?? '').trim() ? description.text : null
  const unchanged = amountProblem === null && description.problem === null && newAmount === null && newDescription === null

  if (amountProblem || description.problem || reason.problem || unchanged)
    return { kind: 'held', amount: amountProblem, description: description.problem, reason: reason.problem, unchanged }

  return {
    kind: 'ready',
    body: {
      settlementEntryId: entry.settlementEntryId,
      requestKind: 'CHANGE',
      newAmount,
      newDescription,
      reason: reason.text,
    },
  }
}

/* ── after a raise (W8) ──────────────────────────────────────────────────────── */

/**
 * What a raise came back with.
 *
 * - **`waiting`** — stored, `requestStatus: "OPEN"`: the card is drawn.
 * - **`applied`** — `requestStatus: "APPLIED"`: a supervisor's own request, applied in
 *   the same act (2194). Read from the ANSWER, never from the flag (W1).
 * - **`refused`** — a 200 refusal; `code` is the server's machine code (344 words it).
 */
export type RaiseOutcome = { kind: 'waiting' } | { kind: 'applied' } | { kind: 'refused'; code: string }

export function afterRaise(answer: SettlementChangeRequestActResult | null | undefined): RaiseOutcome {
  if (answer?.accepted !== true) return { kind: 'refused', code: answer?.refusalReason ?? '' }
  return answer.requestStatus === 'APPLIED' ? { kind: 'applied' } : { kind: 'waiting' }
}

/**
 * **The request just raised, before History is re-read** — so the card is drawn from
 * the answer at once (W8), not after a round trip.
 *
 * `old…` is the entry as it was sent, `new…` what was asked (or the old value, for a
 * field the body left `null` — the contract's own convention), and the id and status
 * are the answer's. ⚠️ **`requestedAt` is unstamped**: the time is the server's, and
 * this module has no clock. The re-read brings it.
 */
export function raisedRequest(
  entry: Pick<EntryNow, 'settlementEntryId' | 'storeId' | 'amount' | 'description' | 'businessDay'>,
  body: SettlementChangeRequestRaiseBody,
  answer: Pick<SettlementChangeRequestActResult, 'changeRequestId' | 'requestStatus'>,
  requester: { staffId: string; name: string },
): SettlementChangeRequest {
  return {
    changeRequestId: answer.changeRequestId,
    settlementEntryId: entry.settlementEntryId,
    storeId: entry.storeId,
    requestKind: body.requestKind,
    status: answer.requestStatus || 'OPEN',
    oldAmount: entry.amount,
    newAmount: body.newAmount ?? entry.amount,
    oldDescription: entry.description,
    newDescription: body.newDescription ?? entry.description,
    oldBusinessDay: entry.businessDay,
    newBusinessDay: body.newBusinessDay ?? entry.businessDay,
    spentAtDecision: 0,
    requestedByStaffId: requester.staffId,
    requestedByName: requester.name,
    requestedAt: UNSTAMPED,
    requestReason: body.reason,
    decidedByStaffId: '',
    decidedByName: '',
    decidedAt: UNSTAMPED,
    decisionReason: '',
  }
}

/* ── the waiting-request card (W6) ───────────────────────────────────────────── */

export type CardChange =
  | { field: 'amount'; from: number; to: number }
  | { field: 'description'; from: string; to: string }
  | { field: 'businessDay'; from: string; to: string }

export type WaitingCard = {
  kind: SettlementChangeRequestKind
  /** Only the fields that differ, in the order amount · description · day. */
  changes: CardChange[]
  /** Under the name they had then. */
  by: string
  /** `null` when unstamped. Local wall clock, as received. */
  at: string | null
  /** The request's Reason — server text, unlocalised. */
  reason: string
}

/** What the card draws for one request — old → new only where they differ. */
export function cardFor(request: SettlementChangeRequest): WaitingCard {
  const changes: CardChange[] = []
  if (roundMoney(request.oldAmount) !== roundMoney(request.newAmount))
    changes.push({ field: 'amount', from: request.oldAmount, to: request.newAmount })
  if ((request.oldDescription ?? '') !== (request.newDescription ?? ''))
    changes.push({ field: 'description', from: request.oldDescription, to: request.newDescription })
  if ((request.oldBusinessDay ?? '') !== (request.newBusinessDay ?? ''))
    changes.push({ field: 'businessDay', from: request.oldBusinessDay, to: request.newBusinessDay })
  return {
    kind: request.requestKind,
    changes,
    by: request.requestedByName,
    at: isStamped(request.requestedAt) ? request.requestedAt : null,
    reason: request.requestReason,
  }
}

/* ── a failed read ───────────────────────────────────────────────────────────── */

/**
 * Why a change-request door threw — the History read or a raise.
 *
 * - **`not-shipped`** — a 404: SIS.Api has not shipped the wave. The pane says *"not
 *   available yet"* and nothing crashes, so the web can ship first (spec 342
 *   Boundaries).
 * - **`forbidden`** — a bare 403: the session no longer holds the grant the probe said
 *   it did. Named, and the probe re-read (`approval.ts`'s `supervisionFailure`).
 * - **`other`** — `apiErrorMessage`'s to word.
 */
export function changeRequestFailure(err: unknown): 'not-shipped' | 'forbidden' | 'other' {
  if (supervisionFailure(err) === 'forbidden') return 'forbidden'
  return err instanceof ApiError && err.statusCode === 404 ? 'not-shipped' : 'other'
}
