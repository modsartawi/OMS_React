import { describe, expect, it } from 'vitest'
import { compareFigures } from './compare-figures'

/**
 * Sorts as AG Grid does: the comparator's answer, negated when descending. A comparator that
 * puts `null` last must therefore answer differently by direction.
 */
function gridSort(values: (number | null)[], descending: boolean): (number | null)[] {
  return [...values].sort((a, b) => {
    const r = compareFigures(a, b, descending)
    return descending ? -r : r
  })
}

describe('compareFigures', () => {
  const values = [5, null, 0, 12, null, 3.5]

  it('sorts numerically, not as text', () => {
    expect(gridSort([10, 9, 100], false)).toEqual([9, 10, 100])
  })

  it('🚩 ascending: the numbers low to high, 0 among them, the absent ones last', () => {
    expect(gridSort(values, false)).toEqual([0, 3.5, 5, 12, null, null])
  })

  it('🚩 descending: the numbers high to low, the absent ones STILL last', () => {
    expect(gridSort(values, true)).toEqual([12, 5, 3.5, 0, null, null])
  })

  it('two absent figures are equal', () => {
    expect(compareFigures(null, null, false)).toBe(0)
    expect(compareFigures(null, null, true)).toBe(0)
  })
})
