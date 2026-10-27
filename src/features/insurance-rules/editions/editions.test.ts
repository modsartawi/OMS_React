/**
 * Ticket 613 — reference editions (BackOffice 3138): the SFDA list / CHI formulary picked from the address,
 * the diff read as counts whatever the door sends, who may publish (never the uploader; only a pending
 * edition), and the gap report counted and filtered by kind.
 */
import { describe, expect, it } from 'vitest'
import { EDITIONS, EDITION_DIFFS, EDITION_GAPS } from '../../../../tools/insurance-rules-stubs.mjs'
import {
  diffCounts,
  editionPath,
  editionsFromParams,
  editionsToParams,
  gapCounts,
  gapsOfKind,
  liveEdition,
  publishGate,
  uploadForm,
} from './editions'

describe('the list in the address', () => {
  it('defaults to the SFDA list and keeps CHI', () => {
    expect(editionsFromParams(new URLSearchParams(''))).toEqual({ list: 'sfda' })
    expect(editionsFromParams(new URLSearchParams('list=chi'))).toEqual({ list: 'chi' })
    expect(editionsFromParams(new URLSearchParams('list=bogus'))).toEqual({ list: 'sfda' })
  })
  it('writes nothing for the default', () => {
    expect(editionsToParams({ list: 'sfda' }).toString()).toBe('')
    expect(editionsToParams({ list: 'chi' }).toString()).toBe('list=chi')
  })
  it('an edition page carries its list and id', () => {
    expect(editionPath('chi', 'ED-CHI-7')).toBe('/insurance-rules/editions/chi/ED-CHI-7')
  })
})

describe('diffCounts', () => {
  it('reads counts, or the length of rows, and totals the fires of the rules affected', () => {
    expect(diffCounts({ added: 12, dropped: 3, changed: 40, newlyUnmatched: [{ item: '100234' }, { item: '100567' }], rulesAffected: [{ ruleId: 'G-008', backtestFires: 41 }, { ruleId: 'G-009', backtestFires: 7 }] })).toEqual({
      added: 12,
      dropped: 3,
      changed: 40,
      newlyUnmatched: 2,
      rules: 2,
      fires: 48,
    })
    expect(diffCounts({ added: [{}, {}], dropped: [], changed: 0, newlyUnmatched: 5, rulesAffected: [] })).toEqual({ added: 2, dropped: 0, changed: 0, newlyUnmatched: 5, rules: 0, fires: 0 })
  })
})

describe('publishGate', () => {
  const pending = { id: 'ED-1', list: 'sfda', state: 'pending', uploadedBy: 'msartawi' } as const
  it('the uploader cannot publish, whatever the case of the id', () => {
    expect(publishGate(pending, 'msartawi')).toEqual({ can: false, why: 'uploader' })
    expect(publishGate(pending, 'MSartawi')).toEqual({ can: false, why: 'uploader' })
  })
  it('a second user publishes a pending edition', () => {
    expect(publishGate(pending, 'approver1')).toEqual({ can: true, why: null })
  })
  it('a live or retired edition is read-only', () => {
    expect(publishGate({ ...pending, state: 'live' }, 'approver1')).toEqual({ can: false, why: 'readOnly' })
    expect(publishGate({ ...pending, state: 'retired' }, 'approver1')).toEqual({ can: false, why: 'readOnly' })
  })
  it('no session yet: no publish', () => {
    expect(publishGate(pending, null)).toEqual({ can: false, why: 'uploader' })
  })
})

describe('liveEdition', () => {
  it('names the live edition of a list, or none', () => {
    expect(liveEdition(EDITIONS.filter((e) => e.list === 'sfda'))?.id).toBe('ED-SFDA-58')
    expect(liveEdition([])).toBeNull()
  })
})

describe('the gap report', () => {
  it('counts every kind, zero included', () => {
    expect(gapCounts([{ kind: 'noMatch' }, { kind: 'junk' }, { kind: 'junk' }, { kind: 'withdrawn' }] as never)).toEqual({ noMatch: 1, junk: 2, gtinMismatch: 0, withdrawn: 1 })
  })
  it('filters by kind; no kind keeps every row', () => {
    const rows = [{ kind: 'noMatch', item: 'a' }, { kind: 'junk', item: 'b' }] as never
    expect(gapsOfKind(rows, 'junk')).toEqual([{ kind: 'junk', item: 'b' }])
    expect(gapsOfKind(rows, null)).toHaveLength(2)
  })
  it('the stubbed edition has a row of every kind', () => {
    expect(Object.values(gapCounts(EDITION_GAPS['ED-SFDA-59'])).every((n) => n > 0)).toBe(true)
    expect(diffCounts(EDITION_DIFFS['ED-SFDA-59']).rules).toBeGreaterThan(0)
  })
})

describe('uploadForm', () => {
  it('sends the list and the file as the multipart parts the door names', () => {
    const file = new File(['x'], 'sfda-2026-10.xlsx')
    const form = uploadForm('chi', file)
    expect(form.get('list')).toBe('chi')
    expect((form.get('file') as File).name).toBe('sfda-2026-10.xlsx')
  })
})
