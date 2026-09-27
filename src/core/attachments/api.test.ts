/**
 * The attachment register's reads (ticket 325): ONE probe entry, the keys under one
 * `attachments` head, and ByOwner's freshness as the caller's parameter.
 *
 * 🔑 Every ByOwner and `/Content` fetch writes an audit row on the server, so a key
 * that splits (two probe entries) or an option the caller did not ask for (a
 * freshness that quietly refetches) is a correctness bug, not a performance nit.
 */
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/core/api'
import {
  ATTACHMENT_ACCESS_KEY,
  READ_ON_EVERY_OPENING,
  attachmentAccessQuery,
  attachmentContentKey,
  attachmentContentQuery,
  attachmentsApi,
  attachmentsByOwnerKey,
  attachmentsByOwnerQuery,
} from './api'

const STORE_DAY_OWNER = { ownerKind: 'STORE_DAY', ownerKey: 'P019/2026-09-20' }

afterEach(() => vi.restoreAllMocks())

describe('the probe — GET AttachmentWeb/Access, ONE shared entry', () => {
  it('lives under the attachments head, and every reader gets the same key and options', () => {
    expect(ATTACHMENT_ACCESS_KEY).toEqual(['attachments', 'access'])
    // The slip grids (`useSlipView`), the drawer, its Add, and the order page (327)
    // each call this; there is no second spelling of the key anywhere.
    const grid = attachmentAccessQuery()
    const drawer = attachmentAccessQuery()
    expect(grid.queryKey).toBe(ATTACHMENT_ACCESS_KEY)
    expect(drawer.queryKey).toEqual(grid.queryKey)
    expect({ staleTime: drawer.staleTime, retry: drawer.retry }).toEqual({ staleTime: Infinity, retry: false })
  })

  it('two readers share one cache entry and one request', async () => {
    const access = vi.spyOn(attachmentsApi, 'access').mockResolvedValue({ categories: ['CASH_CLOSE'] })
    const client = new QueryClient()
    const grid = new QueryObserver(client, attachmentAccessQuery())
    const drawer = new QueryObserver(client, attachmentAccessQuery())
    const off = [grid.subscribe(() => {}), drawer.subscribe(() => {})]
    await vi.waitFor(() => expect(drawer.getCurrentResult().data).toEqual({ categories: ['CASH_CLOSE'] }))
    expect(client.getQueryCache().findAll({ queryKey: ['attachments', 'access'] })).toHaveLength(1)
    expect(access).toHaveBeenCalledTimes(1)
    off.forEach((unsubscribe) => unsubscribe())
  })

  it('re-reading an owner never re-asks the probe — ByOwner is invalidated by its exact key', async () => {
    const client = new QueryClient()
    client.setQueryData(ATTACHMENT_ACCESS_KEY, { categories: ['CASH_CLOSE'] })
    client.setQueryData(attachmentsByOwnerKey(STORE_DAY_OWNER), { stored: [], withdrawn: [] })
    await client.invalidateQueries({ queryKey: attachmentsByOwnerKey(STORE_DAY_OWNER) })
    expect(client.getQueryState(ATTACHMENT_ACCESS_KEY)?.isInvalidated).toBe(false)
  })
})

describe('the keys — one attachments head, owners kept apart', () => {
  it('ByOwner is keyed by owner kind AND key; /Content by the attachment', () => {
    expect(attachmentsByOwnerKey(STORE_DAY_OWNER)).toEqual([
      'attachments',
      'by-owner',
      'STORE_DAY',
      'P019/2026-09-20',
    ])
    expect(attachmentsByOwnerKey({ ownerKind: 'SD_DOCUMENT', ownerKey: 'X' })).not.toEqual(
      attachmentsByOwnerKey({ ownerKind: 'STORE_DAY', ownerKey: 'X' }),
    )
    expect(attachmentContentKey('a1')).toEqual(['attachments', 'content', 'a1'])
  })

  it('/Content keeps no bytes once nothing previews them, and answers on the first no', () => {
    const q = attachmentContentQuery('a1')
    expect({ gcTime: q.gcTime, retry: q.retry }).toEqual({ gcTime: 0, retry: false })
  })
})

describe('ByOwner — freshness is the caller’s parameter', () => {
  it('the slip drawer’s (READ_ON_EVERY_OPENING) adds nothing over the app’s defaults', () => {
    const q = attachmentsByOwnerQuery(STORE_DAY_OWNER, READ_ON_EVERY_OPENING)
    expect(Object.keys(q).sort()).toEqual(['queryFn', 'queryKey', 'retry'])
    expect(q.queryKey).toEqual(['attachments', 'by-owner', 'STORE_DAY', 'P019/2026-09-20'])
    expect(q.retry).toBe(false)
  })

  it('carries what the caller asks for, and nothing it may not override', () => {
    const q = attachmentsByOwnerQuery(STORE_DAY_OWNER, {
      staleTime: Infinity,
      gcTime: 0,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    })
    expect(q).toMatchObject({ staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false })
    expect(q.retry).toBe(false)
    expect(q.queryKey).toEqual(attachmentsByOwnerKey(STORE_DAY_OWNER))
  })

  it('reads the owner through getEnvelope, by kind and key, and keeps withdrawn from beside data', async () => {
    const getEnvelope = vi.spyOn(api, 'getEnvelope').mockResolvedValue({
      statusCode: 200,
      success: true,
      message: '',
      errors: [],
      data: [{ attachmentId: 's1' }],
      withdrawn: [],
    } as never)
    const list = await attachmentsApi.byOwner(STORE_DAY_OWNER)
    expect(getEnvelope).toHaveBeenCalledWith('AttachmentWeb/ByOwner', {
      ownerKind: 'STORE_DAY',
      ownerKey: 'P019/2026-09-20',
    })
    expect(list).toEqual({ stored: [{ attachmentId: 's1' }], withdrawn: [] })
  })
})
