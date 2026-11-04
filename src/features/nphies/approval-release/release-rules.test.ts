/**
 * Ticket 751 (BackOffice spec 3342) — the pure rules of the Release approval number page.
 * Prior art: `../authorizations/row-acts.test.ts` and `../authorizations/detail-view.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  RELEASE_REFUSAL_CODES,
  canConfirmRelease,
  lookupState,
  refusalKey,
  releaseBody,
  releaseOffer,
  type ReleaseSource,
} from './release-rules'

const ROW = (over: Partial<ReleaseSource> = {}): ReleaseSource => ({
  preAuthRef: '12345678',
  isDispensed: false,
  ...over,
})

const refusal = (status: number, code: string | null) =>
  new ApiError(
    'business',
    'the server sentence',
    status,
    code === null ? [] : [{ errorCode: code, errorMessage: 'x' } as never],
  )

describe('release button shows only with the grant and on a releasable row', () => {
  const rows: Record<string, ReleaseSource> = {
    releasable: ROW(),
    dispensed: ROW({ isDispensed: true }),
    empty: ROW({ preAuthRef: '' }),
    blank: ROW({ preAuthRef: '   ' }),
    released: ROW({ preAuthRef: '12345678_' }),
  }

  it.each([
    // grant, row, offered, reason
    [true, 'releasable', true, null],
    [true, 'dispensed', false, 'dispensed'],
    [true, 'empty', false, 'empty'],
    [true, 'blank', false, 'empty'],
    [true, 'released', false, 'alreadyReleased'],
    [false, 'releasable', false, 'noGrant'],
    [false, 'dispensed', false, 'dispensed'],
    [false, 'empty', false, 'empty'],
    [false, 'released', false, 'alreadyReleased'],
  ] as const)('grant=%s on a %s row → offered %s, reason %s', (grant, name, offered, reason) => {
    expect(releaseOffer(grant, rows[name])).toEqual({ offered, reason })
  })

  it('🚩 a missing grant field reads as no grant, never as yes', () => {
    expect(releaseOffer(undefined, ROW())).toEqual({ offered: false, reason: 'noGrant' })
  })

  it('a dispensed row says so first — the act is "undispense it first", whatever else is true', () => {
    expect(releaseOffer(true, ROW({ isDispensed: true, preAuthRef: '9_' })).reason).toBe('dispensed')
  })

  it('⚠ a door that does not answer the dispensed flag leaves the button to the server, and says it cannot tell', () => {
    expect(releaseOffer(true, ROW({ isDispensed: undefined }))).toEqual({ offered: true, reason: null })
  })
})

describe('confirm is disabled until a note is typed', () => {
  it.each(['', ' ', '\n\t '])('a blank note (%j) cannot confirm', (note) => {
    expect(canConfirmRelease(note, false)).toBe(false)
  })

  it('a typed note confirms', () => {
    expect(canConfirmRelease('the pharmacist reissues it', false)).toBe(true)
  })

  it('an Arabic note confirms too', () => {
    expect(canConfirmRelease('سيعيد الصيدلي إصدارها', false)).toBe(true)
  })

  it('nothing confirms while the release is in flight', () => {
    expect(canConfirmRelease('a note', true)).toBe(false)
  })
})

describe('each refusal code maps to its message; not found is its own state', () => {
  it.each([
    ['AUTH_NOT_FOUND', 404, 'refusals.notFound'],
    ['AUTH_ALREADY_DISPENSED', 409, 'refusals.dispensed'],
    ['APPROVAL_NUMBER_EMPTY', 409, 'refusals.empty'],
    ['APPROVAL_NUMBER_ALREADY_RELEASED', 409, 'refusals.alreadyReleased'],
    ['NOTE_REQUIRED', 400, 'refusals.noteRequired'],
  ] as const)('%s → %s', (code, status, key) => {
    expect(refusalKey(refusal(status, code))).toBe(key)
  })

  it('every code the contract names for the release has a message', () => {
    for (const code of RELEASE_REFUSAL_CODES) expect([code, refusalKey(refusal(409, code))]).not.toEqual([code, null])
  })

  it('a bare 403 is the missing release grant, in this page’s words', () => {
    expect(refusalKey(refusal(403, null))).toBe('refusals.noGrant')
  })

  it('an unknown code is not guessed at — the server’s sentence is shown instead', () => {
    expect(refusalKey(refusal(409, 'SOMETHING_ELSE'))).toBeNull()
    expect(refusalKey(new Error('boom'))).toBeNull()
  })

  it('🚩 an unknown bundle Id is NOT FOUND, never an empty card', () => {
    expect(lookupState({ id: 'X', isPending: false, error: refusal(404, 'AUTH_NOT_FOUND'), hasData: false })).toBe(
      'notFound',
    )
  })

  it('a bare 404 with no code is not found too', () => {
    expect(lookupState({ id: 'X', isPending: false, error: refusal(404, null), hasData: false })).toBe('notFound')
  })

  it('any other failure is an error, not a not-found', () => {
    expect(
      lookupState({ id: 'X', isPending: false, error: new ApiError('server', 'down', 500), hasData: false }),
    ).toBe('error')
  })

  it('no id is idle; an id in flight is loading; an answer is found', () => {
    expect(lookupState({ id: '', isPending: true, error: null, hasData: false })).toBe('idle')
    expect(lookupState({ id: 'X', isPending: true, error: null, hasData: false })).toBe('loading')
    expect(lookupState({ id: 'X', isPending: false, error: null, hasData: true })).toBe('found')
  })
})

describe('the release posts only authId and note', () => {
  it('🚩 exactly two fields — who released it is the session’s, never the browser’s', () => {
    expect(Object.keys(releaseBody('AUTH-1', 'a note')).sort()).toEqual(['authId', 'note'])
  })

  it('the note is sent as typed, trimmed at its ends', () => {
    expect(releaseBody(' AUTH-1 ', '  reissue for the patient \n')).toEqual({
      authId: 'AUTH-1',
      note: 'reissue for the patient',
    })
  })
})
