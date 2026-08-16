import { describe, expect, it } from 'vitest'
import { BULK_TEMPLATE_COLUMNS, bulkTemplateCsv } from './bulk-template'
import { reviewBulk } from './bulk'

/**
 * **The blank sheet** — the three things about it that fail silently.
 *
 * 🔑 A template whose headers drifted from the door's would be discovered by an
 * accountant, at the end of a month, as a file the server refuses to read — and the
 * headers are the one part of it nothing else in this repo asserts.
 */

describe('bulkTemplateCsv', () => {
  // 🔑 The door reads columns BY NAME (`.afk/FINDINGS-274.md`, driven live). These
  // three spellings are the contract; a rename here is a rename of the contract.
  it('leads with the three headers the door reads', () => {
    const [header] = bulkTemplateCsv().split('\r\n')
    expect(header).toBe('StoreCode,Amount,Reason')
    expect(BULK_TEMPLATE_COLUMNS).toEqual(['StoreCode', 'Amount', 'Reason'])
  })

  // ⚠️ A separator in an amount is two columns to a CSV parser, so the example must
  // never show one — this is the only place the file can teach the input format.
  it('writes example amounts bare, with no thousands separator', () => {
    const amounts = dataRows().map((cells) => cells[1])
    expect(amounts.length).toBeGreaterThan(0)
    for (const amount of amounts) {
      expect(amount).toMatch(/^\d+(\.\d+)?$/)
      expect(Number.isFinite(Number(amount))).toBe(true)
    }
  })

  /**
   * 🚩 **The template, uploaded unedited, must not be able to post money.** Its
   * branch codes resolve to nothing, which is exactly the condition `reviewBulk`
   * refuses the whole file on — proven here through the real reviewer rather than
   * asserted about the string.
   */
  it('cannot commit if it is uploaded as it came', () => {
    const rows = dataRows().map((cells, i) => ({
      rowNumber: i + 2,
      storeCode: cells[0],
      // The server resolved nothing, because nothing has these codes.
      storeName: '',
      amount: Number(cells[1]),
      fileAmount: Number(cells[1]),
      currencyKey: 'SAR',
      reason: cells[2],
    }))
    const review = reviewBulk({
      batchId: 'B0000MCP5ZGRXP7ZTZ3EHRJQT3',
      contentHash: 'hash',
      entryKind: 'SHORTAGE',
      rows,
      errors: [],
      warnings: [],
      rowCount: rows.length,
      // ⚠️ The SERVER would say yes — every row parsed. The refusal below is this
      // screen's own, which is the point of asserting it here.
      canCommit: true,
      total: rows.reduce((sum, r) => sum + r.amount, 0),
    })
    expect(review.canCommit).toBe(false)
    expect(review.blockers).toHaveLength(rows.length)
  })
})

/** The example rows, split back out of the written file. */
function dataRows(): string[][] {
  return bulkTemplateCsv()
    .split('\r\n')
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => line.split(','))
}
