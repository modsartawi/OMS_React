import { describe, expect, it } from 'vitest'
import { permissionsFromQuery, permissionsOf } from '@/core/permissions'
import { canOpenIDocInspector } from './api'

/**
 * Ticket 296's proofs, on the seam that decides them — since oms 914 one predicate over the one permissions answer.
 * The nav leaf and the screen's own `ScreenGate` both pass `canOpenIDocInspector`, so this IS the access spine.
 */
const p = (...screens: string[]) => permissionsOf({ screens })

describe('theScreenIsHiddenFromTheNavWithoutTheGrant', () => {
  it('is shown only on IDocInspector:03', () => {
    expect(canOpenIDocInspector(p('IDocInspector:03'))).toBe(true)
    expect(canOpenIDocInspector(p())).toBe(false)
    expect(canOpenIDocInspector(p('IDocInspector:02'))).toBe(false)
  })

  it('🚩 stays hidden while the answer is pending or has failed', () => {
    expect(canOpenIDocInspector(permissionsFromQuery({ isPending: true, isError: false, data: undefined }))).toBe(false)
    expect(canOpenIDocInspector(permissionsFromQuery({ isPending: false, isError: true, data: undefined }))).toBe(false)
  })

  it('🔑 reads its own grant, never the invoices one', () => {
    expect(canOpenIDocInspector(p('RetailInvoice:03'))).toBe(false)
  })
})
