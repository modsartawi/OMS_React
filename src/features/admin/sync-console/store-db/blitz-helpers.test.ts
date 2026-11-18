import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { permissionsOf } from '@/core/permissions'
import type { StoreDbBlitz } from '@/core/models/store-database'
import blitzFixture from './__fixtures__/blitz.json'
import { blitzControls, blitzFindings, blitzNotInstalled } from './blitz-helpers'

/** Oms 919 (BackOffice 4039, spec 4016 D18): sp_Blitz on the Health check panel. */
const VIEW = permissionsOf({ screens: ['StoreDatabase:03'] })
const ACT = permissionsOf({ screens: ['StoreDatabase:03', 'StoreDatabase:06'] })

describe('the sp_Blitz controls', () => {
  it('a View holder may run it, never install or remove it', () => {
    expect(blitzControls(VIEW, { installed: true, version: '8.19' })).toEqual({ run: true, install: false, remove: false })
    expect(blitzControls(VIEW, { installed: false, version: null })).toEqual({ run: true, install: false, remove: false })
  })

  it('an Act holder installs it where it is absent, and removes it where it is installed', () => {
    expect(blitzControls(ACT, { installed: false, version: null })).toEqual({ run: true, install: true, remove: false })
    expect(blitzControls(ACT, { installed: true, version: '8.19' })).toEqual({ run: true, install: true, remove: true })
  })

  it('offers both when the store door does not say whether it is installed', () => {
    expect(blitzControls(ACT, null)).toEqual({ run: true, install: true, remove: true })
  })
})

describe('the sp_Blitz findings', () => {
  it('come most urgent first', () => {
    const rows = blitzFindings(blitzFixture as StoreDbBlitz)
    expect(rows.map((r) => r.priority)).toEqual([1, 50, 200])
    expect(rows[0].finding).toBe('Backups Not Performed Recently')
  })

  it('read a missing list as none', () => {
    expect(blitzFindings(null)).toEqual([])
    expect(blitzFindings({} as StoreDbBlitz)).toEqual([])
  })
})

describe('a store without sp_Blitz', () => {
  it('is told by the door’s refusal, not an empty result', () => {
    const refused = new ApiError('business', 'sp_Blitz is not installed on P104.', 400, [{ errorCode: 'BLITZ_NOT_INSTALLED', errorMessage: 'sp_Blitz is not installed on P104.', internalErrorCode: '' }])
    expect(blitzNotInstalled(refused)).toBe(true)
    expect(blitzNotInstalled(new ApiError('server', 'boom', 500))).toBe(false)
    expect(blitzNotInstalled(null)).toBe(false)
  })
})
