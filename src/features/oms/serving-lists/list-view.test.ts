/**
 * Ticket 567 — the Serving lists grid's row view: the members label, the pointing-type chips, and the
 * flag on a list whose competed deliveries record `ServingListInactive`.
 */
import { describe, expect, it } from 'vitest'
import type { ServingListMemberRow, ServingListChangeRow, ServingListRow } from '@/core/models/serving-list'
import { isServingListChangeAction, isServingListDutyState } from '@/core/models/serving-list'
import { listFlag, membersLabel, pointingChips } from './list-view'

const row = (over: Partial<ServingListRow> = {}): ServingListRow => ({
  servingListId: 'SVL-1',
  nameEn: 'Riyadh north',
  nameAr: 'شمال الرياض',
  isActive: true,
  memberCount: 12,
  enabledMemberCount: 9,
  pointingTypes: [],
  createdAt: '2026-10-20T09:00:00',
  createdBy: 'msartawi',
  updatedAt: '2026-10-24T14:30:00',
  updatedBy: 'amal',
  warning: null,
  ...over,
})
const QC = { documentType: 'QC', description: 'Quick commerce', isCompeted: true }
const HD = { documentType: 'HD', description: 'Home delivery', isCompeted: false }

describe('the members label', () => {
  it('reads enabled of all members, as one n / m string', () => {
    expect(membersLabel(row())).toBe('9 / 12')
  })
  it('an empty list reads 0 / 0', () => {
    expect(membersLabel(row({ memberCount: 0, enabledMemberCount: 0 }))).toBe('0 / 0')
  })
})

describe('the pointing-type chips', () => {
  it('one chip per type, in the door order, the description as its tooltip and competed marked', () => {
    expect(pointingChips(row({ pointingTypes: [HD, QC] }))).toEqual([
      { code: 'HD', tooltip: 'Home delivery', competed: false },
      { code: 'QC', tooltip: 'Quick commerce', competed: true },
    ])
  })
  it('a blank description falls back to the code', () => {
    expect(pointingChips(row({ pointingTypes: [{ documentType: 'XX', description: '', isCompeted: false }] }))[0].tooltip).toBe('XX')
  })
  it('no pointing type, no chip', () => {
    expect(pointingChips(row())).toEqual([])
  })
})

describe('the list flag', () => {
  it('🚩 an active list with a competed pointer and no enabled member is flagged', () => {
    expect(listFlag(row({ pointingTypes: [QC], memberCount: 3, enabledMemberCount: 0 }))).toBe('noEnabledMember')
    expect(listFlag(row({ pointingTypes: [HD, QC], memberCount: 0, enabledMemberCount: 0 }))).toBe('noEnabledMember')
  })
  it('a competed pointer with an enabled member is not flagged', () => {
    expect(listFlag(row({ pointingTypes: [QC] }))).toBeNull()
  })
  it('only non-competed pointers and no enabled member: just empty, not the flag', () => {
    expect(listFlag(row({ pointingTypes: [HD], memberCount: 0, enabledMemberCount: 0 }))).toBe('empty')
  })
  it('an empty list nothing competes on reads empty', () => {
    expect(listFlag(row({ memberCount: 0, enabledMemberCount: 0 }))).toBe('empty')
  })
  it('a deactivated list a competed type still points at is flagged as such', () => {
    expect(listFlag(row({ isActive: false, pointingTypes: [QC] }))).toBe('deactivatedCompeted')
    expect(listFlag(row({ isActive: false, pointingTypes: [QC], memberCount: 0, enabledMemberCount: 0 }))).toBe('deactivatedCompeted')
  })
  it('a deactivated list with no competed pointer is not flagged', () => {
    expect(listFlag(row({ isActive: false, pointingTypes: [HD] }))).toBeNull()
  })
})

describe('an unlisted value still parses', () => {
  it('a duty state the server adds later is a string the union accepts, and is not a known state', () => {
    const member = JSON.parse(
      '{"storeCode":"P014","storeName":"Olaya","city":"Riyadh","storeClosed":false,"isEnabled":true,"addedAt":"2026-10-20T09:00:00","addedBy":"a","updatedAt":"2026-10-20T09:00:00","updatedBy":"a","duty":"OnBreak","onDutyNow":false,"todayShifts":[]}',
    ) as ServingListMemberRow
    expect(member.duty).toBe('OnBreak')
    expect(isServingListDutyState(member.duty)).toBe(false)
    expect(['OnDuty', 'OffDuty', 'NoRoster'].map(isServingListDutyState)).toEqual([true, true, true])
  })
  it('a change action the server adds later is a string the union accepts, and is not a known action', () => {
    const change = { action: 'MergeLists' } as ServingListChangeRow
    expect(isServingListChangeAction(change.action)).toBe(false)
    expect(
      ['Create', 'Rename', 'Deactivate', 'Reactivate', 'AddStore', 'RemoveStore', 'EnableStore', 'DisableStore'].every(isServingListChangeAction),
    ).toBe(true)
  })
})
