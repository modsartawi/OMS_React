/**
 * The batch runner (spec 805, ticket 806): a list of items and a single-item write, run one item at
 * a time through the write.
 *
 * - **Sequential**, never parallel: the load stays trivial and the audit order is the pick order.
 * - **A refusal never stops the batch.** Any thrown error (a business refusal, a network or server
 *   failure) is recorded as that item's `refused` outcome, with the error, and the next item runs.
 *   The caller shows it through `apiErrorMessage`.
 * - **An expired session does.** An `auth` `ApiError` means the session is gone: `handle401` has
 *   already cleared it and is redirecting, so the rest are reported `not-attempted` and never sent.
 *
 * Pure apart from the write it is handed: no React, no DOM.
 */
import { apiErrorKind } from '@/core/api'

export type BatchOutcome<T> =
  | { item: T; status: 'done' }
  | { item: T; status: 'refused'; error: unknown }
  | { item: T; status: 'not-attempted' }

export interface BatchResult<T> {
  /** One per item, in the items' order. */
  outcomes: BatchOutcome<T>[]
  done: number
  refused: number
  notAttempted: number
  /** True when an expired session ended the batch early. */
  stopped: boolean
}

export interface BatchProgress<T> {
  /** Items settled so far (done or refused). */
  completed: number
  total: number
  /** The outcome of the item that just settled. */
  outcome: BatchOutcome<T>
}

export async function runBatch<T>(
  items: readonly T[],
  write: (item: T) => Promise<unknown>,
  onProgress?: (progress: BatchProgress<T>) => void,
): Promise<BatchResult<T>> {
  const outcomes: BatchOutcome<T>[] = []
  let stopped = false
  for (const item of items) {
    if (stopped) {
      outcomes.push({ item, status: 'not-attempted' })
      continue
    }
    let outcome: BatchOutcome<T>
    try {
      await write(item)
      outcome = { item, status: 'done' }
    } catch (error) {
      outcome = { item, status: 'refused', error }
      if (apiErrorKind(error) === 'auth') stopped = true
    }
    outcomes.push(outcome)
    onProgress?.({ completed: outcomes.length, total: items.length, outcome })
  }
  const count = (s: BatchOutcome<T>['status']) => outcomes.filter((o) => o.status === s).length
  return { outcomes, done: count('done'), refused: count('refused'), notAttempted: count('not-attempted'), stopped }
}

/** The items whose write was refused, in order — what a retry sends again. */
export function refusedItems<T>(result: BatchResult<T>): T[] {
  return result.outcomes.filter((o) => o.status === 'refused').map((o) => o.item)
}
