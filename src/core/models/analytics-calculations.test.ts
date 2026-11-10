import { describe, expect, it } from 'vitest'
import { readCalculations, readColumnCalculation, readColumnVariant, readUntilReached, readVariants } from './analytics-calculations'

// The server's wire (BackOffice spec 3543, AnalyticsWire.cs on spec3543): `within` on a share, `variants` on the query,
// `variant` on a result column, and `untilReached` as a list per parent when a running share is within a parent.
describe('the phase 2 calculation wire (spec 3543 A and B)', () => {
  it('reads a share within its parents, and drops an empty within', () => {
    expect(readCalculations([{ key: 'dlShare', kind: 'shareOfTotal', measure: 'delivery_value', within: ['region'] }])).toEqual([
      { key: 'dlShare', kind: 'shareOfTotal', measure: 'delivery_value', within: ['region'] },
    ])
    expect(readCalculations([{ key: 'dlShare', kind: 'shareOfTotal', measure: 'delivery_value', within: [] }])).toEqual([
      { key: 'dlShare', kind: 'shareOfTotal', measure: 'delivery_value' },
    ])
    expect(readColumnCalculation({ kind: 'cumulativeShare', measure: 'net', within: ['region', 'city'] })).toEqual({ kind: 'cumulativeShare', measure: 'net', within: ['region', 'city'] })
  })

  it('reads variants tolerantly: a variant needs a key, a measure and a filter with values', () => {
    expect(
      readVariants([
        { key: 'deliveryValue', measure: 'net_till_value_sar', filters: [{ dimension: 'delivery_type', values: ['DL'] }], label: { en: 'Delivery value', ar: 'قيمة التوصيل' } },
        { key: 'noFilter', measure: 'net_till_value_sar', filters: [] },
        { key: '', measure: 'net_till_value_sar', filters: [{ dimension: 'channel', values: ['app'] }] },
        { key: 'empty', measure: 'net_till_value_sar', filters: [{ dimension: 'channel', values: [] }] },
      ]),
    ).toEqual([
      { key: 'deliveryValue', measure: 'net_till_value_sar', filters: [{ dimension: 'delivery_type', values: ['DL'] }], label: { en: 'Delivery value', ar: 'قيمة التوصيل' } },
    ])
    expect(readVariants(undefined)).toBeUndefined()
    expect(readVariants([])).toBeUndefined()
  })

  it("reads a variant column's origin", () => {
    expect(readColumnVariant({ measure: 'net', filters: [{ dimension: 'delivery_type', values: ['DL'] }], label: null })).toEqual({
      measure: 'net',
      filters: [{ dimension: 'delivery_type', values: ['DL'] }],
    })
    expect(readColumnVariant(null)).toBeNull()
  })

  it('reads untilReached as a boolean (3519) or as a list per parent (3545)', () => {
    expect(readUntilReached(false)).toBe(false)
    expect(readUntilReached(undefined)).toBeUndefined()
    expect(
      readUntilReached([
        { parent: { region: 'R1' }, reached: true },
        { parent: { region: 'R2' }, reached: false },
        { parent: 'nonsense', reached: false },
      ]),
    ).toEqual([
      { parent: { region: 'R1' }, reached: true },
      { parent: { region: 'R2' }, reached: false },
    ])
  })
})
