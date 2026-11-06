// The checklist picker's list logic (spec 805, ticket 806): what it shows for a query, what
// Select all shown ticks, and how picks outlive a query.
import { describe, expect, it } from 'vitest'
import { clearPicks, selectAllShown, shownOptions, togglePick, type ChecklistOption } from './checklist'

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
