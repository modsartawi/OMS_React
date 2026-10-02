/* PROTOTYPE — throwaway. Wayfinder ticket 373 (map 358): the Call center order
 * header as a sentence. Branch prototype/373-cc-sentence, never merges.
 *
 * Every state starts from 176's CAPTURED delivery / pickup legs (fixture 09 via
 * `fulfilment-mock.ts`) and patches only the header fields the sentence reads.
 * The patched values are fictional; the shape is the wire's.
 */
import type { SessionState } from '@/core/models/callcenter'
import { SCENARIOS as FULFILMENT } from './fulfilment-mock'

const pick = (key: string) => FULFILMENT.find((s) => s.key === key)!.state

function patch(
  base: SessionState,
  p: { header?: Partial<SessionState['header']>; capabilities?: Partial<SessionState['capabilities']> },
): SessionState {
  return {
    ...base,
    header: { ...base.header, ...p.header },
    capabilities: { ...base.capabilities, ...p.capabilities },
  }
}

const LATIN_CALLER = { customerId: 'C-1000000034', name: 'Fatimah Al-Otaibi', mobile: '966501076360', loyaltyAttached: true }
const ARABIC_CALLER = { ...LATIN_CALLER, name: 'فاطمة بنت عبدالله العتيبي' }

const COMPLETE = patch(pick('delivery'), {
  header: {
    customer: LATIN_CALLER,
    plant: '1101',
    plantName: 'Al Malqa',
    plantSource: 'derivedFromAddress',
    address: {
      addressNumber: '1000000284',
      label: 'Home',
      cityCode: 'C001',
      cityName: 'Riyadh',
      districtCode: 'D00101',
      districtName: 'Al Malqa',
      line: 'Anas Ibn Malik Rd, bldg 14',
    },
    slot: { slotId: '2026-10-02#S3', from: '18:00', to: '21:00', isActive: true },
    documentSource: 'CLCN',
    sourceReference: 'CRM-889231',
    paymentType: 'CashOnDelivery',
    coupons: [{ code: 'SAVE20', description: '20 off over 150', amount: -20 }],
    orderNote: 'Call before arrival — the building gate is on the side street.',
  },
  capabilities: { submitBlockers: [], canRemoveCoupon: true },
})

const FRESH = patch(COMPLETE, {
  header: { slot: null, documentSource: null, sourceReference: null, coupons: [], orderNote: null },
  capabilities: { submitBlockers: ['MISSING_SLOT', 'MISSING_SOURCE', 'MISSING_SOURCE_REFERENCE'] },
})

const PICKUP = patch(pick('pickupChosen'), {
  header: {
    customer: LATIN_CALLER,
    plant: '1204',
    plantName: 'Al Yasmin',
    documentSource: 'CLCN',
    sourceReference: 'CRM-889240',
    coupons: [],
    orderNote: null,
  },
  capabilities: { submitBlockers: [] },
})

const PICKUP_UNCHOSEN = patch(pick('pickupUnchosen'), {
  header: { customer: LATIN_CALLER, documentSource: 'CLCN', sourceReference: null },
})

const ARABIC = patch(COMPLETE, {
  header: {
    customer: ARABIC_CALLER,
    plantName: 'الملقا',
    address: {
      ...COMPLETE.header.address!,
      label: 'المنزل',
      cityName: 'الرياض',
      districtName: 'الملقا',
    },
    orderNote: 'الاتصال قبل الوصول — البوابة من الشارع الجانبي.',
  },
})

const LOCKED = patch(COMPLETE, {
  header: { documentSource: 'WSFD', sourceReference: 'WSF-40218' },
  capabilities: {
    canChangeFulfilment: false,
    capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
  },
})

const NO_CALLER = patch(pick('delivery'), {
  header: { customer: null, address: null, slot: null, documentSource: null, sourceReference: null, coupons: [] },
  capabilities: {
    canAddItem: false,
    submitBlockers: ['NO_CUSTOMER', 'NO_ADDRESS', 'MISSING_SLOT', 'MISSING_SOURCE', 'MISSING_SOURCE_REFERENCE', 'NO_LINES'],
  },
})

export interface Scenario {
  key: string
  label: string
  proves: string
  /** PROTOTYPE: flips <html dir> and words the sentence from the Arabic table. */
  rtl?: boolean
  state: SessionState
}

export const SCENARIOS: Scenario[] = [
  { key: 'complete', label: 'Delivery — every field set', proves: 'The resting sentence: does it read as one thing an agent can say back to the caller?', state: COMPLETE },
  { key: 'fresh', label: 'Delivery — just addressed', proves: 'Slot, source and reference unset AND blocking (server submitBlockers) — how loud is an unfilled slot?', state: FRESH },
  { key: 'pickup', label: 'Collection — store chosen', proves: 'Mode flip rewrites the sentence: no address, no slot, store becomes a control.', state: PICKUP },
  { key: 'pickupUnchosen', label: 'Collection — nobody chose the store', proves: 'STORE_NOT_CHOSEN: the store word is seeded but must read as not chosen.', state: PICKUP_UNCHOSEN },
  { key: 'arabicLtr', label: 'Arabic caller · English sentence', proves: '<bdi> isolation: an Arabic name, address and note inside an LTR sentence keep their punctuation and order.', state: ARABIC },
  { key: 'arabicRtl', label: 'Arabic caller · RTL, Arabic sentence ⚠ unreviewed Arabic', proves: 'dir=rtl + an Arabic template: the translation owns word order; slots are named tags, never concatenated.', rtl: true, state: ARABIC },
  { key: 'latinRtl', label: 'Latin caller · RTL, Arabic sentence ⚠ unreviewed Arabic', proves: 'The other bidi case: Latin store names, codes and times inside an Arabic sentence.', rtl: true, state: COMPLETE },
  { key: 'locked', label: 'A delivery-only source', proves: 'canChangeFulfilment:false — the mode word stops being a control and the reason is said once.', state: LOCKED },
  { key: 'noCaller', label: 'Opening — no caller yet', proves: 'Before the rail resolves anyone: what does a sentence with no subject say?', state: NO_CALLER },
]

export const DEFAULT_SCENARIO = SCENARIOS[0].key
