// The checklist picker's list logic (spec 805, ticket 806): what it shows for a query, what
// Select all shown ticks, and how picks outlive a query.
import { describe, expect, it } from 'vitest'
import {
  chipsFor,
  clearPicks,
  markDisabled,
  rememberOptions,
  selectAllShown,
  shownOptions,
  togglePick,
  type ChecklistOption,
} from './checklist'

const ROLES: ChecklistOption[] = [
  { value: 'PHARM_LEAD', label: 'PHARM_LEAD', description: 'Leads a branch pharmacy' },
  { value: 'PHARM_TECH', label: 'PHARM_TECH', description: 'Pharmacy technician' },
  { value: 'CC_AGENT', label: 'CC_AGENT', description: 'Call centre agent' },
  { value: 'DISPENSER', label: 'DISPENSER', description: 'Dispenses at the pharmacy counter' },
  { value: 'PHARM_AUDIT', label: 'PHARM_AUDIT', description: 'Audits', disabled: true, note: 'Already holds' },
  { value: 'OMS_VIEWER', label: 'OMS_VIEWER', description: 'Reads OMS' },
]
const values = (os: ChecklistOption[]) => os.map((o) => o.value)

describe('checklist picker list', () => {
  it('picker narrows by name and description; select-all ticks only shown, enabled rows; picks survive a new query; clear empties', () => {
    // Narrowing: case-insensitive, over the name AND the description.
    expect(values(shownOptions(ROLES, 'pharm'))).toEqual([
      'PHARM_LEAD',
      'PHARM_TECH',
      'DISPENSER', // by its description
      'PHARM_AUDIT',
    ])
    expect(values(shownOptions(ROLES, '  '))).toEqual(values(ROLES))
    expect(shownOptions(ROLES, 'zzz')).toEqual([])

    // Exclusion: a value the target already holds is never shown.
    expect(values(shownOptions(ROLES, 'pharm', { exclude: ['PHARM_TECH'] }))).toEqual([
      'PHARM_LEAD',
      'DISPENSER',
      'PHARM_AUDIT',
    ])

    // Server mode: the caller already narrowed, the list is drawn as given (exclusion still applies).
    expect(values(shownOptions(ROLES, 'pharm', { narrow: false, exclude: ['CC_AGENT'] }))).toEqual([
      'PHARM_LEAD',
      'PHARM_TECH',
      'DISPENSER',
      'PHARM_AUDIT',
      'OMS_VIEWER',
    ])

    // Select all shown: only the shown, enabled rows; an earlier pick is kept and not doubled.
    let picks = togglePick([], 'OMS_VIEWER')
    picks = selectAllShown(picks, shownOptions(ROLES, 'pharm'))
    expect(picks).toEqual(['OMS_VIEWER', 'PHARM_LEAD', 'PHARM_TECH', 'DISPENSER'])
    expect(selectAllShown(picks, shownOptions(ROLES, 'pharm'))).toEqual(picks)

    // A new query shows other rows; the picks are untouched, and a tick appends.
    expect(values(shownOptions(ROLES, 'agent'))).toEqual(['CC_AGENT'])
    picks = togglePick(picks, 'CC_AGENT')
    expect(picks).toEqual(['OMS_VIEWER', 'PHARM_LEAD', 'PHARM_TECH', 'DISPENSER', 'CC_AGENT'])
    // An untick takes the value out, wherever it is.
    expect(togglePick(picks, 'PHARM_TECH')).toEqual(['OMS_VIEWER', 'PHARM_LEAD', 'DISPENSER', 'CC_AGENT'])
    // A disabled row cannot be ticked.
    expect(togglePick(picks, 'PHARM_AUDIT', ROLES)).toEqual(picks)

    // Clear empties every pick, shown or not.
    expect(clearPicks()).toEqual([])
  })
})

// Server mode (ticket 807, Add holders): each search term brings a new result set from the server.
describe('checklist picker in server mode', () => {
  const AHMED: ChecklistOption[] = [
    { value: '10001', label: 'Ahmed Ali' },
    { value: '10002', label: 'Ahmed Saleh', tag: 'Inactive' },
    { value: '10003', label: 'Ahmed Omar' },
  ]
  const KHALID: ChecklistOption[] = [
    { value: '20001', label: 'Khalid Nasser' },
    { value: '10003', label: 'Ahmed Omar Khalid' },
  ]

  it('picker keeps picks across a server query change and disables already-held rows', () => {
    // Current holders are shown greyed with the note, not left out.
    const first = markDisabled(AHMED, ['10003'], 'Already holds')
    expect(first.map((o) => [o.value, !!o.disabled, o.note ?? null])).toEqual([
      ['10001', false, null],
      ['10002', false, null],
      ['10003', true, 'Already holds'],
    ])
    // The inactive tag survives, and the input is not mutated.
    expect(first[1].tag).toBe('Inactive')
    expect(AHMED[2].disabled).toBeUndefined()

    // Select all shown ticks the enabled rows only (the inactive person is pickable); a held row's tick is refused.
    let picks = selectAllShown([], shownOptions(first, 'ahmed', { narrow: false }))
    expect(picks).toEqual(['10001', '10002'])
    expect(togglePick(picks, '10003', first)).toEqual(['10001', '10002'])

    // Each result set is remembered so a pick off the current page still has its name.
    let known = rememberOptions(new Map(), first)

    // A new term: a new result set; the picks are untouched and a tick appends.
    const second = markDisabled(KHALID, ['10003'], 'Already holds')
    known = rememberOptions(known, second)
    expect(shownOptions(second, 'khalid', { narrow: false }).map((o) => o.value)).toEqual(['20001', '10003'])
    picks = togglePick(picks, '20001', second)
    expect(picks).toEqual(['10001', '10002', '20001'])

    // The chips: one per pick, in pick order, named from whichever result set held them.
    expect(chipsFor(picks, known).map((o) => o.label)).toEqual(['Ahmed Ali', 'Ahmed Saleh', 'Khalid Nasser'])
    // A pick never seen in a result set is chipped by its value, drawn as a machine value.
    expect(chipsFor(['99999'], known)).toEqual([{ value: '99999', label: '99999', machine: true }])
    // A chip is never disabled (a removable pick), even when the row it came from was.
    expect(chipsFor(['10003'], known)[0].disabled).toBeFalsy()
  })
})
