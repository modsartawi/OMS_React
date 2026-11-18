/**
 * The Nphies area's predicates over the one permissions answer (oms 909, BackOffice spec 4002). The release and the
 * undispense grants count only beside the area's own grant: the half-grant is no grant.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canOpenNphies, canReleaseApprovalNumber, canUndispense } from './access'

const p = (...screens: string[]) => permissionsOf({ screens })

describe('Nphies predicates', () => {
  it('the area opens on Nphies:03 alone', () => {
    expect(canOpenNphies(p('Nphies:03'))).toBe(true)
    expect(canOpenNphies(p('NphiesReleaseApproval:03', 'NphiesUndispense:03'))).toBe(false)
  })

  it('release needs Nphies:03 AND NphiesReleaseApproval:03', () => {
    expect(canReleaseApprovalNumber(p('Nphies:03', 'NphiesReleaseApproval:03'))).toBe(true)
    expect(canReleaseApprovalNumber(p('Nphies:03'))).toBe(false)
    // half-grant: the release key without the area's own grant
    expect(canReleaseApprovalNumber(p('NphiesReleaseApproval:03'))).toBe(false)
  })

  it('undispense needs Nphies:03 AND NphiesUndispense:03', () => {
    expect(canUndispense(p('Nphies:03', 'NphiesUndispense:03'))).toBe(true)
    expect(canUndispense(p('Nphies:03'))).toBe(false)
    expect(canUndispense(p('NphiesUndispense:03'))).toBe(false)
  })

  it('an unanswered permissions answer grants nothing', () => {
    const none = permissionsOf(null)
    expect(canOpenNphies(none)).toBe(false)
    expect(canReleaseApprovalNumber(none)).toBe(false)
    expect(canUndispense(none)).toBe(false)
  })
})
