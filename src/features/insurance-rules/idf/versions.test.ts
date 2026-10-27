/**
 * Ticket 623 — a master's version history: only a version that is not live may be restored (restore never
 * overwrites, it makes a new live version); the history reads newest first.
 */
import { describe, expect, it } from 'vitest'
import { canRestore, versionRows, type IdfVersion } from './versions'

const v1: IdfVersion = { versionId: 'V-1', number: 1, by: 'falotaibi', at: '2026-10-01T09:00:00', note: 'First' }
const v2: IdfVersion = { versionId: 'V-2', number: 2, by: 'nalharbi', at: '2026-10-10T09:00:00', note: null }
const v3: IdfVersion = { versionId: 'V-3', number: 3, by: 'nalharbi', at: '2026-10-20T09:00:00', note: 'October' }

describe('only a non-live version can be restored', () => {
  it('the live version cannot, an earlier one can', () => {
    expect(canRestore(v3, 'V-3')).toBe(false)
    expect(canRestore(v1, 'V-3')).toBe(true)
  })
  it('the server marking a version live wins, even when the master names another', () => {
    expect(canRestore({ ...v2, isLive: true }, 'V-3')).toBe(false)
  })
  it('a master with no live version lets every version restore', () => {
    expect(canRestore(v1, null)).toBe(true)
  })
})

describe('the history reads newest first, the live one marked', () => {
  it('sorted by number descending, live and restorable per row', () => {
    const rows = versionRows([v1, v3, v2], 'V-3')
    expect(rows.map((r) => [r.versionId, r.live, r.restorable])).toEqual([
      ['V-3', true, false],
      ['V-2', false, true],
      ['V-1', false, true],
    ])
  })
  it('no history from the envelope is an empty list', () => {
    expect(versionRows(null, 'V-3')).toEqual([])
  })
})
