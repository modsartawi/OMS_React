import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { INQUIRY_EXPORT_CAPABILITIES_KEY, type InquiryExportCapabilities } from '@/core/inquiry-export/api'
import ExportSplitButton from '@/core/inquiry-export/ExportSplitButton'
import { planExportMonth } from '@/core/inquiry-export/export-month'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'
import { buildAcrScopedParams } from './acr-scope'
import { buildCollectionsParams, landingCriteria } from './collections-criteria'
import { collectionsMonthFilters } from './collections-export'

// BackOffice ticket 4323 (spec 4314): Export month… on Cash Collections. The button is offered for this screen only when
// the session holds ITS export permission (CashCollectionsExport, listed by Capabilities as "CashCollections"); the
// request carries the grid's applied filters; and one ACR (the ?acr= drill-down) needs no dates (spec story 37).

const quick = { label: 'Export', onExport: () => {}, disabled: false }

const draw = (caps: InquiryExportCapabilities) =>
  drawExport(
    createElement(ExportSplitButton, {
      screen: 'CashCollections',
      quick,
      month: { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } },
    }),
    seeded([[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]]),
  )

describe('Cash Collections offers Export month… only with its own export permission', () => {
  it('the screen listed: the split button', () => {
    expect(draw({ enabled: true, screens: ['CashCollections'] })).toContain('data-export-month-toggle')
  })

  it("another screen's permission (Collection Attempts) is not this screen's: the quick export alone", () => {
    const html = draw({ enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('feature off: the quick export alone', () => {
    expect(draw({ enabled: false, screens: ['CashCollections'] })).not.toContain('data-export-month-toggle')
  })
})

describe("Cash Collections' month request", () => {
  const columnDefs = [{ colId: 'collectionReceiptNo', headerName: 'Receipt No#' }]

  it('sends the applied filters minus the limit and the collection-date pair, which pre-fills the range', () => {
    const params = buildCollectionsParams({
      ...landingCriteria(),
      collectionDateFrom: '2026-07-01',
      collectionDateTo: '2026-07-31',
      businessDateFrom: '2026-06-30',
      storeId: 'P001',
      collectionTypes: ['Regular'],
      hasStolen: true,
      amountFrom: '100',
    })
    const month = collectionsMonthFilters(params)

    expect(month.range).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(month.undated).toBe(false)
    expect(month.filters).toEqual({
      BusinessDateFrom: '2026-06-30',
      StoreId: 'P001',
      CollectionTypes: ['Regular'],
      HasStolen: true,
      AmountFrom: '100',
    })
  })

  it('a dated screen still needs both dates', () => {
    const plan = planExportMonth({
      screen: 'CashCollections',
      from: '',
      to: '',
      source: { gridApi: null, columnDefs, ...collectionsMonthFilters(buildCollectionsParams(landingCriteria())) },
      language: 'en',
    })
    expect(plan).toEqual({ ok: false, problem: 'missingEnd' })
  })

  it('one ACR: no dates asked for, none sent, the ACR is the filter', () => {
    const month = collectionsMonthFilters(buildAcrScopedParams('01ACR'))
    expect(month.undated).toBe(true)

    const plan = planExportMonth({
      screen: 'CashCollections',
      from: '',
      to: '',
      source: { gridApi: null, columnDefs, ...month },
      language: 'ar',
    })
    expect(plan).toEqual({
      ok: true,
      request: {
        screen: 'CashCollections',
        fromDate: null,
        toDate: null,
        filters: { AcrId: '01ACR' },
        columns: [{ id: 'collectionReceiptNo', header: 'Receipt No#' }],
        language: 'ar',
      },
    })
  })
})
