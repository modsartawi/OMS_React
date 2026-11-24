/**
 * Reading the bulk change's answer for the preview and the apply report (BackOffice spec 4190 stories
 * 25–27, 31; oms 958). The outcome is the server's (the dry run); the screen only lays it out.
 *
 * Fixtures are BackOffice pricing2 9317c4cd6's wire shape (`BbyBulkResult` / `BbyBulkRowResult`,
 * BbyBulkChangeModels.cs): `{ status, batchId, dryRun, saved, skipped, refused, bonusBuys[], refusals[] }`,
 * each row `{ number, status, refusals, warnings, version, changedFields, before, after }`.
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
  english: "Bonus buy 'OMS000000003': someone changed this bonus buy after you loaded it.",
  arabic: 'قام شخص آخر بتغيير عرض الشراء هذا بعد تحميله.',
}

/** A dry run over four rows: one that would change, one skipped, one refused (stale), one not found. */
const DRY_RUN: BbyBulkChangeResult = {
  status: 'valid',
  batchId: null,
  dryRun: true,
  saved: 0,
  skipped: 1,
  refused: 2,
  refusals: [],
  bonusBuys: [
    {
      number: 'OMS000000001',
      status: 'valid',
      refusals: [],
      warnings: [],
      version: '202611231015300000000',
      changedFields: ['Score', 'IsStackable', 'ValidFromTime', 'ValidToTime', 'Excludes'],
      before: rules(),
      after: rules({ score: 40, isStackable: false, excludes: '100234,100567', validFromTime: '150000', validToTime: '180000' }),
    },
    {
      number: 'OMS000000002',
      status: 'skipped',
      refusals: [],
      warnings: [],
      version: '202611231015300000001',
      changedFields: [],
      before: rules(),
      after: rules(),
    },
    {
      number: 'OMS000000003',
      status: 'refused',
      refusals: [refusal],
      warnings: [],
      version: '202611231015300000002',
      changedFields: ['Score'],
      before: rules(),
      after: null,
    },
    { number: 'OMS000000004', status: 'notFound', refusals: [], warnings: [], version: null, changedFields: [], before: null, after: null },
  ],
}

describe('the preview: old → new and refusals from a dry run', () => {
  const read = readBulkResult(DRY_RUN, true)

  it('is a dry run with no batch id, and counts each outcome (notFound is a refusal)', () => {
    expect(read.dryRun).toBe(true)
    expect(read.batchId).toBeNull()
    expect(read.counts).toEqual({ save: 1, skip: 1, refuse: 2, unknown: 0 })
  })

  it('a row that would save lists only the fields that change, before → after, in the form order', () => {
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

  it('a field the server did not name in changedFields is not shown, even if the validator reshaped it', () => {
    const read2 = readBulkResult({
      ...DRY_RUN,
      bonusBuys: [
        {
          ...DRY_RUN.bonusBuys[0],
          changedFields: ['Score'],
          // The validator normalised the origin filter; the change itself only set the score.
          after: rules({ score: 40, originFilter: 'C' }),
        },
      ],
    }, true)
    expect(read2.rows[0].changes).toEqual([{ field: 'score', before: 10, after: 40 }])
  })

  it('a skipped row has no changes; refused and not-found rows carry their refusals', () => {
    expect(read.rows[1]).toMatchObject({ number: 'OMS000000002', outcome: 'skip', changes: [] })
    expect(read.rows[2]).toMatchObject({ number: 'OMS000000003', outcome: 'refuse', changes: [], refusals: [refusal] })
    expect(read.rows[3]).toMatchObject({ number: 'OMS000000004', outcome: 'refuse', changes: [], refusals: [] })
  })
})

describe('the apply report', () => {
  it('saved rows, the batch id, and a status word it does not know kept as unknown', () => {
    const read = readBulkResult({
      status: 'saved',
      batchId: '01JD3K6Q4XNV8T2B7Y5ZC9W0RM',
      dryRun: false,
      saved: 1,
      skipped: 0,
      refused: 0,
      refusals: [],
      bonusBuys: [
        {
          number: 'OMS000000001',
          status: 'saved',
          refusals: [],
          warnings: [],
          version: '202611231020110000000',
          changedFields: ['Score'],
          before: rules(),
          after: rules({ score: 40 }),
        },
        { number: 'OMS000000009', status: 'weird', refusals: [], warnings: [], version: null, changedFields: [], before: null, after: null },
      ],
    }, false)
    expect(read.dryRun).toBe(false)
    expect(read.batchId).toBe('01JD3K6Q4XNV8T2B7Y5ZC9W0RM')
    expect(read.rows.map((r) => r.outcome)).toEqual(['save', 'unknown'])
    expect(read.rows[0].changes).toEqual([{ field: 'score', before: 10, after: 40 }])
    expect(read.rows[1].changes).toEqual([])
  })

  it('a batch refused whole carries the batch refusals and no rows', () => {
    const mixed = {
      code: 'BBY-BULK-MIXED-SALES-AREA',
      english: 'The selected bonus buys belong to more than one sales area (KSA and UAE). Nothing was changed.',
      arabic: 'عروض الشراء المختارة تتبع أكثر من منطقة مبيعات.',
    }
    const read = readBulkResult(
      { status: 'refused', batchId: null, dryRun: false, saved: 0, skipped: 0, refused: 0, refusals: [mixed], bonusBuys: [] },
      false,
    )
    expect(read.refusedWhole).toBe(true)
    expect(read.batchRefusals).toEqual([mixed])
    expect(read.rows).toEqual([])
  })

  it('the request decides dry run, over the server flag', () => {
    const refused = { status: 'refused', batchId: null, dryRun: false, refusals: [], bonusBuys: [] }
    expect(readBulkResult(refused, true).dryRun).toBe(true)
    expect(readBulkResult(refused, false).dryRun).toBe(false)
  })
})
