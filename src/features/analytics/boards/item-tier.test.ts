import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { certifiedCopyOf, needsCurator, tierActionsOf } from './item-tier'

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
