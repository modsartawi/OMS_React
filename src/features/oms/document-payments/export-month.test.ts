import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { INQUIRY_EXPORT_CAPABILITIES_KEY, MY_EXPORTS_PATH, type InquiryExportCapabilities } from '@/core/inquiry-export/api'
import ExportSplitButton from '@/core/inquiry-export/ExportSplitButton'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'
import { defaultCriteria, exportMonthFilters } from './criteria'

// BackOffice spec 4314, ticket 4325: Document payments offers Export month… only to a session holding ITS export
// permission (DocumentPaymentsExport:03 — the capabilities answer lists 'DocumentPayments'), never on another screen's.

const quick = { label: 'Export to Excel', onExport: () => {}, disabled: false }
const month = { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } }

const draw = (caps: InquiryExportCapabilities) =>
  drawExport(
    createElement(ExportSplitButton, { screen: 'DocumentPayments', quick, month }),
    seeded([[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]]),
  )

describe('Document payments: Export month… with its own export permission only', () => {
  it('the session may export Document payments: the menu is offered', () => {
    const html = draw({ enabled: true, screens: ['DocumentPayments'] })
    expect(html).toContain('data-export-month-toggle')
  })

  it('another screen’s export permission does not offer it here', () => {
    const html = draw({ enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('the feature off: the quick export alone', () => {
    expect(draw({ enabled: false, screens: ['DocumentPayments'] })).not.toContain('data-export-month-toggle')
  })

  it('its file is collected from the OMS My exports', () => {
    expect(MY_EXPORTS_PATH.DocumentPayments).toBe('/oms/exports')
  })
})

describe('exportMonthFilters: the applied search, minus the limit and the day pair', () => {
  it('pasted numbers travel as typed, and the day pair becomes the range (dates always bound the job)', () => {
    const applied = {
      ...defaultCriteria(new Date(2026, 10, 3)),
      to: '2026-11-20',
      storeCode: ' P001 ',
      documentNos: '1000001\r\n1000002',
      orderNos: '',
      limit: '50',
    }
    expect(exportMonthFilters(applied)).toEqual({
      filters: { StoreCode: 'P001', DocumentNo: '1000001\r\n1000002' },
      range: { from: '2026-11-03', to: '2026-11-20' },
    })
  })

  it('no search yet: no filters and an open range', () => {
    expect(exportMonthFilters(null)).toEqual({ filters: {}, range: { from: '', to: '' } })
  })
})
