/**
 * `bothSubmittedOutcomesAreTheSameNews` (ticket 174) — asserted at the module's
 * edge: a `SubmitResult` or a thrown `ApiError` in, the news the agent gets out.
 *
 * 🚩 The headline case is an EQUALITY, not two assertions that happen to agree:
 * `submitted` and `alreadySubmitted` are compared to each other, so a branch
 * added later that makes the replay look different fails here rather than on a
 * phone call. The other three — refused, unavailable, and anything else — are
 * asserted to be distinct from both and from each other, because a refusal that
 * read like an outage would send the agent to press *Try again* instead of
 * fixing the field.
 *
 * The locale file is imported and asserted against, as at 173: a `t()` with no
 * backing key renders the raw key to the agent, and no type check can see it.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import callcenter from '@/locales/en/callcenter.json'
import { SUBMIT_PLACED, SUBMIT_REPLAYED } from './__fixtures__/payloads'
import { readSubmitFailure, readSubmitResult, submitRefusalChip } from './submit-outcome'

/** `submit.placed` → the phrase, or undefined if the key does not exist. */
const phrase = (key: string): string | undefined =>
  (callcenter as unknown as Record<string, Record<string, string>>)[key.split('.')[0]]?.[
    key.split('.')[1]
  ]

/** §7's refusals as `core/api.ts` hands them over: business-kind, coded, with
 *  the envelope's own `data` carried on. Never hand-shaped — the fields are the
 *  ones `request()` actually fills. */
const refusal = (code: string, message: string, data: unknown = null) =>
  new ApiError('business', message, code === 'SUBMIT_UNAVAILABLE' ? 503 : 409, [
    { errorCode: code, internalErrorCode: '', errorMessage: '' },
  ], data)

describe('readSubmitResult', () => {
  it('reads the same news out of both successes', () => {
    const first = readSubmitResult(SUBMIT_PLACED)
    const replay = readSubmitResult(SUBMIT_REPLAYED)

    // 🚩 The whole ticket in one line: the outcome word and `replayed` do not
    // survive this module, so no surface downstream CAN tell the two apart.
    expect(replay).toEqual(first)
    expect(first.documentNo).toBe(SUBMIT_PLACED.documentNo)
    // The replay's number is the FIRST submit's — once-only is keyed on the
    // transaction id, so there is only ever one to carry (§8.3).
    expect(SUBMIT_REPLAYED.documentNo).toBe(SUBMIT_PLACED.documentNo)
  })

  it('answers the news and not the projection', () => {
    // 🚩 The returned state goes to the cache through `applyState`, on the one
    // write path every verb shares. If it rode along here, the two successes
    // would be comparable by something other than what the agent is told — the
    // fixture's own replay carries an ELIDED state — and the equality above
    // would be quietly weaker than it looks.
    expect(Object.keys(readSubmitResult(SUBMIT_PLACED))).toEqual(['documentNo'])
  })
})

describe('readSubmitFailure', () => {
  const fallback = 'fallback'

  it('marks a transient outage retryable, with the order still open', () => {
    const failure = readSubmitFailure(refusal('SUBMIT_UNAVAILABLE', 'The order service is not responding.'), fallback)
    expect(failure).toMatchObject({ kind: 'unavailable', retryable: true, orderOpen: true })
    // The server's own sentence, passed through as data (§7) — never a key.
    expect(failure.message).toBe('The order service is not responding.')
  })

  it('names the field a refusal wants fixed, and leaves the order open', () => {
    const failure = readSubmitFailure(
      refusal('SUBMIT_REFUSED', 'A delivery slot is required.', { field: 'slot' }),
      fallback,
    )
    expect(failure).toMatchObject({ kind: 'refused', retryable: false, orderOpen: true, field: 'slot' })
    expect(failure.message).toBe('A delivery slot is required.')
  })

  it('keeps the four outcomes distinct from one another', () => {
    const kinds = [
      readSubmitFailure(refusal('SUBMIT_REFUSED', 'x'), fallback).kind,
      readSubmitFailure(refusal('SUBMIT_UNAVAILABLE', 'x'), fallback).kind,
      readSubmitFailure(new ApiError('network', 'x', 0), fallback).kind,
    ]
    expect(new Set(kinds).size).toBe(3)
    // ...and none of them is a success: the two successes have no `kind` at all,
    // which is what stops any of these being mistaken for one.
    expect(readSubmitResult(SUBMIT_PLACED)).not.toHaveProperty('kind')
  })

  it('falls back to words rather than to nothing', () => {
    // A network failure carries the transport's sentence, and anything that is
    // not an ApiError at all still has to say something.
    expect(readSubmitFailure('boom', fallback).message).toBe(fallback)
    expect(readSubmitFailure('boom', fallback)).toMatchObject({ kind: 'failed', retryable: false })
  })

  it('leaves the order open on every failure', () => {
    // §7 — only submitted/alreadySubmitted close the transaction. A console that
    // treated a refusal as terminal would throw a basket away for a missing slot.
    for (const code of ['SUBMIT_REFUSED', 'SUBMIT_UNAVAILABLE', 'ANYTHING_ELSE'])
      expect(readSubmitFailure(refusal(code, 'x'), fallback).orderOpen).toBe(true)
  })

  it('survives a refusal whose data says nothing about a field', () => {
    for (const data of [null, {}, { field: '' }, { field: 7 }, 'nope'])
      expect(readSubmitFailure(refusal('SUBMIT_REFUSED', 'x', data), fallback).field).toBeNull()
  })
})

describe('submitRefusalChip', () => {
  it('points a named field at the chip that fixes it', () => {
    expect(submitRefusalChip('slot')).toBe('slot')
    expect(submitRefusalChip('documentSource')).toBe('source')
    expect(submitRefusalChip('sourceReference')).toBe('reference')
    // Case is the server's business, not a reason to fail to point at a chip.
    expect(submitRefusalChip('SLOT')).toBe('slot')
  })

  it('points nowhere for a field no chip owns', () => {
    // The refusal's own sentence still names it — this is only the highlight.
    expect(submitRefusalChip('paymentType')).toBeNull()
    expect(submitRefusalChip(null)).toBeNull()
  })
})

describe('the words all of this needs', () => {
  it('has a backing phrase for every key the surfaces use', () => {
    for (const key of [
      'submit.placing',
      'submit.placed',
      'submit.orderNo',
      'submit.readToCaller',
      'submit.refusedTitle',
      'submit.fixSection',
      'submit.stillOpen',
      'submit.unavailableTitle',
      'submit.tryAgain',
      'submit.failed',
    ])
      expect(phrase(key), `${key} has no phrase`).toBeTruthy()
  })
})
