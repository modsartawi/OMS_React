import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { INQUIRY_EXPORT_CAPABILITIES_KEY, MY_EXPORTS_PATH, type InquiryExportCapabilities } from '@/core/inquiry-export/api'
import ExportSplitButton from '@/core/inquiry-export/ExportSplitButton'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'
import { deliveryExportMonth } from './export-month'
import { BLANK_QUERY } from './query-model'

// Ticket 4324 (BackOffice spec 4314): the Delivery list's Export month…. The button is offered on this screen only when
// the session holds THIS screen's export permission (DeliveryListExport:03, listed as `DeliveryList` by Capabilities);
// another screen's permission does not offer it here.

const quick = { label: 'Export', onExport: () => {}, disabled: false }
const month = { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } }

const draw = (caps: InquiryExportCapabilities) =>
  drawExport(
    createElement(ExportSplitButton, { screen: 'DeliveryList', quick, month }),
    seeded([[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]]),
  )

describe('the Delivery list offers Export month… only with its own export permission', () => {
  it('DeliveryList listed: the split button with Export month…', () => {
    const html = draw({ enabled: true, screens: ['DeliveryList'] })
    expect(html).toContain('data-quick-export')
    expect(html).toContain('data-export-month-toggle')
  })

  it("another screen's export permission only: the quick export alone", () => {
    const html = draw({ enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('feature off: the quick export alone', () => {
    const html = draw({ enabled: false, screens: ['DeliveryList'] })
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('the file is collected from My exports in the OMS area', () => {
    expect(MY_EXPORTS_PATH.DeliveryList).toBe('/oms/exports')
  })
})

describe('deliveryExportMonth sends the applied search without the limit and the dates', () => {
  const now = new Date(2026, 10, 26, 10, 0)

  it('a custom range pre-fills the dialog; the filters are the query string minus Limit/FromDate/ToDate', () => {
    const { filters, range } = deliveryExportMonth(
      {
        ...BLANK_QUERY,
        date: { preset: 'custom', from: '2026-11-01', to: '2026-11-20' },
        storeCode: ' P001 ',
        isExpress: true,
        limit: 500,
      },
      now,
    )
    expect(range).toEqual({ from: '2026-11-01', to: '2026-11-20' })
    expect(filters).toEqual({ StoreCode: 'P001', IsExpress: true })
  })

  it('a number filter stays a filter (the job still reads only its days)', () => {
    const { filters, range } = deliveryExportMonth({ ...BLANK_QUERY, documentNo: '1000001181' }, now)
    expect(filters).toEqual({ DocumentNo: '1000001181' })
    expect(range).toEqual({ from: '', to: '' })
  })

  it('no search yet: nothing to send, an open range', () => {
    expect(deliveryExportMonth(null, now)).toEqual({ filters: {}, range: { from: '', to: '' } })
  })
})
