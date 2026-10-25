/**
 * Ticket 568 — the Members tab's filters: as the URL holds them and as the Members door is asked
 * (`GET ServingListWeb/Lists/{id}/Members?city=&enabled=&duty=`). The door refuses an unlisted duty
 * with SVL-00009, so one is never sent.
 */
import { describe, expect, it } from 'vitest'
import {
  EMPTY_MEMBERS_FILTER,
  MEMBER_DUTY_OPTIONS,
  isFilteredMembers,
  membersDoorFilter,
  membersFilterFromParams,
  membersFilterToParams,
} from './members-filter'

const qs = (s: string) => new URLSearchParams(s)

describe('membersFilterFromParams — the URL read', () => {
  it('an empty address is no filter', () => {
    expect(membersFilterFromParams(qs(''))).toEqual({ city: '', enabled: '', duty: '' })
  })

  it('reads all three, trimming the city', () => {
    expect(membersFilterFromParams(qs('city=%20Riyadh%20&enabled=disabled&duty=NoRoster'))).toEqual({ city: 'Riyadh', enabled: 'disabled', duty: 'NoRoster' })
  })

  it('an unlisted duty or enabled value reads as no filter', () => {
    expect(membersFilterFromParams(qs('enabled=yes&duty=OnBreak'))).toEqual({ city: '', enabled: '', duty: '' })
    expect(membersFilterFromParams(qs('duty=onduty')).duty).toBe('')
  })
})

describe('membersFilterToParams — the URL written', () => {
  it('blanks are left out, so no filter is a bare address (Members is the default tab: no tab key)', () => {
    expect(membersFilterToParams(EMPTY_MEMBERS_FILTER).toString()).toBe('')
    expect(membersFilterToParams({ city: '  ', enabled: '', duty: '' }).toString()).toBe('')
  })

  it('writes each set filter in a fixed order', () => {
    expect(membersFilterToParams({ city: 'Al Khobar', enabled: 'enabled', duty: 'OffDuty' }).toString()).toBe('city=Al+Khobar&enabled=enabled&duty=OffDuty')
  })

  it('round-trips', () => {
    const f = { city: 'Jeddah', enabled: 'disabled', duty: 'OnDuty' } as const
    expect(membersFilterFromParams(membersFilterToParams(f))).toEqual(f)
  })
})

describe('membersDoorFilter — the door query', () => {
  it('no filter asks nothing', () => {
    expect(membersDoorFilter(EMPTY_MEMBERS_FILTER)).toEqual({ city: undefined, enabled: undefined, duty: undefined })
  })

  it('enabled maps to true / false, and city and duty pass trimmed', () => {
    expect(membersDoorFilter({ city: ' Riyadh ', enabled: 'enabled', duty: 'NoRoster' })).toEqual({ city: 'Riyadh', enabled: true, duty: 'NoRoster' })
    expect(membersDoorFilter({ city: '', enabled: 'disabled', duty: '' })).toEqual({ city: undefined, enabled: false, duty: undefined })
  })

  it('an unlisted duty is never sent (SVL-00009)', () => {
    expect(membersDoorFilter({ city: '', enabled: '', duty: 'OnBreak' as never }).duty).toBeUndefined()
  })
})

describe('the offered choices', () => {
  it('the duty filter offers exactly the three states', () => {
    expect(MEMBER_DUTY_OPTIONS).toEqual(['OnDuty', 'OffDuty', 'NoRoster'])
  })

  it('isFilteredMembers is true once any filter is set', () => {
    expect(isFilteredMembers(EMPTY_MEMBERS_FILTER)).toBe(false)
    expect(isFilteredMembers({ ...EMPTY_MEMBERS_FILTER, enabled: 'enabled' })).toBe(true)
    expect(isFilteredMembers({ ...EMPTY_MEMBERS_FILTER, city: 'x' })).toBe(true)
  })
})
