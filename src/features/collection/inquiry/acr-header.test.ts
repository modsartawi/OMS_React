import { describe, expect, it } from 'vitest'
import { ACR_HEADER_ROWS, headerCellValue } from './acr-header'
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
        // Ticket 425 (ADR 0066): the number as printed, falling back below.
        ['رقم التجميعي: ', 'acrNo'],
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
    expect(cells.filter((cell) => cell.strong).map((cell) => cell.field)).toEqual(['acrNo'])
    expect(cells.filter((cell) => cell.keepSpaces).map((cell) => cell.field)).toEqual(['closedByText'])
  })

  it('every label keeps the trailing space the stylesheet preserves', () => {
    for (const cell of cells) expect(cell.label.endsWith(': ')).toBe(true)
  })

  // 🔑 Ticket 425 (ADR 0066, BackOffice 2427/2429): the serial prints as the server
  // formatted it — never built here from the collector and the month.
  describe('acr columns and header show acrNo; legacy shows the plain number', () => {
    const serial = cells.find((cell) => cell.label === 'رقم التجميعي: ')!
    const form = (key: string) => ACR_SCENARIOS.find((s) => s.key === key)!.document.form

    it('prints a new ACR’s full number, as sent', () => {
      expect(headerCellValue(form('three-pages'), serial)).toBe('40219-2606-0003')
    })

    it('prints a legacy ACR’s plain number — its acrNo IS the plain number', () => {
      expect(headerCellValue(form('empty'), serial)).toBe('4482')
    })

    it('falls back to acrNumberText against a SIS.Api that sends no acrNo', () => {
      const { acrNo: _dropped, ...older } = form('three-pages')
      void _dropped
      expect(headerCellValue(older, serial)).toBe('3')
      expect(headerCellValue({ ...form('three-pages'), acrNo: '' }, serial)).toBe('3')
    })

    it('isolates the number left-to-right on the RTL sheet — a machine value, whole', () => {
      expect(serial.ltr).toBe(true)
      // …and only the number: the other cells print as before.
      expect(cells.filter((cell) => cell.ltr).map((cell) => cell.field)).toEqual(['acrNo'])
    })

    it('every other cell prints its field as sent, no fallback in play', () => {
      for (const cell of cells.filter((c) => c !== serial)) {
        expect(cell.fallback).toBeUndefined()
        expect(headerCellValue(form('three-pages'), cell)).toBe(form('three-pages')[cell.field])
      }
    })

    it('the fixture carries both kinds of number', () => {
      const numbers = ACR_SCENARIOS.map((s) => s.document.form.acrNo)
      expect(numbers).toContain('40219-2606-0003')
      expect(numbers).toContain('4482')
    })
  })

  it('the label is still in the document — it is the header that stopped printing it', () => {
    // D14: the stored value is unchanged. Were the fixture's label blank, "no
    // description line" would prove nothing.
    for (const { document } of ACR_SCENARIOS) expect(document.form.label).not.toBe('')
  })
})
