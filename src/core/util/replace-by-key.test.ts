import { describe, expect, it } from 'vitest'
import { replaceByKey, replaceInPage } from './replace-by-key'

const row = (code: string, on = false) => ({ code, on })

describe('replaceByKey — a changed row swapped where it stands', () => {
  it('swaps the row with the same key, in place', () => {
    const rows = [row('1'), row('2'), row('3')]
    expect(replaceByKey(rows, row('2', true), 'code')).toEqual([row('1'), row('2', true), row('3')])
  })

  it('hands back the same list when no row has the key, and undefined as undefined', () => {
    const rows = [row('1')]
    expect(replaceByKey(rows, row('9', true), 'code')).toBe(rows)
    expect(replaceByKey(undefined, row('9'), 'code')).toBeUndefined()
  })
})

describe('replaceInPage — a changed row swapped where it stands on a server page', () => {
  it('swaps the row in at its place, the total and the rest untouched', () => {
    const page = { total: 250, rows: [row('1'), row('2'), row('3')] }
    expect(replaceInPage(page, row('2', true), 'code')).toEqual({ total: 250, rows: [row('1'), row('2', true), row('3')] })
  })

  it('hands back the same page when it does not hold the row, and undefined as undefined', () => {
    const page = { total: 1, rows: [row('1')] }
    expect(replaceInPage(page, row('9', true), 'code')).toBe(page)
    expect(replaceInPage(undefined, row('9'), 'code')).toBeUndefined()
  })
})
