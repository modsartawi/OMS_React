/**
 * Ticket 626 (reconciled by 628 with 3167) — every IDF event outcome has a word in English and Arabic, the reserved
 * two too; the filter offers only the seven live ones (alternativeTaken included); time spent reads `m:ss`; and the keys the log builds exist.
 */
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/insurance-idf.json'
import ar from '@/locales/ar/insurance-idf.json'
import { hasLocaleKey } from '@/core/test/locale'
import { IDF_EVENT_DECISIONS, IDF_EVENT_FILTER_OUTCOMES, IDF_EVENT_OUTCOMES, decisionWordKey, formatDurationMs, formatTimeSpent, outcomeWordKey, reasonWordKey, tierOfSource } from './events'

const ALL = ['reminder', 'forcedPickTaken', 'pickCancelled', 'lineAbandoned', 'skippedByException', 'refusedPreAuth', 'alternativeTaken', 'requestRaised', 'autoApproved']

describe('every outcome, reserved ones too, has a word', () => {
  it('the nine outcomes of 3167 (alternativeTaken included)', () => {
    expect([...IDF_EVENT_OUTCOMES].sort()).toEqual([...ALL].sort())
  })

  it.each([
    ['en', en],
    ['ar', ar],
  ])('%s has a word for each', (_, locale) => {
    for (const o of ALL) expect([o, hasLocaleKey(locale, `events.outcome.${o}`)]).toEqual([o, true])
  })

  it('the English words', () => {
    const words = (en.events as { outcome: Record<string, string> }).outcome
    expect(words).toMatchObject({
      reminder: 'Reminder',
      forcedPickTaken: 'Forced pick taken',
      pickCancelled: 'Pick cancelled',
      lineAbandoned: 'Line abandoned',
      skippedByException: 'Skipped by exception',
      refusedPreAuth: 'Refused (pre-authorisation)',
      alternativeTaken: 'Alternative taken',
      requestRaised: 'Request raised',
      autoApproved: 'Auto-approved',
    })
  })

  it('the key of a known outcome, none for an unknown one', () => {
    expect(outcomeWordKey('lineAbandoned')).toBe('events.outcome.lineAbandoned')
    expect(outcomeWordKey('autoApproved')).toBe('events.outcome.autoApproved')
    expect(outcomeWordKey('teleported')).toBeNull()
  })

  it('the filter offers the seven live outcomes, not the reserved', () => {
    expect([...IDF_EVENT_FILTER_OUTCOMES]).toEqual(['reminder', 'forcedPickTaken', 'pickCancelled', 'lineAbandoned', 'skippedByException', 'refusedPreAuth', 'alternativeTaken'])
  })
})

describe('time spent', () => {
  it('reads m:ss, nothing when none was sent', () => {
    expect(formatTimeSpent(65)).toBe('1:05')
    expect(formatTimeSpent(4.4)).toBe('0:04')
    expect(formatTimeSpent(600)).toBe('10:00')
    expect(formatTimeSpent(null)).toBeNull()
    expect(formatTimeSpent(-1)).toBeNull()
  })
})

describe('insurance-idf — the keys the events log builds exist', () => {
  it.each([en, ar])('title, filters, columns, states', (locale) => {
    const keys = [
      'events.title',
      'events.lede',
      'events.loading',
      'events.failed',
      'events.empty',
      'events.anyOutcome',
      'events.anyMaster',
      'events.unknownMaster',
      'events.version',
      'events.total',
      ...['label', 'from', 'to', 'store', 'payer', 'master', 'outcome', 'invalid', 'reversed', 'tooLong', 'outOfBounds'].map((k) => `events.filter.${k}`),
      ...['at', 'store', 'till', 'trx', 'payer', 'documentType', 'itemScanned', 'itemDispensed', 'source', 'master', 'decision', 'outcome', 'scannedPrice', 'dispensedPrice', 'timeSpent'].map((c) => `events.columns.${c}`),
      ...IDF_EVENT_DECISIONS.map((d) => `events.decision.${d}`),
      'events.reason.allCandidatesDearer',
    ]
    for (const key of keys) expect([key, hasLocaleKey(locale, key)]).toEqual([key, true])
  })
})

describe('3167 row words: decision, reason, source tier, duration', () => {
  it('a decision and the price-rule reason have words; blanks and unknowns none', () => {
    expect(decisionWordKey('ForcedPick')).toBe('events.decision.ForcedPick')
    expect(decisionWordKey('None')).toBe('events.decision.None')
    expect(decisionWordKey('')).toBeNull()
    expect(reasonWordKey('allCandidatesDearer')).toBe('events.reason.allCandidatesDearer')
    expect(reasonWordKey('')).toBeNull()
  })
  it('a till source spelling maps to the lookup tier words', () => {
    expect(tierOfSource('InsurerAtStoreList')).toBe('insurerAtStoreList')
    expect(tierOfSource('General')).toBe('general')
    expect(tierOfSource('Store')).toBe('store')
    expect(tierOfSource('')).toBeNull()
  })
  it('durationMs reads m:ss', () => {
    expect(formatDurationMs(65000)).toBe('1:05')
    expect(formatDurationMs(0)).toBe('0:00')
    expect(formatDurationMs(null)).toBeNull()
  })
  it.each([en, ar])('the price columns say per base unit', (locale) => {
    const c = (locale.events as { columns: Record<string, string> }).columns
    expect(c.scannedPrice).toMatch(locale === en ? /per base unit/ : /وحدة أساسية/)
    expect(c.dispensedPrice).toMatch(locale === en ? /per base unit/ : /وحدة أساسية/)
  })
})
