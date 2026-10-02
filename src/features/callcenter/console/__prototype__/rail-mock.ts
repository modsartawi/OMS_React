/* PROTOTYPE — throwaway. Wayfinder ticket 379 (map 358): the customer rail vs
 * a caller header. Branch prototype/379-cc-rail, never merges.
 *
 * Built on 373's sentence states (themselves 176's captured legs, patched).
 * Values are fictional; the shape is the wire's.
 */
import type { SessionState } from '@/core/models/callcenter'
import { SCENARIOS as SENTENCE } from './sentence-mock'

const pick = (key: string) => SENTENCE.find((s) => s.key === key)!.state

function patch(
  base: SessionState,
  p: { header?: Partial<SessionState['header']>; capabilities?: Partial<SessionState['capabilities']> },
): SessionState {
  return { ...base, header: { ...base.header, ...p.header }, capabilities: { ...base.capabilities, ...p.capabilities } }
}

const COMPLETE = pick('complete')
export const FALLBACK_ADDRESS = COMPLETE.header.address

const OPENING = patch(pick('noCaller'), { capabilities: { canOpenAddressBook: false } })
const FRESH = patch(pick('fresh'), { capabilities: { canOpenAddressBook: true } })
const LINKED = patch(COMPLETE, {
  header: {
    linkedRequest: {
      documentNo: '1000004417',
      reason: 'TMRA',
      reasonDescription: 'Out of stock at the pharmacy',
      storeCode: '1101',
      note: 'Asked for the 30-tablet pack.',
    },
  },
  capabilities: { canOpenAddressBook: true },
})
const RETAINED = patch(pick('pickup'), { header: { retainedAddressLabel: 'Home' } })

export interface RailScenario {
  key: string
  label: string
  proves: string
  rtl?: boolean
  /** How many open sales requests the attached caller has (194). */
  openRequests: number
  state: SessionState
}

export const RAIL_SCENARIOS: RailScenario[] = [
  {
    key: 'opening', label: 'Opening — no caller yet', openRequests: 2, state: OPENING,
    proves: 'Caret in the phone box on open (153/165). Type 0501076360 → found → Attach. 0500000000 → miss → Sign up (159/190).',
  },
  {
    key: 'attached', label: 'Just attached — 2 open requests', openRequests: 2, state: FRESH,
    proves: 'The open-requests offer (194) must be noticed the moment the caller lands. Where does it sit?',
  },
  {
    key: 'linked', label: 'Converting a request', openRequests: 0, state: LINKED,
    proves: 'The linked request card + Unlink (195): where do they live without a rail?',
  },
  {
    key: 'complete', label: 'The resting order', openRequests: 0, state: { ...COMPLETE, capabilities: { ...COMPLETE.capabilities, canOpenAddressBook: true } },
    proves: 'Hour nine: what does the rail still say that the sentence + ledger do not? What does the centre gain?',
  },
  {
    key: 'collection', label: 'Collection — address kept', openRequests: 0, state: RETAINED,
    proves: '"Collecting from" + the retained-address trace (176): the sentence says the store; where does the trace go?',
  },
  {
    key: 'collectionUnchosen', label: 'Collection — store not chosen', openRequests: 0, state: pick('pickupUnchosen'),
    proves: 'STORE_NOT_CHOSEN said by the rail today AND the sentence — one place is enough?',
  },
  {
    key: 'arabicRtl', label: 'Arabic caller · RTL ⚠ unreviewed Arabic', openRequests: 2, rtl: true,
    state: { ...pick('arabicRtl'), capabilities: { ...pick('arabicRtl').capabilities, canOpenAddressBook: true } },
    proves: 'The bar / rail mirrored: name isolated, mobile + member LTR, Remove at the inline end.',
  },
]

export const DEFAULT_RAIL_SCENARIO = RAIL_SCENARIOS[0].key
