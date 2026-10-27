/**
 * Review of spec 3148 (finding A/B): a dialog's draft is built from a BASE row, and the save sends that base as the
 * before-state. When the row is re-read (a stale refusal, a refetch) and differs from the base, the draft is rebuilt
 * from the fresh row — never "fresh before + stale after", which would silently overwrite someone else's change.
 */
import { describe, expect, it } from 'vitest'
import { rebaseDraft, sameRow } from './reread'

const row = (over: Record<string, unknown> = {}) => ({ code: 'BUPA', description: 'Bupa', flag: true, amount: 1, ...over })

describe('sameRow', () => {
  it('compares field by field, strings trimmed', () => {
    expect(sameRow(row(), row({ description: ' Bupa ' }))).toBe(true)
    expect(sameRow(row(), row({ description: 'Bupa 2' }))).toBe(false)
    expect(sameRow(row(), row({ flag: false }))).toBe(false)
    expect(sameRow(row(), row({ amount: 2 }))).toBe(false)
  })

  it('a field only one side has is a difference', () => {
    expect(sameRow<object>(row(), { ...row(), extra: 'x' })).toBe(false)
  })

  it('null rows', () => {
    expect(sameRow(null, null)).toBe(true)
    expect(sameRow(row(), null)).toBe(false)
  })
})

describe('rebaseDraft', () => {
  const base = row()
  const draft = row({ description: 'My edit' })

  it('keeps the draft while the loaded row still equals its base', () => {
    expect(rebaseDraft({ base, draft }, row())).toBeNull()
  })

  it('rebuilds the draft from a re-read row that differs from its base, and says so', () => {
    const fresh = row({ flag: false })
    expect(rebaseDraft({ base, draft }, fresh)).toEqual({ base: fresh, draft: fresh, reread: true })
  })

  it('the rebuilt draft has no change: the next save cannot send fresh before + stale after', () => {
    const fresh = row({ flag: false })
    const next = rebaseDraft({ base, draft }, fresh)!
    expect(sameRow(next.base, next.draft)).toBe(true)
    expect(next.draft).not.toHaveProperty('description', 'My edit')
  })

  it('a start function builds the draft (a copy starts blank, say)', () => {
    const fresh = row({ flag: false })
    const next = rebaseDraft({ base, draft }, fresh, (r) => ({ ...r, code: '' }))!
    expect(next).toEqual({ base: fresh, draft: { ...fresh, code: '' }, reread: true })
  })
})
