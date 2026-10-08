import { describe, expect, it } from 'vitest'
import { importResult } from './import-result'

describe('importResult', () => {
  it('carries the applied and unchanged counts, and counts the skipped lines', () => {
    const r = importResult({ applied: 12, unchanged: 3, skipped: [{ line: 4, key: 'RUH-09', reason: 'UNKNOWN_CITY' }] })
    expect(r).toMatchObject({ applied: 12, unchanged: 3, skippedCount: 1, clean: false })
  })

  it('words the known reasons by key', () => {
    const r = importResult({
      applied: 0,
      unchanged: 0,
      skipped: [
        { line: 1, key: 'X1', reason: 'UNKNOWN_CITY' },
        { line: 2, key: '1234', reason: 'UNKNOWN_STAFF' },
        { line: 3, key: 'WEB', reason: 'UNKNOWN_SOURCE' },
      ],
    })
    expect(r.skipped.map((s) => s.reasonKey)).toEqual(['unknownCity', 'unknownStaff', 'unknownSource'])
  })

  it('keeps an unknown reason as its code, never dropped', () => {
    const r = importResult({ applied: 1, unchanged: 0, skipped: [{ line: 7, key: 'K', reason: 'STORE_CLOSED' }] })
    expect(r.skipped).toEqual([{ line: 7, key: 'K', reason: 'STORE_CLOSED', reasonKey: null }])
    expect(r.skippedCount).toBe(1)
  })

  it('lists the skipped lines in file order', () => {
    const r = importResult({
      applied: 0,
      unchanged: 0,
      skipped: [
        { line: 9, key: 'B', reason: 'UNKNOWN_CITY' },
        { line: 2, key: 'A', reason: 'UNKNOWN_CITY' },
      ],
    })
    expect(r.skipped.map((s) => s.line)).toEqual([2, 9])
  })

  it('is clean when nothing was skipped', () => {
    expect(importResult({ applied: 2, unchanged: 1, skipped: [] })).toMatchObject({ skippedCount: 0, clean: true, skipped: [] })
  })

  it('reads a malformed answer as zeros and no skips rather than crashing', () => {
    expect(importResult(null)).toEqual({ applied: 0, unchanged: 0, skippedCount: 0, clean: true, skipped: [] })
    expect(importResult({ applied: 1 } as never)).toMatchObject({ applied: 1, unchanged: 0, skipped: [] })
  })

  it('shows a blank reason as its (blank) code and keeps the line', () => {
    const r = importResult({ applied: 0, unchanged: 0, skipped: [{ line: 1, key: 'K', reason: '' }] })
    expect(r.skipped).toEqual([{ line: 1, key: 'K', reason: '', reasonKey: null }])
  })
})
