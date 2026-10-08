/**
 * What a re-run's answer tells HQ (ticket 435, spec 430 D5/D12/D17). Pure: no React, no `t` — the
 * screen words what this decides.
 *
 * Lifted from WPF `FailedDonorTransfersController.ReRun`: success posted, `success:false` did not
 * finish, and a call that did not answer may still be running — the run posts stock in DRS, so a
 * lost answer is never "failed".
 */
import { apiErrorCode, apiErrorKind, apiErrorMessage } from '@/core/api'
import type { OutboxRunResult } from '@/core/models/failed-donor-transfer'

/** The run, settled: its answer, or what it threw. */
export type RunSettled = { ok: true; result: OutboxRunResult | null } | { ok: false; error: unknown }

export type RunOutcome =
  | { kind: 'posted' }
  /** The run answered and did not finish; `error` is its own words, or `null` when it gave none. */
  | { kind: 'notFinished'; error: string | null }
  /** No answer (network, a timeout, a server fault): it may still be running. */
  | { kind: 'noAnswer' }
  /**
   * The server refused the run (`NOT_RERUNNABLE`, a missing grant), with its own message — `null`
   * when the refusal carried none, for the screen to word.
   */
  | { kind: 'refused'; code: string | null; message: string | null }
  /** The session ended: `@/core/api` already said so and is taking the user to sign in. */
  | { kind: 'signedOut' }

export function runOutcome(settled: RunSettled): RunOutcome {
  if (settled.ok) {
    const { result } = settled
    if (result?.success === true) return { kind: 'posted' }
    return { kind: 'notFinished', error: result?.error?.trim() || null }
  }
  const { error } = settled
  switch (apiErrorKind(error)) {
    case 'auth':
      return { kind: 'signedOut' }
    case 'business':
      return { kind: 'refused', code: apiErrorCode(error), message: apiErrorMessage(error, '').trim() || null }
    default:
      // network, server (a 504 gateway timeout among them), unknown, or not an ApiError at all:
      // the call lost its answer, and the server may have kept going (WPF: "it may still be running").
      return { kind: 'noAnswer' }
  }
}
