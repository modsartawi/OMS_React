/**
 * Oms 924 (BackOffice 4056 `POST Insurance/Patterns/Cases/{id}/Block`, GUESSED body) — "Add to blocked-patient list" on a
 * case: offered only on a CONFIRMED case to a user holding BOTH the investigator grant (`INSURANCE_PATTERN_INVESTIGATOR`,
 * guessed `InsurancePattern:06`) and 3965's `INSURANCE_PATIENT_BLOCK` Change (`InsurancePatientBlock:02`); and the
 * form that asks for the kind of finding (required), an optional reporting payer, and a start and an end.
 */
import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { blockBody, blockProblems, canOfferBlock, EMPTY_BLOCK } from './block'

const holding = (...screens: string[]) => permissionsOf({ screens })
const BOTH = holding('InsurancePattern:06', 'InsurancePatientBlock:02')

describe('who is offered the block, on which case', () => {
  it('a confirmed case, with the investigator grant and the blocked-patient list’s Change grant', () => {
    expect(canOfferBlock('confirmed', BOTH)).toBe(true)
  })

  it.each(['open', 'watching', 'cleared', 'closed', '', 'Confirmed?'])('never on a case that is %j, whatever the grants', (status) => {
    expect(canOfferBlock(status, BOTH)).toBe(false)
  })

  it('not with one grant of the two', () => {
    expect(canOfferBlock('confirmed', holding('InsurancePattern:06'))).toBe(false)
    expect(canOfferBlock('confirmed', holding('InsurancePatientBlock:02'))).toBe(false)
  })

  it('not on near misses: the analyst and the manager, or only READING the blocked-patient list', () => {
    expect(canOfferBlock('confirmed', holding('InsurancePattern:03', 'InsurancePattern:02', 'InsurancePatientBlock:02'))).toBe(false)
    expect(canOfferBlock('confirmed', holding('InsurancePattern:06', 'InsurancePatientBlock:03'))).toBe(false)
  })

  it('fails closed: no answer, a pending one or a failed one offers nothing', () => {
    for (const p of [
      permissionsOf(null),
      permissionsFromQuery({ isPending: true, isError: false, data: undefined }),
      permissionsFromQuery({ isPending: false, isError: true, data: undefined }),
    ])
      expect(canOfferBlock('confirmed', p)).toBe(false)
  })
})

const TODAY = '2026-11-19'
const FRAUD = { ...EMPTY_BLOCK, reasonKind: 'fraud' as const }

describe('the block form', () => {
  it('opens empty: no kind chosen, no payer, no start, no end', () => {
    expect(EMPTY_BLOCK).toEqual({ reasonKind: '', payer: '', startsOn: '', endsOn: '' })
  })

  it('the kind of finding is required: abuse or fraud', () => {
    expect(blockProblems(EMPTY_BLOCK, TODAY)).toEqual(['reasonKind'])
    expect(blockProblems({ ...EMPTY_BLOCK, reasonKind: 'abuse' }, TODAY)).toEqual([])
    expect(blockProblems(FRAUD, TODAY)).toEqual([])
  })

  it('the start may not be after the end; the same day is a one-day block', () => {
    expect(blockProblems({ ...FRAUD, startsOn: '2026-11-21', endsOn: '2026-11-20' }, TODAY)).toEqual(['startAfterEnd'])
    expect(blockProblems({ ...FRAUD, startsOn: '2026-11-20', endsOn: '2026-11-20' }, TODAY)).toEqual([])
  })

  it('the end may be today, never before it (the list refuses an expiry before today)', () => {
    expect(blockProblems({ ...FRAUD, endsOn: '2026-11-18' }, TODAY)).toEqual(['endPast'])
    expect(blockProblems({ ...FRAUD, endsOn: TODAY }, TODAY)).toEqual([])
  })

  it('a backdated start is accepted (3965: a backdated finding is still a fact)', () => {
    expect(blockProblems({ ...FRAUD, startsOn: '2026-11-01' }, TODAY)).toEqual([])
  })

  it('the reporting payer is a note of at most 40 characters (3982)', () => {
    expect(blockProblems({ ...FRAUD, payer: 'P'.repeat(40) }, TODAY)).toEqual([])
    expect(blockProblems({ ...FRAUD, payer: 'P'.repeat(41) }, TODAY)).toEqual(['payerTooLong'])
    expect(blockProblems({ ...FRAUD, payer: `  ${'P'.repeat(40)}  ` }, TODAY)).toEqual([])
  })

  it('a date that is not a day is refused', () => {
    expect(blockProblems({ ...FRAUD, startsOn: 'soon', endsOn: '2027-1-5' }, TODAY)).toEqual(['startInvalid', 'endInvalid'])
  })

  it('every problem at once, in the form’s order', () => {
    expect(blockProblems({ reasonKind: '', payer: 'P'.repeat(41), startsOn: '2026-11-30', endsOn: '2026-11-10' }, TODAY)).toEqual([
      'reasonKind',
      'payerTooLong',
      'endPast',
      'startAfterEnd',
    ])
  })
})

describe('the body posted', () => {
  it('the kind alone when nothing else is given: the server starts it today, with no end', () => {
    expect(blockBody(FRAUD, TODAY)).toEqual({ reasonKind: 'fraud' })
  })

  it('the payer trimmed, the start and the end as typed', () => {
    expect(blockBody({ reasonKind: 'abuse', payer: '  BUPA ', startsOn: '2026-11-19', endsOn: '2027-05-19' }, TODAY)).toEqual({
      reasonKind: 'abuse',
      payer: 'BUPA',
      startsOn: '2026-11-19',
      endsOn: '2027-05-19',
    })
  })

  it('no body while a problem stands', () => {
    expect(blockBody(EMPTY_BLOCK, TODAY)).toBeNull()
    expect(blockBody({ ...FRAUD, startsOn: '2026-12-01', endsOn: '2026-11-30' }, TODAY)).toBeNull()
  })

  it('names no patient and no actor: the server reads both (the patient off the confirmed case)', () => {
    const body = blockBody({ reasonKind: 'abuse', payer: 'BUPA', startsOn: '2026-11-19', endsOn: '2027-05-19' }, TODAY)
    expect(Object.keys(body ?? {}).sort()).toEqual(['endsOn', 'payer', 'reasonKind', 'startsOn'])
  })
})
