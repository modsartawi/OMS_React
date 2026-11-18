/**
 * The Analytics combination row of the permissions brief (oms 909, BackOffice spec 4002): four named predicates over
 * the one answer, each with its half-grant case. Read by the analytics boards and the copilot's SQL mode toggle.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canAuthorAnalytics, canCurateAnalytics, canSqlAnalytics, canViewAnalytics } from './analytics-access'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('the Analytics predicates', () => {
  it('view = Analytics:03', () => {
    expect(canViewAnalytics(holding('Analytics:03'))).toBe(true)
    expect(canViewAnalytics(holding('Analytics:02', 'Analytics:06', 'Analytics:07'))).toBe(false)
  })

  it('author = view and Analytics:02; 02 without 03 is no author', () => {
    expect(canAuthorAnalytics(holding('Analytics:03', 'Analytics:02'))).toBe(true)
    expect(canAuthorAnalytics(holding('Analytics:02'))).toBe(false)
    // The server's canAuthor: the curate grant alone does not make an author.
    expect(canAuthorAnalytics(holding('Analytics:03', 'Analytics:06'))).toBe(false)
  })

  it('curate = author and Analytics:06; 06 without the author grant is no curator', () => {
    expect(canCurateAnalytics(holding('Analytics:03', 'Analytics:02', 'Analytics:06'))).toBe(true)
    expect(canCurateAnalytics(holding('Analytics:03', 'Analytics:06'))).toBe(false)
    expect(canCurateAnalytics(holding('Analytics:02', 'Analytics:06'))).toBe(false)
  })

  it('sql = author and Analytics:07; 07 without 02 is no SQL', () => {
    expect(canSqlAnalytics(holding('Analytics:03', 'Analytics:02', 'Analytics:07'))).toBe(true)
    expect(canSqlAnalytics(holding('Analytics:03', 'Analytics:07'))).toBe(false)
    expect(canSqlAnalytics(holding('Analytics:02', 'Analytics:07'))).toBe(false)
  })

  it('fails closed on no answer', () => {
    const none = permissionsOf(null)
    for (const can of [canViewAnalytics, canAuthorAnalytics, canCurateAnalytics, canSqlAnalytics]) expect(can(none)).toBe(false)
  })
})
