/**
 * The download's file name, read off the header the server actually sends.
 *
 * The real one from SIS.Api's render rail carries **both** the plain and the RFC
 * 5987 form in the same header, which is the case a reader written against a
 * single example gets wrong — and a `;` inside the quoted value is the other one
 * (a naive `split(';')` truncates the name at it).
 */
import { describe, expect, it } from 'vitest'
import { filenameFromDisposition } from './content-disposition'

describe('filenameFromDisposition', () => {
  it('prefers filename* when the header carries both — the live shape', () => {
    const header =
      'attachment; filename="Invoice-P001-REG-01-O426250B87CB7A.pdf";' +
      " filename*=UTF-8''Invoice-P001-REG-01-O426250B87CB7A.pdf"
    expect(filenameFromDisposition(header)).toBe('Invoice-P001-REG-01-O426250B87CB7A.pdf')
  })

  it('percent-decodes a UTF-8 filename*', () => {
    const header = "attachment; filename=\"Invoice.pdf\"; filename*=UTF-8''%D9%81%D8%A7%D8%AA%D9%88%D8%B1%D8%A9.pdf"
    expect(filenameFromDisposition(header)).toBe('فاتورة.pdf')
  })

  it('falls back to the plain filename when filename* is absent', () => {
    expect(filenameFromDisposition('attachment; filename="Invoice-P001-01-00114600051234.pdf"')).toBe(
      'Invoice-P001-01-00114600051234.pdf',
    )
  })

  it('reads an unquoted filename', () => {
    expect(filenameFromDisposition('attachment; filename=Invoice.pdf')).toBe('Invoice.pdf')
  })

  it('does not split on a ; INSIDE the quoted value', () => {
    expect(filenameFromDisposition('attachment; filename="Invoice; final.pdf"')).toBe('Invoice; final.pdf')
  })

  it('un-escapes an escaped quote inside the value', () => {
    expect(filenameFromDisposition('attachment; filename="Invoice \\"final\\".pdf"')).toBe('Invoice "final".pdf')
  })

  it('is case-insensitive about the parameter name', () => {
    expect(filenameFromDisposition('Attachment; FileName="Invoice.pdf"')).toBe('Invoice.pdf')
  })

  it('returns null rather than a guess when there is no header', () => {
    expect(filenameFromDisposition(null)).toBeNull()
    expect(filenameFromDisposition(undefined)).toBeNull()
    expect(filenameFromDisposition('')).toBeNull()
  })

  it('returns null when the header names no filename at all', () => {
    expect(filenameFromDisposition('attachment')).toBeNull()
    expect(filenameFromDisposition('inline; size=48211')).toBeNull()
  })

  it('falls back to the plain form when filename* will not decode', () => {
    expect(filenameFromDisposition("attachment; filename=\"Invoice.pdf\"; filename*=UTF-8''%E0%A4%A.pdf")).toBe(
      'Invoice.pdf',
    )
  })
})
