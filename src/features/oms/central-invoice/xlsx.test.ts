/**
 * The XLSX reader behind the bulk screen's upload (ticket 332).
 *
 * The fixture is a hand-built workbook shaped like the rollout sheet (`Store` |
 * `Order No`), with the traps a real Excel file carries: the FIRST sheet is not
 * `sheet1.xml`, the shared strings are stored uncompressed while the sheets are
 * deflated, one number is in scientific form, one is a rich-text shared string
 * with a phonetic run, one is an inline string with an entity, one is a formula
 * result, and one row is empty.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { xlsxRows } from './xlsx'
import { deliveryColumn } from './delivery-list'

const fixture = () =>
  new Uint8Array(readFileSync(new URL('./__fixtures__/deliveries.xlsx', import.meta.url)))

describe('xlsxRows', () => {
  it('reads the first sheet in workbook order, as text rows by column position', async () => {
    const rows = await xlsxRows(fixture())
    expect(rows).toEqual([
      ['Store', 'Order No'],
      ['1109', '8006456897'],
      ['P432', '8006456512'],
      ['', '8006457611'],
      [],
      ['1163', '8006458443 &'],
      ['1210', '8006456937'],
    ])
  })

  it('feeds the delivery-number column straight into the list', async () => {
    expect(deliveryColumn(await xlsxRows(fixture()))).toEqual([
      '8006456897',
      '8006456512',
      '8006457611',
      '8006458443 &',
      '8006456937',
    ])
  })

  it('refuses a file that is not a workbook, rather than returning nothing', async () => {
    await expect(xlsxRows(new TextEncoder().encode('Store,Order No\n1109,8006456897'))).rejects.toThrow()
  })
})
