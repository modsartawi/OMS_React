/**
 * The loyalty-group picker's value (oms ticket 636; BackOffice 3179): the wire's comma-separated
 * upper-case code string, read into chosen codes, and written back.
 */
import { describe, expect, it } from 'vitest'
import { readLoyGroupSelection, writeLoyGroupSelection } from './selection'

const GROUPS = [
  { code: 'GOLD', isActive: true },
  { code: 'OLD_PROMO', isActive: false },
  { code: 'SILVER', isActive: true },
]

describe('picker selection round-trips the comma code list', () => {
  it('keeps a code that is not a defined group as unknown, and writes the same string back', () => {
    const s = readLoyGroupSelection('GOLD,STAFF_X', GROUPS)
    expect(s.codes).toEqual(['GOLD', 'STAFF_X'])
    expect(s.unknown).toEqual(['STAFF_X'])
    expect(s.inactive).toEqual([])
    expect(writeLoyGroupSelection(s.codes)).toBe('GOLD,STAFF_X')
  })

  it('normalises as the engine list does: any separator, trimmed, upper-cased, order kept', () => {
    const s = readLoyGroupSelection(' silver\r\ngold; staff_x ', GROUPS)
    expect(s.codes).toEqual(['SILVER', 'GOLD', 'STAFF_X'])
    expect(writeLoyGroupSelection(s.codes)).toBe('SILVER,GOLD,STAFF_X')
  })

  it('names a chosen inactive group', () => {
    expect(readLoyGroupSelection('OLD_PROMO,GOLD', GROUPS).inactive).toEqual(['OLD_PROMO'])
  })

  it('holds a code once: a multi-select cannot tick the same group twice', () => {
    expect(readLoyGroupSelection('GOLD,gold,SILVER', GROUPS).codes).toEqual(['GOLD', 'SILVER'])
  })

  it('reads nothing as no codes, and writes no codes as the empty string', () => {
    expect(readLoyGroupSelection('', GROUPS)).toEqual({ codes: [], unknown: [], inactive: [] })
    expect(readLoyGroupSelection(null, GROUPS).codes).toEqual([])
    expect(writeLoyGroupSelection([])).toBe('')
  })

  it('without the groups list nothing is called unknown: the codes are only shown, never judged', () => {
    expect(readLoyGroupSelection('GOLD,STAFF_X', undefined)).toEqual({ codes: ['GOLD', 'STAFF_X'], unknown: [], inactive: [] })
  })
})
