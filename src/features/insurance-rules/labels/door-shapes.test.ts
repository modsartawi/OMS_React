import { describe, expect, it } from 'vitest'
import { overrideOf, worklistRows } from './overrides'

describe('the doors as built', () => {
  it('reads the worklist out of its envelope, and an empty reply as no rows', () => {
    expect(worklistRows({ items: [{ tier: 'rulesetCanShow', system: 's', code: 'c', en: 'E', ar: '', censusCount: 3 }] })).toEqual([
      { system: 's', code: 'c', reason: 'lacksArabic', frequency: 3, current: { en: 'E', ar: '' } },
    ])
    expect(worklistRows(null)).toEqual([])
  })

  it('reads an override, year 1 as not stamped', () => {
    const o = overrideOf({ id: '1', system: 's', code: 'c', status: 'proposed', author: 'a', proposedAt: '2026-10-31T10:00:00', decidedBy: '', decidedAt: '0001-01-01T00:00:00' })
    expect(o.state).toBe('proposed')
    expect(o.proposedBy).toBe('a')
    expect(o.approvedAt).toBeNull()
    expect(o.approvedBy).toBeNull()
  })
})
