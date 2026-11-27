import { describe, expect, it } from 'vitest'
import type { BarReply } from '@/core/models/sourcing-results'
import stub from './stub-bar.json'
import { shelfEvidence } from './shelf-chance-evidence-model'

// The shelf chance evidence rides on the phase 2 bar's reading (BO 4396 `Phase2BarReading.shelfChance`, `read.fleetRatios`):
// one row per mode and stock class, judged by the server against its 90 days of one-line deliveries.
const reading = (stub as unknown as BarReply).reading

describe('shelfEvidence — the rows with their evidence', () => {
  it('lists the rows by mode, then by stock class in the stock read order', () => {
    expect(shelfEvidence(reading).rows.map((r) => r.key)).toEqual([
      'DAWAA_NOW|BOOK_BELOW_ZERO',
      'DAWAA_NOW|BOOK_AT_ZERO',
      'DAWAA_NOW|BOOK_SHORT',
      'DAWAA_NOW|HELD_BY_DELIVERIES',
      'SLOT|BOOK_BELOW_ZERO',
      'SLOT|BOOK_AT_ZERO',
      'SLOT|BOOK_SHORT',
      'SLOT|HELD_BY_DELIVERIES',
    ])
  })

  it('carries each row\'s lines, failed lines, ratio against what it expects, and its two halves as sent', () => {
    const row = shelfEvidence(reading).rows.find((r) => r.key === 'SLOT|BOOK_BELOW_ZERO')!
    expect([row.lines, row.failedLines, row.expected, row.ratio, row.fits, row.firstHalf, row.secondHalf, row.daysCounted]).toEqual([
      5200, 310, 290.4, 1.07, 0.9, 0.82, 1.3, 90,
    ])
  })

  it('takes the verdict as the server judged it: too few where so', () => {
    expect(shelfEvidence(reading).rows.map((r) => r.verdict)).toEqual([
      'ENOUGH_TO_CHANGE',
      'INSIDE_CHANCE',
      'TOO_FEW',
      'TOO_FEW',
      'NOT_STEADY',
      'ENOUGH_TO_CHANGE',
      'INSIDE_CHANCE',
      'TOO_FEW',
    ])
  })

  it('reads a row with no ratio as none, not nought', () => {
    expect(shelfEvidence(reading).rows.at(-1)!.ratio).toBeNull()
  })

  it('says which rows wait for a written ruling and which have one', () => {
    const rows = shelfEvidence(reading).rows
    expect(rows.filter((r) => r.awaitsRuling).map((r) => r.key)).toEqual(['SLOT|BOOK_AT_ZERO'])
    expect(rows.filter((r) => r.ruling).map((r) => r.key)).toEqual(['DAWAA_NOW|BOOK_BELOW_ZERO'])
  })

  it('reads each mode\'s fleet ratio, read and never a limit, a mode with none as none', () => {
    expect(shelfEvidence(reading).fleetRatios).toEqual([
      { mode: 'DAWAA_NOW', ratio: 0.84, expected: 412.5, lines: 18200 },
      { mode: 'SLOT', ratio: 0.93, expected: 806.0, lines: 36400 },
      { mode: 'PICK_UP', ratio: null, expected: 12.0, lines: 900 },
    ])
  })
})
