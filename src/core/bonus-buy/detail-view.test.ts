import { describe, expect, it } from 'vitest'
import type { BbyDetailDto } from '@/core/models/bonus-buy-inquiry'
import { minMaxView, toDetailView } from './detail-view'

const TODAY = '20261008'

const dto = (header: Partial<BbyDetailDto['header']>): BbyDetailDto =>
  ({
    header: { validFrom: '20260101', validTo: '20261231', bbyStatus: '', condTargetType: 'M', ...header },
    org: { salesOrganization: '', distributionChannel: '', plant: '', currency: 'SAR' },
    buy: [],
    get: [],
    totalDiscount: null,
  }) as unknown as BbyDetailDto

// The modal's validity marker reads status the way the server does (ticket 442).
describe('toDetailView validity', () => {
  it('marks an in-window Activated (blank) bonus buy live', () => {
    expect(toDetailView(dto({ bbyStatus: '' }), TODAY).validity).toBe('live')
  })

  it('gives an in-window Planned, Tested or Deactivated one no marker', () => {
    for (const bbyStatus of ['1', '2', '3']) expect(toDetailView(dto({ bbyStatus }), TODAY).validity).toBeNull()
  })

  it('no longer treats the retired A as Activated', () => {
    expect(toDetailView(dto({ bbyStatus: 'A' }), TODAY).validity).toBeNull()
  })

  it('reads the window before the status', () => {
    expect(toDetailView(dto({ validTo: '20260101' }), TODAY).validity).toBe('ended')
    expect(toDetailView(dto({ validFrom: '20270101' }), TODAY).validity).toBe('notStarted')
  })
})

// Spec 4040 / ticket 921: the min/max line says which kind of minimum it is.
describe('minMaxView', () => {
  it('reads incl. VAT when the mark is on', () => {
    const v = minMaxView({ minValue: 100, maxValue: 250, minValueInclVat: true }, 'SAR', '—')
    expect(v).toEqual({ amounts: '100.00 / 250.00 SAR', inclVat: true })
  })

  it("draws the amounts at the currency's own decimals (3 for BHD)", () => {
    expect(minMaxView({ minValue: 12.5, maxValue: 0 }, 'BHD', '—')?.amounts).toBe('12.500 / — BHD')
  })

  it('carries no basis when the mark is off or absent', () => {
    expect(minMaxView({ minValue: 100, maxValue: 0, minValueInclVat: false }, 'SAR', '—')?.inclVat).toBe(false)
    expect(minMaxView({ minValue: 100, maxValue: 0 }, 'SAR', '—')?.inclVat).toBe(false)
    expect(minMaxView({ minValue: 100, maxValue: 0 }, 'SAR', '—')?.amounts).toMatch(/ \/ — SAR$/)
  })

  it('shows no line, and no basis, without a minimum or maximum', () => {
    expect(minMaxView({ minValue: 0, maxValue: 0, minValueInclVat: true }, 'SAR', '—')).toBeNull()
    // A max-only line never claims a VAT basis: the mark is the minimum's, the maximum keeps its meaning.
    expect(minMaxView({ minValue: 0, maxValue: 50, minValueInclVat: true }, 'SAR', '—')?.inclVat).toBe(false)
  })
})
