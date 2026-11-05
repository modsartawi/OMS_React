import { describe, expect, it } from 'vitest'
import { SHEET_DEFAULT_WIDTH, SHEET_MIN_WIDTH, clampSheetWidth, parseSheetSize } from './copilot-sheet-size'

describe('the copilot sheet size (CTO demo)', () => {
  it('clampSheetWidth_keepsTheSheetBetweenItsMinimumAndTheGutter', () => {
    expect(clampSheetWidth(700, 1440)).toBe(700)
    expect(clampSheetWidth(100, 1440)).toBe(SHEET_MIN_WIDTH)
    expect(clampSheetWidth(5000, 1440)).toBe(1392)
    // A screen narrower than the minimum still gets the minimum (the sheet's own max-width caps it).
    expect(clampSheetWidth(600, 300)).toBe(SHEET_MIN_WIDTH)
    expect(clampSheetWidth(Number.NaN, 1440)).toBe(SHEET_DEFAULT_WIDTH)
  })

  it('parseSheetSize_readsOnlyWhatTheStoreWrote', () => {
    expect(parseSheetSize(JSON.stringify({ width: 800, full: true }))).toEqual({ width: 800, full: true })
    expect(parseSheetSize(null)).toEqual({ width: SHEET_DEFAULT_WIDTH, full: false })
    expect(parseSheetSize('not json')).toEqual({ width: SHEET_DEFAULT_WIDTH, full: false })
    expect(parseSheetSize(JSON.stringify({ width: 'wide', full: 'yes' }))).toEqual({ width: SHEET_DEFAULT_WIDTH, full: false })
    expect(parseSheetSize(JSON.stringify({ width: 10 }))).toEqual({ width: SHEET_MIN_WIDTH, full: false })
  })
})
