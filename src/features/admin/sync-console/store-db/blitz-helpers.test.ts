import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { permissionsOf } from '@/core/permissions'
import type { StoreDbBlitz } from '@/core/models/store-database'
import blitzFixture from './__fixtures__/blitz.json'
import { blitzControls, blitzFindings, blitzLink, blitzNotInstalled, blitzState } from './blitz-helpers'

/** Oms 919 (BackOffice 4039, spec 4016 D18): sp_Blitz on the Health check panel. */
const VIEW = permissionsOf({ screens: ['StoreDatabaseView:03'] })
const ACT = permissionsOf({ screens: ['StoreDatabaseView:03', 'StoreDatabaseAct:06'] })

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

describe('the install state (BO 4039 open: no door carries it)', () => {
  const refused = new ApiError('business', 'sp_Blitz is not installed on P104.', 409, [{ errorCode: 'BLITZ_NOT_INSTALLED', errorMessage: 'sp_Blitz is not installed on P104.', internalErrorCode: '' }])

  it('is unknown until sp_Blitz is run', () => {
    expect(blitzState(undefined, null)).toBeNull()
  })

  it('a run that answered says it is installed, with HQ’s recorded build when there is one', () => {
    expect(blitzState(blitzFixture as StoreDbBlitz, null)).toEqual({ installed: true, version: '8.19' })
    expect(blitzState({ ...(blitzFixture as StoreDbBlitz), installedVersion: '' }, null)).toEqual({ installed: true, version: null })
  })

  it('a run refused BLITZ_NOT_INSTALLED says it is not; any other failure leaves it unknown', () => {
    expect(blitzState(undefined, refused)).toEqual({ installed: false, version: null })
    expect(blitzState(undefined, new ApiError('server', 'boom', 502))).toBeNull()
  })
})

describe('a finding’s "read more" link', () => {
  it('keeps a web address', () => {
    expect(blitzLink('https://www.brentozar.com/go/backup')).toBe('https://www.brentozar.com/go/backup')
    expect(blitzLink('http://BrentOzar.com/go/dbcc')).toBe('http://BrentOzar.com/go/dbcc')
    expect(blitzLink('  HTTPS://example.com/x  ')).toBe('HTTPS://example.com/x')
  })

  it('drops anything that is not http or https — a server value never becomes a script link', () => {
    expect(blitzLink('javascript:alert(1)')).toBeNull()
    expect(blitzLink(' JavaScript:alert(1)')).toBeNull()
    expect(blitzLink('data:text/html,<script>1</script>')).toBeNull()
    expect(blitzLink('file:///C:/x')).toBeNull()
    expect(blitzLink('//evil.example/x')).toBeNull()
    expect(blitzLink('/relative/path')).toBeNull()
    expect(blitzLink('not a url')).toBeNull()
    expect(blitzLink('')).toBeNull()
    expect(blitzLink(null)).toBeNull()
  })
})
