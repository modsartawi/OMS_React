/**
 * The Order / ERX list's query model (ticket 786, BackOffice 3391's date rule): an identifier
 * criterion ignores the date; without one, a range is required — default the last 3 days, at
 * most 31 — and the client refuses the search before it is sent, as the server would.
 */
import { describe, expect, it } from 'vitest'
import { buildOrderQuery } from './api'
import { BLANK_QUERY, pendingDiff, queryFields, searchProblem, toSearchCriteria, withField, withinGrant, type QueryCriteria } from './query-model'

// Thursday 5 Nov 2026, mid-afternoon local time.
const NOW = new Date(2026, 10, 5, 15, 30)
const grant = { canViewInsurance: true }
const noGrant = { canViewInsurance: false }

const q = (over: Partial<QueryCriteria>): QueryCriteria => ({ ...BLANK_QUERY, ...over })

describe('order-list query model: identifiers ignore the date, other tokens need a range ≤ 31 days', () => {
  it('opens on the last 3 days and the server default limit of 500', () => {
    expect(BLANK_QUERY.date).toEqual({ preset: 'last3' })
    expect(buildOrderQuery(toSearchCriteria(BLANK_QUERY, NOW, grant))).toEqual({
      FromDate: '2026-11-03',
      ToDate: '2026-11-05',
      Limit: 500,
    })
  })

  it.each([
    ['orderNo', 'BUPA-20261104-77'],
    ['documentNo', '1006358459'],
    ['approval', '146591214'],
    ['mobile', '0551234567'],
    ['patientId', '2402727917'],
    ['memberId', '30112233'],
  ] as const)('an %s sends no date, whatever the Date token says', (field, value) => {
    const query = q({ [field]: value, date: { preset: 'custom', from: '2025-01-01', to: '2026-11-05' } })
    expect(searchProblem(query, NOW, grant)).toBeNull()
    const params = buildOrderQuery(toSearchCriteria(query, NOW, grant))
    expect(params).not.toHaveProperty('FromDate')
    expect(params).not.toHaveProperty('ToDate')
  })

  it('finds 1006358459 by its approval alone, the date dropped', () => {
    const query = withField(BLANK_QUERY, 'approval', '146591214')
    expect(buildOrderQuery(toSearchCriteria(query, NOW, grant))).toEqual({ Approval: '146591214', Limit: 500 })
  })

  it('a narrowing token with no date is refused', () => {
    expect(searchProblem(q({ storeCode: '1101', date: null }), NOW, grant)).toBe('needsDate')
    // A Custom range missing an end is no range.
    expect(searchProblem(q({ date: { preset: 'custom', from: '2026-11-01', to: null } }), NOW, grant)).toBe('needsDate')
  })

  it('a range of 31 days is taken; 32 is refused', () => {
    expect(searchProblem(q({ date: { preset: 'custom', from: '2026-10-06', to: '2026-11-05' } }), NOW, grant)).toBeNull()
    expect(searchProblem(q({ date: { preset: 'custom', from: '2026-10-05', to: '2026-11-05' } }), NOW, grant)).toBe('rangeTooLong')
  })

  it('a reversed range is refused', () => {
    expect(searchProblem(q({ date: { preset: 'custom', from: '2026-11-05', to: '2026-11-01' } }), NOW, grant)).toBe('rangeInvalid')
  })

  it('narrowing tokens go out PascalCase with the range', () => {
    const query = q({
      date: { preset: 'today' },
      storeCode: ' 1101 ',
      documentType: 'BUPA',
      documentSource: 'ERX',
      status: 'OPEN',
      hasDelivery: false,
      moneySource: 'ENGINE',
      limit: 50,
    })
    expect(buildOrderQuery(toSearchCriteria(query, NOW, grant))).toEqual({
      FromDate: '2026-11-05',
      ToDate: '2026-11-05',
      StoreCode: '1101',
      DocumentType: 'BUPA',
      DocumentSource: 'ERX',
      Status: 'OPEN',
      HasDelivery: false,
      MoneySource: 'ENGINE',
      Limit: 50,
    })
  })

  it('without the insurance grant, patient and member ID are neither offered nor sent', () => {
    expect(queryFields(noGrant).map((f) => f.id)).not.toContain('patientId')
    expect(queryFields(noGrant).map((f) => f.id)).not.toContain('memberId')
    expect(queryFields(grant).map((f) => f.id)).toEqual(expect.arrayContaining(['patientId', 'memberId']))

    // A saved view carrying one, opened by a session without the grant: not sent, and not an
    // identifier either — so the date rule applies again.
    const query = q({ patientId: '2402727917', date: null })
    expect(searchProblem(query, NOW, noGrant)).toBe('needsDate')
    const params = buildOrderQuery(toSearchCriteria(q({ patientId: '2402727917' }), NOW, noGrant))
    expect(params).not.toHaveProperty('PatientId')
    expect(params).toHaveProperty('FromDate', '2026-11-03')
  })

  it('without the grant, a hidden patient or member ID is dropped from the draft: no hidden pending change, nothing kept', () => {
    const carried = q({ patientId: '2402727917', memberId: 'M-1', orderNo: 'BUPA-1' })
    const stripped = withinGrant(carried, noGrant)
    expect(stripped.patientId).toBeNull()
    expect(stripped.memberId).toBeNull()
    expect(stripped.orderNo).toBe('BUPA-1')
    // Searched as it stands: the last run equals the draft, so nothing is pending.
    expect(pendingDiff(stripped, withinGrant(q({ orderNo: 'BUPA-1' }), noGrant)).count).toBe(0)
    // A run with no hidden ID beside a stored draft that carried one: still nothing pending once stripped.
    expect(pendingDiff(withinGrant(carried, noGrant), q({ orderNo: 'BUPA-1' })).count).toBe(0)
  })

  it('with the grant, the patient and member ID are kept as they are', () => {
    const carried = q({ patientId: '2402727917', memberId: 'M-1' })
    expect(withinGrant(carried, grant)).toEqual(carried)
  })
})
