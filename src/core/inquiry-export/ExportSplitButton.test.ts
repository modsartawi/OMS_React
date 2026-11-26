import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { INQUIRY_EXPORT_CAPABILITIES_KEY, type InquiryExportCapabilities } from './api'
import ExportSplitButton from './ExportSplitButton'
import { drawExport, seeded } from './test-render'

// Ticket 4318 (spec 4314 story 23): Export month… is offered only when the feature is on AND this session holds the
// screen's export permission (the capabilities answer lists the screen). Otherwise the screen keeps exactly the quick
// export it had.

const quick = { label: 'Export', onExport: () => {}, disabled: false }
const month = { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } }

const draw = (caps: InquiryExportCapabilities | undefined) =>
  drawExport(
    createElement(ExportSplitButton, { screen: 'CollectionAttempts', quick, month }),
    seeded(caps ? [[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]] : []),
  )

describe('ExportSplitButton hides Export month without the permission or with the feature off', () => {
  it('feature on and the screen listed: the quick export and the Export month… menu', () => {
    const html = draw({ enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('Export')
    expect(html).toMatch(/data-export-month-toggle[^>]*aria-haspopup="menu"|aria-haspopup="menu"[^>]*data-export-month-toggle/)
  })

  it('feature on but no export permission for this screen: the quick export alone', () => {
    const html = draw({ enabled: true, screens: ['SomeOtherScreen'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('feature off (no share configured): the quick export alone, whatever the screens say', () => {
    const html = draw({ enabled: false, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('capabilities not answered yet (or failed): the quick export alone', () => {
    const html = draw(undefined)
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })
})
