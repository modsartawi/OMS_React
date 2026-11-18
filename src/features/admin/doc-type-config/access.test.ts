/**
 * Ticket 3149, read off the one permissions answer since oms 909 (BackOffice spec 4002, the SdDocTypeConfig row): the
 * menu leaf and the ScreenGate share one View predicate (the existing OMS access, `DocumentList:03`); every write
 * affordance reads Edit, `DocumentList:03 && SdDocTypeConfig:06`, so Edit is hidden without both.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canEditDocTypeConfig, canViewDocTypeConfig } from './api'

const holding = (...screens: string[]) => permissionsOf({ screens })

describe('the configuration grants', () => {
  it('View is the OMS list grant alone', () => {
    expect(canViewDocTypeConfig(holding('DocumentList:03'))).toBe(true)
    expect(canEditDocTypeConfig(holding('DocumentList:03'))).toBe(false)
  })

  it('Edit needs both keys', () => {
    expect(canEditDocTypeConfig(holding('DocumentList:03', 'SdDocTypeConfig:06'))).toBe(true)
  })

  it('half-grant: SdDocTypeConfig:06 without DocumentList:03 is neither view nor edit', () => {
    const half = holding('SdDocTypeConfig:06')
    expect([canViewDocTypeConfig(half), canEditDocTypeConfig(half)]).toEqual([false, false])
  })

  it('🚩 no answer, or a neighbouring key, grants nothing', () => {
    for (const p of [permissionsOf(null), holding('DocumentList:02', 'SdDocTypeConfig:03')]) {
      expect([canViewDocTypeConfig(p), canEditDocTypeConfig(p)]).toEqual([false, false])
    }
  })
})
