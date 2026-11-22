import { describe, expect, it } from 'vitest'
import { TAKE_OUTCOMES, type StockConsoleTakeRow } from '@/core/models/stock-console'
import { searchFromParams, type ListSpec } from './search'
import { failedNotSearchable, takeCells, takesDay } from './takes'

const TAKES: ListSpec = { filters: TAKE_OUTCOMES, extras: ['day'], keep: ['tab'] }
const state = (qs: string) => searchFromParams(new URLSearchParams(qs), TAKES)

/** SIS.Api's take row is one flat shape (BO 4160, `StockConsoleTakeRow`): a kind fills its fields, the rest are null. */
const take = (over: Partial<StockConsoleTakeRow>): StockConsoleTakeRow => ({
  kind: '',
  at: '2026-11-22T09:00:00',
  takeId: null,
  item: null,
  nameEn: '',
  nameAr: '',
  code: null,
  stage: null,
  available: null,
  quantity: null,
  scannedVendorBatch: null,
  scannedExpiry: null,
  enteredBatch: null,
  batches: null,
  batch: null,
  batchWithStock: null,
  reason: null,
  asked: null,
  shadow: null,
  durationMs: null,
  statusCode: null,
  instance: null,
  ...over,
})

const granted = take({
  kind: 'granted',
  takeId: 'T1',
  at: '2026-11-22T09:14:03',
  item: '1001',
  nameEn: 'Panadol',
  nameAr: 'بانادول',
  quantity: 3,
  available: 40,
  stage: 'Blocking',
  batches: [
    { batch: 'B1', quantity: 2, state: 'Held' },
    { batch: 'B2', quantity: 1, state: 'Sold' },
  ],
})

const refused = take({
  kind: 'refused',
  takeId: 'T2',
  at: '2026-11-22T09:20:00',
  item: '1002',
  nameEn: 'Brufen',
  nameAr: 'بروفين',
  batch: 'L70',
  batchWithStock: 'L77',
  asked: 5,
  available: 1,
  code: 'NotEnough',
  reason: 'Only 1 free on batch L77',
  shadow: false,
  stage: 'Blocking',
})

const failed = take({
  kind: 'failed',
  at: '2026-11-22T09:30:00',
  durationMs: 8012,
  statusCode: 504,
  instance: 'sv-2',
})

describe('a take row’s cells, per kind', () => {
  it('a granted take shows its item, quantity and each batch it took with its quantity', () => {
    expect(takeCells(granted)).toEqual({
      kind: { key: 'takes.kind.granted', sev: 'ok' },
      item: '1001',
      names: { nameEn: 'Panadol', nameAr: 'بانادول' },
      quantity: 3,
      batches: ['B1 · 2', 'B2 · 1'],
      reason: null,
      status: null,
    })
  })

  it('a refused take shows what was asked, the batch the door named, and its reason', () => {
    expect(takeCells(refused)).toEqual({
      kind: { key: 'takes.kind.refused', sev: 'warn' },
      item: '1002',
      names: { nameEn: 'Brufen', nameAr: 'بروفين' },
      quantity: 5,
      batches: ['L77'],
      reason: 'Only 1 free on batch L77',
      status: null,
    })
  })

  it('a refusal with no reason sentence shows its code instead', () => {
    expect(takeCells({ ...refused, reason: null }).reason).toBe('NotEnough')
  })

  it('a refusal that named no batch, and a granted take Stock Visibility sent without its holds, list no batch', () => {
    expect(takeCells({ ...refused, batchWithStock: null }).batches).toEqual([])
    expect(takeCells({ ...granted, batches: null }).batches).toEqual([])
  })

  it('a failed call has no item, no quantity and no batch — only its status and how long it took', () => {
    expect(takeCells(failed)).toEqual({
      kind: { key: 'takes.kind.failed', sev: 'bad' },
      item: null,
      names: null,
      quantity: null,
      batches: [],
      reason: null,
      status: { code: 504, ms: 8012 },
    })
  })

  it('a kind the console does not know is drawn as it came, with nothing else guessed', () => {
    const odd = take({ kind: 'skipped', takeId: 'T4', at: '2026-11-22T09:40:00', item: '1003', quantity: 2 })
    expect(takeCells(odd)).toEqual({
      kind: { raw: 'skipped', sev: 'mute' },
      item: null,
      names: null,
      quantity: null,
      batches: [],
      reason: null,
      status: null,
    })
  })
})

describe('the "failed calls are not searchable by item" line', () => {
  it('shows once a search ran with an item or a batch in the boxes', () => {
    expect(failedNotSearchable(state('ran=1&item=1001'), undefined)).toBe(true)
    expect(failedNotSearchable(state('ran=1&batch=L77'), undefined)).toBe(true)
  })

  it('does not show with empty boxes, nor before a search', () => {
    expect(failedNotSearchable(state('ran=1'), { failedLeftOut: false })).toBe(false)
    expect(failedNotSearchable(state('item=1001'), undefined)).toBe(false)
  })

  it('shows whenever the server says it left failed calls out', () => {
    expect(failedNotSearchable(state('ran=1'), { failedLeftOut: true })).toBe(true)
  })

  it('does not show on the granted or refused list, where no failed call would be anyway', () => {
    expect(failedNotSearchable(state('ran=1&item=1001&filter=granted'), undefined)).toBe(false)
    expect(failedNotSearchable(state('ran=1&item=1001&filter=refused'), undefined)).toBe(false)
    expect(failedNotSearchable(state('ran=1&item=1001&filter=failed'), undefined)).toBe(true)
  })
})

describe('the Takes day', () => {
  it('is today by default, and the address’s day when it names one', () => {
    expect(takesDay(state('ran=1'), '2026-11-22')).toBe('2026-11-22')
    expect(takesDay(state('ran=1&day=2026-11-20'), '2026-11-22')).toBe('2026-11-20')
  })

  it('a day that is not a day falls back to today', () => {
    expect(takesDay(state('ran=1&day=monday'), '2026-11-22')).toBe('2026-11-22')
  })
})
