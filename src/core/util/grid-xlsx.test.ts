/**
 * The grid → xlsx writer's pure parts (graduated from Screen 1's export at ticket 333).
 * The grid-reading half needs a live AG Grid and is proved by the drives.
 */
import { describe, expect, it } from 'vitest'
import { textSheet, xlsxFileName } from './grid-xlsx'

describe('xlsxFileName', () => {
  it('stamps the base with the local day and minute, as Screen 1 always has', () => {
    expect(xlsxFileName('delivery-documents', new Date(2026, 6, 17, 14, 30))).toBe('delivery-documents-20260717-1430.xlsx')
  })
})

describe('textSheet', () => {
  it('is a bold header row then every row as text, never as a number', () => {
    const sheet = textSheet('Serials', ['GTIN', 'Serial'], [['06281234567890', '0012']])
    expect(sheet.name).toBe('Serials')
    expect(sheet.data).toEqual([
      [
        { value: 'GTIN', fontWeight: 'bold' },
        { value: 'Serial', fontWeight: 'bold' },
      ],
      // A GTIN or serial with a leading zero must survive Excel: text, not Number.
      [
        { type: String, value: '06281234567890' },
        { type: String, value: '0012' },
      ],
    ])
  })

  it('sizes each column to its longest cell, between 8 and 60 characters', () => {
    const sheet = textSheet('S', ['A', 'Header'], [['x'.repeat(100), 'yy']])
    expect(sheet.columns).toEqual([{ width: 60 }, { width: 8 }])
  })

  it('writes a header alone when there are no rows', () => {
    expect(textSheet('S', ['A'], []).data).toHaveLength(1)
  })
})
