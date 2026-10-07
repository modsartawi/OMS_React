/**
 * Ticket 433 — `paymentsCriteria`: what the Document payments search asks for, and the 1,000-number
 * guard it applies before the call (spec 430 D4/D11). The numbers are counted as the server's
 * `MultiValueFilter.Split` counts them: split on `, ; |` space `\r \n \t`, trimmed, empties dropped,
 * distinct within a box (case-insensitive), summed across the two boxes.
 */
import { describe, expect, it } from 'vitest'
import {
  MAX_NUMBERS,
  criteriaFromState,
  criteriaProblem,
  criteriaToParams,
  defaultCriteria,
  numberCount,
  stateWithCriteria,
  type PaymentsCriteria,
} from './criteria'

const TODAY = new Date(2026, 9, 7, 15, 30)
const base = (over: Partial<PaymentsCriteria> = {}): PaymentsCriteria => ({ ...defaultCriteria(TODAY), ...over })
/** `n` distinct numbers joined by `sep`. */
const numbers = (n: number, sep = '\r\n', from = 1) =>
  Array.from({ length: n }, (_, i) => String(1_000_000 + from + i)).join(sep)

describe('paymentsCriteria — the default', () => {
  it('is today to today, limit 200, nothing else', () => {
    expect(defaultCriteria(TODAY)).toEqual({
      from: '2026-10-07',
      to: '2026-10-07',
      storeCode: '',
      documentType: '',
      customerPhone: '',
      documentNos: '',
      orderNos: '',
      limit: '200',
    })
    expect(criteriaProblem(defaultCriteria(TODAY))).toBeNull()
  })
})

describe('paymentsCriteria — counting the numbers', () => {
  it('splits an Excel column, commas, semicolons, pipes, spaces and tabs alike', () => {
    expect(numberCount('8000000001\r\n8000000002\r\n8000000003\r\n')).toBe(3)
    expect(numberCount('8000000001\n8000000002')).toBe(2)
    expect(numberCount('8000000001, 8000000002;8000000003|8000000004 8000000005\t8000000006')).toBe(6)
    expect(numberCount(' ,;|\r\n\t ')).toBe(0)
    expect(numberCount('')).toBe(0)
  })

  it('counts a number repeated within one box once, as the server does', () => {
    expect(numberCount('A1\na1\nA1\nB2')).toBe(2)
  })

  it('the cap is 1,000 across BOTH boxes', () => {
    expect(MAX_NUMBERS).toBe(1000)
  })

  it('allows exactly 1,000 across the two boxes', () => {
    const c = base({ documentNos: numbers(600), orderNos: numbers(400, ', ', 5000) })
    expect(criteriaProblem(c)).toBeNull()
  })

  it('🚩 refuses 1,001 across the two boxes, naming the count', () => {
    const c = base({ documentNos: numbers(600), orderNos: numbers(401, ' ', 5000) })
    expect(criteriaProblem(c)).toEqual({ kind: 'tooMany', count: 1001 })
  })

  it('refuses 1,001 in one box alone', () => {
    expect(criteriaProblem(base({ orderNos: numbers(1001, '\t') }))).toEqual({ kind: 'tooMany', count: 1001 })
  })

  it('a number in both boxes counts once in each, as the server sums the two', () => {
    const c = base({ documentNos: numbers(500), orderNos: numbers(501) })
    expect(criteriaProblem(c)).toEqual({ kind: 'tooMany', count: 1001 })
  })

  it('duplicates do not push a list over the cap', () => {
    const c = base({ documentNos: `${numbers(1000)}\r\n${numbers(5)}` })
    expect(criteriaProblem(c)).toBeNull()
  })
})

describe('paymentsCriteria — other problems', () => {
  it('a missing or malformed day', () => {
    expect(criteriaProblem(base({ from: '' }))).toEqual({ kind: 'badDate' })
    expect(criteriaProblem(base({ to: '2026-13-40x' }))).toEqual({ kind: 'badDate' })
  })

  it('a reversed range', () => {
    expect(criteriaProblem(base({ from: '2026-10-08', to: '2026-10-07' }))).toEqual({ kind: 'reversed' })
  })

  it.each(['', '0', '-5', '2.5', 'abc', '200x', '2147483648', '99999999999999999999'])('a limit of %j is not a limit', (limit) => {
    expect(criteriaProblem(base({ limit }))).toEqual({ kind: 'badLimit' })
  })

  it('a limit with spaces round it is fine', () => {
    expect(criteriaProblem(base({ limit: ' 50 ' }))).toBeNull()
  })
})

describe('paymentsCriteria — the query', () => {
  it('the default sends the two days and the limit, named as the WPF query names them', () => {
    expect(criteriaToParams(defaultCriteria(TODAY))).toEqual({ FromDate: '2026-10-07', ToDate: '2026-10-07', Limit: '200' })
  })

  it('every box reaches the wire; the number boxes go as typed', () => {
    const typed = ' 8000000001\r\n8000000002, 8000000003 '
    const params = criteriaToParams(
      base({
        storeCode: ' P019 ',
        documentType: 'ZWEB',
        customerPhone: ' +966500000001 ',
        documentNos: typed,
        orderNos: '1100\t1101',
        limit: ' 50 ',
      }),
    )
    expect(params).toEqual({
      FromDate: '2026-10-07',
      ToDate: '2026-10-07',
      Limit: '50',
      StoreCode: 'P019',
      DocumentType: 'ZWEB',
      CustomerPhone: '+966500000001',
      DocumentNo: typed,
      OrderNo: '1100\t1101',
    })
  })

  it('a number box holding only separators is left off', () => {
    const params = criteriaToParams(base({ documentNos: ' ,\r\n', orderNos: '\t' }))
    expect(params).not.toHaveProperty('DocumentNo')
    expect(params).not.toHaveProperty('OrderNo')
  })
})

describe('paymentsCriteria — kept on the history entry', () => {
  it('round-trips through router state, so Back from Document Details restores the search', () => {
    const c = base({ storeCode: 'P019', documentNos: '1, 2', limit: '50' })
    expect(criteriaFromState(stateWithCriteria(null, c))).toEqual(c)
  })

  it('keeps whatever else the entry carried, and null takes the search out', () => {
    const withSearch = stateWithCriteria({ from: 'list' }, base())
    expect(withSearch.from).toBe('list')
    expect(stateWithCriteria(withSearch, null)).toEqual({ from: 'list' })
    expect(criteriaFromState(stateWithCriteria(withSearch, null))).toBeNull()
  })

  it.each([null, undefined, 'x', {}, { paymentsCriteria: null }, { paymentsCriteria: { from: '2026-10-07' } }, { from: 'list' }])(
    'a state %j carries no search',
    (state) => {
      expect(criteriaFromState(state)).toBeNull()
    },
  )

  it('drops any key that is not a criterion', () => {
    const state = { paymentsCriteria: { ...base(), extra: 'x' }, from: 'list' }
    expect(criteriaFromState(state)).toEqual(base())
  })
})
