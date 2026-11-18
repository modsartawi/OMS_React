/**
 * Bonus Buy Maintenance's grants (BackOffice spec 2374, spec 2396), over the one permissions answer since oms 914
 * (BackOffice spec 4002). The brief's BbyMaintain combination: `screenAllowed = has('BbyMaintain:03')`,
 * `canTest = has('BbyMaintain:03') && has('BbyMaintain:04')`.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf, type ScreenKey } from '@/core/permissions'
import { canOpenBbyMaintain, canTestBbyMaintain } from './api'

const holding = (...screens: ScreenKey[]) => permissionsOf({ screens })

describe('the BbyMaintain combination', () => {
  it('the screen opens on BbyMaintain:03 alone', () => {
    expect(canOpenBbyMaintain(holding('BbyMaintain:03'))).toBe(true)
    expect(canTestBbyMaintain(holding('BbyMaintain:03'))).toBe(false)
  })

  it('Mark Tested needs both :03 and :04', () => {
    expect(canTestBbyMaintain(holding('BbyMaintain:03', 'BbyMaintain:04'))).toBe(true)
  })

  it('🚩 half grant: :04 without :03 opens nothing and offers no Test', () => {
    expect(canOpenBbyMaintain(holding('BbyMaintain:04'))).toBe(false)
    expect(canTestBbyMaintain(holding('BbyMaintain:04'))).toBe(false)
  })

  it('🚩 the inquiry grant is not the maintenance grant, and a failed answer grants nothing', () => {
    expect(canOpenBbyMaintain(holding('BbyInquiry:03'))).toBe(false)
    expect(canOpenBbyMaintain(permissionsOf(null))).toBe(false)
    expect(canTestBbyMaintain(permissionsOf(null))).toBe(false)
  })
})
