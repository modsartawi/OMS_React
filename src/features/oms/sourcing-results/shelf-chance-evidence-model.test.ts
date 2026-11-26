import { describe, expect, it } from 'vitest'
import type { ResultsChecksReply } from '@/core/models/sourcing-results'
import stub from './stub-tabs.json'
import { shelfEvidence } from './shelf-chance-evidence-model'

// The drive's stub: spec 4354 §6's baseline table, with the evidence of the results prototype's 14 days.
const shelf = stub.checks.shelf as unknown as ResultsChecksReply['shelf']

describe('shelfEvidence — the 36 cells with their evidence', () => {
  it('lays the cells out by units asked (rows) and units left over (columns), 36 in all', () => {
    const view = shelfEvidence(shelf, 'SLOT')
    expect(view.grid.map((r) => r.asked)).toEqual([1, 2, 3, 4, 5, 6])
    expect(view.grid.every((r) => r.cells.length === 6)).toBe(true)
    expect(view.grid[0].cells.map((c) => c?.leftOver)).toEqual(['L0', 'L1', 'L2', 'L3_4', 'L5_9', 'L10_PLUS'])
  })

  it('gives each cell the table\'s chance and its picks as sent', () => {
    const cell = shelfEvidence(shelf, 'SLOT').grid[0].cells[0]
    expect(cell).toMatchObject({ asked: 1, leftOver: 'L0', chance: 9.4, lines: 5096, failed: 575, failedPercent: 11.3, reading: 'INSIDE_CHANCE' })
    expect(cell?.halves).toEqual([13.35, 9.12, 8.93])
  })

  it('reads "too few" where the figure expects under 50 failed lines, whatever reading was sent', () => {
    const cells = shelf.modes.find((m) => m.mode === 'SLOT')!.cells.map((c) =>
      c.asked === 1 && c.leftOver === 'L0' ? { ...c, expectedFailed: 49.9, reading: 'ENOUGH_TO_CHANGE' as const } : c,
    )
    const view = shelfEvidence({ ...shelf, modes: [{ mode: 'SLOT', fleetRatio: 1.12, cells }] }, 'SLOT')
    expect(view.grid[0].cells[0]?.reading).toBe('TOO_FEW')
    expect(shelfEvidence(shelf, 'SLOT').grid[5].cells[5]?.reading).toBe('TOO_FEW')
  })

  it('keeps "enough to change" and "not steady" where enough lines stand behind the figure', () => {
    const readings = shelfEvidence(shelf, 'SLOT').grid.flatMap((r) => r.cells.map((c) => c?.reading))
    expect(readings).toContain('ENOUGH_TO_CHANGE')
    expect(readings).toContain('INSIDE_CHANCE')
  })

  it('leaves a cell the reply did not send empty, never invented', () => {
    const cells = shelf.modes[0].cells.filter((c) => !(c.asked === 3 && c.leftOver === 'L2'))
    const view = shelfEvidence({ ...shelf, modes: [{ ...shelf.modes[0], cells }] }, shelf.modes[0].mode)
    expect(view.grid[2].cells[2]).toBeNull()
  })

  it('shades the highest chance strongest and the lowest faintest', () => {
    const flat = shelfEvidence(shelf, 'SLOT').grid.flatMap((r) => r.cells)
    const top = flat.find((c) => c?.chance === 15.62)!
    const low = flat.find((c) => c?.chance === 1.15)!
    expect(top.heat).toBeGreaterThan(low.heat)
    expect(Math.max(...flat.map((c) => c?.heat ?? 0))).toBe(top.heat)
  })

  it('names the mode\'s fleet ratio, every mode\'s ratio, the window and the number of counts', () => {
    const view = shelfEvidence(shelf, 'PICK_UP')
    expect(view.fleetRatio).toBe(0.97)
    expect(view.fleetRatios).toEqual([
      { mode: 'DAWAA_NOW', ratio: 0.84 },
      { mode: 'SLOT', ratio: 1.12 },
      { mode: 'PICK_UP', ratio: 0.97 },
    ])
    expect(view.window).toEqual({ from: '2025-11-26', to: '2026-11-25', counts: 982 })
    expect(view.set).toMatchObject({ name: 'Baseline', version: 3 })
  })

  it('draws no cell for a mode the reply does not hold', () => {
    const view = shelfEvidence({ ...shelf, modes: shelf.modes.filter((m) => m.mode !== 'DAWAA_NOW') }, 'DAWAA_NOW')
    expect(view.grid.flatMap((r) => r.cells).every((c) => c === null)).toBe(true)
    expect(view.fleetRatio).toBeNull()
  })
})

describe('shelfEvidence — the eight short-figure rows, from deliveries', () => {
  it('lists the eight rows by mode then stock class, each marked from deliveries', () => {
    const rows = shelfEvidence(shelf, 'SLOT').rows
    expect(rows.map((r) => `${r.mode}:${r.stockClass}`)).toEqual([
      'SLOT:BOOK_BELOW_ZERO',
      'SLOT:BOOK_AT_ZERO',
      'SLOT:BOOK_SHORT',
      'SLOT:HELD_BY_DELIVERIES',
      'PICK_UP:BOOK_BELOW_ZERO',
      'PICK_UP:BOOK_AT_ZERO',
      'PICK_UP:BOOK_SHORT',
      'PICK_UP:HELD_BY_DELIVERIES',
    ])
    expect(rows.every((r) => r.source === 'DELIVERIES')).toBe(true)
  })

  it('gives each row both ratios with the lines behind each, and the lines per channel group', () => {
    const row = shelfEvidence(shelf, 'SLOT').rows.find((r) => r.mode === 'SLOT' && r.stockClass === 'BOOK_AT_ZERO')!
    expect(row.chance).toBe(22)
    expect(row.oneLine).toMatchObject({ ratio: 0.88, lines: 840 })
    expect(row.everyDelivery).toMatchObject({ ratio: 0.67, lines: 2710 })
    expect(row.groups.map((g) => g.group)).toEqual(['APP_SITE', 'CC_OUTBOUND', 'CC_OTHER'])
  })

  it('reads "too few" on a row whose one-line figure expects under 50 failed lines, and keeps "not steady"', () => {
    const rows = shelfEvidence(shelf, 'SLOT').rows
    const pick = (cls: string) => rows.find((r) => r.mode === 'PICK_UP' && r.stockClass === cls)!
    expect(pick('BOOK_BELOW_ZERO').reading).toBe('TOO_FEW')
    expect(pick('BOOK_AT_ZERO').reading).toBe('NOT_STEADY')
    const lifted = shelf.rows.map((r) =>
      r.mode === 'PICK_UP' && r.stockClass === 'HELD_BY_DELIVERIES' ? { ...r, oneLine: { ...r.oneLine, expectedFailed: 12 } } : r,
    )
    expect(shelfEvidence({ ...shelf, rows: lifted }, 'SLOT').rows.at(-1)?.reading).toBe('TOO_FEW')
  })

  it('puts the lines per channel group in the fixed order whatever order they come in', () => {
    const reordered = shelf.rows.map((r) => ({ ...r, groups: [...r.groups].reverse() }))
    expect(shelfEvidence({ ...shelf, rows: reordered }, 'SLOT').rows[0].groups.map((g) => g.group)).toEqual(['APP_SITE', 'CC_OUTBOUND', 'CC_OTHER'])
  })
})
