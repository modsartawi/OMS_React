import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/core/api'
import type { ChangeManifestRow } from '@/core/models/data-sync'
import { dataSyncApi } from './api'
import {
  changeCells,
  changesFromParams,
  changesPath,
  changesQuery,
  changesToParams,
  isManifestPruned,
  showChangesLink,
  truncatedTables,
} from './changes-helpers'
import en from '@/locales/en/data-sync.json'

afterEach(() => vi.unstubAllGlobals())

const word = (key: string): unknown => key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en)

const row = (over: Partial<ChangeManifestRow>): ChangeManifestRow => ({
  table: 'dbo.Product',
  kind: 'Different',
  key: { ProductId: 10452 },
  sourceValues: null,
  targetValues: null,
  capturedAt: '2026-10-24T09:07:12Z',
  ...over,
})

describe('changesQuery through dataSyncApi.changes', () => {
  const fetched = async (call: () => Promise<unknown>): Promise<string> => {
    const fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ statusCode: 200, success: true, message: '', errors: [], data: [] }),
    } as unknown as Response)
    vi.stubGlobal('fetch', fetch)
    await call()
    const url = String(fetch.mock.calls[0][0])
    return url.slice(url.indexOf('DataSync/'))
  }

  it('asks for page 1 of 50 with no filter', async () => {
    expect(await fetched(() => dataSyncApi.changes('J 1', { table: null, kind: null, page: 1 }))).toBe(
      'DataSync/Jobs/J%201/Changes?page=1&pageSize=50',
    )
  })

  it('sends the table, the kind by its exact name and the page', async () => {
    expect(await fetched(() => dataSyncApi.changes('J1', { table: 'dbo.Product', kind: 'TargetOnly', page: 3 }))).toBe(
      'DataSync/Jobs/J1/Changes?table=dbo.Product&kind=TargetOnly&page=3&pageSize=50',
    )
  })

  it('builds the door query from the view', () => {
    expect(changesQuery({ table: 'dbo.Category', kind: 'Different', page: 2 })).toEqual({
      table: 'dbo.Category',
      kind: 'Different',
      page: 2,
      pageSize: 50,
    })
  })
})

describe('the Changes view in the URL', () => {
  it('reads table, kind and page, dropping an unknown kind and a bad page', () => {
    expect(changesFromParams(new URLSearchParams('table=dbo.Product&kind=SourceOnly&page=4'))).toEqual({
      table: 'dbo.Product',
      kind: 'SourceOnly',
      page: 4,
    })
    expect(changesFromParams(new URLSearchParams('kind=Sideways&page=-1'))).toEqual({ table: null, kind: null, page: 1 })
  })

  it('writes only what differs from the default', () => {
    expect(changesToParams({ table: null, kind: null, page: 1 }).toString()).toBe('')
    expect(changesToParams({ table: 'dbo.Product', kind: 'Different', page: 2 }).toString()).toBe(
      'table=dbo.Product&kind=Different&page=2',
    )
  })
})

describe('changeCells', () => {
  it('Different: both sides, only for the differing columns', () => {
    const cells = changeCells(
      row({
        kind: 'Different',
        key: { ProductId: 200, Client: '000' },
        sourceValues: { SupplierName: 'McCavity Ltd', Price: 4.5, Active: true },
        targetValues: { SupplierName: 'Mccavity Ltd', Price: 4.5, Active: false },
      }),
    )
    expect(cells.key).toEqual([
      { column: 'ProductId', text: '200' },
      { column: 'Client', text: '000' },
    ])
    // Price is equal on both sides: not a difference, not shown.
    expect(cells.values).toEqual([
      { column: 'SupplierName', source: { kind: 'text', text: 'McCavity Ltd' }, target: { kind: 'text', text: 'Mccavity Ltd' } },
      { column: 'Active', source: { kind: 'text', text: 'true' }, target: { kind: 'text', text: 'false' } },
    ])
  })

  it('SourceOnly shows the source side only; TargetOnly the store side only', () => {
    expect(
      changeCells(row({ kind: 'SourceOnly', key: { ProductId: 10990 }, sourceValues: { Name: 'Oat Bar', Price: 4.5 } })).values,
    ).toEqual([
      { column: 'Name', source: { kind: 'text', text: 'Oat Bar' }, target: null },
      { column: 'Price', source: { kind: 'text', text: '4.5' }, target: null },
    ])
    expect(
      changeCells(row({ kind: 'TargetOnly', key: { ProductId: 77 }, sourceValues: null, targetValues: { Name: 'Old bar' } })).values,
    ).toEqual([{ column: 'Name', source: null, target: { kind: 'text', text: 'Old bar' } }])
  })

  it('keeps NULL and the empty string distinct, on values and on the key', () => {
    const cells = changeCells(row({ kind: 'Different', key: { ProductId: 300 }, sourceValues: { Notes: null }, targetValues: { Notes: '' } }))
    expect(cells.values).toEqual([{ column: 'Notes', source: { kind: 'null' }, target: { kind: 'empty' } }])
    // A column the door sends on one side only of a Different row is still a difference.
    const one = changeCells(row({ kind: 'Different', sourceValues: { Notes: null }, targetValues: {} }))
    expect(one.values).toEqual([{ column: 'Notes', source: { kind: 'null' }, target: { kind: 'null' } }])
    expect(changeCells(row({ key: { Code: null } })).key).toEqual([{ column: 'Code', text: null }])
  })
})

describe('the drawer link and the notices', () => {
  it('shows the Changes link only on a report-only job to a holder of Operate', () => {
    expect(showChangesLink('ReportOnly', true)).toBe(true)
    expect(showChangesLink('ReportOnly', false)).toBe(false)
    expect(showChangesLink('Apply', true)).toBe(false)
    expect(showChangesLink(undefined, true)).toBe(false)
    expect(changesPath('J 1')).toBe('/admin/data-sync/jobs/J%201/changes')
  })

  it('names the truncated tables, narrowed to the filtered one', () => {
    const tasks = [
      { table: 'dbo.Product', manifestTruncated: true },
      { table: 'dbo.Category', manifestTruncated: false },
      { table: 'dbo.Price', manifestTruncated: true },
    ]
    expect(truncatedTables(tasks, null)).toEqual(['dbo.Product', 'dbo.Price'])
    expect(truncatedTables(tasks, 'DBO.PRODUCT')).toEqual(['dbo.Product'])
    expect(truncatedTables(tasks, 'dbo.Category')).toEqual([])
  })

  it('knows a pruned manifest by its code', () => {
    const pruned = new ApiError('business', 'Row-level changes for this job have been pruned.', 410, [
      { errorCode: 'DATASYNC_MANIFEST_PRUNED', internalErrorCode: 'DS-0410-01', errorMessage: 'kept 30 days' },
    ])
    expect(isManifestPruned(pruned)).toBe(true)
    expect(isManifestPruned(new ApiError('server', 'x', 500))).toBe(false)
  })

  it('has a sentence for every kind and for both notices', () => {
    for (const k of ['kind.SourceOnly', 'kind.Different', 'kind.TargetOnly', 'changes.truncated', 'changes.pruned', 'changes.nullValue', 'changes.emptyValue'])
      expect(word(k)).toBeTruthy()
  })
})
