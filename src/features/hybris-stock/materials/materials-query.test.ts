import { describe, expect, it } from 'vitest'
import { materialsDoorParams, materialsFromParams, materialsToParams, withRow } from './materials-query'

describe('the materials URL and door', () => {
  it('round-trips, defaults left off', () => {
    const q = materialsFromParams(new URLSearchParams('q=%20panadol%20&enabled=disabled&page=3'))
    expect(q).toEqual({ q: 'panadol', enabled: 'disabled', page: 3 })
    expect(materialsToParams(q).toString()).toBe('q=panadol&enabled=disabled&page=3')
    expect(materialsToParams({ q: null, enabled: 'any', page: 1 }).toString()).toBe('')
  })

  it('junk reads as the defaults', () => {
    expect(materialsFromParams(new URLSearchParams('enabled=maybe&page=-2'))).toEqual({ q: null, enabled: 'any', page: 1 })
  })

  it('sends skip / take and leaves any off', () => {
    expect(materialsDoorParams({ q: null, enabled: 'any', page: 3 })).toEqual({ q: null, enabled: null, skip: 100, take: 50 })
  })

  it('withRow swaps the row where it stands', () => {
    const page = { total: 2, rows: [{ materialNumber: '1', enabled: true }, { materialNumber: '2', enabled: true }] } as never
    expect(withRow(page, { materialNumber: '2', enabled: false } as never)?.rows.map((r) => r.enabled)).toEqual([true, false])
    expect(withRow(page, { materialNumber: '9' } as never)).toBe(page)
  })
})
