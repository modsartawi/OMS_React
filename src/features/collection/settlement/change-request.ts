import { ApiError } from '@/core/api'
import { roundMoney } from '@/core/money'
import type {
  SettlementChangeRequest,
  SettlementChangeRequestActResult,
  SettlementChangeRequestHistory,
  SettlementChangeRequestKind,
  SettlementChangeRequestRaiseBody,
  SettlementChangeRequestRejectBody,
  SettlementChangeRequestStatus,
  SettlementEntry,
  SettlementEntryKind,
  SettlementEntryStatus,
} from '@/core/models/settlement'
import { isStamped, supervisionFailure } from './approval'
import type { ChangeRefusal, ChangeRequestDoor } from './change-refusal'
import { hasChangeWaiting } from './entry-cells'
import { checkBusinessDay, checkDescription, parseAmount } from './posting'

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
  /**
   * The request a withdraw by this session was refused `NOT_REQUESTER` on (345) — the
   * server's own word that this session did not raise it. Withdraw is not offered on it
   * again; a different request waiting later is judged afresh.
   */
  notRequesterOf?: string | null
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

/** The *"Reduce it to X"* cell — from `offerFor`, or 344's `DELETE_SPENT` step (the same shape). */
export type ReduceOffer = Extract<RemoveOffer, { kind: 'reduce' }>

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
 * `requestedByStaffId` (W6), matched exactly after a trim and never re-cased. Both are
 * the session's UserId claim on the server; that they are the same claim is still to be
 * confirmed against a live SIS.Api (345's open question). The server's `NOT_REQUESTER`
 * is the guard, and once it has answered on a request (`notRequesterOf`) Withdraw is not
 * offered on that request again. An unknown or empty user id is never the requester.
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
    // ⚠️ The server outranks the shadow: a NOT_REQUESTER on this very request means the
    // match above is wrong for it, and a button beside that sentence invites it again.
    const refusedHere = !!read.notRequesterOf && read.notRequesterOf === open.changeRequestId
    return {
      kind: 'waiting',
      request: open,
      withdraw:
        session.canOpenSettlement && !refusedHere && me !== '' && me === (open.requestedByStaffId ?? '').trim(),
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

/**
 * What the accountant has typed — the boxes, as strings.
 *
 * `businessDay` is a theft's day box (`yyyy-MM-dd`, ticket 349) — read for a theft only;
 * `''` on the other kinds, which draw no box.
 */
export type ChangeDraft = { amount: string; description: string; reason: string; businessDay: string }

/**
 * Whether the change form asks for a business day — a theft's alone (2195, W4). A
 * shortage or a surplus has no day to move (`SettlementBusinessDayTheftOnly`).
 */
export function asksBusinessDay(kind: SettlementEntryKind): boolean {
  return kind === 'THEFT'
}

/**
 * A day as the day box holds it — the bare `yyyy-MM-dd` of the server's midnight
 * stamp, as received; `''` for the year-1 *no day* (a shortage's, a surplus's).
 */
function dayInBox(stamp: string | null | undefined): string {
  const value = (stamp ?? '').trim()
  return isStamped(value) && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : ''
}

/**
 * **The change form as it opens** (W4) — the entry's current amount and Description and,
 * for a theft, its day. The Reason starts empty.
 */
export function changeDraftFor(entry: Pick<EntryNow, 'amount' | 'description' | 'businessDay'>): ChangeDraft {
  return { amount: String(entry.amount), description: entry.description, reason: '', businessDay: dayInBox(entry.businessDay) }
}

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
      /** A theft's day box emptied, or not a calendar date (349). Always `null` for the other kinds. */
      businessDay: 'blank' | 'unreadable' | null
      reason: 'blank' | 'too-long' | null
      unchanged: boolean
    }

/**
 * **The change body** — only the fields that differ, as `newAmount` / `newDescription`
 * and, for a theft, `newBusinessDay`.
 *
 * 🔑 **"Differs" is decided at holding scale.** `500.0004` against `500` is no change,
 * and the figure sent is the typed one at three places — never a branch-currency
 * rounding the web cannot know (owner ruling 2026-10-01).
 *
 * ⚠️ The floor is the server's `spentAmount`; asking for exactly it is allowed (an
 * `OPEN` entry lowered to it becomes `CONSUMED`, 2192). A figure ≤ 0 or below the floor
 * is held here, and the server still decides.
 *
 * 🔑 **A theft's day (349, BackOffice 2195)** goes as a bare date (`"2025-08-12"`) only
 * when it differs from the theft's own, else `null` — and naming only the day it already
 * has is *nothing differs* (2195's `NO_CHANGE` counts the day). Whether the day is a
 * closed day, or collected, is the server's to say (`SettlementTheftDayNotClosed`,
 * `THEFT_DAY_COLLECTED`): the web has no reliable read of either (W3).
 *
 * 🚩 **A shortage or a surplus never names the field** — not even `null`, whatever the
 * draft holds: 2195 answers `SettlementBusinessDayTheftOnly` to it.
 */
export function changeRequestBody(
  entry: {
    settlementEntryId: string
    amount: number
    description: string
    spentAmount: number
    entryKind: SettlementEntryKind
    businessDay: string
  },
  draft: ChangeDraft,
): ChangeDraftCheck {
  const typed = parseAmount(draft.amount)
  const asked = typed === null ? null : roundMoney(typed)
  const amountProblem =
    asked === null || asked <= 0 ? 'invalid' : asked < roundMoney(entry.spentAmount) ? 'below-floor' : null

  // ⚠️ Only a Description that differs is checked: an older entry posted blank or over
  // 200 must still be able to have its amount changed (`newDescription` goes `null`).
  const description = checkDescription(draft.description)
  const descriptionDiffers = description.text !== (entry.description ?? '').trim()
  const descriptionProblem = descriptionDiffers ? description.problem : null
  const reason = checkDescription(draft.reason)

  // 349: the day box, a theft's alone.
  const theft = asksBusinessDay(entry.entryKind)
  const currentDay = dayInBox(entry.businessDay)
  const day = theft ? checkBusinessDay('THEFT', draft.businessDay) : null
  // ⚠️ An emptied box is held only when there is a day to keep — a theft the server
  // holds without one (it cannot post one so, 339) leaves it as it is.
  const dayProblem = day?.problem === 'blank' && currentDay === '' ? null : (day?.problem ?? null)
  const newBusinessDay = day?.day !== undefined && day.day !== currentDay ? day.day : null

  const newAmount = asked !== null && asked !== roundMoney(entry.amount) ? asked : null
  const newDescription = descriptionDiffers ? description.text : null
  const unchanged =
    amountProblem === null && dayProblem === null && newAmount === null && newDescription === null && newBusinessDay === null

  if (amountProblem || descriptionProblem || dayProblem || reason.problem || unchanged)
    return {
      kind: 'held',
      amount: amountProblem,
      description: descriptionProblem,
      businessDay: dayProblem,
      reason: reason.problem,
      unchanged,
    }

  return {
    kind: 'ready',
    body: {
      settlementEntryId: entry.settlementEntryId,
      requestKind: 'CHANGE',
      newAmount,
      newDescription,
      ...(theft ? { newBusinessDay } : {}),
      reason: reason.text,
    },
  }
}

/* ── the delete form, and "Reduce it to X" (W5, ticket 347) ─────────────────────── */

/**
 * Whether a delete may be sent, and if so, what. `problem` — why the Reason cannot be
 * sent as typed.
 */
export type DeleteCheck =
  | { kind: 'ready'; body: SettlementChangeRequestRaiseBody }
  | { kind: 'held'; problem: 'blank' | 'too-long' }

/**
 * **The delete body** — `{ settlementEntryId, requestKind: "DELETE", reason }`, the
 * Reason trimmed (required, ≤ 200).
 *
 * ⚠️ **No figure field at all — not even `null`.** 2193 answers 400
 * `SettlementDeleteTakesNoFigures` to a delete that names `newAmount` or `newDescription`
 * (even `""`); a field that is not there cannot trip it on any server version.
 *
 * Whether the entry may be deleted is `offerFor`'s `remove` cell, never asked here.
 */
export function deleteRequestBody(entry: Pick<EntryNow, 'settlementEntryId'>, reason: string): DeleteCheck {
  const check = checkDescription(reason)
  if (check.problem) return { kind: 'held', problem: check.problem }
  return { kind: 'ready', body: { settlementEntryId: entry.settlementEntryId, requestKind: 'DELETE', reason: check.text } }
}

/**
 * **"Reduce it to X"** — the change form's draft with `X` filled in as the amount, and
 * the entry's Description (and a theft's day) as it stands (so only the amount differs).
 *
 * 🔑 **`X` is the server's spent figure, from either source**: `offerFor`'s `reduce`
 * cell (the History read) or `changeRefusal`'s `reduce` step (a `DELETE_SPENT`
 * answer's `spentAmount`). Both are `{ kind: 'reduce', to }`, and both already hold it
 * at holding scale; it is written at that scale here too, so a float tail never reaches
 * the box. Asking for exactly the spent figure is allowed (the floor, 2192).
 *
 * @param reason a Reason the accountant already typed — the refused delete's — carried
 *   into the change form to be edited there; `''` from the offer cell.
 */
export function reduceToSpent(
  entry: Pick<EntryNow, 'description' | 'businessDay'>,
  reduce: ReduceOffer,
  reason = '',
): ChangeDraft {
  // The day box as `changeDraftFor` fills it — a theft's form never opens with it emptied.
  return { amount: String(roundMoney(reduce.to)), description: entry.description, reason, businessDay: dayInBox(entry.businessDay) }
}

/**
 * **Whether a refusal on screen already says the cell's sentence** — so the pane says
 * *"The branch has spent X…, so it cannot be deleted"* once, not twice.
 *
 * 🔑 Only when it is the SAME fact with the SAME figure: 344's `DELETE_SPENT.figure`
 * sentence, its spent figure equal to the cell's at holding scale. Any other refusal
 * says something else, and a re-read that stated a different spent figure is newer
 * than the refusal — the cell then says its own sentence, with its own X, beside the
 * button that uses it.
 */
export function removeSaidBy(remove: Exclude<RemoveOffer, { kind: 'delete' }>, refusal: ChangeRefusal | null): boolean {
  if (refusal?.words.kind !== 'key' || refusal.words.key !== 'DELETE_SPENT.figure' || refusal.spent === null) return false
  return refusal.spent === roundMoney(remove.kind === 'reduce' ? remove.to : remove.spent)
}

/* ── after a raise (W8) ──────────────────────────────────────────────────────── */

/**
 * What a raise came back with.
 *
 * - **`waiting`** — stored, `requestStatus: "OPEN"`: the card is drawn.
 * - **`applied`** — `requestStatus: "APPLIED"`: a supervisor's own request, applied in
 *   the same act (2194). Read from the ANSWER, never from the flag (W1).
 * - **`refused`** — a 200 refusal; `code` is the server's machine code (`changeRefusal` words it).
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
    // A day-move is sent bare (`"2025-08-12"`); History writes it at midnight, as the
    // entry's own day is written, so the two compare and draw alike (2195).
    newBusinessDay: body.newBusinessDay ? `${body.newBusinessDay}T00:00:00` : entry.businessDay,
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

/**
 * **What the pane redraws from after a raise (W1 / W8, ticket 348)** — `afterRaise`'s
 * outcome, and the act answer the pane draws until History is re-read.
 *
 * - **`applied`** — the corrected entry (a delete: `entryStatus: "CANCELLED"`) and NO
 *   card: the answer says nothing waits.
 * - **`waiting`** — the card, drawn from the answer (`raisedRequest`), as for anyone.
 * - **`refused`** — the entry's figures only; a refusal says nothing about what waits,
 *   so History's word on the request stands (`request` absent, `ActAnswer`'s rule).
 *
 * 🔑 **The supervision flag is not even passed.** A supervisor's own raise applies at
 * once on the server (2194), and the web learns it from `requestStatus: "APPLIED"`
 * alone: a supervisor's raise that comes back `"OPEN"` draws the card, and an
 * `"APPLIED"` answer is drawn as applied whoever pressed. `requester` only names the
 * card's requester (`userId`, `displayName`).
 */
export type RaiseDraw =
  | { kind: 'applied'; answered: ActAnswer }
  | { kind: 'waiting'; answered: ActAnswer }
  | { kind: 'refused'; code: string; answered: ActAnswer }

export function raiseOutcome(
  entry: Parameters<typeof raisedRequest>[0],
  body: SettlementChangeRequestRaiseBody,
  answer: SettlementChangeRequestActResult,
  requester: { userId: string | null; displayName: string | null },
): RaiseDraw {
  const outcome = afterRaise(answer)
  switch (outcome.kind) {
    case 'refused':
      return { ...outcome, answered: { result: answer } }
    case 'applied':
      return { kind: 'applied', answered: { result: answer, request: null } }
    case 'waiting': {
      const staffId = requester.userId ?? ''
      const by = { staffId, name: requester.displayName || staffId }
      return { kind: 'waiting', answered: { result: answer, request: raisedRequest(entry, body, answer, by) } }
    }
  }
}

/**
 * **Whether the pane says *"decide it first"*** (348, story 22) — a raise refused
 * `CHANGE_ALREADY_OPEN`, and the card now drawn is the request that blocked it, with
 * Approve / Reject for this session.
 *
 * 🔑 Only the blocking request: the one 344's `open-request` step names (a different
 * request waiting by the time History is re-read is not it), or — in 2194's sub-second
 * race, where no id is named — whatever waits now. Never the session's own request
 * (`withdraw`): that one is withdrawn, not decided first.
 */
export function decideFirst(refusal: ChangeRefusal | null | undefined, offer: ChangeRequestOffer): boolean {
  if (!refusal || offer.kind !== 'waiting' || !offer.decide || offer.withdraw) return false
  if (refusal.step.kind === 'open-request') return refusal.step.changeRequestId === offer.request.changeRequestId
  return refusal.code === 'CHANGE_ALREADY_OPEN' && refusal.step.kind === 'reread'
}

/* ── after a withdraw (W6, ticket 345) ───────────────────────────────────────── */

/**
 * What a withdraw came back with (2194).
 *
 * - **`withdrawn`** — accepted, `requestStatus: "WITHDRAWN"`: the card goes, and the
 *   entry's figures are the answer's (unchanged).
 * - **`unconfirmed`** — accepted, but naming another status. Neither withdrawn nor a
 *   refusal: the server made neither claim, so the pane says so and the re-read draws
 *   what is true.
 * - **`refused`** — a 200 refusal (`NOT_REQUESTER`, `CHANGE_NOT_OPEN`); `changeRefusal`
 *   words it and names the step.
 */
export type WithdrawOutcome = { kind: 'withdrawn' } | { kind: 'unconfirmed' } | { kind: 'refused'; code: string }

export function afterWithdraw(answer: SettlementChangeRequestActResult | null | undefined): WithdrawOutcome {
  if (answer?.accepted !== true) return { kind: 'refused', code: answer?.refusalReason ?? '' }
  return answer.requestStatus === 'WITHDRAWN' ? { kind: 'withdrawn' } : { kind: 'unconfirmed' }
}

/* ── a supervisor's approve or reject (W6 / W8, ticket 346) ──────────────────── */

/**
 * What an approve or a reject came back with (2191–2195).
 *
 * - **`decided`** — accepted, and the answer names the end that door makes:
 *   `"APPLIED"` for an approve, `"REJECTED"` for a reject. The card goes, and the
 *   entry's figures are the answer's (corrected after an approve, untouched after a
 *   reject).
 * - **`unconfirmed`** — accepted, but naming another status: neither decided nor a
 *   refusal, as `afterWithdraw` says it. The re-read draws what is true.
 * - **`refused`** — a 200 refusal; the request stays `OPEN` (all but `CHANGE_NOT_OPEN`)
 *   and `changeRefusal('approve' | 'reject', …)` words it and names the step.
 */
/** The two doors a supervisor decides a waiting request through. */
export type DecideDoor = Extract<ChangeRequestDoor, 'approve' | 'reject'>

export type DecideOutcome = { kind: 'decided' } | { kind: 'unconfirmed' } | { kind: 'refused'; code: string }

/** The end each door makes of a request it decides. */
const DECIDED_STATUS: Record<DecideDoor, SettlementChangeRequestStatus> = { approve: 'APPLIED', reject: 'REJECTED' }

export function afterDecide(
  door: DecideDoor,
  answer: SettlementChangeRequestActResult | null | undefined,
): DecideOutcome {
  if (answer?.accepted !== true) return { kind: 'refused', code: answer?.refusalReason ?? '' }
  return answer.requestStatus === DECIDED_STATUS[door] ? { kind: 'decided' } : { kind: 'unconfirmed' }
}

/**
 * Whether a Reject may be sent, and if so, what — `{ changeRequestId, reason }`, the
 * Reason trimmed (2191: required, ≤ 200). Nothing about the entry goes: a reject never
 * touches it.
 */
export type RejectCheck =
  | { kind: 'ready'; body: SettlementChangeRequestRejectBody }
  /** `problem` — why the Reason cannot be sent as typed. */
  | { kind: 'held'; problem: 'blank' | 'too-long' }

export function rejectBody(request: Pick<SettlementChangeRequest, 'changeRequestId'>, reason: string): RejectCheck {
  const check = checkDescription(reason)
  if (check.problem) return { kind: 'held', problem: check.problem }
  return { kind: 'ready', body: { changeRequestId: request.changeRequestId, reason: check.text } }
}

/* ── what the pane draws from (W8) ───────────────────────────────────────────── */

/**
 * The last act answer about the entry on screen, and what it leaves waiting.
 *
 * `request` is the answer's word on the waiting request: the one a raise just stored,
 * or `null` once one was applied, rejected or withdrawn. **Absent for a refusal** — a
 * refusal says nothing about what waits, so History's word stands (a refused approve
 * keeps its card, still `OPEN`).
 */
export type ActAnswer = { result: SettlementChangeRequestActResult; request?: SettlementChangeRequest | null }

/**
 * **The redraw step (W8)** — the entry's figures and its waiting request, as the pane
 * should draw them now: an act answer about THIS entry first, then the History read,
 * then the account row (`entryNow`).
 *
 * ⚠️ **An answer about another entry is ignored whole** — its figures (as `entryNow`
 * already does) and what it says waits. The pane is keyed by entry, so this should not
 * arise; if it does, nothing of 143 is drawn under 151's header.
 */
export function paneRead(
  row: Parameters<typeof entryNow>[0],
  history: Partial<SettlementChangeRequestHistory> | null | undefined,
  answered: ActAnswer | null | undefined,
): { now: EntryNow; openRequest: SettlementChangeRequest | null; spentAmount: number | null } {
  const mine = answered && answered.result.settlementEntryId === row.settlementEntryId ? answered : null
  const now = entryNow(row, history, mine?.result)
  const openRequest = mine && mine.request !== undefined ? mine.request : (history?.openRequest ?? null)
  // `spentAmount` beside `now` so the whole read is `offerFor`'s `ChangeRequestRead`.
  return { now, openRequest, spentAmount: now.spentAmount }
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
  // Compared as days, not as stamps: a stamp written another way is not a day-move.
  if (dayInBox(request.oldBusinessDay) !== dayInBox(request.newBusinessDay))
    changes.push({ field: 'businessDay', from: request.oldBusinessDay, to: request.newBusinessDay })
  return {
    kind: request.requestKind,
    changes,
    by: request.requestedByName,
    at: isStamped(request.requestedAt) ? request.requestedAt : null,
    reason: request.requestReason,
  }
}

/**
 * Server text (a Description, routinely Arabic) wrapped in a first-strong isolate —
 * FSI … PDI — so it keeps its own direction without reordering the sentence around it.
 *
 * 🚩 Found on screen at 350: *"{{from}} → {{to}}"* over two Arabic Descriptions in one
 * `dir="auto"` run turns right-to-left whole, and the arrow then points at the old one.
 * Each side isolated, the arrow stays between them, reading old → new. The waiting card
 * and the audit column both draw a Description change through it.
 */
export const bidiIsolate = (text: string): string => `\u2068${text}\u2069`

/* ── a direct act supersedes (W12, ticket 352) ───────────────────────────────── */

/**
 * What a direct act's confirm step says about a change request waiting on what it acts
 * on — Cancel, Write off, Approve and Reject of a pending entry, and Bulk Cancel
 * (BackOffice 2194: an ACCEPTED direct act makes the waiting request `SUPERSEDED` in the
 * same transaction; a refused one leaves it `OPEN`).
 *
 * - **`entry`** — a request waits on this entry: *"the waiting change request will be
 *   closed as superseded"*.
 * - **`unknown`** — History has not answered yet, or failed (other than a 404): whether
 *   one waits is not known, so *"any change request waiting on this entry…"*. Never
 *   silence, which would read as *nothing waits*.
 * - **`batch`** — *"any change request waiting on an entry this withdraws…"*: nothing on
 *   the web enumerates a batch's entries (`BatchWithdraw.tsx`), so it is said
 *   unconditionally — and only of the entries the act withdraws, since a refused row
 *   keeps its request `OPEN`.
 * - **`none`** — nothing waits; no sentence.
 */
export type SupersedeWarning = 'none' | 'entry' | 'unknown' | 'batch'

/**
 * Where the confirm step learns of a waiting request.
 *
 * - **`history`** — the entry panel: the ONE History read (`changeRequestHistoryQuery`),
 *   as the query hands it over — its data, and whether it is still in flight or failed.
 * - **`row`** — a lane row: `Settlement/Ledger`'s `openChangeRequestId` (351).
 * - **`batch`** — Bulk Cancel, which has no entries to read.
 */
export type SupersedeSource =
  | {
      from: 'history'
      read: {
        data?: Partial<Pick<SettlementChangeRequestHistory, 'openRequest'>> | null
        isPending: boolean
        isError: boolean
        error: unknown
      }
    }
  | { from: 'row'; row: { openChangeRequestId?: string } | null | undefined }
  | { from: 'batch' }

/**
 * **Whether a direct act's confirm step says a waiting request will be superseded.**
 *
 * 🔑 The server's word and nothing else: History's `openRequest`, or the row's
 * `openChangeRequestId` (the mark's rule, `hasChangeWaiting`). A row an older SIS.Api
 * sent without the field, and a History door that 404s, say nothing waits.
 *
 * ⚠️ It only words the confirm step. The direct doors are unchanged (W12): the sentence
 * guards nothing, and the act is never held for it.
 */
export function supersedeWarning(source: SupersedeSource): SupersedeWarning {
  switch (source.from) {
    case 'batch':
      return 'batch'
    case 'row':
      return hasChangeWaiting(source.row) ? 'entry' : 'none'
    case 'history': {
      const { read } = source
      // ⚠️ A 404 is a true *none* — a server without the wave holds no request. Any other
      // failure, and a read in flight, leave it unknown.
      if (read.isPending || (read.isError && changeRequestFailure(read.error) !== 'not-shipped')) return 'unknown'
      return read.data?.openRequest ? 'entry' : 'none'
    }
  }
}

/** The read's requests about ONE entry — a row about another entry is never drawn or counted under it (350). */
export const requestsOf = (
  requests: readonly SettlementChangeRequest[] | null | undefined,
  settlementEntryId: string,
): SettlementChangeRequest[] => (requests ?? []).filter((r) => r.settlementEntryId === settlementEntryId)

/**
 * Newest first by one of a request's stamps, then by the ULID — **never History's listing
 * order** (350). The audit column orders applied changes by `decidedAt`; the superseded
 * card finds the latest request by `requestedAt`. One comparator, so the two never
 * disagree about what "newest" means.
 */
export const newestFirstBy =
  (stamp: 'requestedAt' | 'decidedAt') =>
  (a: SettlementChangeRequest, b: SettlementChangeRequest): number =>
    (a[stamp] < b[stamp] ? 1 : a[stamp] > b[stamp] ? -1 : 0) ||
    (a.changeRequestId < b.changeRequestId ? 1 : a.changeRequestId > b.changeRequestId ? -1 : 0)

/**
 * **The request a direct act superseded, as the pane shows it** (W12) — the entry's
 * LATEST request, when it ended `SUPERSEDED` and nothing waits now.
 *
 * 🔑 Drawn for as long as that holds (HITL-352), not only in the moment after the act:
 * it is the server's read, so it survives a reload. A later request — waiting, or decided
 * any other way — is the entry's story now, and takes its place. A request about another
 * entry is never drawn under this one's header.
 *
 * ⚠️ **Not while an act answer of the pane's own about this entry is drawn** (`answered`,
 * W8): it is newer than the read — a raise it stored is the card, one it applied is the
 * entry's story — until the re-read replaces it.
 */
export function supersededRequest(
  history: Partial<Pick<SettlementChangeRequestHistory, 'openRequest' | 'requests'>> | null | undefined,
  settlementEntryId: string,
  answered?: ActAnswer | null,
): SettlementChangeRequest | null {
  if (!history || history.openRequest) return null
  if (answered && answered.result.settlementEntryId === settlementEntryId) return null
  const latest = requestsOf(history.requests, settlementEntryId).sort(newestFirstBy('requestedAt'))[0]
  return latest?.status === 'SUPERSEDED' ? latest : null
}

/**
 * **Who closed a superseded request, and when** — 2194's SUPERSEDED row: the supervisor
 * whose direct act ended it (under the name recorded then, else their staff id), at the
 * act's own time. `null` for what the row does not say — the card then says so in words,
 * never *"when  acted"*.
 */
export function closedBy(
  request: Pick<SettlementChangeRequest, 'decidedByName' | 'decidedByStaffId' | 'decidedAt'>,
): { by: string | null; at: string | null } {
  return {
    by: (request.decidedByName || request.decidedByStaffId || '').trim() || null,
    at: isStamped(request.decidedAt) ? request.decidedAt : null,
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
