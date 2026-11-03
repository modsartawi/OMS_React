/**
 * Ticket 738 — the sourcing advisor's probe: the menu leaf, the screen's gate and Delivery details'
 * "Why this store?" link share one predicate that fails closed.
 */
import { describe, expect, it } from 'vitest'
import type { SourcingAdvisorAccess } from '@/core/models/sourcing-advisor'
import { SOURCING_ADVISOR_ACCESS_KEY, canViewSourcingAdvisor, sourcingAdvisorAccessQuery } from './access'

describe('the sourcing advisor probe', () => {
  it('grants on canView true only', () => {
    expect(canViewSourcingAdvisor({ canView: true })).toBe(true)
    expect(canViewSourcingAdvisor({ canView: false })).toBe(false)
  })

  it.each([null, undefined, [], {}, { canView: 'true' }, { canView: 1 }])('🚩 %j grants nothing', (r) => {
    expect(canViewSourcingAdvisor(r as unknown as SourcingAdvisorAccess)).toBe(false)
  })

  it('one key, no retry, never stale in a page life', () => {
    const q = sourcingAdvisorAccessQuery()
    expect(q.queryKey).toEqual(['oms', 'sourcing-advisor', 'access'])
    expect(SOURCING_ADVISOR_ACCESS_KEY).toEqual(['oms', 'sourcing-advisor', 'access'])
    expect(q.retry).toBe(false)
    expect(q.staleTime).toBe(Infinity)
  })
})
