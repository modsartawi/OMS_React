/**
 * The Collection Assignment screen's three bulk flows (BackOffice 1171), against the
 * pure module — no React, no network.
 *
 * The two rulings under test are the ticket's own: every flow ends at ONE
 * confirmation carrying BOTH numbers, and rows a bulk apply changed stay visible
 * even when they stop matching the filter that selected them.
 */
import { describe, expect, it } from 'vitest'
import {
  applyBulkResult,
  bulkPins,
  buildBulkBody,
  buildConfirmation,
  isApplicable,
  keepVisible,
  pageCodes,
  parsePastedCodes,
  selectionFromFilter,
  selectionFromPaste,
  selectionFromTicks,
  type BulkPreview,
  type BulkResult,
} from './bulk'
import { visibleBranches, type AssignmentBranch, type NameOf } from './assignment'

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

const nameOf: NameOf = (staffId) => ({ '8725': 'فهد', '4466': 'عادل' })[staffId] ?? staffId

// A city: three branches in الخبر, one of which already has a collector, plus one
// branch somewhere else entirely.
const ESTATE: AssignmentBranch[] = [
  branch({ storeCode: 'P075', city: 'الخبر', storeName: 'فرع الكورنيش' }),
  branch({ storeCode: 'P076', city: 'الخبر', storeName: 'فرع العقربية' }),
  branch({
    storeCode: 'P077',
    city: 'الخبر',
    storeName: 'فرع الثقبة',
    accountantId: '4466',
    collectorId: '8725',
  }),
  branch({ storeCode: 'P900', city: 'جدة', storeName: 'فرع الروضة' }),
]

const preview = (over: Partial<BulkPreview> = {}): BulkPreview => ({
  targeted: 3,
  alreadyServed: 1,
  unknownStoreCodes: [],
  ...over,
})

describe('every flow ends at the same confirmation', () => {
  // 🔑 THE HEADLINE. Three gestures, one dialog, and it always states BOTH numbers.
  // "3 branches" alone is what an administrator agrees to without reading; "3
  // branches, 1 of which already has somebody" is what stops them rewriting a
  // pairing finance decided.
  it('carries both numbers whichever gesture produced the selection', () => {
    const fromFilter = selectionFromFilter(ESTATE, { status: 'all', search: 'الخبر' }, nameOf)
    const fromTicks = selectionFromTicks(['P075', 'P076', 'P077'])
    const fromPaste = selectionFromPaste('P075\nP076\nP077')

    expect(fromFilter.storeCodes).toEqual(['P075', 'P076', 'P077'])
    expect(fromTicks.storeCodes).toEqual(['P075', 'P076', 'P077'])
    expect(fromPaste.storeCodes).toEqual(['P075', 'P076', 'P077'])

    const confirmations = [fromFilter, fromTicks, fromPaste].map((selection) =>
      buildConfirmation(selection, 'collectorId', '4466', preview()),
    )

    for (const confirmation of confirmations) {
      expect(confirmation.targeted).toBe(3)
      expect(confirmation.alreadyServed).toBe(1)
      expect(confirmation.slot).toBe('collectorId')
      expect(confirmation.staffId).toBe('4466')
      expect(isApplicable(confirmation)).toBe(true)
    }

    // The three dialogs differ in ONE field — which gesture the user made — and in
    // nothing that governs the write.
    expect(confirmations.map((c) => c.flow)).toEqual(['filter', 'ticked', 'pasted'])
    for (const c of confirmations) {
      expect({ ...c, flow: 'filter' }).toEqual({ ...confirmations[0], flow: 'filter' })
    }
  })

  // 🚩 The already-served count is the SERVER's, and this module only carries it.
  // Anything the client could compute would be a page-load snapshot on the tick
  // flow — and on the paste flow, a set the grid may never have shown at all.
  it('takes both numbers from the preview rather than from the rows on screen', () => {
    // A paste naming a branch this client has never heard of: the client holds four
    // rows and could not have counted three targeted, let alone two already served.
    const selection = selectionFromPaste('P075, P076, P999')
    const confirmation = buildConfirmation(
      selection,
      'accountantId',
      '4466',
      preview({ targeted: 3, alreadyServed: 2, unknownStoreCodes: ['P999'] }),
    )

    expect(confirmation.targeted).toBe(3)
    expect(confirmation.alreadyServed).toBe(2)
    // ⚠️ Unknown codes are NAMED, never silently dropped — a typo in a list arriving
    // by email must be visible, or the branch it was meant for stays unserved with
    // nothing on screen saying so.
    expect(confirmation.unknown).toEqual(['P999'])
  })

  it('sends exactly one slot, and the same body to the preview and the apply', () => {
    const selection = selectionFromTicks(['P075', 'P076'])

    // Applying to the collector slot carries NO accountantId at all — over a city
    // just as over a row, the untouched slot is left exactly as finance set it.
    expect(buildBulkBody(selection, 'collectorId', '4466')).toEqual({
      storeCodes: ['P075', 'P076'],
      collectorId: '4466',
    })
    expect(buildBulkBody(selection, 'accountantId', '')).toEqual({
      storeCodes: ['P075', 'P076'],
      accountantId: '',
    })
  })

  it('cleans a pasted list the way a pasted list actually arrives', () => {
    // Newlines, commas, tabs, a trailing blank line, a duplicate, and stray spaces.
    expect(parsePastedCodes(' P075,P076\tP077\n\nP075 \n')).toEqual(['P075', 'P076', 'P077'])
    expect(parsePastedCodes('')).toEqual([])
  })

  it('refuses to open a dialog over a selection that resolved to nothing', () => {
    const confirmation = buildConfirmation(
      selectionFromPaste('P999'),
      'collectorId',
      '4466',
      preview({ targeted: 0, alreadyServed: 0, unknownStoreCodes: ['P999'] }),
    )

    expect(isApplicable(confirmation)).toBe(false)
    // …and the typo is still named, which is the whole answer in that case.
    expect(confirmation.unknown).toEqual(['P999'])
  })

  it('takes the whole filtered set, not the page the grid drew', () => {
    // The filter-then-apply flow is built from the filter over the WHOLE payload.
    // Taking the rows on the page would assign a fiftieth of what the button says.
    const gapOnly = selectionFromFilter(ESTATE, { status: 'gap', search: '' }, nameOf)
    expect(gapOnly.storeCodes).toEqual(['P075', 'P076', 'P900'])
  })
})

describe('rows a bulk apply changed stay visible', () => {
  const result: BulkResult = {
    appliedStoreCodes: ['P075', 'P076'],
    applied: 2,
    alreadyServed: 0,
    unknownStoreCodes: [],
    updatedBy: 'FINADMIN',
    updatedAt: '2026-08-14T11:00:00',
  }

  // 🔑 1169's touched-row rule at SET SCALE. Filter to *With a gap*, assign a
  // collector to the whole city, and every row just filled stops matching the filter
  // that selected it — the grid empties in one frame and the only evidence the work
  // happened is a number in a toast.
  it('keeps them on screen when the apply makes them stop matching the filter', () => {
    // Two branches with an accountant and no collector — *half assigned*, which is
    // the state finance actually works from — and one that is already complete.
    const rows = [
      branch({ storeCode: 'P075', city: 'الخبر', accountantId: '8725' }),
      branch({ storeCode: 'P076', city: 'الخبر', accountantId: '8725' }),
      branch({ storeCode: 'P077', city: 'الخبر', accountantId: '4466', collectorId: '8725' }),
    ]
    const gap = { status: 'gap', search: '' } as const

    // Before: the two unserved branches are what *With a gap* shows.
    expect(visibleBranches(rows, gap, nameOf).map((r) => r.storeCode)).toEqual(['P075', 'P076'])

    const settled = applyBulkResult(rows, result, 'collectorId', '4466')

    // They now have a collector, so they no longer match…
    expect(visibleBranches(settled, gap, nameOf).map((r) => r.storeCode)).toEqual([])

    // …and the pin is what keeps them there.
    const pins = bulkPins(result)
    expect(visibleBranches(settled, gap, nameOf, pins).map((r) => r.storeCode)).toEqual([
      'P075',
      'P076',
    ])

    // ⚠️ The pin is a SEPARATE set from the unsaved edits, and `visibleBranches`
    // takes one — so the screen unions them rather than choosing.
    const edits = new Set(['P077'])
    expect(
      visibleBranches(settled, { status: 'assigned', search: '' }, nameOf, keepVisible(edits, pins))
        .map((r) => r.storeCode)
        .sort(),
    ).toEqual(['P075', 'P076', 'P077'])
  })

  it('moves only the applied slot, and only on the applied branches', () => {
    const rows = [
      branch({ storeCode: 'P075', accountantId: '8725' }),
      branch({ storeCode: 'P076', accountantId: '8725', collectorId: '8725' }),
      branch({ storeCode: 'P900', accountantId: '8725' }),
    ]

    const settled = applyBulkResult(rows, result, 'collectorId', '4466')

    expect(settled.map((r) => r.collectorId)).toEqual(['4466', '4466', ''])
    expect(settled.map((r) => r.accountantId)).toEqual(['8725', '8725', '8725'])
    // The stamp the server actually wrote, on the rows it actually wrote.
    expect(settled.map((r) => r.updatedBy)).toEqual(['FINADMIN', 'FINADMIN', ''])
    expect(settled[2]).toBe(rows[2])
  })

  // ⚠️ Two applies in a row: the second must not un-hold what the first changed —
  // that would be the same disappearance, arriving one gesture later.
  it('accumulates across applies rather than replacing', () => {
    const second: BulkResult = { ...result, appliedStoreCodes: ['P900'], applied: 1 }

    expect([...keepVisible(bulkPins(result), bulkPins(second))].sort()).toEqual([
      'P075',
      'P076',
      'P900',
    ])
  })

  // *Tick this page* is the third gesture, and the paging arithmetic that decides
  // which 50 rows it means lives beside the other two flows rather than in the JSX.
  it('ticks exactly the page the grid is showing', () => {
    const rows = ['A', 'B', 'C', 'D', 'E'].map((code) => branch({ storeCode: code }))

    expect(pageCodes(rows, 0, 2)).toEqual(['A', 'B'])
    expect(pageCodes(rows, 2, 2)).toEqual(['E'])
    expect(pageCodes(rows, 9, 2)).toEqual([])
  })

  it('leaves the grid alone when the apply landed nothing', () => {
    const rows = [branch({ storeCode: 'P075' })]
    const nothing: BulkResult = {
      appliedStoreCodes: [],
      applied: 0,
      alreadyServed: 0,
      unknownStoreCodes: ['P999'],
      updatedBy: 'FINADMIN',
      updatedAt: '2026-08-14T11:00:00',
    }

    expect(applyBulkResult(rows, nothing, 'collectorId', '4466')).toEqual(rows)
    expect(bulkPins(nothing).size).toBe(0)
  })
})
