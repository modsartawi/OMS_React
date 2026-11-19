import type { ColDef, ColGroupDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import type { BbyInquiryRow } from '@/core/models/bonus-buy-inquiry'
import { buildInquiryColumns } from './columns'

const t = ((key: string) => key) as unknown as TFunction

type Col = ColDef<BbyInquiryRow> | ColGroupDef<BbyInquiryRow>
const leaves = (cols: Col[]): ColDef<BbyInquiryRow>[] =>
  cols.flatMap((c) => ('children' in c ? leaves(c.children as Col[]) : [c as ColDef<BbyInquiryRow>]))

// Spec 4040 story 21 / ticket 921: support lists every VAT-inclusive bonus buy from the grid.
describe('buildInquiryColumns', () => {
  const cols = leaves(buildInquiryColumns(t, () => {}))
  const mark = cols.find((c) => c.field === 'minValueInclVat')

  it('carries a column for the minimum’s incl. VAT mark, beside the minimum', () => {
    expect(mark).toBeDefined()
    expect(mark?.headerName).toBe('columns.minValueInclVat')
    const fields = cols.map((c) => c.field)
    expect(fields.indexOf('minValueInclVat')).toBe(fields.indexOf('minValue') + 1)
  })

  it('reads a marked row ✓ and an unmarked or pre-4044 row –', () => {
    const fmt = mark?.valueFormatter as (p: { value: unknown }) => string
    expect(fmt({ value: true })).toBe('✓')
    expect(fmt({ value: false })).toBe('–')
    expect(fmt({ value: undefined })).toBe('–')
  })
})
