/**
 * Ticket 451 — `resolvedChip`: each `resolvedAs` that needs explaining (gs1 / barcode / code) maps
 * to a label key; `text`, `material` and `null` show no chip.
 */
import { describe, expect, it } from 'vitest'
import type { MaterialSearchResult, MaterialSearchRow } from '@/core/models/materials'
import { resolvedChip } from './resolved-chip'

const row = (materialNumber: string) => ({ materialNumber }) as MaterialSearchRow
const result = (over: Partial<MaterialSearchResult>): MaterialSearchResult => ({
  resolvedAs: null,
  resolvedFrom: null,
  limited: false,
  rows: [row('101234')],
  ...over,
})

describe('resolvedChip', () => {
  it('barcode → resolved.barcode, from the barcode the server matched, to the material', () => {
    expect(
      resolvedChip(result({ resolvedAs: 'barcode', resolvedFrom: { gtin: '06281234567890', barcode: '6281234567890' } }), '628123456789'),
    ).toEqual({ kind: 'barcode', labelKey: 'resolved.barcode', from: '6281234567890', material: '101234', count: 1 })
  })

  it('gs1 → resolved.gs1, from the GTIN (never the raw scan)', () => {
    const chip = resolvedChip(
      result({ resolvedAs: 'gs1', resolvedFrom: { gtin: '06281234567890', barcode: '6281234567890' } }),
      '0106281234567890\u001d21X9',
    )
    expect(chip).toMatchObject({ kind: 'gs1', labelKey: 'resolved.gs1', from: '06281234567890', material: '101234' })
  })

  it('code → resolved.code, from the code as typed (resolvedFrom is null for a code)', () => {
    expect(resolvedChip(result({ resolvedAs: 'code' }), ' SFDA-123 ')).toMatchObject({
      labelKey: 'resolved.code',
      from: 'SFDA-123',
      material: '101234',
    })
  })

  it('several materials (a code shared) or none (filters left nothing) → the Many key with a count', () => {
    expect(resolvedChip(result({ resolvedAs: 'code', rows: [row('1'), row('2')] }), 'W1')).toMatchObject({
      labelKey: 'resolved.codeMany',
      material: null,
      count: 2,
    })
    expect(resolvedChip(result({ resolvedAs: 'barcode', rows: [] }), '628')).toMatchObject({
      labelKey: 'resolved.barcodeMany',
      material: null,
      count: 0,
    })
  })

  it('a missing resolvedFrom falls back to what was typed', () => {
    expect(resolvedChip(result({ resolvedAs: 'barcode' }), '628')?.from).toBe('628')
  })

  it.each(['text', null] as const)('%s → no chip', (resolvedAs) => {
    expect(resolvedChip(result({ resolvedAs }), 'panadol')).toBeNull()
  })

  it('no answer → no chip', () => {
    expect(resolvedChip(undefined, 'x')).toBeNull()
    expect(resolvedChip(null, 'x')).toBeNull()
  })
})
