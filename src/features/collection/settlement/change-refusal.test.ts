/**
 * **The change-request refusal map** — spec 342 W7, ticket 344's Proof.
 *
 * 🔑 The codes below are typed out from BackOffice 2191–2195's `## Web contract`, NOT
 * imported from the module under test: a code the module forgot must fail here, and a
 * list shared with the module would forget it too. Every later door (Withdraw 345,
 * Approve / Reject 346, delete 347, theft day 349) renders these answers.
 */
import { describe, expect, it } from 'vitest'

import en from '@/locales/en/settlement.json'
import { changeFieldError, changeRefusal, type ChangeRequestDoor } from './change-refusal'
import { BELOW_SPENT_SAMPLE, SAMPLE_REQUEST_ID } from './change-request-fixture'

/** Every 200 refusal the five contracts name, on any door. */
const REFUSALS_200 = [
  'ENTRY_NOT_OPEN',
  'ENTRY_FINAL',
  'BELOW_SPENT',
  'DELETE_SPENT',
  'CHANGE_ALREADY_OPEN',
  'NO_CHANGE',
  'CHANGE_STALE',
  'CHANGE_NOT_OPEN',
  'NOT_REQUESTER',
  'THEFT_DAY_COLLECTED',
  'WRONG_KIND',
  'REMAINING_INSUFFICIENT',
] as const

/** Every 400 `errors[0].errorCode` the five contracts name, on any door. */
const CODES_400 = [
  'SettlementAmountRequired',
  'SettlementAmountRoundsToZero',
  'SettlementReasonTooLong',
  'SettlementChangeReasonRequired',
  'SettlementReasonRequired',
  'SettlementDeleteTakesNoFigures',
  'SettlementBusinessDayTheftOnly',
  'SettlementTheftBusinessDayRequired',
  'SettlementTheftDayNotClosed',
  'SettlementChangeBodyRequired',
  'SettlementEntryRequired',
  'SettlementChangeRequestRequired',
  'SettlementChangeRequestKindInvalid',
  'SettlementRejectReasonRequired',
] as const

const DOORS: ChangeRequestDoor[] = ['raise', 'approve', 'reject', 'withdraw']

/** A refused act answer — 2192's sample's figures, the code and request fields the case's. */
const refused = (
  refusalReason: string,
  o: Partial<{ changeRequestId: string; requestStatus: string; amount: number; spentAmount: number }> = {},
) => ({
  ...BELOW_SPENT_SAMPLE,
  refusalReason,
  changeRequestId: '',
  requestStatus: '',
  ...o,
}) as typeof BELOW_SPENT_SAMPLE

/** Resolve a dotted key against the locale, as i18next does. */
const keyed = (path: string): unknown =>
  path.split('.').reduce<unknown>((at, k) => (at && typeof at === 'object' ? (at as Record<string, unknown>)[k] : undefined), en)

describe('changeRefusal — every 200 code is worded off the CODE, never off message (W7)', () => {
  it.each(REFUSALS_200.flatMap((code) => DOORS.map((door) => [code, door] as const)))(
    '%s on %s has its own sentence, and that sentence exists in the settlement namespace',
    (code, door) => {
      const r = changeRefusal(door, refused(code, { changeRequestId: SAMPLE_REQUEST_ID, requestStatus: 'OPEN' }), 'server words')
      expect(r.code).toBe(code)
      expect(r.words.kind).toBe('key')
      if (r.words.kind !== 'key') return
      expect(r.words.key).not.toBe('unknown')
      expect(typeof keyed(`changeRequest.refusal.${r.words.key}`)).toBe('string')
    },
  )

  it('🔑 a known code never draws the server\'s message, even when one is sent', () => {
    for (const code of REFUSALS_200)
      expect(JSON.stringify(changeRefusal('raise', refused(code), 'Something in English'))).not.toContain('Something in English')
  })

  it('an unknown code falls back to the server\'s message', () => {
    expect(changeRefusal('raise', refused('SOMETHING_NEW'), '  The till is offline.  ')).toEqual({
      code: 'SOMETHING_NEW',
      words: { kind: 'message', text: 'The till is offline.' },
      spent: 350,
      step: { kind: 'none' },
    })
  })

  it('…and with no message, names the code in a keyed sentence', () => {
    const r = changeRefusal('raise', refused('SOMETHING_NEW'))
    expect(r.words).toEqual({ kind: 'key', key: 'unknown' })
    expect(r.step).toEqual({ kind: 'none' })
    expect(typeof keyed('changeRequest.refusal.unknown')).toBe('string')
  })

  it('a refusal with no code and no message says the server did not say why', () => {
    expect(changeRefusal('raise', refused('')).words).toEqual({ kind: 'key', key: 'unstated' })
    expect(changeRefusal('raise', null).words).toEqual({ kind: 'key', key: 'unstated' })
    expect(typeof keyed('changeRequest.refusal.unstated')).toBe('string')
  })

  it('the code is matched as the server sends it — trimmed, never re-cased', () => {
    expect(changeRefusal('raise', refused(' NO_CHANGE ')).words).toEqual({ kind: 'key', key: 'NO_CHANGE' })
    expect(changeRefusal('raise', refused('no_change')).words).toEqual({ kind: 'key', key: 'unknown' })
  })
})

describe('changeRefusal — the next step (ticket 344\'s table)', () => {
  it('ENTRY_NOT_OPEN — the entry no longer exists: close the pane', () => {
    for (const door of DOORS) expect(changeRefusal(door, refused('ENTRY_NOT_OPEN')).step).toEqual({ kind: 'close' })
  })

  it('ENTRY_FINAL — cancelled / closed out / rejected: redraw', () => {
    for (const door of DOORS) expect(changeRefusal(door, refused('ENTRY_FINAL')).step).toEqual({ kind: 'redraw' })
  })

  it('🔑 BELOW_SPENT on a raise refills the floor from the ANSWER\'s spentAmount', () => {
    const r = changeRefusal('raise', refused('BELOW_SPENT', { spentAmount: 350 }))
    expect(r).toEqual({ code: 'BELOW_SPENT', words: { kind: 'key', key: 'BELOW_SPENT.figure' }, spent: 350, step: { kind: 'refill-floor', floor: 350 } })
  })

  it('…at holding scale — the floor is never a figure the server did not hold', () => {
    expect(changeRefusal('raise', refused('BELOW_SPENT', { spentAmount: 350.0004 })).step).toEqual({ kind: 'refill-floor', floor: 350 })
  })

  it('…and with no spent figure, asks History for it instead of inventing one', () => {
    const r = changeRefusal('raise', { ...refused('BELOW_SPENT'), spentAmount: undefined as unknown as number })
    expect(r.words).toEqual({ kind: 'key', key: 'BELOW_SPENT.unstated' })
    expect(r.spent).toBeNull()
    expect(r.step).toEqual({ kind: 'reread' })
  })

  it('BELOW_SPENT on an approve — a till spent past it while it waited: reject with a reason', () => {
    expect(changeRefusal('approve', refused('BELOW_SPENT', { spentAmount: 420 })).step).toEqual({ kind: 'reject' })
  })

  it('🔑 DELETE_SPENT on a raise offers "Reduce it to X", X the answer\'s spentAmount (W5, wired by 347)', () => {
    const r = changeRefusal('raise', refused('DELETE_SPENT', { amount: 500, spentAmount: 120 }))
    expect(r).toEqual({ code: 'DELETE_SPENT', words: { kind: 'key', key: 'DELETE_SPENT.figure' }, spent: 120, step: { kind: 'reduce', to: 120 } })
  })

  it('…but not when the branch spent all of it — reducing to the amount changes nothing (343\'s spent-whole)', () => {
    expect(changeRefusal('raise', refused('DELETE_SPENT', { amount: 500, spentAmount: 500 })).step).toEqual({ kind: 'none' })
  })

  it('…and a spend of 0.001 is a spend (holding scale)', () => {
    expect(changeRefusal('raise', refused('DELETE_SPENT', { amount: 50, spentAmount: 0.001 })).step).toEqual({ kind: 'reduce', to: 0.001 })
  })

  it('DELETE_SPENT on an approve: reject with a reason', () => {
    expect(changeRefusal('approve', refused('DELETE_SPENT', { spentAmount: 120 })).step).toEqual({ kind: 'reject' })
  })

  it('🔑 CHANGE_ALREADY_OPEN opens the waiting request the answer names', () => {
    const r = changeRefusal('raise', refused('CHANGE_ALREADY_OPEN', { changeRequestId: SAMPLE_REQUEST_ID, requestStatus: 'OPEN' }))
    expect(r.words).toEqual({ kind: 'key', key: 'CHANGE_ALREADY_OPEN.named' })
    expect(r.step).toEqual({ kind: 'open-request', changeRequestId: SAMPLE_REQUEST_ID })
  })

  it('🔑 …and re-reads History when the id is \'\' (2194\'s sub-second race)', () => {
    const r = changeRefusal('raise', refused('CHANGE_ALREADY_OPEN', { changeRequestId: '  ' }))
    expect(r.words).toEqual({ kind: 'key', key: 'CHANGE_ALREADY_OPEN.unnamed' })
    expect(r.step).toEqual({ kind: 'reread' })
  })

  it('NO_CHANGE — stay in the form', () => {
    expect(changeRefusal('raise', refused('NO_CHANGE')).step).toEqual({ kind: 'stay' })
  })

  it('CHANGE_STALE on an approve — the entry moved since it was asked: reject with a reason', () => {
    expect(changeRefusal('approve', refused('CHANGE_STALE')).step).toEqual({ kind: 'reject' })
  })

  it('…on a supervisor\'s own raise (2194) it is the entry moving under the form: redraw', () => {
    expect(changeRefusal('raise', refused('CHANGE_STALE')).step).toEqual({ kind: 'redraw' })
  })

  it('🔑 CHANGE_NOT_OPEN redraws, and requestStatus names which end the request met', () => {
    for (const status of ['APPLIED', 'REJECTED', 'WITHDRAWN', 'SUPERSEDED'])
      for (const door of ['approve', 'reject', 'withdraw'] as const) {
        const r = changeRefusal(door, refused('CHANGE_NOT_OPEN', { changeRequestId: SAMPLE_REQUEST_ID, requestStatus: status }))
        expect(r.words).toEqual({ kind: 'key', key: `CHANGE_NOT_OPEN.${status}` })
        expect(r.step).toEqual({ kind: 'redraw' })
      }
  })

  it('…an unsaid status (\'\' — no such request; or an odd OPEN) is its own sentence, never a guess', () => {
    expect(changeRefusal('approve', refused('CHANGE_NOT_OPEN')).words).toEqual({ kind: 'key', key: 'CHANGE_NOT_OPEN.unsaid' })
    expect(changeRefusal('approve', refused('CHANGE_NOT_OPEN', { requestStatus: 'OPEN' })).words).toEqual({ kind: 'key', key: 'CHANGE_NOT_OPEN.unsaid' })
  })

  it('NOT_REQUESTER — only the requester can withdraw it: the pane stops offering Withdraw on it (345)', () => {
    expect(changeRefusal('withdraw', refused('NOT_REQUESTER', { changeRequestId: SAMPLE_REQUEST_ID, requestStatus: 'OPEN' })).step).toEqual({ kind: 'not-requester' })
  })

  it('THEFT_DAY_COLLECTED at approval: the supervisor rejects it with a reason', () => {
    expect(changeRefusal('approve', refused('THEFT_DAY_COLLECTED')).step).toEqual({ kind: 'reject' })
  })

  it('…on a raise the form stays — the new day may be the collected one, and another can be picked', () => {
    expect(changeRefusal('raise', refused('THEFT_DAY_COLLECTED')).step).toEqual({ kind: 'stay' })
  })

  it('WRONG_KIND and REMAINING_INSUFFICIENT — the tracer\'s codes, one generic sentence, no step', () => {
    for (const code of ['WRONG_KIND', 'REMAINING_INSUFFICIENT'])
      for (const door of DOORS)
        expect(changeRefusal(door, refused(code))).toMatchObject({ code, words: { kind: 'key', key: 'tracer' }, step: { kind: 'none' } })
  })
})

describe('changeFieldError — every 400 lands on the box that can fix it, or on the form', () => {
  it.each(CODES_400)('%s maps to a field, and its sentence exists', (code) => {
    const e = changeFieldError(code)
    expect(e).not.toBeNull()
    expect(typeof keyed(`changeRequest.invalid.${e!.sentence}`)).toBe('string')
  })

  it('🔑 each code to its field', () => {
    const field = (code: string, sent?: { newDescription: string | null }) => changeFieldError(code, sent)?.field
    expect(field('SettlementAmountRequired')).toBe('amount')
    expect(field('SettlementAmountRoundsToZero')).toBe('amount')
    expect(field('SettlementReasonRequired')).toBe('description')
    expect(field('SettlementChangeReasonRequired')).toBe('reason')
    expect(field('SettlementRejectReasonRequired')).toBe('reason')
    expect(field('SettlementBusinessDayTheftOnly')).toBe('businessDay')
    expect(field('SettlementTheftBusinessDayRequired')).toBe('businessDay')
    expect(field('SettlementTheftDayNotClosed')).toBe('businessDay')
    for (const code of [
      'SettlementDeleteTakesNoFigures',
      'SettlementChangeBodyRequired',
      'SettlementEntryRequired',
      'SettlementChangeRequestRequired',
      'SettlementChangeRequestKindInvalid',
    ])
      expect(field(code)).toBe('form')
  })

  it('⚠️ SettlementReasonTooLong is the Reason when only a Reason was sent…', () => {
    expect(changeFieldError('SettlementReasonTooLong', { newDescription: null })).toEqual({
      code: 'SettlementReasonTooLong',
      field: 'reason',
      sentence: 'SettlementReasonTooLong.reason',
    })
    expect(changeFieldError('SettlementReasonTooLong')?.field).toBe('reason')
  })

  it('…and the form when a Description went too — the code does not say which, so neither box is blamed', () => {
    expect(changeFieldError('SettlementReasonTooLong', { newDescription: 'نص جديد' })).toEqual({
      code: 'SettlementReasonTooLong',
      field: 'form',
      sentence: 'SettlementReasonTooLong.either',
    })
  })

  it('an unknown or absent code is not a field error — the caller shows the server\'s message', () => {
    expect(changeFieldError('SomethingNew')).toBeNull()
    expect(changeFieldError(null)).toBeNull()
    expect(changeFieldError(undefined)).toBeNull()
    expect(changeFieldError('')).toBeNull()
  })
})
