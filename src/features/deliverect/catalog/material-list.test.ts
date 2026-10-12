/**
 * Ticket 479 — the whitelist import's list of material numbers, from pasted text or a sheet.
 *
 * The server refuses an import of no rows, of more than 5000, or with a row that is not a material
 * number (DLV-00012). What these pin is what the category manager SEES before sending: the trimmed,
 * de-duplicated list the request will carry, a header row skipped, and the 5000 cap refused here
 * rather than by the door.
 */
import { describe, expect, it } from 'vitest'
import { WHITELIST_IMPORT_MAX, parseMaterialList } from './material-list'

describe('parseMaterialList — pasted text', () => {
  it('splits on line breaks, commas, semicolons, tabs and spaces, and trims', () => {
    const list = parseMaterialList(' 101234\r\n101235, 101236;101237\t101238  101239 \n')
    expect(list.materials).toEqual(['101234', '101235', '101236', '101237', '101238', '101239'])
    expect(list.overBy).toBe(0)
  })

  it('drops blanks and collapses duplicates, first occurrence first, counting them', () => {
    const list = parseMaterialList('101235\n\n101234\n 101235 \n101234\n\n')
    expect(list.materials).toEqual(['101235', '101234'])
    expect(list.duplicates).toBe(2)
  })

  it('keeps a material number as stored — leading zeros and all, never a number', () => {
    expect(parseMaterialList('000000000000101234\n00101234').materials).toEqual(['000000000000101234', '00101234'])
  })

  it('skips a first line with no digit in it as a header, and says which', () => {
    const list = parseMaterialList('Material number\n101234\n101235')
    expect(list.materials).toEqual(['101234', '101235'])
    expect(list.header).toBe('Material number')
    expect(parseMaterialList('رقم المادة\n101234').header).toBe('رقم المادة')
  })

  it('never skips a first line that holds a digit, and never a later line', () => {
    expect(parseMaterialList('101234\nMaterial').materials).toEqual(['101234', 'Material'])
    expect(parseMaterialList('101234\nMaterial').header).toBeNull()
    // A value the server will judge is kept and sent, not silently dropped (DLV-00012 answers it).
    expect(parseMaterialList('ABC-12\n101234').materials).toEqual(['ABC-12', '101234'])
  })

  it('an empty paste is an empty list, not an error', () => {
    expect(parseMaterialList('  \n\t\n')).toEqual({ materials: [], duplicates: 0, entries: 0, header: null, overBy: 0, otherColumns: false })
  })
})

describe('parseMaterialList — the 5000 cap', () => {
  const numbers = (n: number) => Array.from({ length: n }, (_, i) => String(100000 + i))

  it('is the contract’s 5000', () => {
    expect(WHITELIST_IMPORT_MAX).toBe(5000)
  })

  it('5000 distinct materials can be sent', () => {
    expect(parseMaterialList(numbers(5000).join('\n')).overBy).toBe(0)
  })

  it('5001 are refused — reported, never truncated, so nothing is silently dropped', () => {
    const list = parseMaterialList(numbers(5001).join('\n'))
    expect(list.overBy).toBe(1)
    expect(list.materials).toHaveLength(5001)
  })

  it('the cap counts DISTINCT materials, as the request would carry them', () => {
    expect(parseMaterialList([...numbers(5000), ...numbers(10)].join('\n')).overBy).toBe(0)
  })
})

describe('parseMaterialList — a sheet', () => {
  it('reads the first column, trimmed, blanks and duplicates dropped, a header row skipped', () => {
    const list = parseMaterialList([['Material'], [' 101234 '], [], [''], ['101235'], ['101234']])
    expect(list.materials).toEqual(['101234', '101235'])
    expect(list.header).toBe('Material')
    expect(list.duplicates).toBe(1)
    expect(list.otherColumns).toBe(false)
  })

  it('a cell is one material — it is not split on spaces', () => {
    expect(parseMaterialList([['101234'], ['101235 101236']]).materials).toEqual(['101234', '101235 101236'])
  })

  it('flags a sheet holding a second column rather than guessing which one to read', () => {
    expect(parseMaterialList([['Material', 'Name'], ['101234', 'Panadol']]).otherColumns).toBe(true)
    // A blank second cell is no second column.
    expect(parseMaterialList([['101234', ''], ['101235', ' ']]).otherColumns).toBe(false)
  })

  it('counts the entries read — repeats included — so a sheet can be refused by its rows', () => {
    const list = parseMaterialList([['Material'], ['101234'], ['101234'], [''], ['101235']])
    expect(list.entries).toBe(3)
    expect(parseMaterialList('101234\n101234').entries).toBe(2)
  })

  it('caps a sheet the same way', () => {
    const rows = Array.from({ length: 5002 }, (_, i) => [String(200000 + i)])
    expect(parseMaterialList(rows).overBy).toBe(2)
  })
})
