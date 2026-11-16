/**
 * BackOffice ticket 3983 (spec 3972; map 3960 ticket 3971) — a TCS or GIG workbook's code column pasted over a whole
 * item list says, before submit, against the LIVE version of the list: how many codes it adds, how many it takes
 * out, and how many no item of the master has (they would never match). HQ counts
 * (`POST InsuranceRules/Lists/PasteCounts`); the editor shows all three, a zero included.
 */
import { describe, expect, it } from 'vitest'
import { pasteCountLines, pasteCountsOf } from './paste-counts'

describe('pasteCountLines', () => {
  it('shows the three counts before submit — added, removed, not in the master', () => {
    const counts = pasteCountsOf({
      added: 2,
      removed: 1,
      notInMaster: 1,
      addedCodes: ['T-N', 'T-Z'],
      removedCodes: ['T-OLD'],
      notInMasterCodes: ['T-Z'],
    })
    expect(pasteCountLines(counts)).toEqual([
      { kind: 'added', count: 2 },
      { kind: 'removed', count: 1 },
      { kind: 'notInMaster', count: 1 },
    ])
    expect(counts.notInMasterCodes).toEqual(['T-Z'])
  })

  it('the 1,611 TCS codes over an empty list: 1,611 added, 0 removed, 0 not in the master — the zeros shown', () => {
    expect(pasteCountLines(pasteCountsOf({ added: 1611, removed: 0, notInMaster: 0 }))).toEqual([
      { kind: 'added', count: 1611 },
      { kind: 'removed', count: 0 },
      { kind: 'notInMaster', count: 0 },
    ])
  })

  it('reads a missing reply as nothing counted, never a crash', () => {
    const counts = pasteCountsOf(null)
    expect(pasteCountLines(counts).map((l) => l.count)).toEqual([0, 0, 0])
    expect(counts.notInMasterCodes).toEqual([])
  })
})
