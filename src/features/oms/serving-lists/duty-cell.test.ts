/**
 * Ticket 568 — a member's duty today, as the Members grid's duty column shows it (BackOffice spec 3042,
 * 3046 duty semantics). Pure: keys and values, never words.
 */
import { describe, expect, it } from 'vitest'
import type { ServingListMemberShift } from '@/core/models/serving-list'
import { dutyCell } from './duty-cell'

const shift = (open: string, close: string, overnight = false): ServingListMemberShift => ({ open, close, overnight })

describe('dutyCell — each state reads its own label', () => {
  it('OnDuty reads "On duty now" with today\'s hours', () => {
    expect(dutyCell({ duty: 'OnDuty', todayShifts: [shift('09:00', '17:00')] })).toEqual({
      state: 'onDuty',
      labelKey: 'duty.onDuty',
      raw: 'OnDuty',
      sev: 'ok',
      hours: [{ range: '09:00–17:00', overnight: false }],
    })
  })

  it('OffDuty with shifts reads "Off duty now" with today\'s hours, muted', () => {
    const v = dutyCell({ duty: 'OffDuty', todayShifts: [shift('16:00', '23:00')] })
    expect([v.state, v.labelKey, v.sev, v.hours]).toEqual(['offDuty', 'duty.offDuty', 'mute', [{ range: '16:00–23:00', overnight: false }]])
  })

  it('OffDuty with no shift today reads "Closed today"', () => {
    const v = dutyCell({ duty: 'OffDuty', todayShifts: [] })
    expect([v.state, v.labelKey, v.sev, v.hours]).toEqual(['closedToday', 'duty.closedToday', 'mute', []])
  })

  it('NoRoster reads "No roster" as a warning, with no hours', () => {
    const v = dutyCell({ duty: 'NoRoster', todayShifts: [] })
    expect([v.state, v.labelKey, v.sev, v.hours]).toEqual(['noRoster', 'duty.noRoster', 'warn', []])
  })

  it('an unknown state still renders: its raw value, muted, with its hours', () => {
    expect(dutyCell({ duty: 'OnBreak', todayShifts: [shift('10:00', '12:00')] })).toEqual({
      state: 'unknown',
      labelKey: null,
      raw: 'OnBreak',
      sev: 'mute',
      hours: [{ range: '10:00–12:00', overnight: false }],
    })
  })
})

describe('dutyCell — today\'s hours from todayShifts', () => {
  it('two shifts, in the door\'s order', () => {
    expect(dutyCell({ duty: 'OnDuty', todayShifts: [shift('08:00', '12:00'), shift('16:00', '22:00')] }).hours).toEqual([
      { range: '08:00–12:00', overnight: false },
      { range: '16:00–22:00', overnight: false },
    ])
  })

  it('an overnight shift keeps its close and is marked next morning', () => {
    expect(dutyCell({ duty: 'OnDuty', todayShifts: [shift('18:00', '02:00', true)] }).hours).toEqual([{ range: '18:00–02:00', overnight: true }])
  })
})
