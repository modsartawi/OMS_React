/**
 * Ticket 567 — the serving-list probe: the menu leaf and the ScreenGate share one View predicate that
 * fails closed; every edit control (570) reads its own Edit flag.
 */
import { describe, expect, it } from 'vitest'
import type { ServingListAccess } from '@/core/models/serving-list'
import { SERVING_LIST_ACCESS_KEY, canEditServingLists, canViewServingLists, servingListAccessQuery } from './access'

describe('the serving-list probe', () => {
  it('each flag reads only its own field', () => {
    const view: ServingListAccess = { canViewServingLists: true, canEditServingLists: false }
    expect([canViewServingLists(view), canEditServingLists(view)]).toEqual([true, false])
    const edit: ServingListAccess = { canViewServingLists: false, canEditServingLists: true }
    expect([canViewServingLists(edit), canEditServingLists(edit)]).toEqual([false, true])
  })

  it.each([null, undefined, [], {}, { canViewServingLists: 'true', canEditServingLists: 1 }])('🚩 %j grants nothing', (r) => {
    expect(canViewServingLists(r as unknown as ServingListAccess)).toBe(false)
    expect(canEditServingLists(r as unknown as ServingListAccess)).toBe(false)
  })

  it('one key, no retry, never stale in a page life', () => {
    const q = servingListAccessQuery()
    expect(q.queryKey).toEqual(['oms', 'serving-lists', 'access'])
    expect(SERVING_LIST_ACCESS_KEY).toEqual(['oms', 'serving-lists', 'access'])
    expect(q.retry).toBe(false)
    expect(q.staleTime).toBe(Infinity)
  })
})
