/**
 * The one permissions answer (oms 914, BackOffice spec 4002): `GET Auth/Permissions` read once, `has(key)` everywhere.
 * The pure halves of `usePermissions` and the 403 door in `@/core/api` that invalidates it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'
import { api } from './api'
import {
  PERMISSIONS_KEY,
  invalidatePermissionsOnForbidden,
  parsePermissionsAnswer,
  permissionsFromQuery,
  permissionsQuery,
  type PermissionsAnswer,
} from './permissions'

const answer = (over: Partial<Record<string, unknown>> = {}) => ({
  screens: ['Attachments:03:NPHIES', 'DocumentList:03', 'Nphies:03'],
  extras: {
    fileServerReady: true,
    notificationCenterOn: false,
    commandCenterOn: false,
    nphiesContractVersion: '1.3',
    canManageRoles: true,
    canManageUsers: false,
  },
  version: '0123456789abcdef0123456789abcdef',
  ...over,
})

const ready = (data: PermissionsAnswer | null) => permissionsFromQuery({ isPending: false, isError: false, data })

afterEach(() => vi.unstubAllGlobals())

describe('has', () => {
  it('is an exact, case-sensitive lookup over screens', () => {
    const p = ready(parsePermissionsAnswer(answer()))
    expect(p.has('DocumentList:03')).toBe(true)
    expect(p.has('Nphies:03')).toBe(true)
    expect(p.has('Attachments:03:NPHIES')).toBe(true)
    // Neighbours are not the key: another command, another case, a prefix, a three-field cousin.
    expect(p.has('DocumentList:02' as 'DocumentList:03')).toBe(false)
    expect(p.has('documentlist:03' as 'DocumentList:03')).toBe(false)
    expect(p.has('Nphies:0' as 'Nphies:03')).toBe(false)
    expect(p.has('Attachments:03:WASFATY')).toBe(false)
  })

  it('carries the extras verbatim and is settled', () => {
    const p = ready(parsePermissionsAnswer(answer()))
    expect(p.extras.fileServerReady).toBe(true)
    expect(p.extras.canManageRoles).toBe(true)
    expect(p.extras.canManageUsers).toBe(false)
    expect(p.extras.nphiesContractVersion).toBe('1.3')
    expect(p.settled).toBe(true)
    expect(p.failed).toBe(false)
  })
})

describe('fails closed', () => {
  it.each([
    ['not an object', 'DocumentList:03'],
    ['null', null],
    ['no screens', { extras: answer().extras, version: 'x' }],
    ['screens not an array', answer({ screens: 'DocumentList:03' })],
    ['screens holding a non-string', answer({ screens: ['DocumentList:03', 3] })],
    ['extras missing', answer({ extras: undefined })],
  ])('a malformed answer (%s) is refused', (_, raw) => {
    expect(parsePermissionsAnswer(raw)).toBeNull()
  })

  it('a malformed answer makes the query error, so nothing is granted', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ status: 200, ok: true, json: async () => ({ success: true, statusCode: 200, data: { screens: 'x' } }) }),
    )
    await expect(new QueryClient().fetchQuery(permissionsQuery())).rejects.toThrow()
  })

  it('an extra flag that is not an explicit true reads false', () => {
    const raw = answer({ extras: { fileServerReady: 'true', notificationCenterOn: 1, nphiesContractVersion: 13 } })
    const p = ready(parsePermissionsAnswer(raw))
    expect(p.extras.fileServerReady).toBe(false)
    expect(p.extras.notificationCenterOn).toBe(false)
    expect(p.extras.canManageRoles).toBe(false)
    expect(p.extras.nphiesContractVersion).toBe('')
  })

  // oms 946 (BackOffice spec 4165, decisions §2): `CommandCenter:Home` rides the one answer as `commandCenterOn`.
  it('946: the command center switch is on only when the answer says an explicit true; a missing flag is off', () => {
    expect(ready(parsePermissionsAnswer(answer())).extras.commandCenterOn).toBe(false)
    const on = answer({ extras: { ...answer().extras, commandCenterOn: true } })
    expect(ready(parsePermissionsAnswer(on)).extras.commandCenterOn).toBe(true)
    const odd = answer({ extras: { ...answer().extras, commandCenterOn: 'true' } })
    expect(ready(parsePermissionsAnswer(odd)).extras.commandCenterOn).toBe(false)
  })

  it('pending: nothing granted and not settled', () => {
    const p = permissionsFromQuery({ isPending: true, isError: false, data: undefined })
    expect(p.has('DocumentList:03')).toBe(false)
    expect(p.settled).toBe(false)
  })

  it('errored: nothing granted, settled and failed', () => {
    const p = permissionsFromQuery({ isPending: false, isError: true, data: parsePermissionsAnswer(answer()) })
    expect(p.has('DocumentList:03')).toBe(false)
    expect(p.extras.fileServerReady).toBe(false)
    expect(p.settled).toBe(true)
    expect(p.failed).toBe(true)
  })
})

describe('the query', () => {
  it('reads GET Auth/Permissions once per page life under one key', async () => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, statusCode: 200, data: answer() }),
    })
    vi.stubGlobal('fetch', fetch)
    const q = permissionsQuery()
    expect(q.queryKey).toEqual(['auth', 'permissions'])
    expect(q.staleTime).toBe(Infinity)
    expect(q.retry).toBe(false)
    const data = await new QueryClient().fetchQuery(q)
    expect(data.screens).toContain('DocumentList:03')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(String(fetch.mock.calls[0][0])).toMatch(/Auth\/Permissions$/)
  })
})

describe('a 403 from @/core/api', () => {
  const forbid = (body: unknown) =>
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 403, ok: false, json: async () => body }))

  it.each([
    ['a bare grant-filter refusal', null],
    ['a coded refusal', { success: false, statusCode: 403, message: 'no', errors: [{ errorCode: 'DENIED' }] }],
  ])('%s invalidates the permissions answer', async (_, body) => {
    const client = new QueryClient()
    client.setQueryData(PERMISSIONS_KEY, parsePermissionsAnswer(answer()))
    const stop = invalidatePermissionsOnForbidden(client)
    forbid(body)
    await expect(api.get('SdDocument/Anything')).rejects.toThrow()
    expect(client.getQueryState(PERMISSIONS_KEY)?.isInvalidated).toBe(true)
    stop()
  })

  it('any other failure leaves it alone', async () => {
    const client = new QueryClient()
    client.setQueryData(PERMISSIONS_KEY, parsePermissionsAnswer(answer()))
    const stop = invalidatePermissionsOnForbidden(client)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 400, ok: false, json: async () => null }))
    await expect(api.get('SdDocument/Anything')).rejects.toThrow()
    expect(client.getQueryState(PERMISSIONS_KEY)?.isInvalidated).toBe(false)
    stop()
  })
})
