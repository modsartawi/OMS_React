/**
 * Ticket 3149 — the configuration probe: the menu leaf and the ScreenGate share one View predicate (the existing OMS
 * access) that fails closed; every write affordance reads its own Edit flag, so Edit is hidden without the grant.
 */
import { describe, expect, it } from 'vitest'
import { DOC_TYPE_CONFIG_ACCESS_KEY, canEditDocTypeConfig, canViewDocTypeConfig, docTypeConfigAccessQuery } from './api'
import type { DocTypeConfigAccess } from './types'

describe('the configuration probe', () => {
  it('each flag reads only its own field', () => {
    const view: DocTypeConfigAccess = { canViewDocTypeConfig: true, canEditDocTypeConfig: false }
    expect([canViewDocTypeConfig(view), canEditDocTypeConfig(view)]).toEqual([true, false])
    const both: DocTypeConfigAccess = { canViewDocTypeConfig: true, canEditDocTypeConfig: true }
    expect([canViewDocTypeConfig(both), canEditDocTypeConfig(both)]).toEqual([true, true])
  })

  it.each([null, undefined, [], {}, { canViewDocTypeConfig: 'true', canEditDocTypeConfig: 1 }])('🚩 %j grants nothing', (r) => {
    expect(canViewDocTypeConfig(r as unknown as DocTypeConfigAccess)).toBe(false)
    expect(canEditDocTypeConfig(r as unknown as DocTypeConfigAccess)).toBe(false)
  })

  it('one key, no retry, never stale in a page life', () => {
    const q = docTypeConfigAccessQuery()
    expect(q.queryKey).toEqual(['admin', 'doc-type-config', 'access'])
    expect(DOC_TYPE_CONFIG_ACCESS_KEY).toEqual(['admin', 'doc-type-config', 'access'])
    expect(q.retry).toBe(false)
    expect(q.staleTime).toBe(Infinity)
  })
})
