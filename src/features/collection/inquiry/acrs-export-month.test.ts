import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { INQUIRY_EXPORT_CAPABILITIES_KEY, type InquiryExportCapabilities } from '@/core/inquiry-export/api'
import ExportSplitButton from '@/core/inquiry-export/ExportSplitButton'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'

// BackOffice ticket 4321 (spec 4314): the ACRs screen offers Export month… only to a session holding the ACRs export
// permission (`AcrsExport` — Capabilities lists `Acrs`). Holding another screen's export is not enough.

const quick = { label: 'Export', onExport: () => {}, disabled: false }
const month = { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } }

const draw = (caps: InquiryExportCapabilities) =>
  drawExport(
    createElement(ExportSplitButton, { screen: 'Acrs', quick, month }),
    seeded([[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]]),
  )

describe('ACRs: Export month follows the ACRs export permission', () => {
  it('with the ACRs export permission: the Export month… menu', () => {
    const html = draw({ enabled: true, screens: ['Acrs'] })
    expect(html).toContain('data-export-month-toggle')
  })

  it("with only another screen's export permission: the quick export alone", () => {
    const html = draw({ enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })
})
