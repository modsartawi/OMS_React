/**
 * Ticket 555 — the HungerStation materials search lives in the URL (state, text, page), and the
 * door is server-paged (`skip` / `take`, `total`; contract § Materials `GET
 * HungerStationWeb/Materials?q=&state=&skip=&take=`).
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationMaterialRow, HungerStationMaterialsQuery } from '@/core/models/hungerstation'
import { MATERIAL_STATES, MATERIALS_PAGE_SIZE, materialsDoorParams, materialsFromParams, materialsPage, materialsToParams, withRow } from './materials-query'

const query = (over: Partial<HungerStationMaterialsQuery> = {}): HungerStationMaterialsQuery => ({
  q: null,
  state: 'active',
  skip: 0,
  take: 100,
  ...over,
})

describe('materialsFromParams ⇄ materialsToParams', () => {
  it('an empty URL is the active materials, first page, the contract’s 100 a page', () => {
    expect(MATERIALS_PAGE_SIZE).toBe(100)
    expect(materialsFromParams(new URLSearchParams())).toEqual(query())
  })

  it('the defaults are left out of the URL', () => {
    expect(materialsToParams(query()).toString()).toBe('')
  })

  it('round-trips state, text and page', () => {
    const full = query({ state: 'deleted', q: '1012', skip: 200 })
    const params = materialsToParams(full)
    expect(params.toString()).toBe('state=deleted&q=1012&skip=200')
    expect(materialsFromParams(params)).toEqual(full)
  })

  it('offers the four states in the contract’s order, active first', () => {
    expect(MATERIAL_STATES).toEqual(['active', 'disabled', 'deleted', 'any'])
    for (const state of MATERIAL_STATES) expect(materialsFromParams(materialsToParams(query({ state })))).toEqual(query({ state }))
  })

  it('🚩 a state the door does not know reads as active — sending it would be HungerStationFilterUnknown', () => {
    expect(materialsFromParams(new URLSearchParams('state=gone')).state).toBe('active')
  })

  it('the text is trimmed, a blank one dropped, Arabic kept', () => {
    expect(materialsFromParams(new URLSearchParams('q=%20%20')).q).toBeNull()
    expect(materialsFromParams(new URLSearchParams('q=%20بنادول%20')).q).toBe('بنادول')
  })

  it('skip is a whole number ≥ 0; anything else is the first page', () => {
    for (const bad of ['-100', 'abc', '1.5', '']) expect(materialsFromParams(new URLSearchParams(`skip=${bad}`)).skip).toBe(0)
  })
})

describe('materialsDoorParams', () => {
  it('sends state, skip and take always, and the text when there is one', () => {
    expect(materialsDoorParams(query())).toEqual({ q: null, state: 'active', skip: 0, take: 100 })
    expect(materialsDoorParams(query({ q: '101', state: 'any', skip: 300 }))).toEqual({ q: '101', state: 'any', skip: 300, take: 100 })
  })
})

describe('materialsPage', () => {
  it('the first of three pages: 1–100 of 250, no previous, a next at 100', () => {
    expect(materialsPage(query(), 250, 100)).toEqual({ first: 1, last: 100, total: 250, previous: null, next: 100 })
  })

  it('the last page: 201–250 of 250, a previous at 100, no next', () => {
    expect(materialsPage(query({ skip: 200 }), 250, 50)).toEqual({ first: 201, last: 250, total: 250, previous: 100, next: null })
  })

  it('an empty answer is 0 of 0, nowhere to go', () => {
    expect(materialsPage(query(), 0, 0)).toEqual({ first: 0, last: 0, total: 0, previous: null, next: null })
  })

  it('a page past the end (the list shrank) goes back to the last page there is', () => {
    expect(materialsPage(query({ skip: 300 }), 120, 0)).toEqual({ first: 0, last: 0, total: 120, previous: 100, next: null })
  })
})

describe('withRow — a change updates the grid in place', () => {
  const row = (materialNumber: string, over: Partial<HungerStationMaterialRow> = {}): HungerStationMaterialRow => ({
    materialNumber,
    sku: `SKU-${materialNumber}`,
    nameEn: 'Panadol',
    nameAr: 'بنادول',
    disabled: false,
    deleted: false,
    updatedAt: null,
    updatedBy: '',
    ...over,
  })

  it('swaps the returned row in at its place, the rest and the total untouched', () => {
    const page = { total: 250, rows: [row('101'), row('102'), row('103')] }
    const changed = row('102', { disabled: true, updatedAt: '2026-10-24T11:00:00', updatedBy: 'CATMGR' })
    expect(withRow(page, changed)).toEqual({ total: 250, rows: [row('101'), changed, row('103')] })
  })

  it('a page without the material is handed back as it was', () => {
    const page = { total: 1, rows: [row('101')] }
    expect(withRow(page, row('999'))).toBe(page)
    expect(withRow(undefined, row('999'))).toBeUndefined()
  })
})
