import { roundMoney } from '@/core/money'
import type { SettlementChangeRequestActResult } from '@/core/models/settlement'

/**
 * **The change-request refusal map** — every code BackOffice 2191–2195's `## Web
 * contract` names, turned into a sentence and a next step (spec 342 W7, ticket 344).
 *
 * 🔑 **One map for the whole wave.** Raise (343), Withdraw (345), Approve / Reject (346),
 * delete (347), a supervisor's own act (348) and the theft day (349) all render ITS
 * answers. None of them keeps a second code table, and none words a refusal off the
 * server's `message`: that is drawn only for a code this map does not know.
 *
 * - **A 200 with `accepted: false`** is `changeRefusal` — a sentence, and the step the
 *   pane takes next.
 * - **A 400 envelope** (`errors[0].errorCode`) is `changeFieldError` — the box that can
 *   fix it, or the form when no box can.
 *
 * ⚠️ **The step is per door where the contract makes it so.** `BELOW_SPENT` on a raise
 * refills the floor; the same code on an approve means a till spent past the request
 * while it waited, and the supervisor rejects it. The sentence is the same on every
 * door, so it is worded to be true on each.
 *
 * 🚩 Pure: no React, no `t()`, no clock, no call. A sentence is returned as the KEY under
 * `settlement:changeRequest.refusal.` / `.invalid.`; the pane formats the figures.
 */

/** The four doors a refusal can come back from (2191, 2194). */
export type ChangeRequestDoor = 'raise' | 'approve' | 'reject' | 'withdraw'

/**
 * What the pane does next.
 *
 * | step | the pane |
 * |---|---|
 * | `close` | draws the sentence alone — the entry no longer exists |
 * | `redraw` | redraws from the answer and the re-read (a finished entry; a decided request) |
 * | `refill-floor` | keeps the form, its floor now `floor` |
 * | `reduce` | offers *"Reduce it to X"* — the change form with `to` filled in (347) |
 * | `open-request` | closes the form; the re-read draws the waiting request `changeRequestId` |
 * | `reread` | closes the form; the re-read draws whatever now waits |
 * | `stay` | keeps the form as typed |
 * | `reject` | a supervisor's approve: the card stays, Reject (with a reason) is the way on (346) |
 * | `not-requester` | the card stays, still waiting; Withdraw is no longer offered on that request (345) |
 * | `none` | nothing to offer — the sentence is the whole answer |
 */
export type RefusalStep =
  | { kind: 'close' }
  | { kind: 'redraw' }
  | { kind: 'refill-floor'; floor: number }
  | { kind: 'reduce'; to: number }
  | { kind: 'open-request'; changeRequestId: string }
  | { kind: 'reread' }
  | { kind: 'stay' }
  | { kind: 'reject' }
  | { kind: 'not-requester' }
  | { kind: 'none' }

/** The ends a decided request can have met (2194) — `CHANGE_NOT_OPEN`'s `requestStatus`. */
const DECIDED = ['APPLIED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED'] as const

/** A key under `settlement:changeRequest.refusal.`. */
export type RefusalSentence =
  | 'ENTRY_NOT_OPEN'
  | 'ENTRY_FINAL'
  | 'BELOW_SPENT.figure'
  | 'BELOW_SPENT.unstated'
  | 'DELETE_SPENT.figure'
  | 'DELETE_SPENT.unstated'
  | 'CHANGE_ALREADY_OPEN.named'
  | 'CHANGE_ALREADY_OPEN.unnamed'
  | 'NO_CHANGE'
  | 'CHANGE_STALE'
  | `CHANGE_NOT_OPEN.${(typeof DECIDED)[number] | 'unsaid'}`
  | 'NOT_REQUESTER'
  | 'THEFT_DAY_COLLECTED'
  /** `WRONG_KIND` / `REMAINING_INSUFFICIENT` — 2191's tracer refusals, not answered since 2192 / 2195. */
  | 'tracer'
  /** A code this map does not know, and no `message` to fall back on — the code is named. */
  | 'unknown'
  /** No code at all. */
  | 'unstated'

export type ChangeRefusal = {
  /** The server's code, trimmed (`''` when it sent none). */
  code: string
  /** 🔑 A keyed sentence — or, only for an unknown code, the server's own `message`. */
  words: { kind: 'key'; key: RefusalSentence } | { kind: 'message'; text: string }
  /** The answer's `spentAmount` at holding scale, for the sentences that name it; `null` when not a figure. */
  spent: number | null
  step: RefusalStep
}

const isFigure = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

const key = (k: RefusalSentence): ChangeRefusal['words'] => ({ kind: 'key', key: k })

/**
 * The sentence and next step for one refused act.
 *
 * ⚠️ **The code is matched exactly as sent, after a trim** — never re-cased. A code in
 * another case is a code this map does not know, and says so.
 *
 * @param message the envelope's `message`, when the caller has one. Drawn ONLY for an
 *   unknown code (W7).
 */
export function changeRefusal(
  door: ChangeRequestDoor,
  answer:
    | Partial<Pick<SettlementChangeRequestActResult, 'refusalReason' | 'changeRequestId' | 'requestStatus' | 'amount' | 'spentAmount' | 'settlementEntryId'>>
    | null
    | undefined,
  message?: string | null,
): ChangeRefusal {
  const code = (answer?.refusalReason ?? '').trim()
  const spent = isFigure(answer?.spentAmount) ? Math.max(0, roundMoney(answer.spentAmount)) : null
  const said = (words: ChangeRefusal['words'], step: RefusalStep): ChangeRefusal => ({ code, words, spent, step })
  // A supervisor's approve that the entry has outrun: the request stays OPEN, and the
  // supervisor's way on is to reject it with a reason (2192, 2193, 2195).
  const atApproval = door === 'approve'

  switch (code) {
    case 'ENTRY_NOT_OPEN':
      // ⚠️ 346: on Approve the server ALSO answers this when the entry exists and nothing it
      // can name stopped the request (`SettlementChangeRequestStore.RefusedAsync`'s
      // fallback) — the request stays OPEN. An answer that names the entry says it exists,
      // so "no longer exists, close" would hide a request still waiting: it is said as an
      // unexplained refusal and History re-read. With no entry named it is gone, as anywhere.
      if (atApproval && (answer?.settlementEntryId ?? '').trim() !== '')
        return said(key('tracer'), { kind: 'reread' })
      return said(key('ENTRY_NOT_OPEN'), { kind: 'close' })

    case 'ENTRY_FINAL':
      return said(key('ENTRY_FINAL'), { kind: 'redraw' })

    case 'BELOW_SPENT':
      if (spent === null) return said(key('BELOW_SPENT.unstated'), atApproval ? { kind: 'reject' } : { kind: 'reread' })
      return said(key('BELOW_SPENT.figure'), atApproval ? { kind: 'reject' } : { kind: 'refill-floor', floor: spent })

    case 'DELETE_SPENT': {
      if (spent === null) return said(key('DELETE_SPENT.unstated'), atApproval ? { kind: 'reject' } : { kind: 'reread' })
      if (atApproval) return said(key('DELETE_SPENT.figure'), { kind: 'reject' })
      // ⚠️ Spent all of it: reducing to the spent figure would change nothing (the
      // server's NO_CHANGE) — 343's `spent-whole`, so no reduce is offered.
      const whole = isFigure(answer?.amount) && spent >= roundMoney(answer.amount)
      return said(key('DELETE_SPENT.figure'), whole ? { kind: 'none' } : { kind: 'reduce', to: spent })
    }

    case 'CHANGE_ALREADY_OPEN': {
      // 🔑 2194's sub-second race: the winner was decided before the loser could read it,
      // so the id is `''` — nothing to name, and History is re-read for what waits now.
      const id = (answer?.changeRequestId ?? '').trim()
      return id
        ? said(key('CHANGE_ALREADY_OPEN.named'), { kind: 'open-request', changeRequestId: id })
        : said(key('CHANGE_ALREADY_OPEN.unnamed'), { kind: 'reread' })
    }

    case 'NO_CHANGE':
      return said(key('NO_CHANGE'), { kind: 'stay' })

    case 'CHANGE_STALE':
      // On a raise (a supervisor's own, 2194) it is the entry moving under the open form.
      return said(key('CHANGE_STALE'), atApproval ? { kind: 'reject' } : { kind: 'redraw' })

    case 'CHANGE_NOT_OPEN': {
      const status = DECIDED.find((s) => s === answer?.requestStatus)
      return said(key(`CHANGE_NOT_OPEN.${status ?? 'unsaid'}`), { kind: 'redraw' })
    }

    case 'NOT_REQUESTER':
      // The server's word that this session did not raise it — the pane passes the id to
      // `offerFor` (`notRequesterOf`), which stops offering Withdraw on that request (345).
      return said(key('NOT_REQUESTER'), { kind: 'not-requester' })

    case 'THEFT_DAY_COLLECTED':
      // On a raise the NEW day may be the collected one, and another can be picked.
      return said(key('THEFT_DAY_COLLECTED'), atApproval ? { kind: 'reject' } : { kind: 'stay' })

    case 'WRONG_KIND':
    case 'REMAINING_INSUFFICIENT':
      return said(key('tracer'), { kind: 'none' })

    case '':
      return said(key('unstated'), { kind: 'none' })

    default: {
      const text = (message ?? '').trim()
      return said(text ? { kind: 'message', text } : key('unknown'), { kind: 'none' })
    }
  }
}

/* ── the 400s ────────────────────────────────────────────────────────────────── */

/**
 * The box a 400 belongs on. `businessDay` is the theft's day field (349); `form` is a
 * code no box can fix — the body itself was wrong, which is this app's bug, not the
 * accountant's.
 */
export type ChangeField = 'amount' | 'description' | 'businessDay' | 'reason' | 'form'

/** A key under `settlement:changeRequest.invalid.`. */
export type FieldSentence =
  | 'SettlementAmountRequired'
  | 'SettlementAmountRoundsToZero'
  | 'SettlementReasonTooLong.reason'
  | 'SettlementReasonTooLong.either'
  | 'SettlementChangeReasonRequired'
  | 'SettlementReasonRequired'
  | 'SettlementDeleteTakesNoFigures'
  | 'SettlementBusinessDayTheftOnly'
  | 'SettlementTheftBusinessDayRequired'
  | 'SettlementTheftDayNotClosed'
  | 'SettlementChangeBodyRequired'
  | 'SettlementEntryRequired'
  | 'SettlementChangeRequestRequired'
  | 'SettlementChangeRequestKindInvalid'
  | 'SettlementRejectReasonRequired'

export type ChangeFieldError = { code: string; field: ChangeField; sentence: FieldSentence }

const FIELD_OF: Record<Exclude<FieldSentence, `SettlementReasonTooLong.${string}`>, ChangeField> = {
  // `newAmount ≤ 0`, and one that rounds to nothing at the branch's currency (a SAR
  // `0.4`) — the second is the one the form cannot shadow, having no currency.
  SettlementAmountRequired: 'amount',
  SettlementAmountRoundsToZero: 'amount',
  // A blank `newDescription` — posting's own code for the entry's text.
  SettlementReasonRequired: 'description',
  SettlementChangeReasonRequired: 'reason',
  SettlementRejectReasonRequired: 'reason',
  SettlementBusinessDayTheftOnly: 'businessDay',
  SettlementTheftBusinessDayRequired: 'businessDay',
  SettlementTheftDayNotClosed: 'businessDay',
  SettlementDeleteTakesNoFigures: 'form',
  SettlementChangeBodyRequired: 'form',
  SettlementEntryRequired: 'form',
  SettlementChangeRequestRequired: 'form',
  SettlementChangeRequestKindInvalid: 'form',
}

/**
 * Which box a refused body is about — `null` for a code this map does not know (the
 * caller shows `apiErrorMessage`, the server's own sentence).
 *
 * ⚠️ **`SettlementReasonTooLong` covers the Reason AND the Description** (2191). When
 * the body carried only a Reason it is the Reason's; when a Description went too, the
 * code cannot say which, so it is the form's and names both rather than blaming one.
 *
 * @param sent the body that was refused, when there was one.
 */
export function changeFieldError(
  code: string | null | undefined,
  sent?: { newDescription?: string | null } | null,
): ChangeFieldError | null {
  const c = (code ?? '').trim()
  if (c === 'SettlementReasonTooLong')
    return sent?.newDescription != null
      ? { code: c, field: 'form', sentence: 'SettlementReasonTooLong.either' }
      : { code: c, field: 'reason', sentence: 'SettlementReasonTooLong.reason' }
  if (!Object.hasOwn(FIELD_OF, c)) return null
  const sentence = c as keyof typeof FIELD_OF
  return { code: c, field: FIELD_OF[sentence], sentence }
}
