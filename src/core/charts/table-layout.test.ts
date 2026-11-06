import { describe, expect, it } from 'vitest'
import { TABLE_AUTO_HEIGHT_MAX_ROWS, TABLE_VIEWPORT_ROWS, tableLayout } from './table-layout'

describe('the table form sizes its grid (row virtualisation)', () => {
  it('a short table keeps auto height', () => {
    expect(tableLayout(0, 26, 28)).toEqual({ kind: 'auto' })
    expect(tableLayout(TABLE_AUTO_HEIGHT_MAX_ROWS, 26, 28)).toEqual({ kind: 'auto' })
  })

  it('a long table gets a fixed viewport, so only the rows in sight are rendered', () => {
    expect(tableLayout(TABLE_AUTO_HEIGHT_MAX_ROWS + 1, 26, 28)).toEqual({ kind: 'fixed', heightPx: 28 + 26 * TABLE_VIEWPORT_ROWS + 2 })
  })

  it('the viewport does not grow with the rows: a year of days is the same height as 21 rows', () => {
    expect(tableLayout(10_000, 26, 28)).toEqual(tableLayout(21, 26, 28))
  })
})
