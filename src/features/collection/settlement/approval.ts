import { ApiError } from '@/core/api'
import type {
  SettlementEntry,
  SettlementEntryStatus,
  SettlementSupervisionResult,
} from '@/core/models/settlement'

/**
 * **The approval decision** — what a pending or rejected surplus offers, and what an
 * Approve or a Reject came back with (ticket 309, BackOffice 1977 / 1978).
 *
 * An accountant's SURPLUS of 500 or more is stored `PENDING_APPROVAL`: it has its
 * entry number, and no till sees it until an **accountant supervisor** approves it
 * (→ `OPEN`) or rejects it with a reason (→ `REJECTED`, final). This module decides
 * what the screen says and offers about such an entry; the components only draw it.
 *
 * 🔑 **The threshold is nowhere in here, and must not be.** Whether an entry waits is
 * the server's rule (`SettlementApprovalRule`, on the rounded amount, in the store's
 * own currency) and the row's `status` already says which side of it the entry fell.
 * A client that re-derived *"≥ 500 so it must be pending"* would be a second spelling
 * of a money rule, and the first one to drift.
 *
 * ⚠️ **The supervision boolean hides buttons; it guards nothing.** `Settlement/Approve`
 * and `Settlement/Reject` sit behind their own grant filter and answer a bare 403 to a
 * session without it. `supervisionFailure` names that 403, because a probe read at
 * page load can be stale by the time the button is pressed.
 *
 * 🚩 Pure: no React, no `t()`, no clock, and no call is made — `ApiError` is imported
 * only to RECOGNISE a failure (`supervisionFailure`). Every outcome is a tagged union;
 * the words are the `settlement` namespace's.
 */

/** The refusal both doors answer with — the entry is not `PENDING_APPROVAL` (or does
 *  not exist). A machine code, matched rather than displayed. */
export const ENTRY_NOT_PENDING = 'ENTRY_NOT_PENDING'

/**
 * Did the server actually stamp this time?
 *
 * ⚠️ **`''` and `0001-01-01…` both mean no.** The approval columns are `NOT NULL`
 * with defaults (ticket 1977's SQL), so an entry nobody approved arrives with a year-1
 * date rather than an absent one — and a pane that trusted any non-empty string would
 * draw *"approved on 1 January 0001"*, sorted before the posting it approved.
 */
export function isStamped(at: string | null | undefined): boolean {
  const value = (at ?? '').trim()
  return value !== '' && !value.startsWith('0001-01-01')
}

/**
 * What the account says and offers about one entry's approval.
 *
 * | status | session | case |
 * |---|---|---|
 * | `PENDING_APPROVAL` | supervises | **`decide`** — Approve and Reject |
 * | `PENDING_APPROVAL` | does not | **`waiting`** — it waits for a supervisor, and no till sees it |
 * | `REJECTED` | anyone | **`rejected`** — who refused it, when, and the reason the accountant reads |
 * | anything else | anyone | `none` — the entry never waited, or its wait is over |
 *
 * 🔑 **`rejected` is shown to everybody**, because the accountant who posted it is the
 * reader it exists for (story 7): *"I want to see a rejected entry with the
 * supervisor's reason, so that I can post a corrected one."*
 */
export type ApprovalState =
  | { kind: 'decide' }
  | { kind: 'waiting' }
  | {
      kind: 'rejected'
      /** The supervisor's staff id — the contract carries no name for them, and one
       *  is not invented (the closer's id on a correction is the same asymmetry). */
      by: string
      /** `null` when the server did not stamp it (see `isStamped`). */
      at: string | null
      /** Server text, passed through unlocalised. */
      reason: string
    }
  | { kind: 'none' }

export function approvalFor(
  entry:
    | Pick<SettlementEntry, 'status' | 'rejectedByStaffId' | 'rejectedAt' | 'rejectedReason'>
    | null
    | undefined,
  canSupervise: boolean,
): ApprovalState {
  if (!entry) return { kind: 'none' }
  if (entry.status === 'PENDING_APPROVAL')
    // 🚩 `=== true` at the caller and nothing looser here: a session the probe did
    // not say supervises is shown the wait, never the buttons.
    return canSupervise ? { kind: 'decide' } : { kind: 'waiting' }
  if (entry.status === 'REJECTED')
    return {
      kind: 'rejected',
      by: entry.rejectedByStaffId ?? '',
      at: isStamped(entry.rejectedAt) ? entry.rejectedAt : null,
      reason: entry.rejectedReason ?? '',
    }
  return { kind: 'none' }
}

/** Which of the two supervisor acts. */
export type SupervisionAct = 'approve' | 'reject'

/**
 * **What a supervisor is shown before deciding** — story 9: *"the amount, the store,
 * the accountant and the description before approving, so that I know exactly what I
 * am authorizing."* Assembled from a row, so the dialog reads nothing back from a
 * grid and the queue and the account hand it the same shape.
 */
export type ApprovalTarget = Pick<
  SettlementEntry,
  'settlementEntryId' | 'entryNumber' | 'storeId' | 'entryKind' | 'amount' | 'reason' | 'postedByName' | 'postedAt'
> & {
  /** Both scripts in one string, as every store name on this contract carries them. */
  storeName: string
  /** The row's own currency on the queue; `''` on the account, whose door sends none
   *  (274 §B6) — `settlementMoney` then keeps a third decimal rather than guessing. */
  currencyKey: string
}

export function approvalTarget(
  entry: Omit<ApprovalTarget, 'storeName' | 'currencyKey'>,
  storeName: string,
  currencyKey: string,
): ApprovalTarget {
  const { settlementEntryId, entryNumber, storeId, entryKind, amount, reason, postedByName, postedAt } = entry
  return {
    settlementEntryId,
    entryNumber,
    storeId,
    storeName,
    entryKind,
    amount,
    reason,
    postedByName,
    postedAt,
    currencyKey,
  }
}

/**
 * What an Approve or a Reject came back with.
 *
 * 🔑 **A refusal is a 200, and on these doors it almost always means somebody got
 * there first** — a double-click, or a second supervisor working the same queue.
 * Nothing was written, and the screen's job is to say what the entry IS now, from the
 * server's own `status`, rather than to report a failure:
 *
 * - **`done`** — the act happened. `status` is the server's (`OPEN` / `REJECTED`).
 * - **`decided`** — it was no longer pending: already approved, already rejected, or
 *   corrected since. `status` is what it is now.
 * - **`gone`** — no such entry (`status: ''`).
 * - **`refused`** — a refusal carrying a code this screen does not know. Its code is
 *   passed through as data rather than swallowed.
 */
export type SupervisionOutcome =
  | { kind: 'done'; act: SupervisionAct; status: SettlementEntryStatus | '' }
  | { kind: 'decided'; status: SettlementEntryStatus }
  | { kind: 'gone' }
  | { kind: 'refused'; reason: string }

export function afterSupervision(
  act: SupervisionAct,
  result: SettlementSupervisionResult | null | undefined,
): SupervisionOutcome {
  if (result?.accepted === true) return { kind: 'done', act, status: result.status ?? '' }

  const reason = result?.refusalReason ?? ''
  // ⚠️ Only the ONE code these doors define reads the status; anything else is a
  // refusal this screen does not understand, and it says so in the server's code
  // rather than guessing that a stranger meant *somebody got there first*.
  if (reason !== ENTRY_NOT_PENDING) return { kind: 'refused', reason }
  const status = result?.status ?? ''
  return status === '' ? { kind: 'gone' } : { kind: 'decided', status }
}

/**
 * Why an Approve or a Reject threw.
 *
 * 🔑 **`forbidden` is the bare 403 the doors answer a session without settlement
 * supervision** — no body, so `@/core/api` can only call it *unexpected*. It is named
 * here because the buttons were drawn off a probe read at page load, and an
 * administrator can take the grant away between that read and the press. The screen
 * says *you no longer hold it* rather than *something went wrong*.
 *
 * Everything else — a 400 for a blank or over-long reason, the network, a 5xx — is
 * `other`, and its message is `apiErrorMessage`'s to give.
 */
export function supervisionFailure(err: unknown): 'forbidden' | 'other' {
  return err instanceof ApiError && err.statusCode === 403 ? 'forbidden' : 'other'
}
