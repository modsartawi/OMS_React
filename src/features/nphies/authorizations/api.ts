/**
 * The authorizations feature's server calls (spec 209, frozen contract v1.0
 * §1.1). Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`):
 * the envelope, the three-way error taxonomy and 401 are that module's, and 401
 * in particular is never caught here.
 *
 * The door is `Nphies/*` — one tag, one grant filter, one probe (§1). The probe
 * and the providers lookup both live in `@/core/nphies/api` because the whole
 * area shares them.
 *
 * ⚠️ **The endpoint does not exist yet.** SIS.Api maps exactly one Nphies route
 * today (`POST Nphies/CheckEligibility`, §1's verified note); the re-modelled
 * authorization list is BackOffice 913's half of this slice. Until it lands the
 * screen is verified against stubbed envelopes
 * (`tools/nphies-authorizations-drive.mjs`) built from the contract's own shapes
 * — the same code-complete / runtime-blocked posture 211–213 shipped under.
 */
import { api } from '@/core/api'
import type {
  AuthCancellationRequest,
  AuthCancellationResult,
  AuthDetail,
  AuthListRow,
  AuthRetryResult,
  AuthStatusCheckResult,
  NphiesAbandonResult,
  NphiesAuthSessionState,
  NphiesOpenResult,
  NphiesPage,
} from '@/core/models/nphies'

export const authorizationsApi = {
  /**
   * `GET Nphies/AuthResponses` (§1.1 #5, §3.3) — the list, **re-modelled** rather
   * than proxied.
   *
   * 🚩 One of only two endpoints in the whole contract that SIS.Api re-models:
   * upstream answers a `Take(20000)` ordered by `RowIndex` descending
   * (`AuthService.cs:1401`), so **sort, page and total are the server's** and this
   * call is the one place the browser trusts them.
   *
   * The params object is built by the pure `buildAuthListParams` — the window, the
   * six filters and `showAll` all live there, and nothing on this function decides
   * what narrows the read.
   */
  list(params: Record<string, unknown>): Promise<NphiesPage<AuthListRow>> {
    return api.get<NphiesPage<AuthListRow>>('Nphies/AuthResponses', params)
  },

  /**
   * `GET Nphies/AuthResponse/{id}` (§1.1 #6, §3.4, ticket 216) — one
   * authorization, whole.
   *
   * 🚩 It answers **`AuthHeaderDto`**, not the thin submit DTO: `AuthLines` and
   * `AuthSupportingInfos` are eagerly fetched, every line carries
   * `AdjudicationOutcome` / `ApprovedQuantity` / `Rejected` / `Benefit` / `Copay`
   * and the **already-decoded** `BenefitReason`, and the attachments come back as
   * base64 whether anyone renders them or not. That is why **there is no
   * rejection view to build** — no second endpoint, no second surface.
   *
   * ⚠️ It is also the heaviest read on this door: the response carries every
   * attached megabyte. No `refetchInterval` anywhere near it (§3.6), and a stored
   * response does not change on its own.
   *
   * An unknown id is a **business outcome**, not a crash — SIS.Api answers
   * `AUTH_NOT_FOUND` rather than forwarding the upstream's empty 204, which would
   * have rendered a blank detail for a mistyped id (BackOffice 916).
   */
  detail(id: string): Promise<AuthDetail> {
    return api.get<AuthDetail>(`Nphies/AuthResponse/${encodeURIComponent(id)}`)
  },

  /**
   * `POST Nphies/StatusCheck` (§1.1 #7, §3.6) — the manual escalation for a
   * `Pending` row that has waited too long.
   *
   * 🚩 It is **not a poll**. The service's own `PollRequestWorker` sweeps every 15
   * seconds, so a pending authorization becomes complete on its own; this act is
   * what an agent presses when it has not. Nothing on this screen sets a
   * `refetchInterval`.
   *
   * `reference` is the authorization **id** — `CancellationService.cs:108` matches
   * it as `c.Id`, not as the payer's preauth reference.
   */
  statusCheck(reference: string): Promise<AuthStatusCheckResult> {
    return api.post<AuthStatusCheckResult>('Nphies/StatusCheck', { reference })
  },

  /**
   * `POST Nphies/Retry` (§1.1 #8, §3.6) — re-POST the stored request payload
   * verbatim and take the newer answer.
   *
   * 🚩 **Offered on `Pending` only** (`row-acts.ts` carries the correction), and
   * 🚩 **`referenceId` is the only field the browser sends**: `referenceType`,
   * `staffId` and `storeCode` are the server's (law 7 / §1.3), pinned and stamped
   * from the session. A body that carried them would be the browser asserting an
   * identity — SIS.Api overwrites them, and sending them anyway would say this
   * client believes otherwise.
   */
  retry(referenceId: string): Promise<AuthRetryResult> {
    return api.post<AuthRetryResult>('Nphies/Retry', { referenceId })
  },

  /**
   * `POST Nphies/Cancellation` (§1.1 #9, §3.6) — withdraw a completed,
   * undispensed authorization.
   *
   * `claimType` and `staffId` are absent for the retry's reason. What is left is
   * genuinely the agent's: the row's `reference` and `providerCode`, the chosen
   * `reasonCode`, and `nullify`, which is always `false` — the upstream refuses a
   * nullify outright and SIS.Api forwards the flag as asked rather than quietly
   * downgrading it to an ordinary cancellation.
   */
  cancel(body: AuthCancellationRequest): Promise<AuthCancellationResult> {
    return api.post<AuthCancellationResult>('Nphies/Cancellation', body)
  },
}

/**
 * The **engine session** verbs (contract §1.2) — ticket 217's half of the table.
 *
 * All `POST` under `Nphies/Session/*` except the read, all carrying
 * `{ transactionId, requestId }`, and **every mutating one answers the whole
 * `NphiesAuthSessionState`** (law 3). There is no delta protocol and no reducer:
 * the client renders the latest state it is allowed to render, and which one that
 * is comes from `@/core/engine-session/session-state` (§2.1).
 *
 * 🚩 **Six of the eleven verbs are here.** `setHeader`, `setInsurance`,
 * `updateLineInsurance`, `updateLineMeta` and `submit` belong to 218–220 and are
 * deliberately absent — a verb declared before the screen that presses it is a
 * shape nobody has checked against a live door.
 *
 * ⚠️ **None of these endpoints exists yet.** They are the largest and riskiest
 * server term in the effort (8–12 days, a *parallel* build: the call-centre engine
 * services are document-type-aware but call-centre-**bound**). Until they land the
 * form is verified against stubbed envelopes
 * (`tools/nphies-authorization-session-drive.mjs`) built from the contract's own
 * shapes — the code-complete / runtime-blocked posture 211–216 shipped under.
 */
export const authSessionApi = {
  /**
   * `POST Nphies/Session/Open` → §7.1's `OpenResult`. Opens a real `NphiesAuth`
   * transaction: from this moment everything the agent does is on one transaction
   * the server owns, and there is no save verb because **the transaction IS the
   * draft** (law 9).
   *
   * 🚩 It takes the eligibility id and the chosen member id and **nothing else**
   * — 213's seam, verbatim. The patient, payer, policy and provider come back in
   * the state's `reference`, fetched server-side from that eligibility, which is
   * why this form never reads the eligibility itself: one read, inside the verb
   * that binds it, so a second client-side one cannot disagree with what the
   * engine bound.
   *
   * 🚩 **The plant is not on this body.** The acting store is bound from the
   * agent's own session server-side (law 8 / law 7); a browser-supplied plant
   * would be the client naming the one value that decides every amount.
   *
   * 🚩 **Shift-less**, per the call-centre device precedent — a browser has no
   * shift and nothing reads one before submission. And unlike the call-centre
   * door there is **no `refusedExisting`**: a second `Open` opens a second
   * transaction, because nothing here is resumable.
   */
  open(requestId: string, eligibilityId: string, memberId: string): Promise<NphiesOpenResult> {
    return api.post<NphiesOpenResult>('Nphies/Session/Open', {
      requestId,
      eligibilityId,
      memberId,
    })
  },

  /**
   * `GET Nphies/Session/State?transactionId=` — **refresh, recovery and reload
   * only** (law 3). Never a way to "sync": a mutating verb has already returned
   * the whole state, and asking again after one would be the client admitting it
   * did not believe the answer.
   *
   * A pure read, so it carries no `requestId`: there is no act for a ledger to
   * absorb.
   */
  state(transactionId: string): Promise<NphiesAuthSessionState> {
    return api.get<NphiesAuthSessionState>('Nphies/Session/State', { transactionId })
  },

  /**
   * `POST Nphies/Session/AddItem` → the whole state (law 3).
   *
   * 🚩 **It sends an item number and a quantity, and never a price** (law 1). What
   * the line costs is decided by pricing at the plant and comes back in the
   * projection — including `pricing: 'pending'` while it is still being decided,
   * which is what lets the row **price in place** instead of appearing blank.
   *
   * Refuses `ITEM_ALREADY_ON_REQUEST` (409) — §2.3's rule, moved forward from
   * WPF's submit-time `ValidateDuplicateItems` so the agent fixes it while looking
   * at it, with the **quantity control named as the remedy**. Also
   * `ITEM_NOT_FOUND`, `ITEM_NO_NPHIES_CATEGORY`, `NO_PRICE_AT_PLANT`,
   * `ZERO_EXTENDED_PRICE` and `QTY_INVALID` — every one of them a business
   * outcome the row states, never a crash.
   */
  addItem(
    transactionId: string,
    requestId: string,
    itemNumber: string,
    qty: number,
  ): Promise<NphiesAuthSessionState> {
    return api.post<NphiesAuthSessionState>('Nphies/Session/AddItem', {
      transactionId,
      requestId,
      itemNumber,
      qty,
    })
  },

  /**
   * `POST Nphies/Session/ChangeQty` → the whole state (law 3).
   *
   * 🚩 It sends a **new quantity**, never a delta: the engine owns what the line
   * holds, and a delta applied to a line that moved under the agent would be a
   * quantity nobody chose. It re-prices, which is why the whole state comes back.
   *
   * Refuses `QTY_INVALID` (zero, negative, or beyond the cap — the cap is the
   * engine's and is never re-implemented here) and `LINE_NOT_FOUND`, which on this
   * verb is nearly always a screen that has fallen behind.
   */
  changeQty(
    transactionId: string,
    requestId: string,
    lineId: string,
    newQty: number,
  ): Promise<NphiesAuthSessionState> {
    return api.post<NphiesAuthSessionState>('Nphies/Session/ChangeQty', {
      transactionId,
      requestId,
      lineId,
      newQty,
    })
  },

  /**
   * `POST Nphies/Session/VoidLine` → the whole state (law 3).
   *
   * 🚩 **The line is kept, not removed.** That is the whole reason the form is a
   * session: the audit trail must show what the engine landed against what the
   * agent changed, and "added then voided" is exactly what a payload of survivors
   * cannot record. The projection returns it with `voided: true` and the grid
   * draws it.
   *
   * Refuses `LINE_NOT_FOUND`.
   */
  voidLine(
    transactionId: string,
    requestId: string,
    lineId: string,
  ): Promise<NphiesAuthSessionState> {
    return api.post<NphiesAuthSessionState>('Nphies/Session/VoidLine', {
      transactionId,
      requestId,
      lineId,
    })
  },

  /**
   * `POST Nphies/Session/Abandon` → §7.2's `AbandonResult`. The transaction is
   * VOIDED.
   *
   * 🚩 **Leaving abandons, and there are no drafts** (law 9). Nothing is
   * resumable and a crashed tab is swept server-side, which is precisely why the
   * form warns before navigating away: leaving genuinely discards the request.
   *
   * 🚩 **No state comes back** — there is nothing left to render — so the caller
   * owes the agent a landing. An abandon with no follow-on leaves them holding
   * nothing.
   */
  abandon(transactionId: string, requestId: string): Promise<NphiesAbandonResult> {
    return api.post<NphiesAbandonResult>('Nphies/Session/Abandon', { transactionId, requestId })
  },
}
