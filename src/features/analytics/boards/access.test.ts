import { describe, expect, it } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '@/core/api'
import { canAuthorAnalytics, canCurateAnalytics, canViewAnalytics } from '@/core/analytics-access'
import { PERMISSIONS_KEY } from '@/core/permissions'
import { RENDER_TICKET_PERMISSIONS, needsAuthor, refreshAfterLostGrant } from './access'

const coded = (code: string) => new ApiError('business', `Server says ${code}.`, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }])

// 822 (spec 819 §C) on the one permissions answer (oms 914): a lost-grant refusal asks the answer again, so the
// actions it no longer covers hide next time.
describe('the lost author grant', () => {
  it('ANALYTICS-415 is "needs the author grant"', () => {
    expect(needsAuthor(coded('ANALYTICS-415'))).toBe(true)
    expect(needsAuthor(coded('ANALYTICS-402'))).toBe(false)
    expect(needsAuthor(new Error('boom'))).toBe(false)
  })

  it('invalidates the one permissions answer', () => {
    const client = new QueryClient()
    client.setQueryData(PERMISSIONS_KEY, { screens: ['Analytics:03', 'Analytics:02'], extras: {}, version: 'v' })
    refreshAfterLostGrant(client)
    expect(client.getQueryState(PERMISSIONS_KEY)?.isInvalidated).toBe(true)
  })
})

// 835: under a render ticket the print page reads as a runner's, with no call.
describe('the render ticket reading', () => {
  it('is a runner: view, never author or curator', () => {
    expect(canViewAnalytics(RENDER_TICKET_PERMISSIONS)).toBe(true)
    expect(canAuthorAnalytics(RENDER_TICKET_PERMISSIONS)).toBe(false)
    expect(canCurateAnalytics(RENDER_TICKET_PERMISSIONS)).toBe(false)
  })
})
