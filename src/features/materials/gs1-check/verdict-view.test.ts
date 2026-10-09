/**
 * Ticket 454 — `verdictView`: each status, batch value and material reason maps to a label key and
 * a severity token, and every key exists in both locales.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/materials-gs1-check.json'
import ar from '@/locales/ar/materials-gs1-check.json'
import type { Gs1CheckAnswer } from '@/core/models/materials'
import {
  GS1_BATCH_VERDICTS,
  GS1_ISSUE_CATEGORIES,
  GS1_MATERIAL_REASONS,
  GS1_STATUSES,
  GS1_TRX_TYPES,
  batchView,
  isDuplicate,
  issueCategoryKey,
  materialReasonView,
  showsSyncNote,
  statusView,
  trxTypeView,
  wellFormedView,
} from './verdict-view'

const has = (locale: unknown, key: string) =>
  typeof key.split('.').reduce<unknown>((n, part) => (n as Record<string, unknown> | undefined)?.[part], locale) === 'string'

describe('verdictView — status', () => {
  it('SELLABLE / SOLD / HELD each map to a key and a severity', () => {
    expect(statusView('SELLABLE')).toEqual({ key: 'status.SELLABLE', sev: 'ok' })
    expect(statusView('SOLD')).toEqual({ key: 'status.SOLD', sev: 'bad' })
    expect(statusView('HELD')).toEqual({ key: 'status.HELD', sev: 'warn' })
  })

  it('no status (no material or serial) is neutral', () => {
    expect(statusView(null)).toEqual({ key: 'status.none', sev: 'mute' })
  })

  it('the sync note stands beside SELLABLE only', () => {
    expect(GS1_STATUSES.filter(showsSyncNote)).toEqual(['SELLABLE'])
    expect(showsSyncNote(null)).toBe(false)
  })
})

describe('verdictView — batch', () => {
  it('known is good, unknown is a warning, not applicable is neutral', () => {
    expect(batchView('known')).toEqual({ key: 'batch.known', sev: 'ok' })
    expect(batchView('unknown')).toEqual({ key: 'batch.unknown', sev: 'warn' })
    expect(batchView('notApplicable')).toEqual({ key: 'batch.notApplicable', sev: 'mute' })
  })
})

describe('verdictView — material reason', () => {
  it('NOT_PARSED and GTIN_UNKNOWN each have a key and a severity', () => {
    expect(materialReasonView('NOT_PARSED')).toEqual({ key: 'materialReason.NOT_PARSED', sev: 'bad' })
    expect(materialReasonView('GTIN_UNKNOWN')).toEqual({ key: 'materialReason.GTIN_UNKNOWN', sev: 'warn' })
  })
})

describe('verdictView — well-formed, issues, transaction type', () => {
  it('is the server’s `valid` as given', () => {
    expect(wellFormedView(true)).toEqual({ key: 'wellFormed.yes', sev: 'ok' })
    expect(wellFormedView(false)).toEqual({ key: 'wellFormed.no', sev: 'bad' })
  })

  it('SALE and RETURN are told apart', () => {
    expect(trxTypeView('SALE').key).toBe('trxType.SALE')
    expect(trxTypeView('RETURN').key).toBe('trxType.RETURN')
    expect(trxTypeView('SALE').sev).not.toBe(trxTypeView('RETURN').sev)
  })
})

describe('verdictView — duplicates', () => {
  const answer = (duplicate: boolean) => ({ duplicate }) as Gs1CheckAnswer
  it('the list’s flag OR the server’s flag', () => {
    expect(isDuplicate(false, answer(false))).toBe(false)
    expect(isDuplicate(true, answer(false))).toBe(true)
    expect(isDuplicate(false, answer(true))).toBe(true)
    expect(isDuplicate(true, undefined)).toBe(true)
    expect(isDuplicate(false, null)).toBe(false)
  })
})

describe('verdictView — every key it builds exists in en and ar', () => {
  const keys = [
    ...GS1_STATUSES.map((s) => statusView(s).key),
    statusView(null).key,
    ...GS1_BATCH_VERDICTS.map((b) => batchView(b).key),
    ...GS1_MATERIAL_REASONS.map((r) => materialReasonView(r).key),
    wellFormedView(true).key,
    wellFormedView(false).key,
    ...GS1_ISSUE_CATEGORIES.map(issueCategoryKey),
    ...GS1_TRX_TYPES.map((x) => trxTypeView(x).key),
  ]
  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s', (_, locale) => {
    for (const key of keys) expect([key, has(locale, key)]).toEqual([key, true])
  })
})
