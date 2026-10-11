import { describe, expect, it } from 'vitest'
import { SAP_EXPORT_ACCESS_KEY, canOpenSapExport, sapExportAccessQuery } from './access'

/**
 * The console's access spine (ticket 461): the nav leaf and the page's `ScreenGate` each read
 * ONE predicate over ONE shared query, so this pure module is where "hidden without the grant"
 * and "guards itself" are decided. The rendering of the shut door is driven
 * (`tools/sap-export-storeday-drive.mjs`, section 10).
 */
describe('canOpenSapExport', () => {
  it('opens only on an explicit grant', () => {
    expect(canOpenSapExport({ screenAllowed: true })).toBe(true)
    expect(canOpenSapExport({ screenAllowed: false })).toBe(false)
  })

  it('🚩 fails closed on a pending, thrown or malformed probe', () => {
    expect(canOpenSapExport(undefined)).toBe(false)
    expect(canOpenSapExport(null)).toBe(false)
    expect(canOpenSapExport({} as never)).toBe(false)
    expect(canOpenSapExport({ screenAllowed: 'true' } as never)).toBe(false)
    expect(canOpenSapExport({ screenAllowed: 1 } as never)).toBe(false)
  })
})

describe('sapExportAccessQuery', () => {
  it('shares the one key, never retries a refusal, and asks once per page life', () => {
    const q = sapExportAccessQuery()
    expect(q.queryKey).toBe(SAP_EXPORT_ACCESS_KEY)
    expect(q.retry).toBe(false)
    expect(q.staleTime).toBe(Infinity)
  })
})
