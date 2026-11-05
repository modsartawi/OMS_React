/**
 * The Order / ERX list's saved views (ticket 786): the shared store (`@/core/list/saved-view-store`,
 * whose own behaviour the Deliveries suite proves) bound to the order criteria. The point here is
 * the Date: a view saved as "Last 3 days" still means the last three days when it runs tomorrow.
 */
import { describe, expect, it } from 'vitest'
import { buildOrderQuery } from './api'
import { BLANK_QUERY, toSearchCriteria, withField } from './query-model'
import { EMPTY_VIEW_STORE, parseViewStore, readViewStore, saveView, serializeViewStore, viewStorageKey, writeViewStore } from './saved-views'

const grant = { canViewInsurance: true }

function memoryStorage(seed: Record<string, string> = {}) {
  const items = new Map(Object.entries(seed))
  return { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v), items }
}

const snapshot = (query = BLANK_QUERY) => ({ query, lens: 'noDelivery' as const, columnState: null, filterModel: null })

describe('order-list saved view keeps a relative date', () => {
  it('stores "Last 3 days" as the preset, and it resolves against the day it runs', () => {
    const query = withField(withField(BLANK_QUERY, 'date', { preset: 'last3' }), 'documentSource', 'ERX')
    const saved = saveView(EMPTY_VIEW_STORE, 'ERX this week', snapshot(query), 'v1')
    if (!saved.ok) throw new Error('refused')

    const storage = memoryStorage()
    writeViewStore(storage, 'u7', saved.store)
    expect(JSON.parse(storage.items.get('oms.orders.views.v1:u7')!).views[0].query.date).toEqual({ preset: 'last3' })

    const view = readViewStore(storage, 'u7').views[0]
    expect(view.query?.date).toEqual({ preset: 'last3' })
    expect(view.lens).toBe('noDelivery')

    // Saved on 5 Nov, run on 9 Nov: the window is 7–9 Nov, not 3–5 Nov.
    const ranTomorrow = buildOrderQuery(toSearchCriteria(view.query!, new Date(2026, 10, 9, 8), grant))
    expect(ranTomorrow).toMatchObject({ FromDate: '2026-11-07', ToDate: '2026-11-09', DocumentSource: 'ERX' })
  })

  it('keeps a Custom range as its two days', () => {
    const query = withField(BLANK_QUERY, 'date', { preset: 'custom', from: '2026-10-10', to: '2026-10-20' })
    const saved = saveView(EMPTY_VIEW_STORE, 'October', snapshot(query), 'v2')
    if (!saved.ok) throw new Error('refused')
    const back = parseViewStore(serializeViewStore(saved.store)).views[0]
    expect(back.query?.date).toEqual({ preset: 'custom', from: '2026-10-10', to: '2026-10-20' })
  })

  it('reads the order criteria back defensively, field by field', () => {
    const raw = JSON.stringify({
      views: [
        {
          id: 'v3',
          name: 'Engine orders',
          lens: 'engine',
          query: { date: { preset: 'nextWeek' }, moneySource: 'BOTH', hasDelivery: 'no', approval: '146591214', limit: -4 },
          columnState: null,
          filterModel: {},
        },
      ],
    })
    const view = parseViewStore(raw).views[0]
    expect(view.query).toEqual({ ...BLANK_QUERY, date: null, approval: '146591214' })
    expect(view.lens).toBe('engine')
  })

  it('is per user, under the order list’s own key', () => {
    expect(viewStorageKey('u7')).toBe('oms.orders.views.v1:u7')
    expect(readViewStore(memoryStorage(), null)).toEqual(EMPTY_VIEW_STORE)
  })
})
