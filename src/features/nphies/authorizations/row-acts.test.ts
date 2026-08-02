/**
 * The three pure Proof bullets of ticket 215, at the seam that owns them.
 *
 * A row's acts are a **function of its Request state and its dispensed marker**,
 * and nothing else. These assertions are the mapping table of spec 209 §5 and
 * contract §3.6 stated as tests, so the one correction of record this ticket
 * carries — **Retry belongs to `Pending`, not to `Failed`** — cannot regress back
 * to 201's original line by anyone reading the older ticket.
 */
import { describe, expect, it } from 'vitest'
import { AUTH_ACTS, authRowActs, type AuthActSource } from './row-acts'

/** A row in each of the five states the table names. `AuthAxisSource`'s four raw
 *  fields plus the two markers — never a pre-derived state, because the point of
 *  the module is that it derives one. */
const ROW = (over: Partial<AuthActSource> = {}): AuthActSource => ({
  cancelled: false,
  error: false,
  queued: false,
  claimProcessingCodes: 'Complete',
  adjudicationOutcome: 'approved',
  needComm: false,
  isDispensed: false,
  ...over,
})

const PENDING = ROW({ queued: true, claimProcessingCodes: 'Queued', adjudicationOutcome: '' })
const COMPLETE = ROW()
const DISPENSED = ROW({ isDispensed: true })
// 🚩 Still carries `Complete` + `approved`: `Error` and `Cancelled` outrank the
// stored outcome, which is `deriveAuthAxes`'s rule and not this module's.
const FAILED = ROW({ error: true, claimProcessingCodes: 'Error' })
const CANCELLED = ROW({ cancelled: true })

const offered = (row: AuthActSource) =>
  authRowActs(row)
    .filter((a) => a.available)
    .map((a) => a.act)

describe('retryIsOfferedOnPendingAndNotOnFailed', () => {
  it('🚩 offers Retry on a PENDING request', () => {
    // Retry re-POSTs the stored request JSON verbatim and takes the newer answer
    // (`AuthService.RetryAuth:1155`) — "ask again with the same payload". That is
    // exactly what a request the exchange accepted but has not answered wants.
    expect(offered(PENDING)).toContain('retry')
  })

  it('🚩 does NOT offer Retry on a FAILED request — the correction of record', () => {
    // 201 said `Failed ⇒ Retry`; the contract supersedes it (§3.6). A `Failed`
    // request was refused BEFORE the payer saw it, so re-sending the identical
    // payload can only be refused identically — and an act that cannot succeed
    // invites an agent to press it repeatedly instead of fixing the request.
    expect(offered(FAILED)).not.toContain('retry')
  })

  it('and says WHY it is withheld there, naming the payload rather than the state', () => {
    const retry = authRowActs(FAILED).find((a) => a.act === 'retry')
    expect(retry?.available).toBe(false)
    expect(retry?.reason).toBe('neverAccepted')
  })

  it('offers Status check beside it on Pending, and nowhere else', () => {
    expect(offered(PENDING)).toEqual(['statusCheck', 'retry'])
    for (const row of [COMPLETE, DISPENSED, FAILED, CANCELLED]) {
      expect(offered(row)).not.toContain('statusCheck')
    }
  })
})

describe('everyWithheldActCarriesItsReason', () => {
  it('names every act on every row — no act is ever merely absent', () => {
    // The row teaches its own vocabulary. An act that vanishes on some states
    // teaches nothing, and an agent learns the rule by being refused instead.
    for (const row of [PENDING, COMPLETE, DISPENSED, FAILED, CANCELLED]) {
      expect(authRowActs(row).map((a) => a.act)).toEqual([...AUTH_ACTS])
    }
  })

  it('🚩 gives every withheld act a reason, and every offered act none', () => {
    for (const row of [PENDING, COMPLETE, DISPENSED, FAILED, CANCELLED]) {
      for (const act of authRowActs(row)) {
        if (act.available) expect(act.reason).toBeNull()
        else expect(act.reason).not.toBeNull()
      }
    }
  })

  it('the reason distinguishes the states rather than repeating one sentence', () => {
    const reasonFor = (row: AuthActSource, act: string) =>
      authRowActs(row).find((a) => a.act === act)?.reason

    // Cancel is withheld on three different rows for three different causes, and
    // "you cannot do that" three times would teach none of them.
    expect(reasonFor(PENDING, 'cancel')).toBe('notAnswered')
    expect(reasonFor(DISPENSED, 'cancel')).toBe('dispensed')
    expect(reasonFor(CANCELLED, 'cancel')).toBe('cancelled')
    expect(reasonFor(COMPLETE, 'retry')).toBe('alreadyAnswered')
  })

  it('🚩 offers the Failed row’s own act — and offers it NOWHERE else (221)', () => {
    // A request the exchange never accepted is the one thing on this list that is
    // still fixable, and the way back to it is a replay of what was submitted.
    const reopen = authRowActs(FAILED).find((a) => a.act === 'openRefusal')
    expect(reopen?.available).toBe(true)
    expect(reopen?.reason).toBeNull()

    // And on every other state it is withheld for the OTHER reason: there is no
    // refusal to open.
    for (const row of [PENDING, COMPLETE, DISPENSED, CANCELLED]) {
      expect(authRowActs(row).find((a) => a.act === 'openRefusal')?.reason).toBe('notRefused')
    }
  })
})

describe('aDispensedAuthorizationOffersNothing', () => {
  it('🚩 withholds BOTH cancel and retry once the row is dispensed', () => {
    // The service refuses both (`CancellationService:120`, `RetryAuth`'s dispensed
    // guard) and answers `AUTH_ALREADY_DISPENSED`. The row says so first — the
    // server stays authoritative, but an agent should not have to press a button
    // to learn a fact the row already carries.
    const acts = authRowActs(DISPENSED)
    expect(acts.find((a) => a.act === 'cancel')?.available).toBe(false)
    expect(acts.find((a) => a.act === 'retry')?.available).toBe(false)
  })

  it('offers no act at all on a dispensed row', () => {
    expect(offered(DISPENSED)).toEqual([])
  })

  it('and offers none on a cancelled one either', () => {
    expect(offered(CANCELLED)).toEqual([])
  })

  it('offers Cancel on a completed, UNdispensed authorization — the one act it has', () => {
    expect(offered(COMPLETE)).toEqual(['cancel'])
  })

  it('the dispensed marker outranks the verdict, not the other way round', () => {
    // A dispensed row is `Complete` with a good verdict, which is precisely the
    // shape the cancel act is offered on. Reading the verdict first would offer a
    // cancel the server will refuse.
    expect(offered(ROW({ isDispensed: true, adjudicationOutcome: 'partial' }))).toEqual([])
  })
})
