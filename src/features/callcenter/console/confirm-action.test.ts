/**
 * `theAcceptanceThatDidNothingIsNotSilent` (ticket 177, BackOffice 858).
 *
 * The v1.2 capture found that both two-phase commits are a **no-op** on the live
 * server: the ask's own claim advances the engine version past the ledger's
 * reservation, so the confirming retry — on the same `requestId`, as §0 law 3
 * requires — resolves as already-applied and never touches the engine. The agent
 * accepts, gets a `200`, and nothing happens.
 *
 * 🚩 **The hard half of this is not detecting it — it is not crying wolf.** A
 * banner saying *nothing changed* over a basket that DID move is worse than the
 * silence it replaces, because the agent would act on it. So the cases below are
 * weighted the other way round from a normal suite: one proves the predicate
 * fires on the captures, and four prove it stays quiet.
 *
 * The captures come through `__fixtures__/payloads.ts` like every other payload
 * in this feature — that module is the one place that knows the capture's shape,
 * and a second unwrap here would drift the day v1.3 moves it.
 */
import { describe, expect, it } from 'vitest'
import callcenter from '@/locales/en/callcenter.json'
import {
  BELOW_ATP_COMMIT_ATTEMPT,
  REBIND_COMMIT_ATTEMPT,
  REBIND_PREVIEW,
  REBIND_PREVIEW_STATE,
} from './__fixtures__/payloads'
import { commitWasSwallowed, committing, isCommitting, repreviewing } from './confirm-action'

/** The action on each leg: the ask carries no token, the commit carries the one
 *  the ask handed back. One id across both (law 3). */
const ACTION = { requestId: '01JC8QF00000000000000000AA' }
const COMMIT = committing(ACTION, REBIND_PREVIEW.confirmToken)

/** The plant the rebind's token pinned as the destination. */
const TO_PLANT = (REBIND_PREVIEW.detail as { toPlant?: string }).toPlant

describe('commitWasSwallowed — what it catches', () => {
  it('reads the captured below-availability commit as the no-op it is', () => {
    // The capture's own `confirmAttempt`: 200, `replayed: true`, empty basket.
    expect(BELOW_ATP_COMMIT_ATTEMPT.replayed).toBe(true)
    expect(BELOW_ATP_COMMIT_ATTEMPT.lines).toHaveLength(0)
    const applied = BELOW_ATP_COMMIT_ATTEMPT.lines.length > 0
    expect(commitWasSwallowed(COMMIT, BELOW_ATP_COMMIT_ATTEMPT, applied)).toBe(true)
  })

  it('reads the captured rebind commit as one too — the plant did not move', () => {
    expect(REBIND_COMMIT_ATTEMPT.replayed).toBe(true)
    expect(REBIND_COMMIT_ATTEMPT.header.plant).toBe(REBIND_PREVIEW_STATE.header.plant)
    expect(REBIND_COMMIT_ATTEMPT.header.plant).not.toBe(TO_PLANT)
    const applied = REBIND_COMMIT_ATTEMPT.header.plant === TO_PLANT
    expect(commitWasSwallowed(COMMIT, REBIND_COMMIT_ATTEMPT, applied)).toBe(true)
  })

  it('🚩 rules out every shortcut the captures themselves disprove', () => {
    // These three are the reasons `applied` is an ARGUMENT rather than something
    // this function derives. Each looked like it would do, and each is wrong:
    //
    // 1. The version moved on both swallowed commits — `SaveAsync`
    //    blind-increments it (§2.1), so an advance is not an application.
    expect(REBIND_COMMIT_ATTEMPT.version).toBeGreaterThan(REBIND_PREVIEW_STATE.version)
    // 2. `hasBelowAtp` is `true` on a commit that added NOTHING — the sidecar
    //    patch landed where the engine mutation did not.
    expect(BELOW_ATP_COMMIT_ATTEMPT.header.hasBelowAtp).toBe(true)
    expect(BELOW_ATP_COMMIT_ATTEMPT.lines).toHaveLength(0)
    // 3. `pendingConfirmation` is cleared either way, so its absence says
    //    nothing about whether the thing it asked about happened.
    expect(BELOW_ATP_COMMIT_ATTEMPT.pendingConfirmation).toBeNull()
  })
})

describe('commitWasSwallowed — what it must never accuse', () => {
  it('🚩 stays silent on a REPLAY of a commit that actually applied', () => {
    // The finding that rewrote this function. §4's `replayed` means *not
    // re-applied* — which is equally true of a commit that already landed, and
    // §6.4's crash-between-2-and-3 resolution answers exactly that way. A
    // `SESSION_BUSY` retry of a commit reaches it on a live order.
    expect(commitWasSwallowed(COMMIT, { replayed: true }, true)).toBe(false)
    // Same projection as the capture's, but with the plant where it was asked to
    // go: a real move, reported as a replay. It may not draw a banner.
    const moved = { ...REBIND_COMMIT_ATTEMPT, header: { ...REBIND_COMMIT_ATTEMPT.header, plant: TO_PLANT! } }
    expect(commitWasSwallowed(COMMIT, moved, moved.header.plant === TO_PLANT)).toBe(false)
  })

  it('says nothing about the ASK, which is not a commit at all', () => {
    // The bound that keeps a busy-retried PREVIEW out of this entirely: an ask
    // carries no token, so a 200 that is merely a replay of it never qualifies.
    expect(isCommitting(ACTION)).toBe(false)
    expect(commitWasSwallowed(ACTION, { replayed: true }, false)).toBe(false)
  })

  it('is not raised by a re-preview, which has dropped its token', () => {
    // `CONFIRM_TOKEN_STALE` re-sends the same action WITHOUT the token to show a
    // fresh diff. That send is an ask, so it may not be accused.
    expect(commitWasSwallowed(repreviewing(COMMIT), { replayed: true }, false)).toBe(false)
  })

  it('accuses nothing on a first, honest commit or an under-populated answer', () => {
    // What 858 landing looks like: `replayed: false`. The banner disappears on
    // its own, with nothing here changing.
    expect(commitWasSwallowed(COMMIT, { replayed: false }, false)).toBe(false)
    // A server that carries no `replayed` at all is not accused either — absent
    // is not `true`, and §9 has clients ignore what they do not know.
    expect(commitWasSwallowed(COMMIT, {}, false)).toBe(false)
    expect(commitWasSwallowed(COMMIT, null, false)).toBe(false)
    expect(commitWasSwallowed(null, { replayed: true }, false)).toBe(false)
  })
})

describe('the words the banner needs', () => {
  const words = (callcenter as unknown as Record<string, Record<string, string>>).swallowed

  it('has a phrase for both verbs, and for the hint beside them', () => {
    for (const key of ['belowAtp', 'storeChange', 'hint', 'dismiss'])
      expect(words?.[key], `swallowed.${key} has no phrase`).toBeTruthy()
  })

  it('offers no retry in its words — the same id would be swallowed again', () => {
    // 🚩 It may say *start the action again*; it may not read as a button the
    // console does not draw, because pressing the same one is the failure.
    expect(words.belowAtp).not.toMatch(/try again/i)
    expect(words.storeChange).not.toMatch(/try again/i)
  })

  it('says the order is untouched, which is the fact that stops a re-key', () => {
    expect(words.hint).toMatch(/nothing .* changed/i)
  })
})
