/**
 * The People tab's two rulings (BackOffice 1170), against the pure module — no
 * React, no network.
 *
 * They are the same shape and they are opposite, which is exactly why they are
 * tested together in one file: the supervisor field offers the WHOLE roster, and
 * the two assignment slots do NOT. "Tidying" the two into one filter is the change
 * these cases exist to redden.
 */
import { describe, expect, it } from 'vitest'
import {
  matchesPersonSearch,
  blankPerson,
  personFormError,
  personToBody,
  roleLabelKey,
  rosterNameOf,
  slotPeople,
  supervisorIds,
  supervisorOptions,
  type RosterPerson,
} from './people'

function person(overrides: Partial<RosterPerson> & { staffId: string }): RosterPerson {
  return {
    displayName: overrides.staffId,
    role: '',
    supervisorId: '',
    isActive: true,
    updatedBy: 'TEST',
    updatedAt: '2026-08-14T10:00:00',
    ...overrides,
  }
}

// The roster the tab maintains: one of each Role, plus the pure manager who does
// nothing for branches at all.
const ACCOUNTANT = person({ staffId: '7792', displayName: 'ضحى', role: 'ACCOUNTANT' })
const COLLECTOR = person({ staffId: '8725', displayName: 'فهد', role: 'COLLECTOR' })
const MANAGER = person({ staffId: '15493', displayName: 'مدير التحصيل', role: '' })
const ROSTER = [ACCOUNTANT, COLLECTOR, MANAGER]

describe('the supervisor field', () => {
  it('SupervisorFieldOffersTheWholeRoster — 🚩 offers the WHOLE roster, unfiltered by Role', () => {
    // Naming a supervisor for the accountant: every other person on the roster is
    // offered, whatever they do for branches.
    const offered = supervisorOptions(ROSTER, ACCOUNTANT.staffId)

    expect(offered.map((p) => p.staffId).sort()).toEqual([COLLECTOR.staffId, MANAGER.staffId].sort())

    // The three that matter, spelled out — because a Role filter here would look
    // perfectly reasonable and would silently make most of the roster unnameable.
    expect(offered).toContainEqual({ staffId: COLLECTOR.staffId, displayName: 'فهد' })
    expect(offered).toContainEqual({ staffId: MANAGER.staffId, displayName: 'مدير التحصيل' })

    // …and the reverse direction, since "supervising is not a role" has to hold
    // both ways round: an accountant may supervise a collector.
    expect(supervisorOptions(ROSTER, COLLECTOR.staffId).map((p) => p.staffId)).toContain(
      ACCOUNTANT.staffId,
    )
  })

  it('excludes only self — which is not a cycle check', () => {
    expect(supervisorOptions(ROSTER, ACCOUNTANT.staffId).map((p) => p.staffId)).not.toContain(
      ACCOUNTANT.staffId,
    )

    // A↔B is deliberately harmless: scope is ONE level, so there is no recursion to
    // protect and no cycle check anywhere in this feature. B is still offered to A
    // after A has been offered to B.
    const mutual = [
      person({ staffId: 'A', role: 'ACCOUNTANT', supervisorId: 'B' }),
      person({ staffId: 'B', role: 'COLLECTOR', supervisorId: 'A' }),
    ]
    expect(supervisorOptions(mutual, 'A').map((p) => p.staffId)).toEqual(['B'])
    expect(supervisorOptions(mutual, 'B').map((p) => p.staffId)).toEqual(['A'])

    // A brand-new person has no id yet, so nothing is excluded.
    expect(supervisorOptions(ROSTER, '').map((p) => p.staffId)).toHaveLength(ROSTER.length)
  })

  it('🔑 naming somebody is what makes them a supervisor — DISTINCT supervisorId, not a Role', () => {
    // Before: nobody names anybody, so the Served by control's Supervisors group is
    // empty and hidden. That is day one — finance's extract has blank supervisor
    // columns.
    expect(supervisorIds(ROSTER).size).toBe(0)

    // One field on one person, and the group has a member. No deploy, no second
    // hierarchy screen.
    const named = [{ ...ACCOUNTANT, supervisorId: MANAGER.staffId }, COLLECTOR, MANAGER]
    expect([...supervisorIds(named)]).toEqual([MANAGER.staffId])

    // 🔑 And somebody who both SERVES branches and supervises is in two groups: the
    // collector is still a collector, and is now also a supervisor. Two different
    // questions, so two entries and no deduplication.
    const both = [
      { ...ACCOUNTANT, supervisorId: COLLECTOR.staffId },
      COLLECTOR,
      { ...MANAGER, supervisorId: COLLECTOR.staffId },
    ]
    expect([...supervisorIds(both)]).toEqual([COLLECTOR.staffId])
    expect(slotPeople(both, 'collectorId').map((p) => p.staffId)).toEqual([COLLECTOR.staffId])
  })
})

describe('the two assignment slots', () => {
  it('AssignmentSlotsStillFilterByRole — 🚩 1170 loosens the supervisor field and nothing else', () => {
    expect(slotPeople(ROSTER, 'accountantId').map((p) => p.staffId)).toEqual([ACCOUNTANT.staffId])
    expect(slotPeople(ROSTER, 'collectorId').map((p) => p.staffId)).toEqual([COLLECTOR.staffId])

    // Neither slot offers the other's people…
    expect(slotPeople(ROSTER, 'accountantId').map((p) => p.staffId)).not.toContain(
      COLLECTOR.staffId,
    )
    expect(slotPeople(ROSTER, 'collectorId').map((p) => p.staffId)).not.toContain(
      ACCOUNTANT.staffId,
    )

    // …and NEITHER offers the pure manager, who does nothing for branches. The
    // supervisor field offers them, which is the whole distinction.
    expect(slotPeople(ROSTER, 'accountantId').map((p) => p.staffId)).not.toContain(MANAGER.staffId)
    expect(slotPeople(ROSTER, 'collectorId').map((p) => p.staffId)).not.toContain(MANAGER.staffId)
    expect(supervisorOptions(ROSTER, ACCOUNTANT.staffId).map((p) => p.staffId)).toContain(
      MANAGER.staffId,
    )

    // Being named as a supervisor does not put somebody in a slot either: the two
    // facts are independent, so a person's Role is the only thing a slot reads.
    const supervising = [{ ...MANAGER, staffId: MANAGER.staffId }, { ...ACCOUNTANT, supervisorId: MANAGER.staffId }]
    expect(slotPeople(supervising, 'accountantId').map((p) => p.staffId)).toEqual([
      ACCOUNTANT.staffId,
    ])
  })
})

describe('the roster is the one name source on this screen', () => {
  it('resolves both tabs, and echoes an id it does not know', () => {
    const nameOf = rosterNameOf(ROSTER)
    expect(nameOf('7792')).toBe('ضحى')
    // A person removed from the roster after being assigned stays a legible id
    // rather than an empty cell.
    expect(nameOf('99999')).toBe('99999')
  })

  it('searches a person by id, by name and by their supervisor', () => {
    const nameOf = rosterNameOf(ROSTER)
    const supervised = { ...ACCOUNTANT, supervisorId: MANAGER.staffId }

    expect(matchesPersonSearch(supervised, 'ضحى', nameOf)).toBe(true)
    expect(matchesPersonSearch(supervised, '7792', nameOf)).toBe(true)
    expect(matchesPersonSearch(supervised, 'مدير', nameOf)).toBe(true)
    expect(matchesPersonSearch(supervised, 'فهد', nameOf)).toBe(false)
    expect(matchesPersonSearch(supervised, '  ', nameOf)).toBe(true)
  })
})

describe('a Role reads as a caption in ONE place', () => {
  it('captions the pure manager rather than leaving the cell blank', () => {
    expect(roleLabelKey('ACCOUNTANT')).toBe('assignment.columns.accountant')
    expect(roleLabelKey('COLLECTOR')).toBe('assignment.columns.collector')
    // 🔑 Blank is the pure manager and gets a caption of its own: an empty cell
    // would read as an unfinished row, and this one is complete.
    expect(roleLabelKey('')).toBe('assignment.people.roleNone')
    expect(roleLabelKey('  accountant ')).toBe('assignment.columns.accountant')
  })
})

describe('adding somebody is not the same operation as editing them', () => {
  it('🚩 a blank form is an ADD and a loaded person is an EDIT', () => {
    // The server cannot tell the two apart, so the screen — which can, because it
    // disables the id field while editing — says which it is. A staff id typed one
    // digit wrong would otherwise silently replace the colleague who owns it, with
    // no history on that table and no other copy of the name.
    expect(blankPerson().isNew).toBe(true)
    expect(personToBody(ACCOUNTANT).isNew).toBe(false)

    // …and an edit carries the person's current values, so an untouched field is
    // re-sent as itself rather than blanked by the whole-form save.
    expect(personToBody({ ...ACCOUNTANT, supervisorId: MANAGER.staffId })).toEqual({
      staffId: ACCOUNTANT.staffId,
      displayName: 'ضحى',
      role: 'ACCOUNTANT',
      supervisorId: MANAGER.staffId,
      isActive: true,
      isNew: false,
    })
  })
})

describe('the add-person form', () => {
  it('refuses a nameless person before the round trip, because this row is the only name source', () => {
    expect(personFormError({ ...blank(), staffId: '', displayName: 'x' })).toBe('staffId')
    expect(personFormError({ ...blank(), staffId: '1', displayName: '   ' })).toBe('displayName')
    expect(personFormError({ ...blank(), staffId: '1', displayName: 'منى' })).toBeNull()
    // A blank Role passes: the pure manager is a legitimate person, not a
    // half-filled form.
    expect(personFormError({ ...blank(), staffId: '1', displayName: 'منى', role: '' })).toBeNull()
  })
})

function blank() {
  return { staffId: '', displayName: '', role: '', supervisorId: '', isActive: true, isNew: true }
}
