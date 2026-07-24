import { describe, expect, it } from 'vitest'
import { railEntries, type RailEntry } from './rail'
import { DOCUMENT_NUMBERS, PAYLOADS } from './__fixtures__/payloads'
import documentEn from '@/locales/en/document.json'

/**
 * The real `document` namespace, resolved the way `t('rail.closeStatus')` does.
 * Using the shipped copy rather than a stub means a key deleted from the JSON
 * fails these tests instead of rendering a raw key to an operator.
 */
const t = (key: string): string => {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], documentEn)
  if (typeof value !== 'string') throw new Error(`missing document namespace key: ${key}`)
  return value
}

/** An entry as the rail reads on screen — "Delivery Delivered", "Ready". */
const read = (entry: RailEntry): string => (entry.label ? `${entry.label} ${entry.text}` : entry.text)

describe('railComposition', () => {
  // Spec 083 D-3's corpus table, which is this ticket's fixture assertion.
  const EXPECTED: Record<string, string[]> = {
    '2000000551': ['Last action Prescription Ready', 'Ready', 'Approval Approved'],
    '8000000121': ['Last action Rescheduled'],
    '8000000174': ['Last action Close Requested', 'Ready', 'Cancellation Close Requested'],
    '8000000253': ['Last action Delivered', 'Ready', 'Delivery Delivered'],
    '9000000003': ['Last action TRDY'],
  }

  it.each(DOCUMENT_NUMBERS)('%s produces the rail spec 083 D-3 describes', (documentNo) => {
    const entries = railEntries(PAYLOADS[documentNo].status, t)
    expect(entries.map(read)).toEqual(EXPECTED[documentNo])
  })

  it('renders 2·0·2·2·0 pills beside the anchor, in ascending document order', () => {
    const pillCounts = DOCUMENT_NUMBERS.map(
      (documentNo) => railEntries(PAYLOADS[documentNo].status, t).filter((e) => e.key !== 'lastAction').length,
    )
    expect(pillCounts).toEqual([2, 0, 2, 2, 0])
  })

  it('anchors every document on lastAction, uncoloured and first', () => {
    for (const documentNo of DOCUMENT_NUMBERS) {
      const [anchor] = railEntries(PAYLOADS[documentNo].status, t)
      expect(anchor.key).toBe('lastAction')
      expect(anchor.sev).toBeNull()
      expect(anchor.label).toBe('Last action')
    }
  })

  it('gives a blank or null status no pill at all', () => {
    // `availabilityStatus` is null and `paymentStatus` is '' on all five.
    for (const documentNo of DOCUMENT_NUMBERS) {
      const keys = railEntries(PAYLOADS[documentNo].status, t).map((e) => e.key)
      expect(keys).not.toContain('availabilityStatus')
      expect(keys).not.toContain('paymentStatus')
    }
  })

  it('drops the label when the description restates it, and keeps it otherwise', () => {
    const rail = railEntries(PAYLOADS['8000000253'].status, t)
    expect(rail.find((e) => e.key === 'readyStatus')).toMatchObject({ label: null, text: 'Ready' })
    expect(rail.find((e) => e.key === 'deliveryStatus')).toMatchObject({
      label: 'Delivery',
      text: 'Delivered',
    })
  })

  it('returns nothing at all for a document with no status block', () => {
    expect(railEntries(null, t)).toEqual([])
  })
})
