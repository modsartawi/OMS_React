import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { certifiedCopyOf, needsCurator, tierActionsOf, viewDeleteBlocked, viewInUse } from './item-tier'

const item = (id: string, over: Record<string, unknown> = {}) => ({ id, tier: 'shared', certifiedFrom: null, ...over }) as never

describe('the tier actions an item header shows', () => {
  it('keeps the tier actions, in order, and leaves the editor its saves', () => {
    expect(tierActionsOf(['saveInPlace', 'saveAsCopy', 'unshare', 'certify', 'delete'])).toEqual(['unshare', 'certify', 'delete'])
    expect(tierActionsOf(['create'])).toEqual([])
  })
})

describe('the certified copy of an item', () => {
  it('is the Certified item that names it as its source', () => {
    const list = [item('b-1'), item('b-1-cert', { tier: 'certified', certifiedFrom: 'b-1' }), item('b-2')]
    expect(certifiedCopyOf(list, 'b-1')?.id).toBe('b-1-cert')
    expect(certifiedCopyOf(list, 'b-2')).toBeNull()
  })
  it('is none once un-certified, or when the list has not landed', () => {
    expect(certifiedCopyOf([item('x', { tier: 'shared', certifiedFrom: 'b-1' })], 'b-1')).toBeNull()
    expect(certifiedCopyOf(undefined, 'b-1')).toBeNull()
  })
})

describe('ANALYTICS-402 from a stale probe', () => {
  it('is read as "needs the curator grant"; any other refusal is not', () => {
    const refused = (code: string) => new ApiError('business', 'no', 403, [{ errorCode: code, errorMessage: 'no' } as never])
    expect(needsCurator(refused('ANALYTICS-402'))).toBe(true)
    expect(needsCurator(refused('ANALYTICS-404'))).toBe(false)
    expect(needsCurator(new Error('x'))).toBe(false)
  })
})

describe('837: a view in use (BackOffice 3432 §2)', () => {
  const board = (id: string, over: Record<string, unknown> = {}) => ({ id, title: { en: id, ar: '' }, owner: 'me', tier: 'personal', mine: true, ...over }) as never
  it('reads the boards that block a delete from an ANALYTICS-416 refusal, and nothing from any other failure', () => {
    const data = { boards: [{ id: 'b-1', title: { en: 'Ops', ar: 'العمليات' }, owner: 'someone', tier: 'shared', mine: false }, { title: {} }], hidden: 2 }
    const refused = new ApiError('business', 'In use.', 409, [{ errorCode: 'ANALYTICS-416', internalErrorCode: '', errorMessage: 'In use.' }], data)
    expect(viewInUse(refused)).toEqual({ boards: [{ id: 'b-1', title: { en: 'Ops', ar: 'العمليات' }, owner: 'someone', tier: 'shared', mine: false }], hidden: 2 })
    const other = new ApiError('business', 'Gone.', 404, [{ errorCode: 'ANALYTICS-404', internalErrorCode: '', errorMessage: 'Gone.' }], data)
    expect(viewInUse(other)).toBeNull()
    expect(viewInUse(new Error('x'))).toBeNull()
  })
  it('a 416 with no data still blocks, with no boards named', () => {
    const bare = new ApiError('business', 'In use.', 409, [{ errorCode: 'ANALYTICS-416', internalErrorCode: '', errorMessage: 'In use.' }])
    expect(viewInUse(bare)).toEqual({ boards: [], hidden: 0 })
  })
  it('blocks when a linking board is Certified, not mine, or hidden; my own Personal or Shared boards do not', () => {
    expect(viewDeleteBlocked({ boards: [], hidden: 0 })).toBe(false)
    expect(viewDeleteBlocked({ boards: [board('a'), board('b', { tier: 'shared' })], hidden: 0 })).toBe(false)
    expect(viewDeleteBlocked({ boards: [board('a', { tier: 'certified' })], hidden: 0 })).toBe(true)
    expect(viewDeleteBlocked({ boards: [board('a', { mine: false, tier: 'shared' })], hidden: 0 })).toBe(true)
    expect(viewDeleteBlocked({ boards: [], hidden: 1 })).toBe(true)
  })
})
