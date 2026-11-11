import { describe, expect, it } from 'vitest'
import { GRID_LIMIT } from './cap'
import {
  attemptsParamsFor,
  buildAttemptsParams,
  isLandingQuery,
  landingCriteria,
  sameQuery,
  type AttemptsCriteria,
} from './attempts-criteria'

// Ticket 255's Collection Attempts criteria Proof: the reason code is dropped when
// empty. Ticket 316 added the two named date ranges and the Served-by pair
// (BackOffice 1993).

describe('landingCriteria', () => {
  it('opens with no date at all and everything else open', () => {
    expect(landingCriteria()).toEqual({
      businessDateFrom: '',
      businessDateTo: '',
      collectionDateFrom: '',
      collectionDateTo: '',
      storeCode: '',
      collectorStaffId: '',
      reasonCode: '',
      // Nothing picked — the estate, exactly as the screen opened before it had the
      // control (see `landingCriteria`).
      servedBy: { kind: '', id: '' },
    })
  })

  it('issues no request until the first Search — nothing applied is no query', () => {
    expect(attemptsParamsFor(null)).toBeNull()
    expect(attemptsParamsFor(landingCriteria())).toEqual({ Limit: GRID_LIMIT })
  })

  it('tells a repeated Search from a new one', () => {
    const landing = buildAttemptsParams(landingCriteria())
    expect(sameQuery(buildAttemptsParams(landingCriteria()), landing)).toBe(true)
    expect(sameQuery(buildAttemptsParams({ reasonCode: 'OTHER' }), landing)).toBe(false)
  })
})

describe('buildAttemptsParams', () => {
  it('sends the landing state as the system cap alone — no date', () => {
    expect(buildAttemptsParams(landingCriteria())).toEqual({ Limit: GRID_LIMIT })
  })

  it('drops the reason code when the box is empty — or only whitespace', () => {
    expect(buildAttemptsParams({ reasonCode: '' })).not.toHaveProperty('ReasonCode')
    expect(buildAttemptsParams({ reasonCode: '   ' })).not.toHaveProperty('ReasonCode')
  })

  it('carries a typed reason code under the endpoint’s own name', () => {
    expect(buildAttemptsParams({ reasonCode: ' STORE_CLOSED ' }).ReasonCode).toBe('STORE_CLOSED')
  })

  it('uses THIS endpoint’s spellings — StoreCode and CollectorStaffId, not the other screens’', () => {
    // CollectionAttemptInquiryOptions names them differently from
    // CollectionInquiryOptions. A parameter the binder does not recognise is
    // silently ignored, and the grid comes back unfiltered.
    const params = buildAttemptsParams({ storeCode: ' 1001 ', collectorStaffId: ' 4472 ' })
    expect(params).toEqual({
      StoreCode: '1001',
      CollectorStaffId: '4472',
      Limit: GRID_LIMIT,
    })
    expect(params).not.toHaveProperty('StoreId')
    expect(params).not.toHaveProperty('CollectorOperatorId')
  })

  it('drops empty filters rather than sending them as empty strings', () => {
    const params = buildAttemptsParams({
      businessDateFrom: '',
      businessDateTo: '  ',
      collectionDateFrom: '2026-08-08',
      collectionDateTo: '2026-08-08',
      storeCode: '   ',
      collectorStaffId: '',
      reasonCode: '',
      servedBy: { kind: '', id: '' },
    })
    expect(params).toEqual({
      CollectionDateFrom: '2026-08-08',
      CollectionDateTo: '2026-08-08',
      Limit: GRID_LIMIT,
    })
  })

  it('never asks for the WPF’s 200 — the cap is a system cap and it is generous', () => {
    expect(buildAttemptsParams({}).Limit).toBe(2000)
  })

  it('is a pure function of the draft — the same draft builds the same query', () => {
    const draft: AttemptsCriteria = {
      businessDateFrom: '2026-07-31',
      businessDateTo: '2026-08-07',
      collectionDateFrom: '2026-08-01',
      collectionDateTo: '2026-08-08',
      storeCode: '1001',
      collectorStaffId: '4472',
      reasonCode: 'OTHER',
      servedBy: { kind: 'ACCOUNTANT', id: '4466' },
    }
    expect(buildAttemptsParams(draft)).toEqual(buildAttemptsParams({ ...draft }))
  })
})

// Ticket 316 (BackOffice 1993) — the four-filter contract on Attempts. The business
// range reads the attempted business day, never the visit time; the collection
// range reads the attempt time. Each end optional, inclusive by day on the server.
describe('the business and collection date ranges', () => {
  it('sends a business range under 1992’s PascalCase names — the contract’s own example', () => {
    expect(
      buildAttemptsParams({
        servedBy: { kind: 'ACCOUNTANT', id: '4466' },
        businessDateFrom: '2026-09-02',
        businessDateTo: '2026-09-02',
      }),
    ).toEqual({
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      BusinessDateFrom: '2026-09-02',
      BusinessDateTo: '2026-09-02',
      Limit: GRID_LIMIT,
    })
  })

  it('never sends the legacy FromDate/ToDate — the contract retires them for the web', () => {
    // 🚩 The door still honours them and INTERSECTS them with CollectionDate*.
    const params = buildAttemptsParams(landingCriteria())
    expect(params).not.toHaveProperty('FromDate')
    expect(params).not.toHaveProperty('ToDate')
  })

  it('sends either end ALONE — an open-ended range is the contract’s, not a broken pair', () => {
    expect(buildAttemptsParams({ businessDateFrom: '2026-09-01' })).toEqual({
      BusinessDateFrom: '2026-09-01',
      Limit: GRID_LIMIT,
    })
    expect(buildAttemptsParams({ collectionDateTo: '2026-08-08', reasonCode: 'OTHER' })).toEqual({
      CollectionDateTo: '2026-08-08',
      ReasonCode: 'OTHER',
      Limit: GRID_LIMIT,
    })
  })

  it('may leave the collection range off entirely, to ask about business days alone', () => {
    expect(
      buildAttemptsParams({
        ...landingCriteria(),
        businessDateFrom: '2026-09-02',
        businessDateTo: '2026-09-02',
        collectionDateFrom: '',
        collectionDateTo: '',
      }),
    ).toEqual({
      BusinessDateFrom: '2026-09-02',
      BusinessDateTo: '2026-09-02',
      Limit: GRID_LIMIT,
    })
  })

  it('sends the day as typed — no time part, no widening to the next midnight', () => {
    const params = buildAttemptsParams({ collectionDateFrom: ' 2026-09-05 ', collectionDateTo: '2026-09-05' })
    expect(params.CollectionDateFrom).toBe('2026-09-05')
    expect(params.CollectionDateTo).toBe('2026-09-05')
  })

  it('passes a From later than its To through — the door matches nothing, honestly', () => {
    expect(
      buildAttemptsParams({ businessDateFrom: '2026-09-10', businessDateTo: '2026-09-01' }),
    ).toEqual({
      BusinessDateFrom: '2026-09-10',
      BusinessDateTo: '2026-09-01',
      Limit: GRID_LIMIT,
    })
  })
})

// Ticket 316 (BackOffice 1993) — Attempts gains the Served-by pair, on the
// ASSIGNMENT reading (the store's current pairing, exactly as on Collections).
describe('the Served-by pair', () => {
  it('ANDs with the collector box — the attempting collector and the assigned accountant are two questions', () => {
    expect(
      buildAttemptsParams({
        collectorStaffId: 'COLL-9',
        servedBy: { kind: 'ACCOUNTANT', id: '4466' },
      }),
    ).toEqual({
      CollectorStaffId: 'COLL-9',
      ServedByKind: 'ACCOUNTANT',
      ServedById: '4466',
      Limit: GRID_LIMIT,
    })
  })

  it('UNASSIGNED sends the Kind alone — it names nobody', () => {
    expect(buildAttemptsParams({ servedBy: { kind: 'UNASSIGNED', id: '' } })).toEqual({
      ServedByKind: 'UNASSIGNED',
      Limit: GRID_LIMIT,
    })
  })

  it('a half-chosen pair (a Kind with no id) sends neither key — the server would 400 it', () => {
    const params = buildAttemptsParams({ servedBy: { kind: 'ACCOUNTANT', id: '' } })
    expect(params).not.toHaveProperty('ServedByKind')
    expect(params).not.toHaveProperty('ServedById')
  })
})

describe('a draft that has not been promoted', () => {
  it('a half-typed store code leaves the applied query untouched', () => {
    const applied = buildAttemptsParams(landingCriteria())
    expect(applied).not.toEqual(
      buildAttemptsParams({ ...landingCriteria(), storeCode: '10' }),
    )
    expect(applied).toEqual({ Limit: GRID_LIMIT })
  })
})

describe('the "filtered" chip reads the ISSUED query, not the draft', () => {
  const applied = (criteria: Partial<AttemptsCriteria>) =>
    isLandingQuery(buildAttemptsParams(criteria))

  it('the landing state is the landing query', () => {
    expect(applied(landingCriteria())).toBe(true)
  })

  it('a searched reason code is not', () => {
    expect(applied({ ...landingCriteria(), reasonCode: 'OTHER' })).toBe(false)
  })

  it('a widened period is not either', () => {
    expect(applied({ ...landingCriteria(), collectionDateFrom: '2026-08-07' })).toBe(false)
  })

  it('a business range and a Served-by pick are filters like any other', () => {
    expect(applied({ ...landingCriteria(), businessDateFrom: '2026-08-01' })).toBe(false)
    expect(
      applied({ ...landingCriteria(), servedBy: { kind: 'ACCOUNTANT', id: '4466' } }),
    ).toBe(false)
  })

  it('a whitespace-only reason code never made it onto the wire, so it is', () => {
    expect(applied({ ...landingCriteria(), reasonCode: '  ' })).toBe(true)
  })

  it('a query carrying the cap alone is it — the landing has no date', () => {
    expect(applied({})).toBe(true)
  })
})
