/**
 * Which acts a row offers, and why it withholds the rest (ticket 215, spec 209
 * §5, contract v1.0 §3.6).
 *
 * The acts are **state-driven and withheld with their reason**, so the row
 * teaches its own vocabulary instead of an agent learning it by being refused.
 * Nothing here re-derives a status: the Request state comes from
 * `@/core/nphies/status`'s `deriveAuthAxes` and the dispensed fact from
 * `authRowMarkers`, exactly as the two axis columns read them.
 *
 * | Request state | Acts offered |
 * |---|---|
 * | `Pending` | Status check · **Retry** |
 * | `Complete`, not dispensed | Cancel |
 * | `Complete`, dispensed | — |
 * | `Failed` | **Open the refusal** — reopen and replay (221) |
 * | `Cancelled` | — |
 *
 * 🚩 **Retry belongs to `Pending`, not to `Failed`** — the correction of record
 * this ticket carries. `AuthService.RetryAuth` (`:1155`) re-POSTs the stored
 * request JSON **verbatim** and runs `ProcessPendingAuth` on the answer, i.e.
 * *"ask again with the same payload, take the newer answer"*. That is meaningless
 * for a request the exchange never accepted, and offering it there would invite an
 * agent to press it repeatedly on a request that can only be fixed on the form.
 * [201](../../../../.issues/201-nphies-rejection-detail.md)'s `Failed ⇒ Retry`
 * line is superseded.
 *
 * **These are affordances, not permissions.** The server stays authoritative — a
 * dispensed authorization is refused by the service for both retry and
 * cancellation whatever the row believed, and that refusal renders as a business
 * outcome (§6 kind 2), never as a crash. This module exists so the ordinary case
 * is *stated* rather than *discovered*.
 *
 * Pure: no React, no i18n, no `@/core/api`. It returns **key suffixes**, never
 * sentences — the label is the screen's `t()` call, per the zero-literal rule.
 *
 * It lives in the feature rather than in `core/` because the authorizations
 * feature is its only consumer: 216's detail is the same feature, and no screen
 * outside it has an authorization row to act on. `core/nphies/status` is shared
 * because two *features* render the axes; this is not that situation.
 */

import { authRowMarkers, deriveAuthAxes, type AuthAxisSource } from '@/core/nphies/status'

/**
 * The four acts a row can name — the three of §3.6 plus the refusal's own, which
 * this ticket renders and [221](../../../../.issues/221-reopening-replays-and-reports.md)
 * wired: it reaches the form route as `?copyOf=<authId>` and replays the stored
 * request there.
 */
export type AuthAct = 'statusCheck' | 'retry' | 'cancel' | 'openRefusal'

/**
 * Every act, in the order a row renders them. Exported so the screen offers
 * exactly this set and cannot drift from the type — and asserted, so an act added
 * later must decide its place in the table rather than appear at the end by
 * accident.
 */
export const AUTH_ACTS: readonly AuthAct[] = ['statusCheck', 'retry', 'cancel', 'openRefusal']

/**
 * Why an act is not offered. One value per *cause*, not per act: the same row can
 * withhold three acts and an agent who reads "unavailable" three times has learnt
 * nothing.
 *
 * - `alreadyAnswered` — the payer has replied; there is nothing left to chase or
 *   re-ask.
 * - `neverAccepted` — 🚩 the correction. The exchange refused the request before
 *   the payer saw it, so re-sending the identical payload can only be refused
 *   identically. The remedy is the form, not the button.
 * - `notAnswered` — nothing has come back yet, so there is no approval to withdraw.
 * - `dispensed` — the till has dispensed it; the service refuses both retry and
 *   cancellation (`AUTH_ALREADY_DISPENSED`).
 * - `cancelled` — the request was already withdrawn.
 * - `notRefused` — this row is not a refusal, so there is no refusal to open.
 */
export type WithheldReason =
  | 'alreadyAnswered'
  | 'neverAccepted'
  | 'notAnswered'
  | 'dispensed'
  | 'cancelled'
  | 'notRefused'

export interface RowAct {
  act: AuthAct
  available: boolean
  /** The i18n key suffix under `acts.withheld.` — non-null **exactly** when the
   *  act is withheld. No act is ever merely absent or merely greyed. */
  reason: WithheldReason | null
}

/**
 * The raw fields an act decision reads — the axis source plus the two markers,
 * i.e. a structural subset of `AuthListRow` that 216's detail also satisfies.
 *
 * `needComm` rides along because `authRowMarkers` takes it; the payer query is
 * deliberately **not** an input to any act. Answering one is out of v1, and
 * hiding the acts on a queried row would leave an agent with a stalled
 * authorization and no way to chase it.
 */
export type AuthActSource = AuthAxisSource & { needComm: boolean; isDispensed: boolean }

const withheld = (act: AuthAct, reason: WithheldReason): RowAct => ({
  act,
  available: false,
  reason,
})
const offered = (act: AuthAct): RowAct => ({ act, available: true, reason: null })

/**
 * The acts of one row, all four of them, always in `AUTH_ACTS` order.
 *
 * The dispensed marker is read **before** the verdict: a dispensed row is
 * `Complete` with a good verdict, which is exactly the shape Cancel is offered on,
 * so a rule that looked at the verdict first would offer a cancel the service will
 * refuse.
 */
export function authRowActs(row: AuthActSource): RowAct[] {
  const { request } = deriveAuthAxes(row)
  const { dispensed } = authRowMarkers(row)

  switch (request) {
    case 'pending':
      return [
        offered('statusCheck'),
        offered('retry'),
        withheld('cancel', 'notAnswered'),
        withheld('openRefusal', 'notRefused'),
      ]
    case 'complete':
      return dispensed
        ? [
            withheld('statusCheck', 'alreadyAnswered'),
            withheld('retry', 'dispensed'),
            withheld('cancel', 'dispensed'),
            withheld('openRefusal', 'notRefused'),
          ]
        : [
            withheld('statusCheck', 'alreadyAnswered'),
            withheld('retry', 'alreadyAnswered'),
            offered('cancel'),
            withheld('openRefusal', 'notRefused'),
          ]
    case 'failed':
      return [
        // There is no request in flight to chase: the exchange never took it.
        withheld('statusCheck', 'neverAccepted'),
        withheld('retry', 'neverAccepted'),
        withheld('cancel', 'notAnswered'),
        // 🚩 The one act a `Failed` row has, and the only state that offers it: a
        // request the exchange never accepted is fixable, and the way back to it
        // is a REPLAY of what was submitted rather than retyping the basket (221).
        offered('openRefusal'),
      ]
    case 'cancelled':
      return [
        withheld('statusCheck', 'cancelled'),
        withheld('retry', 'cancelled'),
        withheld('cancel', 'cancelled'),
        withheld('openRefusal', 'notRefused'),
      ]
  }
}
