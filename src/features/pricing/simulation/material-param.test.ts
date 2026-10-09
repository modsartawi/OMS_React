/**
 * Ticket 452 — the simulator opens prefilled from a material's detail (spec 2544 story 22):
 * `?material=101234` pre-adds that material ONCE, as one item row (qty 1, EA), at the initial
 * state only — it never processes by itself. Without the param the initial rows are exactly what
 * they always were: one empty row.
 */
import { describe, expect, it } from 'vitest'
import type { SimItemRow } from './SimItemsEntry'
import { simulationMaterialParam } from './material-param'

let seq = 0
/** The shape of `emptyItemRow()`: a fresh id, nothing typed, qty 1, EA. */
const emptyRow = (): SimItemRow => ({ id: `row-${++seq}`, materialNumber: '', quantity: '1', qtyUnit: 'EA', itemConditionControl: '' })

const rows = (qs: string) => simulationMaterialParam(new URLSearchParams(qs), emptyRow).map(({ id: _id, ...rest }) => rest)

describe('simulationMaterialParam', () => {
  it('?material=101234 pre-adds the material as ONE row, qty 1, EA', () => {
    expect(rows('material=101234')).toEqual([{ materialNumber: '101234', quantity: '1', qtyUnit: 'EA', itemConditionControl: '' }])
  })

  it('keeps the number as the string it is — leading zeros kept, outer spaces trimmed', () => {
    expect(rows('material=%200100777%20')[0].materialNumber).toBe('0100777')
  })

  it('a repeated param still pre-adds ONE material: the first', () => {
    expect(rows('material=101234&material=100777').map((r) => r.materialNumber)).toEqual(['101234'])
  })

  it('without the param the simulator is unchanged: one empty row', () => {
    const empty = { materialNumber: '', quantity: '1', qtyUnit: 'EA', itemConditionControl: '' }
    expect(rows('')).toEqual([empty])
    expect(rows('material=')).toEqual([empty])
    expect(rows('material=%20%20')).toEqual([empty])
    expect(rows('other=1')).toEqual([empty])
  })

  it('the row keeps its fresh id', () => {
    expect(simulationMaterialParam(new URLSearchParams('material=101234'), emptyRow)[0].id).toMatch(/^row-\d+$/)
  })
})
