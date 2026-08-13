/**
 * The Collection Assignment screen's three rulings (BackOffice 1169), against the
 * pure module — no React, no network.
 *
 * The first of them is the ticket's headline and the reason the screen has a
 * `touched` set at all.
 */
import { describe, expect, it } from 'vitest'
import {
  ASSIGNMENT_LANDING,
  assignmentCounts,
  branchStatus,
  buildSaveBody,
  isDirty,
  visibleBranches,
  type AssignmentBranch,
  type NameOf,
} from './assignment'

function branch(overrides: Partial<AssignmentBranch> & { storeCode: string }): AssignmentBranch {
  return {
    storeName: '',
    city: '',
    area: '',
    accountantId: '',
    collectorId: '',
    updatedBy: '',
    updatedAt: '0001-01-01T00:00:00',
    ...overrides,
  }
}

// The roster the two dropdowns are built from — the ONLY place these people's
// names live, which is why the search takes a resolver rather than reading a
// column.
const ROSTER: Record<string, string> = {
  '4466': 'عادل',
  '8725': 'فهد',
  '6420': 'سلمان',
}
const nameOf: NameOf = (id) => ROSTER[id] ?? id

describe('a touched row and the filter that found it', () => {
  it('🔑 stays visible when the edit makes it stop matching — and leaves once saved', () => {
    // The screen as finance actually works it: filtered to *With a gap*, which is
    // how the 1255 unserved branches get closed.
    const gapFilter = { status: 'gap' as const, search: '' }

    const gap = branch({ storeCode: 'P075' })
    const served = branch({ storeCode: 'P076', accountantId: '4466', collectorId: '8725' })

    // Before the edit: only the branch with a gap is on screen.
    expect(visibleBranches([gap, served], gapFilter, nameOf).map((b) => b.storeCode)).toEqual([
      'P075',
    ])

    // The administrator fills both slots in. The row NO LONGER MATCHES the filter
    // that found it — and the edit is not saved yet.
    const filled = { ...gap, accountantId: '4466', collectorId: '8725' }
    const touched = new Set(['P075'])

    expect(
      visibleBranches([filled, served], gapFilter, nameOf, touched).map((b) => b.storeCode),
    ).toEqual([
      // 🚩 If this list were empty, the row would have vanished out from under the
      // cursor with the work unsaved — which is exactly what building the
      // prototype at 1394 rows found, and what this rule exists to prevent.
      'P075',
    ])

    // ⚠️ And it is about being UNSAVED, not about having been looked at: once the
    // server has the change, the row leaves the filter it no longer matches. That
    // is the screen reporting progress on the gap, and nothing is at risk by then.
    expect(
      visibleBranches([filled, served], gapFilter, nameOf, new Set()).map((b) => b.storeCode),
    ).toEqual([])

    // It does not jump to the top either — a row moving while it is being edited
    // is the same disorientation in a smaller dose.
    const many = [served, filled, branch({ storeCode: 'P077' })]
    expect(visibleBranches(many, gapFilter, nameOf, touched).map((b) => b.storeCode)).toEqual([
      'P075',
      'P077',
    ])
  })

  it('holds a touched row through the SEARCH box too, not only the status filter', () => {
    // The same trap by the other route: searching for a person's name and then
    // assigning the branch to somebody else.
    const searchFahd = { status: 'all' as const, search: 'فهد' }
    const row = branch({ storeCode: 'P080', collectorId: '8725' })

    expect(visibleBranches([row], searchFahd, nameOf).map((b) => b.storeCode)).toEqual(['P080'])

    const reassigned = { ...row, collectorId: '6420' }
    expect(visibleBranches([reassigned], searchFahd, nameOf).map((b) => b.storeCode)).toEqual([])
    expect(
      visibleBranches([reassigned], searchFahd, nameOf, new Set(['P080'])).map((b) => b.storeCode),
    ).toEqual(['P080'])
  })

  it('opens on the whole estate — the one screen here that is NOT default-to-mine', () => {
    const rows = [
      branch({ storeCode: 'P075' }),
      branch({ storeCode: 'P076', accountantId: '4466', collectorId: '8725' }),
    ]

    expect(visibleBranches(rows, ASSIGNMENT_LANDING, nameOf)).toHaveLength(2)
  })
})

describe('the status column', () => {
  it('🚩 names NO ACCOUNTANT and NO COLLECTOR separately, not one "incomplete"', () => {
    // Half assigned is 0 on today's seed only because the seed fills both slots
    // together — and this screen writes each slot on its own, so both halves are
    // reachable the first afternoon somebody uses it.
    expect(branchStatus(branch({ storeCode: 'A', accountantId: '4466', collectorId: '8725' })))
      .toBe('assigned')
    expect(branchStatus(branch({ storeCode: 'B', accountantId: '4466' }))).toBe('noCollector')
    expect(branchStatus(branch({ storeCode: 'C', collectorId: '8725' }))).toBe('noAccountant')
    expect(branchStatus(branch({ storeCode: 'D' }))).toBe('nobody')

    // The two halves are DIFFERENT answers — a status column collapsing them
    // would pass every other assertion in this file.
    expect(branchStatus(branch({ storeCode: 'B', accountantId: '4466' }))).not.toBe(
      branchStatus(branch({ storeCode: 'C', collectorId: '8725' })),
    )

    // A whitespace-only slot is nobody: the column is NOT NULL DEFAULT '' and the
    // server compares with `<> ''`, which SQL Server's padding makes true here too.
    expect(branchStatus(branch({ storeCode: 'E', accountantId: '   ' }))).toBe('nobody')
  })

  it('filters by each state on its own, and by "with a gap" over all three', () => {
    const rows = [
      branch({ storeCode: 'A', accountantId: '4466', collectorId: '8725' }),
      branch({ storeCode: 'B', accountantId: '4466' }),
      branch({ storeCode: 'C', collectorId: '8725' }),
      branch({ storeCode: 'D' }),
    ]

    const codes = (status: 'all' | 'gap' | 'assigned' | 'noAccountant' | 'noCollector') =>
      visibleBranches(rows, { status, search: '' }, nameOf).map((b) => b.storeCode)

    expect(codes('all')).toEqual(['A', 'B', 'C', 'D'])
    expect(codes('assigned')).toEqual(['A'])
    expect(codes('noCollector')).toEqual(['B'])
    expect(codes('noAccountant')).toEqual(['C'])
    expect(codes('gap')).toEqual(['B', 'C', 'D'])
  })

  it('counts the three states, so the size of the gap is visible unfiltered', () => {
    const rows = [
      branch({ storeCode: 'A', accountantId: '4466', collectorId: '8725' }),
      branch({ storeCode: 'B', accountantId: '4466' }),
      branch({ storeCode: 'C' }),
      branch({ storeCode: 'D' }),
    ]

    expect(assignmentCounts(rows)).toEqual({ total: 4, assigned: 1, half: 1, nobody: 2 })
  })
})

describe('the store search', () => {
  const rows = [
    branch({
      storeCode: 'P075',
      storeName: 'صيدلية الدواء 1000',
      city: 'الخبر',
      area: 'الكورنيش',
      accountantId: '4466',
      collectorId: '8725',
    }),
    branch({ storeCode: 'P076', storeName: 'صيدلية جدة', city: 'جدة', area: 'الروضة' }),
  ]

  const found = (search: string) =>
    visibleBranches(rows, { status: 'all', search }, nameOf).map((b) => b.storeCode)

  it('🚩 spans code, Arabic name, city, area AND the two assigned people', () => {
    // At 1394 branches finance says "الخبر" — 74 of them — far more often than
    // "P075", and *"what is فهد carrying?"* has to be answerable here.
    expect(found('P075')).toEqual(['P075'])
    expect(found('الدواء')).toEqual(['P075'])
    expect(found('الخبر')).toEqual(['P075'])
    expect(found('الكورنيش')).toEqual(['P075'])
    expect(found('عادل')).toEqual(['P075']) // the accountant, BY NAME
    expect(found('فهد')).toEqual(['P075']) // the collector, BY NAME

    // The names are resolved through the DROPDOWNS' roster — there are no name
    // columns on the row, so a search that only read the payload's own fields
    // would find neither of the last two.
    expect(found('8725')).toEqual(['P075']) // …and the raw id still works
  })

  it('is case-insensitive over the Latin half, and substring throughout', () => {
    expect(found('p07')).toEqual(['P075', 'P076'])
    expect(found('صيدلية')).toEqual(['P075', 'P076'])
    expect(found('  ')).toEqual(['P075', 'P076'])
    expect(found('nothing here')).toEqual([])
  })
})

describe('the per-row save body', () => {
  it('sends only the slot that CHANGED, and carries no actor', () => {
    const original = branch({ storeCode: 'P075', accountantId: '4466' })

    // Filling the missing collector must not re-send the accountant: an absent
    // slot means "leave it alone", so a full body could overwrite a change
    // somebody else made between the page load and this save.
    expect(buildSaveBody(original, { ...original, collectorId: '8725' })).toEqual({
      storeCode: 'P075',
      collectorId: '8725',
    })

    // Clearing IS a change, and travels as a blank — the dropdown's *nobody*.
    expect(buildSaveBody(original, { ...original, accountantId: '' })).toEqual({
      storeCode: 'P075',
      accountantId: '',
    })

    expect(buildSaveBody(original, { ...original, accountantId: '6420', collectorId: '8725' })).toEqual(
      { storeCode: 'P075', accountantId: '6420', collectorId: '8725' },
    )

    // 🔑 No actor field, ever: attribution is stamped server-side from the cookie
    // session, and a body field would let the browser name somebody else.
    const body = buildSaveBody(original, { ...original, collectorId: '8725' })
    expect(Object.keys(body)).toEqual(['storeCode', 'collectorId'])
  })

  it('knows an untouched row from a changed one', () => {
    const original = branch({ storeCode: 'P075', accountantId: '4466' })

    expect(isDirty(original, { ...original })).toBe(false)
    expect(isDirty(original, { ...original, collectorId: '8725' })).toBe(true)
    // A save that changes neither slot is refused by the server (it would only
    // re-stamp who touched the branch last), so the screen never sends one.
  })
})
