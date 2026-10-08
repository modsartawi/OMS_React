import { describe, expect, it } from 'vitest'
import type { BbyDetailDto } from '@/core/models/bonus-buy-inquiry'
import { toDetailView } from './detail-view'

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
