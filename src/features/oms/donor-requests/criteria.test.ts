/**
 * What the donor request list asks the server for (ticket 431, spec 430 D3/D9). Pure: criteria in,
 * the query params `GET SdDocumentWeb/DonorRequests` binds out.
 */
import { describe, expect, it } from 'vitest'
import {
  DONOR_REQUEST_STATES,
  criteriaProblem,
  criteriaToParams,
  defaultCriteria,
  initialCriteria,
  requestCriteria,
} from './criteria'

const TODAY = new Date(2026, 9, 7, 15, 30)

describe('defaultCriteria', () => {
  it('is today, all states and no store', () => {
    expect(defaultCriteria(TODAY)).toEqual({
      states: [],
      donorStore: '',
      orderStore: '',
      from: '2026-10-07',
      to: '2026-10-07',
      requestNo: '',
    })
  })

  it('asks for today only — no state and no store go on the wire', () => {
    expect(criteriaToParams(defaultCriteria(TODAY))).toEqual({ fromDate: '2026-10-07', toDate: '2026-10-07' })
  })
})

describe('criteriaToParams', () => {
  it('sends state as a REPEATED key (an array), in the order offered', () => {
    const params = criteriaToParams({ ...defaultCriteria(TODAY), states: ['CANCELLED', 'OPEN'] })
    expect(params.state).toEqual(['OPEN', 'CANCELLED'])
  })

  it('every state picked is the same as none: all states, nothing sent', () => {
    const params = criteriaToParams({ ...defaultCriteria(TODAY), states: [...DONOR_REQUEST_STATES] })
    expect(params.state).toBeUndefined()
  })

  it('toDate is the last day itself — the server reads it inclusively, so no day is added', () => {
    const params = criteriaToParams({ ...defaultCriteria(TODAY), from: '2026-10-01', to: '2026-10-05' })
    expect(params).toMatchObject({ fromDate: '2026-10-01', toDate: '2026-10-05' })
  })

  it('drops empty filters and trims the store codes', () => {
    expect(
      criteriaToParams({ states: [], donorStore: '  D012 ', orderStore: '   ', from: '', to: '', requestNo: '' }),
    ).toEqual({ donorStore: 'D012' })
  })

  it('names the params as the door binds them', () => {
    expect(
      criteriaToParams({
        states: ['OPEN'],
        donorStore: 'D012',
        orderStore: 'P019',
        from: '2026-10-01',
        to: '2026-10-07',
        requestNo: '',
      }),
    ).toEqual({ state: ['OPEN'], donorStore: 'D012', orderStore: 'P019', fromDate: '2026-10-01', toDate: '2026-10-07' })
  })
})

describe('?request= seeds a request-only search', () => {
  it('asks for that one request with no date bound, whatever day it was raised', () => {
    expect(criteriaToParams(requestCriteria(' DR77 '))).toEqual({ requestNo: 'DR77' })
  })

  it('initialCriteria takes the param when it is there, today otherwise', () => {
    expect(initialCriteria('DR77', TODAY)).toEqual(requestCriteria('DR77'))
    expect(initialCriteria(null, TODAY)).toEqual(defaultCriteria(TODAY))
    expect(initialCriteria('   ', TODAY)).toEqual(defaultCriteria(TODAY))
  })
})

describe('criteriaProblem', () => {
  it('a range that ends before it starts cannot be searched', () => {
    expect(criteriaProblem({ ...defaultCriteria(TODAY), from: '2026-10-07', to: '2026-10-01' })).toBe('reversed')
  })

  it('an open end is fine, and so is one day', () => {
    expect(criteriaProblem({ ...defaultCriteria(TODAY), from: '' })).toBeNull()
    expect(criteriaProblem(defaultCriteria(TODAY))).toBeNull()
  })

  it('an end that is not a date is refused', () => {
    expect(criteriaProblem({ ...defaultCriteria(TODAY), to: '07/10/2026' })).toBe('badDate')
  })
})
