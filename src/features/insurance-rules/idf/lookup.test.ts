/**
 * Ticket 625 — "why this priority": the lookup reads the skipped tiers in the fixed order (insurer + store list →
 * insurer → operation pharmacy → general) whatever order the door sends, names the deciding tier as the first one
 * not skipped, reads reasons and descriptions in the reader's language, and marks the looked-up item's row in the
 * ranked group. The search lives in the URL.
 */
import { describe, expect, it } from 'vitest'
import { isLookupReady, lookupFromParams, lookupToParams, lookupView, type IdfLookupAnswer } from './lookup'
import type { IdfMaster } from './masters'

const masters: IdfMaster[] = [
  {
    masterId: 'M-TAW',
    kind: 'insurer',
    payerCode: 'TAWUNIYA',
    nameEn: 'Tawuniya',
    nameAr: 'التعاونية',
    liveVersion: { versionId: 'V-7', number: 2, by: 'nalharbi', at: '2026-10-20T09:15:00' },
  },
]

const insurerDecided: IdfLookupAnswer = {
  decidingMaster: { masterId: 'M-TAW', kind: 'insurer', versionId: 'V-7' },
  skippedTiers: [{ tier: 'insurerStoreList', reasonEn: 'Store P019 is not on the pilot list', reasonAr: 'الصيدلية P019 ليست في قائمة التجربة' }],
  priority: 2,
  hardThreshold: 5,
  reminderThreshold: 2,
  group: [
    { itemNumber: '100200', descriptionEn: 'Panadol 500', descriptionAr: 'بنادول ٥٠٠', priority: 1, sourceTier: 'insurer' },
    { itemNumber: '100300', descriptionEn: 'Adol 500', descriptionAr: '', priority: 2, sourceTier: 'insurer' },
    { itemNumber: '100400', descriptionEn: 'Fevadol', descriptionAr: 'فيفادول', priority: 3, sourceTier: 'general' },
  ],
}

const generalFallback: IdfLookupAnswer = {
  decidingMaster: null,
  // sent out of order on purpose
  skippedTiers: [
    { tier: 'operationPharmacy', reasonEn: 'Master does not name the item', reasonAr: 'القائمة لا تذكر الصنف' },
    { tier: 'insurerStoreList', reasonEn: 'Not on the pilot list', reasonAr: 'ليست في قائمة التجربة' },
    { tier: 'insurer', reasonEn: 'No master for this payer', reasonAr: '' },
  ],
  priority: 4,
  hardThreshold: null,
  reminderThreshold: null,
  group: [{ itemNumber: '200100', descriptionEn: 'Brufen 400', descriptionAr: 'بروفين ٤٠٠', priority: 4, sourceTier: 'general' }],
}

const q = { item: '100300', store: 'P019', payer: 'TAWUNIYA', documentType: '' }

describe('lookup reads tiers in the fixed order and marks the looked-up item', () => {
  it('an insurer-decided answer: the deciding tier, the named master and its version number', () => {
    const v = lookupView(insurerDecided, q, 'en', masters)
    expect(v.decidingTier).toBe('insurer')
    expect(v.master).toEqual({ masterId: 'M-TAW', kind: 'insurer', name: 'Tawuniya', version: '2' })
    expect([v.priority, v.hard, v.reminder]).toEqual([2, 5, 2])
    expect(v.skipped).toEqual([{ tier: 'insurerStoreList', reason: 'Store P019 is not on the pilot list' }])
  })

  it('marks exactly the looked-up item, keeps the ranked order, reads each row’s source tier', () => {
    const v = lookupView(insurerDecided, q, 'en', masters)
    expect(v.group.map((r) => [r.itemNumber, r.priority, r.sourceTier, r.isLookedUp])).toEqual([
      ['100200', 1, 'insurer', false],
      ['100300', 2, 'insurer', true],
      ['100400', 3, 'general', false],
    ])
  })

  it('a general fallback: three skipped tiers in the fixed order, thresholds 4 and 1, no master', () => {
    const v = lookupView(generalFallback, { ...q, item: '200100' }, 'en', masters)
    expect(v.decidingTier).toBe('general')
    expect(v.master).toBeNull()
    expect(v.skipped.map((s) => s.tier)).toEqual(['insurerStoreList', 'insurer', 'operationPharmacy'])
    expect([v.hard, v.reminder]).toEqual([4, 1])
    expect(v.group[0].isLookedUp).toBe(true)
  })

  it('reads Arabic reasons and descriptions, English when the Arabic is blank', () => {
    const v = lookupView(generalFallback, q, 'ar', masters)
    expect(v.skipped.map((s) => s.reason)).toEqual(['ليست في قائمة التجربة', 'No master for this payer', 'القائمة لا تذكر الصنف'])
    const g = lookupView(insurerDecided, q, 'ar', masters).group
    expect(g.map((r) => r.description)).toEqual(['بنادول ٥٠٠', 'Adol 500', 'فيفادول'])
    expect(lookupView(insurerDecided, q, 'ar', masters).master?.name).toBe('التعاونية')
  })

  it('a master the list does not know is shown by its id and version id', () => {
    const v = lookupView({ ...insurerDecided, decidingMaster: { masterId: 'M-X', kind: 'store', versionId: 'V-99' } }, q, 'en', [])
    expect(v.master).toEqual({ masterId: 'M-X', kind: 'store', name: null, version: 'V-99' })
    expect(v.decidingTier).toBe('insurer')
  })

  it('the cash rule is shown only when the answer carries it', () => {
    expect(lookupView(insurerDecided, q, 'en', masters).cashNeverForces).toBe(false)
    expect(lookupView({ ...insurerDecided, cashNeverForces: true }, q, 'en', masters).cashNeverForces).toBe(true)
  })
})

describe('the lookup search lives in the URL', () => {
  it('reads and writes item, store, payer and document type; blanks are dropped', () => {
    const read = lookupFromParams(new URLSearchParams('item=%20100300%20&store=P019&payer=TAWUNIYA'))
    expect(read).toEqual({ item: '100300', store: 'P019', payer: 'TAWUNIYA', documentType: '' })
    expect(lookupToParams(read).toString()).toBe('item=100300&store=P019&payer=TAWUNIYA')
    expect(lookupToParams({ ...read, documentType: 'RX' }).toString()).toBe('item=100300&store=P019&payer=TAWUNIYA&documentType=RX')
  })
  it('asks the door only when item, store and payer are all given', () => {
    expect(isLookupReady({ item: '1', store: 'P1', payer: 'B', documentType: '' })).toBe(true)
    expect(isLookupReady({ item: '1', store: '', payer: 'B', documentType: 'RX' })).toBe(false)
  })
})
