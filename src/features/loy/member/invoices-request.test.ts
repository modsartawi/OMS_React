/**
 * What the Invoices tab asks the server for (ticket 428): the read and the requeue
 * hit the contract's routes (BackOffice 2446, 2445), and the requeue invalidates
 * the Invoices AND the Actions tab from inside the mutation.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { QueryClient } from '@tanstack/react-query'

import {
  MEMBER_SCOPE_KEY,
  invoicesKey,
  loyCommandApi,
  loyReportsApi,
  memberActionsScopeKey,
} from './api'
import { requeueInvoice } from './invoice-resend'

const answers = (data: unknown) =>
  vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data }),
  } as unknown as Response)

const lastCall = (fetchMock: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit | undefined]
  return {
    path: new URL(String(url), 'http://portal.test').pathname,
    method: init?.method ?? 'GET',
    body: init?.body,
  }
}

const QUEUED = { result: 'Queued', recipient: 'a@b.sa', recipientSource: 'Profile' }

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('the invoices read', () => {
  it('GETs LoyWeb/Reports/Invoices/{loyId}', async () => {
    const fetchMock = answers([])
    vi.stubGlobal('fetch', fetchMock)
    await loyReportsApi.invoices('100001293')
    expect(lastCall(fetchMock)).toMatchObject({
      path: '/api/LoyWeb/Reports/Invoices/100001293',
      method: 'GET',
    })
  })

  it('a null data is an empty list, never a crash', async () => {
    vi.stubGlobal('fetch', answers(null))
    expect(await loyReportsApi.invoices('100001293')).toEqual([])
  })
})

describe('the requeue command', () => {
  it('POSTs to the receipt’s Requeue route, carrying nothing but the route', async () => {
    const fetchMock = answers(QUEUED)
    vi.stubGlobal('fetch', fetchMock)
    const answer = await loyCommandApi.requeueInvoice('100001293', '1001', '1001/0042 7')
    const sent = lastCall(fetchMock)
    expect(sent.method).toBe('POST')
    expect(sent.path).toBe('/api/LoyWeb/Member/100001293/Invoices/1001/1001%2F0042%207/Requeue')
    expect(sent.body).toBe('{}')
    expect(answer).toEqual(QUEUED)
  })

  it('🚩 invalidates the Invoices and the Actions tab', async () => {
    vi.stubGlobal('fetch', answers(QUEUED))
    const client = new QueryClient()
    const invalidated: unknown[] = []
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      invalidated.push(filters?.queryKey)
    })
    await requeueInvoice(client, '100001293', { storeCode: '1001', trxNumber: '000123' })
    expect(invalidated).toEqual([invoicesKey('100001293'), memberActionsScopeKey('100001293')])
  })

  it('🚩 the Invoices key sits under the member scope, so every profile command re-reads it', () => {
    expect(invoicesKey('100001293').slice(0, MEMBER_SCOPE_KEY.length)).toEqual([...MEMBER_SCOPE_KEY])
  })

  it('🚩 a business refusal re-reads the Invoices tab only — the row was stale', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 400,
        ok: false,
        json: async () => ({
          statusCode: 400,
          success: false,
          message: 'There is no email on the profile.',
          errors: [{ errorCode: 'LOY-X', errorMessage: 'There is no email on the profile.' }],
          data: null,
        }),
      } as unknown as Response),
    )
    const client = new QueryClient()
    const invalidated: unknown[] = []
    vi.spyOn(client, 'invalidateQueries').mockImplementation(async (filters) => {
      invalidated.push(filters?.queryKey)
    })
    await expect(
      requeueInvoice(client, '100001293', { storeCode: '1001', trxNumber: '000123' }),
    ).rejects.toBeTruthy()
    expect(invalidated).toEqual([invoicesKey('100001293')])
  })

  it('🚩 an outage re-reads nothing — it says nothing about the row', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    const client = new QueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    await expect(
      requeueInvoice(client, '100001293', { storeCode: '1001', trxNumber: '000123' }),
    ).rejects.toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
