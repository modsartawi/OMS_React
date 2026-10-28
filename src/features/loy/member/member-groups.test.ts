/**
 * `member-groups` — ticket 635's pure Proof bullet: whether the member header
 * shows a groups row at all, and what each chip says.
 *
 * 🚩 Absent or `[]` without the view grant is "not shown", never "in no group"
 * (brief 3173, Lookup 3176). Only present-and-empty UNDER the grant says none.
 */
import { describe, expect, it } from 'vitest'
import type { LoyGroup } from '@/core/models/loy-groups'
import { memberGroups } from './member-groups'

const group = (code: string, nameEn: string, nameAr: string): LoyGroup => ({
  groupId: code.toLowerCase(),
  code,
  nameEn,
  nameAr,
  isActive: true,
  mobileCount: 0,
  liveBonusBuys: [],
})

const LIST = [group('VIP', 'Ramadan VIP', 'كبار رمضان ٢'), group('STAFF', 'Staff', '')]

describe('member group chips: absent hides, empty under grant says none, codes resolve to names', () => {
  it('hides the row when the field is absent, even under the grant', () => {
    expect(memberGroups(undefined, true, LIST, 'en')).toEqual({ show: false })
  })

  it('hides the row without the grant, whether the field is absent, empty or filled', () => {
    expect(memberGroups(undefined, false, LIST, 'en')).toEqual({ show: false })
    expect(memberGroups([], false, LIST, 'en')).toEqual({ show: false })
    expect(memberGroups(['VIP'], false, LIST, 'en')).toEqual({ show: false })
  })

  it('says "in no group" only for present-and-empty under the grant', () => {
    expect(memberGroups([], true, LIST, 'en')).toEqual({ show: true, chips: [] })
  })

  it('names each code from the groups list, keeping the server order', () => {
    expect(memberGroups(['STAFF', 'VIP'], true, LIST, 'en')).toEqual({
      show: true,
      chips: [
        { code: 'STAFF', name: 'Staff' },
        { code: 'VIP', name: 'Ramadan VIP' },
      ],
    })
  })

  it('reads the Arabic name as stored under Arabic', () => {
    expect(memberGroups(['VIP'], true, LIST, 'ar')).toEqual({
      show: true,
      chips: [{ code: 'VIP', name: 'كبار رمضان ٢' }],
    })
  })

  it('shows a code missing from the list (or a list not loaded yet) as its code', () => {
    expect(memberGroups(['GONE'], true, LIST, 'en')).toEqual({ show: true, chips: [{ code: 'GONE', name: 'GONE' }] })
    expect(memberGroups(['VIP'], true, undefined, 'en')).toEqual({ show: true, chips: [{ code: 'VIP', name: 'VIP' }] })
  })

  it('shows a listed group whose names are both blank as its code', () => {
    const blank = [group('NONAME', ' ', '')]
    expect(memberGroups(['NONAME'], true, blank, 'en')).toEqual({
      show: true,
      chips: [{ code: 'NONAME', name: 'NONAME' }],
    })
  })
})

// Review fix 8: codes match case-insensitively, as the picker's selection does.
describe('member group codes match the list case-insensitively', () => {
  it('names a lower-case code from an upper-case list entry, keeping the code as sent', () => {
    expect(memberGroups(['vip'], true, LIST, 'en')).toEqual({ show: true, chips: [{ code: 'vip', name: 'Ramadan VIP' }] })
    expect(memberGroups(['STAFF'], true, [group('staff', 'Staff', '')], 'en')).toEqual({ show: true, chips: [{ code: 'STAFF', name: 'Staff' }] })
  })
})
