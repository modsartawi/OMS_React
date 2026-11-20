import { describe, expect, it } from 'vitest'
import { KSA, readSalesArea, salesAreaOf } from './sales-area'

describe('readSalesArea', () => {
  it('a document with no pair is KSA (1000 / 20 / SAR)', () => {
    expect(readSalesArea({})).toEqual(KSA)
    expect(readSalesArea(null)).toEqual(KSA)
  })
  it('a Bahrain pair reads as BHD', () => {
    const a = readSalesArea({ salesOrganization: '1000', distributionChannel: '21' })
    expect(a.key).toBe('bahrain')
    expect(a.currency).toBe('BHD')
  })
  it('a pair outside the list keeps its codes, never relabelled KSA', () => {
    const a = readSalesArea({ salesOrganization: '1000', distributionChannel: '30', currency: 'XYZ' })
    expect(a.key).toBeNull()
    expect(a.distributionChannel).toBe('30')
    expect(a.currency).toBe('XYZ')
    expect(salesAreaOf('1000', '30')).toBeNull()
  })
  it('a pair outside the list with no currency keeps the currency blank (unknown), never SAR', () => {
    expect(readSalesArea({ salesOrganization: '2000', distributionChannel: '10' })).toEqual({
      key: null,
      salesOrganization: '2000',
      distributionChannel: '10',
      currency: '',
    })
  })
})
