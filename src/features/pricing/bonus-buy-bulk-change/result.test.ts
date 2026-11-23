/**
 * Reading the bulk change's answer for the preview and the apply report (BackOffice spec 4190 stories
 * 25–27, 31; oms 958). The outcome is the server's (the dry run); the screen only lays it out.
 */
import { describe, expect, it } from 'vitest'
import type { BbyEngineRulesWire } from '@/core/models/bonus-buy-maintenance'
import type { BbyBulkChangeResult } from '@/core/models/bonus-buy-bulk'
import { readBulkResult } from './result'

const rules = (patch: Partial<BbyEngineRulesWire> = {}): BbyEngineRulesWire => ({
  includes: null,
  excludes: '100234',
  originFilter: '',
  stackingExcludes: null,
  loyGroups: null,
  loyTiers: null,
  isStackable: true,
  maxValue: 0,
  score: 10,
  validFromTime: null,
  validToTime: null,
  ...patch,
})

const refusal = {
  code: 'BBY-STALE',
  english: 'Someone changed this bonus buy after you loaded it.',
  arabic: 'قام شخص آخر بتغيير عرض الشراء هذا بعد تحميله.',
}

/** A dry run over four rows: one that would change, one skipped, one refused (stale), one unknown status word. */
const DRY_RUN: BbyBulkChangeResult = {
  status: 'valid',
  dryRun: true,
  batchId: null,
  refusals: [],
  warnings: [],
  bonusBuys: [
    {
      number: 'OMS000000001',
      status: 'valid',
      refusals: [],
      warnings: [],
      oldRules: rules(),
      newRules: rules({ score: 40, isStackable: false, excludes: '100234,100567', validFromTime: '150000', validToTime: '180000' }),
    },
    { number: 'OMS000000002', status: 'skipped', refusals: [], warnings: [], oldRules: rules(), newRules: rules() },
    { number: 'OMS000000003', status: 'refused', refusals: [refusal], warnings: [], oldRules: rules(), newRules: null },
  ],
}

describe('the preview: old → new and refusals from a dry run', () => {
  const read = readBulkResult(DRY_RUN)

  it('is a dry run with no batch id, and counts each outcome', () => {
    expect(read.dryRun).toBe(true)
    expect(read.batchId).toBeNull()
    expect(read.counts).toEqual({ save: 1, skip: 1, refuse: 1, unknown: 0 })
  })

  it('a row that would save lists only the fields that change, old → new, in the form order', () => {
    const [first] = read.rows
    expect(first.number).toBe('OMS000000001')
    expect(first.outcome).toBe('save')
    expect(first.changes).toEqual([
      { field: 'score', before: 10, after: 40 },
      { field: 'isStackable', before: true, after: false },
      { field: 'timeWindow', before: '', after: '15:00:00–18:00:00' },
      { field: 'excludes', before: '100234', after: '100234,100567', added: ['100567'], removed: [] },
    ])
  })

  it('a skipped row has no changes; a refused row carries its refusals in both languages', () => {
    expect(read.rows[1]).toMatchObject({ number: 'OMS000000002', outcome: 'skip', changes: [] })
    expect(read.rows[2]).toMatchObject({ number: 'OMS000000003', outcome: 'refuse', changes: [], refusals: [refusal] })
  })
})

describe('the apply report', () => {
  it('saved rows, the batch id, and a status word it does not know kept as unknown', () => {
    const read = readBulkResult({
      status: 'saved',
      dryRun: false,
      batchId: '01JD3K6Q4XNV8T2B7Y5ZC9W0RM',
      refusals: [],
      warnings: [],
      bonusBuys: [
        { number: 'OMS000000001', status: 'saved', refusals: [], warnings: [], oldRules: rules(), newRules: rules({ score: 40 }) },
        { number: 'OMS000000009', status: 'weird', refusals: [], warnings: [] },
      ],
    })
    expect(read.dryRun).toBe(false)
    expect(read.batchId).toBe('01JD3K6Q4XNV8T2B7Y5ZC9W0RM')
    expect(read.rows.map((r) => r.outcome)).toEqual(['save', 'unknown'])
    expect(read.rows[0].changes).toEqual([{ field: 'score', before: 10, after: 40 }])
    expect(read.rows[1].changes).toEqual([])
  })

  it('🚩 a batch refused whole carries the batch refusals and no rows', () => {
    const mixed = { code: 'BBY-BULK-SALES-AREA', english: 'One sales area per batch.', arabic: 'منطقة مبيعات واحدة لكل دفعة.' }
    const read = readBulkResult({ status: 'refused', batchId: null, refusals: [mixed], warnings: [], bonusBuys: [] })
    expect(read.refusedWhole).toBe(true)
    expect(read.batchRefusals).toEqual([mixed])
    expect(read.rows).toEqual([])
  })

  it('a missing dryRun flag is read off the status: `valid` is a dry run', () => {
    expect(readBulkResult({ status: 'valid', batchId: null, refusals: [], warnings: [], bonusBuys: [] }).dryRun).toBe(true)
  })
})
