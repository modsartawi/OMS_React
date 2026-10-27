/**
 * Ticket 3149 (spec 3148 story 6) — the list's filter: by category, and a search over code or description.
 */
import { describe, expect, it } from 'vitest'
import { categoriesOf, filterDocumentTypes } from './list-filter'
import type { DocumentTypeListRow } from './types'

const row = (documentType: string, description: string, documentCategory = 'O', engineType = ''): DocumentTypeListRow => ({
  documentType,
  description,
  documentCategory,
  engineType,
})
const ROWS = [row('BUPA', 'Bupa insurance'), row('ORRT', 'Order return', 'R'), row('WSFD', 'Wasfaty', 'X'), row('CASH', 'Cash order')]
const codes = (rows: DocumentTypeListRow[]) => rows.map((r) => r.documentType)

describe('filterDocumentTypes', () => {
  it('keeps everything with no filter', () => {
    expect(codes(filterDocumentTypes(ROWS, { category: '', search: '' }))).toEqual(['BUPA', 'ORRT', 'WSFD', 'CASH'])
  })

  it('filters by category', () => {
    expect(codes(filterDocumentTypes(ROWS, { category: 'O', search: '' }))).toEqual(['BUPA', 'CASH'])
  })

  it('searches the code or the description, either case, trimmed', () => {
    expect(codes(filterDocumentTypes(ROWS, { category: '', search: ' wsf ' }))).toEqual(['WSFD'])
    expect(codes(filterDocumentTypes(ROWS, { category: '', search: 'ORDER' }))).toEqual(['ORRT', 'CASH'])
  })

  it('combines both', () => {
    expect(codes(filterDocumentTypes(ROWS, { category: 'O', search: 'order' }))).toEqual(['CASH'])
  })
})

describe('categoriesOf', () => {
  it('lists each category once, sorted', () => {
    expect(categoriesOf(ROWS)).toEqual(['O', 'R', 'X'])
  })
})
