/**
 * Ticket 453 — the materials box: split on newline, comma and space; trimmed; each once; the 51st
 * refused on the client before any call (the door's MAT-00002, said first).
 */
import { describe, expect, it } from 'vitest'
import { STOCK_MATERIAL_CAP } from '@/core/materials/stock-cap'
import { materialListText, parseMaterialList } from './material-list'

const many = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i))

describe('parseMaterialList', () => {
  it('splits on newline, comma and space (and a pasted tab or CRLF), trimming each', () => {
    expect(parseMaterialList('101234\n100777, 100888 100999\t101000\r\n  101111  ').materials).toEqual([
      '101234',
      '100777',
      '100888',
      '100999',
      '101000',
      '101111',
    ])
  })

  it('reads nothing from an empty or blank box', () => {
    expect(parseMaterialList('')).toEqual({ materials: [], refused: [], duplicates: 0 })
    expect(parseMaterialList(' ,\n ,, ')).toEqual({ materials: [], refused: [], duplicates: 0 })
    expect(parseMaterialList(null).materials).toEqual([])
  })

  it('de-duplicates, keeping the first place, and counts what it folded', () => {
    expect(parseMaterialList('101234, 100777\n101234 100777 101234')).toEqual({
      materials: ['101234', '100777'],
      refused: [],
      duplicates: 3,
    })
  })

  it('keeps leading zeros — a material number is a string, never a number', () => {
    expect(parseMaterialList('0100777 100777').materials).toEqual(['0100777', '100777'])
  })

  it('takes exactly 50 and refuses the 51st', () => {
    expect(STOCK_MATERIAL_CAP).toBe(50)
    const fifty = parseMaterialList(many(50).join('\n'))
    expect(fifty.materials).toHaveLength(50)
    expect(fifty.refused).toEqual([])
    const fiftyOne = parseMaterialList(many(51).join(','))
    expect(fiftyOne.materials).toHaveLength(50)
    expect(fiftyOne.refused).toEqual(['100050'])
  })

  it('counts the cap after de-duplication: 50 distinct pasted twice is not refused', () => {
    const twice = parseMaterialList([...many(50), ...many(50)].join(' '))
    expect(twice.materials).toHaveLength(50)
    expect(twice.refused).toEqual([])
    expect(twice.duplicates).toBe(50)
  })
})

describe('materialListText', () => {
  it('writes one per line, and reads back the same list', () => {
    const list = ['101234', '0100777']
    expect(materialListText(list)).toBe('101234\n0100777')
    expect(parseMaterialList(materialListText(list)).materials).toEqual(list)
  })
})
