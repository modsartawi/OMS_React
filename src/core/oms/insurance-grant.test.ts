/**
 * The insurance-view grant (spec 3389, client tickets 786–789) off the one permissions answer (oms 909):
 * `OmsInsuranceView:03`. It guards health data, so nothing else implies it.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { canViewInsurance } from './insurance-grant'

describe('canViewInsurance', () => {
  it('grants on OmsInsuranceView:03', () => {
    expect(canViewInsurance(permissionsOf({ screens: ['OmsInsuranceView:03'] }))).toBe(true)
  })

  it('an unanswered or failed answer grants nothing', () => {
    expect(canViewInsurance(permissionsOf(null))).toBe(false)
  })

  it('no other OMS grant implies it', () => {
    const everything = ['DocumentList:03', 'DocumentDetails:03', 'DocumentDetails:02', 'OmsCreateReturn:01', 'PickSupport:03']
    expect(canViewInsurance(permissionsOf({ screens: everything }))).toBe(false)
  })
})
