import { describe, expect, it } from 'vitest'
import { readCatalogArea } from './catalog-wire'
import { NEW_VIEW_PATH } from './editor'
import { catalogAuthorActions, newViewFrom } from './catalog-actions'

const AREA = readCatalogArea({
  key: 'item_sales',
  label: { en: 'Item sales', ar: 'مبيعات الأصناف' },
  available: true,
  measures: [
    { key: 'net_sales', area: 'item_sales', shape: 'additive', unit: 'SAR', label: { en: 'Net sales', ar: 'صافي المبيعات' }, dimensions: ['date', 'store'] },
    { key: 'units', area: 'item_sales', shape: 'additive', unit: 'count', label: { en: 'Units', ar: 'الوحدات' }, dimensions: ['date', 'store', 'item'] },
  ],
  dimensions: [
    { key: 'date', kind: 'time', label: { en: 'Date', ar: 'التاريخ' }, values: [] },
    { key: 'store', kind: 'category', label: { en: 'Store', ar: 'الفرع' }, values: [] },
    { key: 'item', kind: 'category', label: { en: 'Item', ar: 'الصنف' }, values: [] },
  ],
})

describe('New view from this (843, spec 3437 story 49)', () => {
  it('new view from a measure pre-fills the builder link', () => {
    // A measure node: that measure, by the preview's axis — the date by day, last 7 days.
    const link = newViewFrom(AREA, { measure: 'units' })
    expect(link.to).toBe(NEW_VIEW_PATH)
    expect(link.state?.editorSeed.definition).toEqual({
      chart: { type: 'line' },
      query: { measures: ['units'], dimensions: ['date'], filters: [], period: 'last-7-days', grain: 'day' },
    })

    // An area node: the area's first measure, same axis.
    expect(newViewFrom(AREA, {}).state?.editorSeed.definition.query).toEqual({
      measures: ['net_sales'],
      dimensions: ['date'],
      filters: [],
      period: 'last-7-days',
      grain: 'day',
    })

    // A dimension node: that dimension, with the area's first measure that can be cut by it; no day grain.
    expect(newViewFrom(AREA, { dimension: 'item' }).state?.editorSeed.definition).toEqual({
      chart: { type: 'bar' },
      query: { measures: ['units'], dimensions: ['item'], filters: [], period: 'last-7-days', grain: null },
    })
  })
})

describe('who is offered the author actions (843, story 51)', () => {
  it('runner sees no author actions', () => {
    const runner = { canView: true, canAuthor: false, canCurate: false }
    expect(catalogAuthorActions(runner, true)).toEqual({ newView: false, ask: false })
    // Still asking the probe, or no probe: nothing (fails closed).
    expect(catalogAuthorActions(undefined, true)).toEqual({ newView: false, ask: false })

    // An author gets both; the ask also needs the copilot probe, like the ask box.
    const author = { canView: true, canAuthor: true, canCurate: false }
    expect(catalogAuthorActions(author, true)).toEqual({ newView: true, ask: true })
    expect(catalogAuthorActions(author, false)).toEqual({ newView: true, ask: false })
    // A curator authors too.
    expect(catalogAuthorActions({ canView: true, canAuthor: false, canCurate: true }, true)).toEqual({ newView: true, ask: true })
  })
})
