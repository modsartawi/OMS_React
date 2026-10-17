import { describe, expect, it } from 'vitest'
import type { RuleCampaignListRow, RuleCampaignStatus } from '@/core/models/rule-campaign'
import { matchesSearch, stateCounts, tileFromParam, visibleRows } from './list-filter'

const row = (
  code: string,
  status: RuleCampaignStatus,
  from: string | null,
  until: string | null,
  en = code,
  ar = '',
): RuleCampaignListRow => ({
  id: code,
  code,
  name: { en, ar },
  tags: [],
  status,
  schedule: { from, until, days: [], hoursFrom: null, hoursTo: null },
  features: { coupons: false, points: true },
  created: null,
  live: null,
})

const NOW = new Date(2026, 9, 16, 18, 30)

const ROWS = [
  row('SUN-3FOR2', 'live', '2026-08-01', '2026-11-01', 'Suncare: any three', 'العناية بالشمس'),
  row('PRCB-AUG26', 'live', '2026-08-27', '2026-09-04', 'Arbahi points-back'),
  row('NATDAY-15', 'live', '2026-10-19', '2026-10-26', 'National Day 15% off'),
  row('BDAY-BEAUTY', 'waitingForApproval', null, null, 'Birthday week'),
  row('NEW-DRAFT', 'draft', null, null, 'A new draft'),
  row('OLD-COUPON', 'disabled', '2026-09-01', null, 'Old coupon'),
]

describe('stateCounts', () => {
  it('counts each campaign under the tile its local state names, and the total', () => {
    expect(stateCounts(ROWS, NOW)).toEqual({
      all: 6,
      draft: 1,
      waitingForApproval: 1,
      scheduled: 1,
      running: 1,
      expired: 1,
      disabled: 1,
    })
  })
})

describe('matchesSearch', () => {
  it('matches the English name, the Arabic name or the code, ignoring case', () => {
    expect(matchesSearch(ROWS[0], 'suncare')).toBe(true)
    expect(matchesSearch(ROWS[0], 'بالشمس')).toBe(true)
    expect(matchesSearch(ROWS[0], 'sun-3for')).toBe(true)
    expect(matchesSearch(ROWS[0], 'beauty')).toBe(false)
    expect(matchesSearch(ROWS[0], '   ')).toBe(true)
  })
})

describe('visibleRows', () => {
  it('a tile and the search narrow together', () => {
    expect(visibleRows(ROWS, 'running', '', NOW).map((r) => r.code)).toEqual(['SUN-3FOR2'])
    expect(visibleRows(ROWS, 'all', 'day', NOW).map((r) => r.code)).toEqual(['NATDAY-15', 'BDAY-BEAUTY'])
    expect(visibleRows(ROWS, 'scheduled', 'day', NOW).map((r) => r.code)).toEqual(['NATDAY-15'])
  })
})

describe('tileFromParam', () => {
  it('reads a known state, and anything else as every campaign', () => {
    expect(tileFromParam('expired')).toBe('expired')
    expect(tileFromParam('live')).toBe('all')
    expect(tileFromParam(null)).toBe('all')
  })
})
