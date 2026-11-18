import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { canOpenSapExport } from './access'

/**
 * The console's access spine (ticket 461; oms 914): the nav leaf and the page's `ScreenGate` each read this ONE
 * predicate over the one permissions answer.
 */
describe('canOpenSapExport', () => {
  it('opens only on SapExportConsole:03', () => {
    expect(canOpenSapExport(permissionsOf({ screens: ['SapExportConsole:03'] }))).toBe(true)
    expect(canOpenSapExport(permissionsOf({ screens: ['SapExportConsole:06', 'IDocInspector:03'] }))).toBe(false)
  })

  it('🚩 fails closed on a pending or failed answer', () => {
    expect(canOpenSapExport(permissionsFromQuery({ isPending: true, isError: false, data: undefined }))).toBe(false)
    expect(canOpenSapExport(permissionsFromQuery({ isPending: false, isError: true, data: undefined }))).toBe(false)
    expect(canOpenSapExport(permissionsOf(null))).toBe(false)
  })
})
