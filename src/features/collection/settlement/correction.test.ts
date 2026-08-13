/**
 * **The correction decision** — which single button an entry shows, across all four
 * statuses, and what a cancel that lost its race becomes (ticket 272's Proof, spec
 * 267 D5).
 *
 * 🔑 The suite's shape is the ticket's own argument: every assertion about *which*
 * button is paired with an assertion that the **other** one is absent. A menu
 * offering both is the failure this module exists to make unrepresentable, and a
 * test that only checked the right button was present would pass on a union that
 * had quietly become two booleans.
 *
 * The four statuses are covered against the **fixture's own entries** wherever the
 * fixture holds them — it was built hostile precisely so that a `CLOSED_OUT` sits
 * beside a `CANCELLED` and a partly-consumed surplus beside an untouched shortage.
 */
import { describe, expect, it } from 'vitest'

import type { SettlementEntry } from '@/core/models/settlement'
import { afterRefusedCancel, afterRefusedCloseOut, correctionFor } from './correction'
import { SETTLEMENT_ACCOUNTS } from './settlement-fixture'

const entryOf = (code: string, entryNumber: number): SettlementEntry => {
  const found = SETTLEMENT_ACCOUNTS[code].entries.find((e) => e.entryNumber === entryNumber)
  if (!found) throw new Error(`fixture ${code} has no entry ${entryNumber}`)
  return found
}

describe('the one button an entry offers', () => {
  it('offers CANCEL on an untouched OPEN entry — 0142/143, 500.00 of 500.00 left', () => {
    const entry = entryOf('0142', 143)
    expect(entry.remainingAmount).toBe(entry.amount)
    expect(correctionFor(entry)).toEqual({ kind: 'cancel', amount: 500 })
  })

  it('offers the WRITE-OFF on a partly consumed one — 0142/151, 120.00 of 320.00 left', () => {
    const entry = entryOf('0142', 151)
    expect(entry.status).toBe('OPEN')
    expect(entry.remainingAmount).toBeLessThan(entry.amount)
    expect(correctionFor(entry)).toEqual({ kind: 'write-off', remaining: 120 })
  })

  it('🔑 never offers both — the two acts are cases of one union, not two flags', () => {
    // The type makes this unrepresentable; the test is here so a refactor into
    // `{canCancel, canWriteOff}` fails loudly rather than silently widening the
    // menu this ticket exists to keep at one item.
    for (const entry of Object.values(SETTLEMENT_ACCOUNTS).flatMap((a) => a.entries)) {
      const correction = correctionFor(entry)
      expect(['cancel', 'write-off', 'none']).toContain(correction.kind)
      expect(Object.keys(correction)).toHaveLength(2)
    }
  })

  it('🔑 writes off the SERVER’s remaining, never amount − remaining', () => {
    // 269's rule 3, one screen over: this feature performs no subtractions. The
    // figure on the button is `remainingAmount` and nothing else, so a journal
    // whose rows do not add up (a reversal, a repair) cannot move it.
    const entry = entryOf('0455', 141)
    expect(correctionFor(entry)).toEqual({ kind: 'write-off', remaining: entry.remainingAmount })
    expect(entry.amount - entry.remainingAmount).not.toBe(entry.remainingAmount)
  })
})

describe('the entries that offer nothing at all', () => {
  it('🔑 a CANCELLED entry offers no correction — 0688/147', () => {
    expect(correctionFor(entryOf('0688', 147))).toEqual({ kind: 'none', because: 'cancelled' })
  })

  it('🔑 a CLOSED_OUT entry offers no correction — 0688/133', () => {
    expect(correctionFor(entryOf('0688', 133))).toEqual({ kind: 'none', because: 'written-off' })
  })

  it('a CONSUMED entry offers none either — a till took all of it (0207/149)', () => {
    expect(correctionFor(entryOf('0207', 149))).toEqual({ kind: 'none', because: 'consumed' })
  })

  it('🚩 …and the three reasons stay distinct, because they are three different facts', () => {
    // *Where did the money go* is the question the branch asks, and "closed" is not
    // an answer to it. Collapsing these would make the sentence beside a missing
    // button say nothing.
    const reasons = [
      correctionFor(entryOf('0688', 147)),
      correctionFor(entryOf('0688', 133)),
      correctionFor(entryOf('0207', 149)),
    ].map((c) => (c.kind === 'none' ? c.because : c.kind))
    expect(new Set(reasons).size).toBe(3)
  })

  it('🚩 an OPEN entry with nothing left offers no write-off of zero', () => {
    // A server inconsistency (the consume that emptied it should have set
    // CONSUMED), and the one thing the screen must not do with it is offer an act
    // whose audit row would say an accountant forgave nothing.
    const entry = { ...entryOf('0142', 143), remainingAmount: 0 }
    expect(correctionFor(entry)).toEqual({ kind: 'none', because: 'nothing-left' })
  })

  it('is null-tolerant — D8 is unconfirmed and this app has no ErrorBoundary', () => {
    expect(correctionFor(null)).toEqual({ kind: 'none', because: 'nothing-left' })
    expect(correctionFor(undefined)).toEqual({ kind: 'none', because: 'nothing-left' })
  })
})

describe('the equality that decides between the two buttons', () => {
  it('⚠️ is tested at the scale money is HELD at — a BHD fils moves it', () => {
    // 0688 is the estate's 3-decimal branch. An entry consumed by one fils is a
    // partly-consumed entry, and rounding that away at the branch's DISPLAY
    // precision would offer Cancel on an entry the server will refuse to cancel —
    // manufacturing this ticket's race for no reason.
    const entry = entryOf('0688', 152)
    expect(correctionFor(entry).kind).toBe('cancel')
    expect(correctionFor({ ...entry, remainingAmount: entry.amount - 0.001 })).toEqual({
      kind: 'write-off',
      remaining: 95.249,
    })
  })

  it('is not fooled by an IEEE-754 tail — a summed remaining still reads as untouched', () => {
    const entry = { ...entryOf('0142', 143), remainingAmount: 0.1 + 0.2 + 499.7 }
    expect(correctionFor(entry).kind).toBe('cancel')
  })

  it('⚠️ treats an impossible remaining ABOVE the amount as not-untouched', () => {
    // Unreachable through any server path — but whatever produced it, the cancel's
    // own predicate would not hold, so the honest affordance is the one that can
    // actually succeed.
    const entry = { ...entryOf('0142', 143), remainingAmount: 600 }
    expect(correctionFor(entry)).toEqual({ kind: 'write-off', remaining: 600 })
  })
})

describe('🔑 the cancel that lost the race', () => {
  const untouched = entryOf('0142', 143)

  it('comes back with the NEW remaining and the write-off in reach', () => {
    const outcome = afterRefusedCancel(untouched, {
      refusalReason: 'A till consumed part of this entry.',
      remainingAmount: 350,
    })
    expect(outcome).toEqual({
      kind: 'partly-consumed',
      remaining: 350,
      offer: { kind: 'write-off', remaining: 350 },
    })
  })

  it('🔑 …and the recovery is the SAME rule over the server’s newer truth', () => {
    // Not a patch on the affordance the screen was drawn with: `correctionFor` runs
    // again over the returned figure, so a raced entry gets the one definition of
    // *which button* that every other entry gets.
    const outcome = afterRefusedCancel(untouched, { refusalReason: '', remainingAmount: 350 })
    expect(outcome.kind === 'partly-consumed' && outcome.offer).toEqual(
      correctionFor({ ...untouched, remainingAmount: 350 }),
    )
  })

  it('🚩 says nothing-left when a till consumed ALL of it mid-dialog', () => {
    // There is no write-off to offer, and offering one for zero would be an act
    // with no effect on an entry that is already finished.
    expect(afterRefusedCancel(untouched, { refusalReason: '', remainingAmount: 0 })).toEqual({
      kind: 'nothing-left',
    })
  })

  it('🚩 does NOT fall back to Cancel when the remaining did not move', () => {
    // Whatever the server objected to is not this race, and a button that
    // reappears unchanged after a refusal is a button an accountant presses in a
    // loop. The server's own words carry the explanation instead.
    expect(
      afterRefusedCancel(untouched, {
        refusalReason: 'This entry belongs to a batch that is being cancelled.',
        remainingAmount: untouched.amount,
      }),
    ).toEqual({ kind: 'refused', reason: 'This entry belongs to a batch that is being cancelled.' })
  })

  it('⚠️ treats a refusal with no usable figure as a refusal, not a race', () => {
    // Guessing a remaining would put a number on screen that no server ever sent,
    // on the one screen whose figures a branch hands money over against.
    expect(afterRefusedCancel(untouched, { refusalReason: 'No.', remainingAmount: NaN })).toEqual({
      kind: 'refused',
      reason: 'No.',
    })
    expect(afterRefusedCancel(untouched, null)).toEqual({ kind: 'refused', reason: '' })
  })
})

describe('the write-off that was refused', () => {
  // 🚩 The cancel's refusal had a tagged union and a suite; this one was being
  // reasoned about inline in the component, with `-1` standing in for "no figure".
  // `/standards-review` called that the asymmetry it was, and this is the half of
  // the fix that makes it falsifiable.

  it('names what the entry still has left — the one unambiguous reading', () => {
    // On a REFUSED close-out nothing was forgiven, so `remainingAmount` can only
    // mean what is left. (On a successful one it is genuinely ambiguous, which is
    // why the confirmation names no figure at all — see `.afk/HITL-272.md`.)
    expect(afterRefusedCloseOut({ remainingAmount: 400 })).toEqual({
      kind: 'refused',
      remaining: 400,
    })
  })

  it('🚩 says nothing-left when a till took the rest while the panel was open', () => {
    expect(afterRefusedCloseOut({ remainingAmount: 0 })).toEqual({ kind: 'nothing-left' })
  })

  it('⚠️ states NO figure when the server sent none, rather than inventing one', () => {
    // D8 gives this answer two fields and no `refusalReason`, so there are no server
    // words to fall back on either — the screen says what it does not know.
    expect(afterRefusedCloseOut({})).toEqual({ kind: 'unstated' })
    expect(afterRefusedCloseOut({ remainingAmount: NaN })).toEqual({ kind: 'unstated' })
    expect(afterRefusedCloseOut(null)).toEqual({ kind: 'unstated' })
    expect(afterRefusedCloseOut(undefined)).toEqual({ kind: 'unstated' })
  })

  it('rounds at the scale money is held at, as every other figure here does', () => {
    expect(afterRefusedCloseOut({ remainingAmount: 0.1 + 0.2 })).toEqual({
      kind: 'refused',
      remaining: 0.3,
    })
  })
})
