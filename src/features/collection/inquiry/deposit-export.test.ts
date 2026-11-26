import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import {
  INQUIRY_EXPORT_CAPABILITIES_KEY,
  MY_EXPORTS_PATH,
  type InquiryExportCapabilities,
} from '@/core/inquiry-export/api'
import ExportSplitButton from '@/core/inquiry-export/ExportSplitButton'
import { drawExport, seeded } from '@/core/inquiry-export/test-render'
import en from '@/locales/en/inquiry-export.json'
import ar from '@/locales/ar/inquiry-export.json'
import { buildDepositsParams, depositsExportFilters } from './deposit-criteria'

// Ticket 4322 (spec 4314): Export month… on Deposits is offered only with the Deposits export permission — the
// capabilities answer lists `Deposits` — and another screen's permission does not open it.

const quick = { label: 'Export', onExport: () => {}, disabled: false }
const month = { gridApi: null, columnDefs: [], filters: {}, range: { from: '', to: '' } }

const draw = (screen: 'Deposits' | 'CollectionAttempts', caps: InquiryExportCapabilities) =>
  drawExport(
    createElement(ExportSplitButton, { screen, quick, month }),
    seeded([[INQUIRY_EXPORT_CAPABILITIES_KEY, caps]]),
  )

describe('Deposits Export month… follows its own export permission', () => {
  it('with the Deposits export permission: the Export month… menu on Deposits', () => {
    expect(draw('Deposits', { enabled: true, screens: ['Deposits'] })).toContain('data-export-month-toggle')
  })

  it('with only the Collection Attempts permission: Deposits keeps the quick export alone', () => {
    const html = draw('Deposits', { enabled: true, screens: ['CollectionAttempts'] })
    expect(html).toContain('data-quick-export')
    expect(html).not.toContain('data-export-month-toggle')
  })

  it('the Deposits permission does not open Export month… on another screen', () => {
    expect(draw('CollectionAttempts', { enabled: true, screens: ['Deposits'] })).not.toContain(
      'data-export-month-toggle',
    )
  })

  it('My exports for a Deposits job lives under Collections, named in both languages', () => {
    expect(MY_EXPORTS_PATH.Deposits).toBe('/collection/exports')
    expect(en.screens.Deposits).toBe('Deposits')
    expect(ar.screens.Deposits).toBe('الإيداعات')
  })
})

describe('depositsExportFilters', () => {
  it('sends the applied filters minus the limit and the collection-date pair, which pre-fills the range', () => {
    const applied = buildDepositsParams({
      collectionDateFrom: '2026-11-01',
      collectionDateTo: '2026-11-26',
      businessDateFrom: '2026-10-30',
      bankCode: 'RJHI',
      status: 'POSTED',
    })
    const { filters, range } = depositsExportFilters(applied)
    expect(range).toEqual({ from: '2026-11-01', to: '2026-11-26' })
    expect(filters).toEqual({ BusinessDateFrom: '2026-10-30', BankCode: 'RJHI', Status: 'POSTED' })
  })

  it('an open collection-date end pre-fills as blank', () => {
    expect(depositsExportFilters(buildDepositsParams({})).range).toEqual({ from: '', to: '' })
  })
})
