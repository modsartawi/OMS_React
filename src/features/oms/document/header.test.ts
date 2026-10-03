/**
 * Delivery details' light header (spec 380 D2, ticket 402; rulings 371 §1 and 369 §1), over the
 * five captured payloads. Pure: a document header in, what line one and line two show out.
 */
import { describe, expect, it } from 'vitest'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import { documentHeaderView } from './header'
import { DOCUMENT_NUMBERS, PAYLOADS } from './__fixtures__/payloads'
import documentEn from '@/locales/en/document.json'

/** The real `document` namespace, so a key missing from the shipped JSON fails here. */
const t = (key: string): string => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value
}

const view = (doc: SdDocumentHeaderModel) => documentHeaderView(doc, t)

describe('dueTag', () => {
  it('dueTag reads Due n while amountDue > 0 and Paid at 0', () => {
    // 8000000174 owes 103.10; the same document at 0 is paid.
    expect(view(PAYLOADS['8000000174']).due).toEqual({ paid: false, amount: '103.10' })
    expect(view({ ...PAYLOADS['8000000174'], amountDue: 0 }).due).toEqual({ paid: true })
    // A due that rounds to 0.00 is paid, never "Due 0.00".
    expect(view({ ...PAYLOADS['8000000174'], amountDue: 0.004 }).due).toEqual({ paid: true })
  })
})

describe('nowStep', () => {
  it('reads each captured document’s now-step from its status block', () => {
    expect(DOCUMENT_NUMBERS.map((no) => [no, view(PAYLOADS[no]).now])).toEqual([
      ['2000000551', 'ready'],
      ['8000000121', 'created'],
      ['8000000174', 'requested'],
      // Pick-in-store, delivery status D: Delivered completes it with no Out step.
      ['8000000253', 'delivered'],
      ['9000000003', 'created'],
    ])
  })
})

describe('headerTags', () => {
  it('shows e-Rx only on a document carrying a prescription fact', () => {
    expect(DOCUMENT_NUMBERS.filter((no) => view(PAYLOADS[no]).tags.eRx)).toEqual(['2000000551'])
    expect(view({ ...PAYLOADS['8000000121'], referenceErx: ' 77 ' }).tags.eRx).toBe(true)
  })

  it('shows Dawaa Now only on an express delivery', () => {
    expect(view(PAYLOADS['8000000174']).tags.dawaaNow).toBe(false)
    expect(view({ ...PAYLOADS['8000000174'], isExpressDelivery: true }).tags.dawaaNow).toBe(true)
  })

  it('carries the raw Overall code, blank when the document has none', () => {
    expect(view(PAYLOADS['8000000253']).tags.overall).toBe('C')
    expect(view(PAYLOADS['8000000174']).tags.overall).toBe('')
  })
})

describe('headerSubIds', () => {
  it('line two ends with the document no. (the delivery’s ref document), IDs in mono', () => {
    expect(view(PAYLOADS['8000000174']).subIds.map((r) => [r.key, r.value, r.isCode])).toEqual([
      ['orderNo', 'FE000002', true],
      ['documentType', 'Cash', false],
      ['deliveryDocumentType', 'Delivery', false],
      ['placed', 'April 24, 2025 · 22:29', false],
      ['storeCode', 'E001', true],
      ['refDocumentNo', '1000000303', true],
    ])
  })

  it('omits the document no. when the document has no ref document', () => {
    expect(view(PAYLOADS['2000000551']).subIds.map((r) => r.key)).toEqual([
      'orderNo',
      'documentType',
      'placed',
      'storeCode',
    ])
  })
})
