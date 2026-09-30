import { describe, expect, it } from 'vitest'
import { ACR_HEADER_ROWS } from './acr-header'
import { ACR_SCENARIOS } from './acr-fixture'

// Ticket 341 (BackOffice 2149 D14): the follow-up form's header no longer prints the
// description line (الوصف, the ACR's label), and nothing else in it moves.

const cells = ACR_HEADER_ROWS.flat()

describe('the ACR form header', () => {
  it('acr form header renders no description line', () => {
    expect(cells.some((cell) => cell.label.includes('الوصف'))).toBe(false)
    // …and the label is bound under no other caption either.
    expect(cells.map((cell) => cell.field)).not.toContain('label')
  })

  it('keeps every other line, in the order it printed', () => {
    expect(ACR_HEADER_ROWS.map((row) => row.map((cell) => [cell.label, cell.field]))).toEqual([
      [
        ['عن يوم: ', 'acrDateText'],
        ['رقم التجميعي: ', 'acrNumberText'],
        ['المدينة: ', 'cities'],
      ],
      [
        ['تاريخ التحصيل: ', 'collectionDateText'],
        ['الحالة: ', 'status'],
        ['أُغلق بواسطة: ', 'closedByText'],
      ],
    ])
  })

  it('the serial still prints bold, and who closed it still keeps its two spaces', () => {
    expect(cells.filter((cell) => cell.strong).map((cell) => cell.field)).toEqual(['acrNumberText'])
    expect(cells.filter((cell) => cell.keepSpaces).map((cell) => cell.field)).toEqual(['closedByText'])
  })

  it('every label keeps the trailing space the stylesheet preserves', () => {
    for (const cell of cells) expect(cell.label.endsWith(': ')).toBe(true)
  })

  it('the label is still in the document — it is the header that stopped printing it', () => {
    // D14: the stored value is unchanged. Were the fixture's label blank, "no
    // description line" would prove nothing.
    for (const { document } of ACR_SCENARIOS) expect(document.form.label).not.toBe('')
  })
})
