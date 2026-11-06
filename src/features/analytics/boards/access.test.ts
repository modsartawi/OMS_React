import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { canAuthorAnalytics, needsAuthor, withoutAuthor } from './access'

const coded = (code: string) => new ApiError('business', `Server says ${code}.`, 403, [{ errorCode: code, internalErrorCode: '', errorMessage: '' }])

// 822 (spec 819 §C): `GET Analytics/Access` → `{ canView, canAuthor, canCurate }`; absent or unreachable means
// denied, and curate implies author.
describe('the author grant', () => {
  it('is held only on canView with canAuthor === true, or with the curator grant', () => {
    expect(canAuthorAnalytics({ canView: true, canAuthor: true, canCurate: false })).toBe(true)
    expect(canAuthorAnalytics({ canView: true, canAuthor: false, canCurate: true })).toBe(true)
    expect(canAuthorAnalytics({ canView: true, canAuthor: false, canCurate: false })).toBe(false)
    expect(canAuthorAnalytics({ canView: false, canAuthor: true, canCurate: true })).toBe(false)
  })
  it('is denied when the answer is absent, old (no canAuthor) or malformed', () => {
    expect(canAuthorAnalytics(undefined)).toBe(false)
    expect(canAuthorAnalytics(null)).toBe(false)
    expect(canAuthorAnalytics({ canView: true, canCurate: false } as never)).toBe(false)
    expect(canAuthorAnalytics({ canView: true, canAuthor: 'true', canCurate: false } as never)).toBe(false)
  })
  it('ANALYTICS-415 is "needs the author grant", and dropping it from the cached probe drops curate too', () => {
    expect(needsAuthor(coded('ANALYTICS-415'))).toBe(true)
    expect(needsAuthor(coded('ANALYTICS-402'))).toBe(false)
    expect(needsAuthor(new Error('boom'))).toBe(false)
    expect(withoutAuthor({ canView: true, canAuthor: true, canCurate: true })).toEqual({ canView: true, canAuthor: false, canCurate: false })
    expect(withoutAuthor(undefined)).toBeUndefined()
  })
})
