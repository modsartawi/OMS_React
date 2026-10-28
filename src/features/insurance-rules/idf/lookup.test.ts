/**
 * Ticket 625 (reconciled by 628 with 3168 / 3166) — "why this priority": the lookup reads the deciding tier off the
 * answer's `sourceTier`, names the deciding master from the answer (the masters list only fills a blank name and the
 * live version number), reads the skipped tiers most specific first (an exception's master, then insurer on a store
 * list → insurer → store → general) whatever order the door sends, reads reasons and descriptions in the reader's
 * language, carries the exception row, and marks the looked-up item's row in the ranked group. The search lives in the
 * URL; the payer (the insurer's customer id) is optional.
 */
import { describe, expect, it } from 'vitest'
import {
  IDF_RESOLUTION_ORDER,
  IDF_TIERS,
  isLookupReady,
  lookupDoorParams,
  lookupFromParams,
  lookupToParams,
  lookupView,
  versionLabel,
  type IdfLookupAnswer,
  type IdfLookupQuery,
} from './lookup'
import type { IdfMaster } from './masters'

const masters: IdfMaster[] = [
  {
    masterId: 'M-TAW',
    kind: 'insurer',
    insurerCustomerId: '0001100412',
    nameEn: 'Tawuniya',
    nameAr: 'التعاونية',
    liveVersion: { versionId: 'V-7', number: 2, by: 'nalharbi', at: '2026-10-20T09:15:00' },
  },
]

const insurerDecided: IdfLookupAnswer = {
  itemNumber: '100300',
  descriptionEn: 'Adol 500',
  descriptionAr: 'أدول ٥٠٠',
  idfNumber: 'IDF-PARA-500',
  storeCode: 'P019',
  insurerCustomerId: '0001100412',
  documentType: null,
  documentTypeCanForcePick: null,
  decidingMaster: { masterId: 'M-TAW', kind: 'insurer', versionId: 'V-7', nameEn: 'Tawuniya', nameAr: 'التعاونية' },
  exception: null,
  sourceTier: 'insurer',
  skippedTiers: [{ tier: 'insurerAtStoreList', reason: 'notOnPilotList', masterId: null, reasonEn: 'Store P019 is not on the pilot list', reasonAr: 'الصيدلية P019 ليست في قائمة التجربة' }],
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
  itemNumber: '200100',
  decidingMaster: null,
  sourceTier: 'general',
  // sent out of order on purpose
  skippedTiers: [
    { tier: 'store', reason: 'masterDoesNotNameItem', masterId: 'M-OPS', reasonEn: 'Master does not name the item', reasonAr: 'القائمة لا تذكر الصنف' },
    { tier: 'insurerAtStoreList', reason: 'notOnPilotList', reasonEn: 'Not on the pilot list', reasonAr: 'ليست في قائمة التجربة' },
    { tier: 'insurer', reason: 'noMaster', reasonEn: 'No master for this payer', reasonAr: '' },
  ],
  priority: 4,
  hardThreshold: null,
  reminderThreshold: null,
  group: [{ itemNumber: '200100', descriptionEn: 'Brufen 400', descriptionAr: 'بروفين ٤٠٠', priority: 4, sourceTier: 'general' }],
}

const q: IdfLookupQuery = { item: '100300', store: 'P019', payer: '0001100412', documentType: '', subDocumentType: '', nphiesClaimType: '' }

describe('the tiers are the door\'s spelling', () => {
  it('the resolution order, and an exception row\'s master besides', () => {
    expect([...IDF_RESOLUTION_ORDER]).toEqual(['insurerAtStoreList', 'insurer', 'store', 'general'])
    expect([...IDF_TIERS]).toEqual(['insurerAtStoreList', 'insurer', 'store', 'general', 'exceptionMaster'])
  })
})

describe('lookup reads the answer and marks the looked-up item', () => {
  it('an insurer-decided answer: the source tier, the master the answer names and its live version number', () => {
    const v = lookupView(insurerDecided, q, 'en', masters)
    expect(v.decidingTier).toBe('insurer')
    expect(v.master).toEqual({ masterId: 'M-TAW', kind: 'insurer', name: 'Tawuniya', version: '2' })
    expect([v.priority, v.hard, v.reminder]).toEqual([2, 5, 2])
    expect(v.skipped).toEqual([{ tier: 'insurerAtStoreList', reason: 'Store P019 is not on the pilot list', reasonCode: 'notOnPilotList', masterId: null }])
    expect(v.item).toEqual({ itemNumber: '100300', description: 'Adol 500', idfNumber: 'IDF-PARA-500' })
    expect(v.insurerCustomerId).toBe('0001100412')
  })

  it('marks exactly the looked-up item, keeps the ranked order, reads each row’s source tier', () => {
    const v = lookupView(insurerDecided, q, 'en', masters)
    expect(v.group.map((r) => [r.itemNumber, r.priority, r.sourceTier, r.isLookedUp])).toEqual([
      ['100200', 1, 'insurer', false],
      ['100300', 2, 'insurer', true],
      ['100400', 3, 'general', false],
    ])
  })

  it('a general fallback: three skipped tiers most specific first, thresholds 4 and 1, no master', () => {
    const v = lookupView(generalFallback, { ...q, item: '200100' }, 'en', masters)
    expect(v.decidingTier).toBe('general')
    expect(v.master).toBeNull()
    expect(v.skipped.map((s) => s.tier)).toEqual(['insurerAtStoreList', 'insurer', 'store'])
    expect(v.skipped[2]).toMatchObject({ reasonCode: 'masterDoesNotNameItem', masterId: 'M-OPS' })
    expect([v.hard, v.reminder]).toEqual([4, 1])
    expect(v.group[0].isLookedUp).toBe(true)
  })

  it('reads Arabic reasons, names and descriptions, English when the Arabic is blank', () => {
    const v = lookupView(generalFallback, q, 'ar', masters)
    expect(v.skipped.map((s) => s.reason)).toEqual(['ليست في قائمة التجربة', 'No master for this payer', 'القائمة لا تذكر الصنف'])
    const a = lookupView(insurerDecided, q, 'ar', masters)
    expect(a.group.map((r) => r.description)).toEqual(['بنادول ٥٠٠', 'Adol 500', 'فيفادول'])
    expect(a.master?.name).toBe('التعاونية')
    expect(a.item.description).toBe('أدول ٥٠٠')
  })

  it('a deciding master without names falls back to the masters list, then to its id; an unknown version shows its id', () => {
    const nameless = { ...insurerDecided, decidingMaster: { masterId: 'M-TAW', kind: 'insurer' as const, versionId: 'V-7', nameEn: '', nameAr: '' } }
    expect(lookupView(nameless, q, 'en', masters).master?.name).toBe('Tawuniya')
    const unknown = { ...insurerDecided, sourceTier: 'store', decidingMaster: { masterId: 'M-X', kind: 'store' as const, versionId: 'V-99' } }
    expect(lookupView(unknown, q, 'en', []).master).toEqual({ masterId: 'M-X', kind: 'store', name: null, version: 'V-99' })
    expect(lookupView(unknown, q, 'en', []).decidingTier).toBe('store')
  })

  it('an exception row that applied is carried; its master can decide (exceptionMaster) and outranks the skipped order', () => {
    const exception = { exceptionId: 'X-1', keyKind: 'subDocumentType', key: 'SABIC', handling: 'master', masterId: 'M-TAW', allStores: true }
    const a: IdfLookupAnswer = {
      ...insurerDecided,
      sourceTier: 'exceptionMaster',
      exception,
      skippedTiers: [
        { tier: 'insurer', reason: 'exceptionRow', reasonEn: 'An exception row applied', reasonAr: '' },
        { tier: 'exceptionMaster', reason: 'unreadable', reasonEn: 'x', reasonAr: '' },
      ],
    }
    const v = lookupView(a, q, 'en', masters)
    expect(v.decidingTier).toBe('exceptionMaster')
    expect(v.exception).toEqual(exception)
    expect(v.skipped.map((s) => s.tier)).toEqual(['exceptionMaster', 'insurer'])
    expect(lookupView(insurerDecided, q, 'en', masters).exception).toBeNull()
  })

  it('the cash rule: shown only when a document type was given and cannot force a pick', () => {
    expect(lookupView(insurerDecided, q, 'en', masters).cashNeverForces).toBe(false)
    expect(lookupView({ ...insurerDecided, documentType: 'Cash', documentTypeCanForcePick: false }, q, 'en', masters).cashNeverForces).toBe(true)
    expect(lookupView({ ...insurerDecided, documentType: 'InsuranceOrder', documentTypeCanForcePick: true }, q, 'en', masters).cashNeverForces).toBe(false)
  })

  it('a version reads as its number only when it is the master\'s live one', () => {
    expect(versionLabel(masters, 'M-TAW', 'V-7')).toBe('2')
    expect(versionLabel(masters, 'M-TAW', 'V-6')).toBe('V-6')
    expect(versionLabel(masters, 'M-TAW', '')).toBeNull()
  })
})

describe('the lookup search lives in the URL', () => {
  it('reads and writes every field; blanks are dropped', () => {
    const read = lookupFromParams(new URLSearchParams('item=%20100300%20&store=P019&payer=0001100412'))
    expect(read).toEqual({ item: '100300', store: 'P019', payer: '0001100412', documentType: '', subDocumentType: '', nphiesClaimType: '' })
    expect(lookupToParams(read).toString()).toBe('item=100300&store=P019&payer=0001100412')
    expect(lookupToParams({ ...read, documentType: 'InsuranceOrder', subDocumentType: 'SABIC', nphiesClaimType: '3' }).toString()).toBe(
      'item=100300&store=P019&payer=0001100412&documentType=InsuranceOrder&subDocumentType=SABIC&nphiesClaimType=3',
    )
  })
  it('asks the door once item and store are given; the payer is optional (blank = none)', () => {
    expect(isLookupReady({ ...q, payer: '' })).toBe(true)
    expect(isLookupReady({ ...q, store: '' })).toBe(false)
    expect(isLookupReady({ ...q, item: '' })).toBe(false)
  })
  it('the door gets payer = the insurer customer id, and every optional field named (blanks dropped by buildQuery)', () => {
    expect(lookupDoorParams({ ...q, nphiesClaimType: '3' })).toEqual({
      item: '100300',
      store: 'P019',
      payer: '0001100412',
      documentType: '',
      subDocumentType: '',
      nphiesClaimType: '3',
    })
  })
})
