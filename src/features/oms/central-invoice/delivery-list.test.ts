/**
 * The bulk screen's list of delivery numbers (ticket 332): the paste parser, the
 * column a file's numbers are read from, and the CSV rows under it.
 *
 * The server dedupes too, and refuses a value that is not a delivery. What these
 * pin is what the officer SEES before sending: how many distinct numbers the
 * request will carry, how many duplicates were collapsed, and whether the list is
 * over the 200 the server takes.
 */
import { describe, expect, it } from 'vitest'
import { csvRows, deliveryColumn, fileKind, parseDeliveryList } from './delivery-list'

describe('parseDeliveryList', () => {
  it('splits on line breaks, commas, semicolons, tabs and spaces, and trims', () => {
    const list = parseDeliveryList(' 8006456897\r\n8006456512, 8006473324;8006457177\t8006456881  8006457868 ', 200)
    expect(list.numbers).toEqual([
      '8006456897',
      '8006456512',
      '8006473324',
      '8006457177',
      '8006456881',
      '8006457868',
    ])
    expect(list.duplicates).toBe(0)
    expect(list.overBy).toBe(0)
  })

  it('drops blank tokens: empty lines and trailing separators are not numbers', () => {
    expect(parseDeliveryList('\n\n8006456897,,\n;\n', 200).numbers).toEqual(['8006456897'])
    expect(parseDeliveryList('', 200).numbers).toEqual([])
    expect(parseDeliveryList('  \n\t ', 200).numbers).toEqual([])
  })

  it('collapses duplicates, keeps the first occurrence order, and counts what it collapsed', () => {
    const list = parseDeliveryList('8006456897\n8006456512\n8006456897\n 8006456512 \n8006456897', 200)
    expect(list.numbers).toEqual(['8006456897', '8006456512'])
    expect(list.duplicates).toBe(3)
  })

  it('unwraps the quoting a spreadsheet adds when a column is copied as CSV', () => {
    // `"123"` from a quoted CSV cell, `="123"` from Excel's keep-as-text formula.
    expect(parseDeliveryList('"8006456897"\n="8006456512"\n\'8006473324', 200).numbers).toEqual([
      '8006456897',
      '8006456512',
      '8006473324',
    ])
  })

  it('keeps a value that is not a delivery number: the server answers it as "not a delivery"', () => {
    expect(parseDeliveryList('6314628864841\nP983\n8006456897', 200).numbers).toEqual([
      '6314628864841',
      'P983',
      '8006456897',
    ])
  })

  it('dedupes exactly as typed, with no case folding (the server compares ordinally)', () => {
    expect(parseDeliveryList('abc\nABC', 200).numbers).toEqual(['abc', 'ABC'])
  })

  it('counts how far over the cap a list is, AFTER duplicates are collapsed', () => {
    const many = Array.from({ length: 203 }, (_, i) => String(8006000000 + i))
    expect(parseDeliveryList(many.join('\n'), 200).overBy).toBe(3)
    // 200 distinct plus 50 repeats is exactly at the cap, not over it.
    const atCap = [...many.slice(0, 200), ...many.slice(0, 50)]
    const list = parseDeliveryList(atCap.join('\n'), 200)
    expect(list.numbers).toHaveLength(200)
    expect(list.duplicates).toBe(50)
    expect(list.overBy).toBe(0)
  })

  it('never truncates: an over-long list keeps every number so the officer can split it', () => {
    const many = Array.from({ length: 205 }, (_, i) => String(8006000000 + i))
    expect(parseDeliveryList(many.join(','), 200).numbers).toHaveLength(205)
  })
})

describe('deliveryColumn', () => {
  it('reads the column holding the delivery numbers, whatever its header says (the rollout sheet: Store | Order No)', () => {
    const rows = [
      ['Store', 'Order No'],
      ['1109', '8006456897'],
      ['1115', '8006456512'],
      ['P432', '8006473324'],
    ]
    expect(deliveryColumn(rows)).toEqual(['8006456897', '8006456512', '8006473324'])
  })

  it('skips a header only when it is not a number', () => {
    expect(deliveryColumn([['8006456897'], ['8006456512']])).toEqual(['8006456897', '8006456512'])
    expect(deliveryColumn([['Delivery'], ['8006456897']])).toEqual(['8006456897'])
  })

  it('keeps every non-blank cell under the header, including one that is not a delivery number', () => {
    const rows = [
      ['Store', 'Delivery'],
      ['P983', '6314628864841'],
      ['P983', ''],
      ['P001', 'n/a'],
      ['P001', '8006456897'],
    ]
    expect(deliveryColumn(rows)).toEqual(['6314628864841', 'n/a', '8006456897'])
  })

  it('handles ragged rows and picks the leftmost column on a tie', () => {
    expect(deliveryColumn([['8006456897', '8006456512'], ['8006473324']])).toEqual(['8006456897', '8006473324'])
    expect(deliveryColumn([['x'], ['', '8006456897'], ['', '8006456512']])).toEqual(['8006456897', '8006456512'])
  })

  it('🚩 a column headed "Delivery" wins over content: order and delivery numbers are both 10 digits', () => {
    const rows = [
      ['Store', 'Order No', 'Delivery No'],
      ['1109', '1000371607', '8006456897'],
      ['1115', '1000371608', '8006456512'],
    ]
    expect(deliveryColumn(rows)).toEqual(['8006456897', '8006456512'])
  })

  it('drops EVERY leading non-number in the column — a title row above the header too', () => {
    const rows = [
      ['Deliveries not invoiced', ''],
      ['Store', 'Order No'],
      ['1109', '8006456897'],
      ['P983', 'P983-typo'],
    ]
    expect(deliveryColumn(rows)).toEqual(['8006456897', 'P983-typo'])
  })

  it('falls back to the first column when no column holds a long number', () => {
    expect(deliveryColumn([['a', 'b'], ['c', 'd']])).toEqual(['c'])
    expect(deliveryColumn([])).toEqual([])
  })
})

describe('csvRows', () => {
  it('splits a comma file with quoted cells, doubled quotes and CRLF, and drops a BOM', () => {
    expect(csvRows(String.fromCharCode(0xfeff) + 'Store,Order No\r\n"P1,x",8006456897\r\n"say ""hi""",8006456512\r\n')).toEqual([
      ['Store', 'Order No'],
      ['P1,x', '8006456897'],
      ['say "hi"', '8006456512'],
    ])
  })

  it('honours a `sep=` first line and reads a semicolon file (Excel in an Arabic locale)', () => {
    expect(csvRows('sep=;\nStore;Order No\n1109;8006456897\n')).toEqual([
      ['Store', 'Order No'],
      ['1109', '8006456897'],
    ])
    expect(csvRows('Store;Order No\n1109;8006456897')).toEqual([
      ['Store', 'Order No'],
      ['1109', '8006456897'],
    ])
  })

  it('sniffs the separator past a title line that holds none', () => {
    expect(csvRows('Deliveries to invoice\nStore;Order No\n1109;8006456897\n')).toEqual([
      ['Deliveries to invoice'],
      ['Store', 'Order No'],
      ['1109', '8006456897'],
    ])
  })

  it('reads a tab-separated file and a one-column file', () => {
    expect(csvRows('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
    expect(csvRows('8006456897\n8006456512\n')).toEqual([['8006456897'], ['8006456512']])
  })

  it('keeps a line break inside a quoted cell in that cell', () => {
    expect(csvRows('"a\nb",1\n2,3')).toEqual([
      ['a\nb', '1'],
      ['2', '3'],
    ])
  })
})

describe('fileKind', () => {
  const bytes = (...b: number[]) => new Uint8Array(b)
  const text = (s: string) => new TextEncoder().encode(s)

  it('is a workbook only on the full zip signature, not on a CSV that starts with "PK"', () => {
    expect(fileKind(bytes(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00))).toBe('xlsx')
    expect(fileKind(text('PK01,8006456897\n'))).toBe('utf-8')
  })

  it('reads a UTF-16 text export by its byte-order mark', () => {
    expect(fileKind(bytes(0xff, 0xfe, 0x53, 0x00))).toBe('utf-16le')
    expect(fileKind(bytes(0xfe, 0xff, 0x00, 0x53))).toBe('utf-16be')
  })

  it('refuses an old binary .xls rather than decoding it as noise', () => {
    expect(fileKind(bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1))).toBe('unsupported')
  })

  it('refuses a file holding NUL bytes that is not UTF-16 (a binary file)', () => {
    expect(fileKind(bytes(0x38, 0x00, 0x30, 0x00))).toBe('unsupported')
  })
})
