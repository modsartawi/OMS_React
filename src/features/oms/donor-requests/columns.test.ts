/**
 * The donor request grid's cells that word a code (ticket 672, BackOffice spec 3242): the host column and the
 * reason column. Driven through `donorColumns` itself — the cell text is what the grid shows and 432's export
 * writes — with a stand-in `t`.
 */
import { describe, expect, it } from 'vitest'
import type { TFunction } from 'i18next'
import type { DonorRequestModel } from '@/core/models/sd-document'
import { donorColumns, type DonorRequestRow } from './columns'
import { donorRow } from './donor-row'
import en from '@/locales/en/donor-words.json'
import ar from '@/locales/ar/donor-words.json'

const UNSET = '0001-01-01T00:00:00'
const NOW = Date.parse('2026-10-07T10:20:00')

const row = (over: Partial<DonorRequestModel> = {}): DonorRequestRow => {
  const r: DonorRequestModel = {
    requestNo: 'DR1',
    deliveryNo: '8000000500',
    orderStore: 'P019',
    donorStore: 'D012',
    state: 'OPEN',
    outcome: '',
    outcomeReason: '',
    outcomeBy: '',
    outcomeAt: UNSET,
    raisedBy: 'store.p019',
    raisedAt: '2026-10-07T09:00:00',
    changedBy: '',
    changedAt: UNSET,
    fulfilledAt: UNSET,
    lockedBy: '',
    lockedAt: UNSET,
    transferStoNo: '',
    transferSapDocumentNo: '',
    transferredAt: UNSET,
    picked: 0,
    required: 3,
    ...over,
  }
  return { ...r, view: donorRow(r, NOW) }
}

/** A stand-in `t` that answers every key with itself. */
const t = ((key: string) => key) as unknown as TFunction

/** A cell's text as the grid computes it: the column's getter, else its field. */
function cell(colId: string, data: DonorRequestRow, lang = 'en'): unknown {
  const col = donorColumns(t, lang).find((c) => (c.colId ?? c.field) === colId)
  if (!col) throw new Error(`no column ${colId}`)
  if (typeof col.valueGetter === 'function') return col.valueGetter({ data } as never)
  return data[col.field as keyof DonorRequestRow]
}

describe('the host column', () => {
  const wp = row({ deliveryNo: '98765', sourceType: 'WP', hostLabel: 'Wasfaty+ order 98765', hostLabelAr: 'طلب وصفتي بلس 98765' })

  it('a WP-hosted row shows its host label, in the language of the screen', () => {
    expect(cell('deliveryNo', wp)).toBe('Wasfaty+ order 98765')
    expect(cell('deliveryNo', wp, 'ar')).toBe('طلب وصفتي بلس 98765')
  })

  it('a row without a source type shows its bare delivery number, exactly as today', () => {
    expect(cell('deliveryNo', row())).toBe('8000000500')
    expect(cell('deliveryNo', row({ hostLabel: 'Delivery 8000000500' }))).toBe('8000000500')
  })

  it('a host the server sent no words for shows its key', () => {
    expect(cell('deliveryNo', row({ deliveryNo: '01K8ZQ', sourceType: 'PSES' }))).toBe('01K8ZQ')
  })
})

const at = (bundle: unknown, key: string) =>
  key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], bundle)

/** A `t` over one locale's `donor-words` bundle; any other key renders itself, as i18next's missing key does. */
const tIn = (bundle: unknown) =>
  ((key: string) => {
    const [ns, path] = key.split(':')
    const found = ns === 'donor-words' && path ? at(bundle, path) : undefined
    return typeof found === 'string' ? found : key
  }) as unknown as TFunction

function reasonCell(data: DonorRequestRow, bundle: unknown): unknown {
  const col = donorColumns(tIn(bundle)).find((c) => (c.colId ?? c.field) === 'outcomeReason')
  if (!col || typeof col.valueGetter !== 'function') throw new Error('the reason column has no getter')
  return col.valueGetter({ data } as never)
}

describe('the reason column', () => {
  const ended = (outcomeReason: string) =>
    row({ state: 'CANCELLED', outcome: 'CANCELLED', outcomeReason, outcomeAt: '2026-10-07T10:00:00' })

  it('HOST_CANCELLED and HOST_STORE_CHANGED read in words, in English and Arabic', () => {
    expect(reasonCell(ended('HOST_CANCELLED'), en)).toBe('Order cancelled')
    expect(reasonCell(ended('HOST_STORE_CHANGED'), en)).toBe('Order moved to another store')
    expect(reasonCell(ended('HOST_CANCELLED'), ar)).toBe('تم إلغاء الطلب')
    expect(reasonCell(ended('HOST_STORE_CHANGED'), ar)).toBe('نُقل الطلب إلى فرع آخر')
  })

  it('the delivery hook reasons read in words too', () => {
    expect(reasonCell(ended('DELIVERY_FORCE_CLOSED'), en)).toBe('Delivery force-closed')
  })

  it('an unknown code renders raw, as today', () => {
    expect(reasonCell(ended('OUT_OF_STOCK'), en)).toBe('OUT_OF_STOCK')
    expect(reasonCell(row(), en)).toBe('')
  })
})
