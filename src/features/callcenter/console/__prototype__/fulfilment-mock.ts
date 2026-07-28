/* PROTOTYPE — throwaway. Wayfinder ticket 176 (map 126), drawing 155 and 156.
 *
 * 🚩 **The two states that matter are CAPTURES, not illustrations.** Fixture
 * [09](.issues/assets/136-cc-contract/09-fulfilment-flip.json) was driven live
 * against the real `CallCenterWeb/SetFulfilment` handler, so both sides of the
 * flip below are the wire's own bytes — including the three facts this ticket
 * exists to draw, none of which the console currently honours:
 *
 *   `address: null` · `canOpenAddressBook: false` · `MISSING_SLOT` gone
 *   `deliveryFee { amount: 0, waived: false, thresholdGross: 100 }`
 *
 * That last one is 156's finding: against it the shipped receipt draws
 * **`Delivery SAR 0.00`** and *"free over SAR 100"* on an order nobody is
 * delivering.
 *
 * Everything else here is a **stub, and says so** — 177's lesson. Three paths on
 * this screen are unreachable against today's server and are drawn anyway,
 * because a capability the client ignores is the failure §2's rule exists to
 * prevent:
 *
 *   `waivedReason`            — contract v1.5, BackOffice 874 unbuilt
 *   `canChangePaymentType`    — §2.4: no phase-1 order can force the field
 *   `canChangeFulfilment:false` + `capabilityReasons` — the delivery-only source
 *                               rule, and `capabilityReasons` is 176's PROPOSAL,
 *                               not on the frozen contract at all
 */
import type { SessionState } from '@/core/models/callcenter'
import capture09 from '../../../../../.issues/assets/136-cc-contract/09-fulfilment-flip.json'

type Exchange = { response: { body: { data: unknown } } }
const wire = (e: unknown) => (e as Exchange).response.body.data as SessionState

/** The delivery side of the capture — `setAddress` answered, plant derived. */
const DELIVERY_BARE = wire((capture09 as Record<string, unknown>).deliveryBefore)
/**
 * The pickup side — `setFulfilment` answered. Address gone, fee zeroed.
 *
 * ⚠ One field is ADDED to the capture: `retainedAddressLabel`, contract v1.8,
 * ruled by the owner on 2026-07-29 while this prototype was being driven. The
 * capture predates it. Everything else is the wire's.
 */
const PICKUP: SessionState = (() => {
  const captured = wire((capture09 as Record<string, unknown>).flip)
  return { ...captured, header: { ...captured.header, retainedAddressLabel: 'Home' } }
})()

/**
 * The capture's delivery leg has an empty basket (`net: 0`) while its pickup leg
 * has lines, because un-captured adds happened between them. For a *drawing*
 * that difference is noise — the receipt would be comparing two baskets rather
 * than two modes — so the delivery state borrows the pickup leg's lines and
 * totals, with the fee the capture itself recorded for delivery (12, threshold
 * 100). Nothing about the fee, the mode or the capabilities is invented.
 */
const DELIVERY: SessionState = {
  ...DELIVERY_BARE,
  lines: PICKUP.lines,
  firedPromotions: PICKUP.firedPromotions,
  // ...and drops NO_LINES with them, so the receipt is not asking for an item
  // that is sitting in the basket above it.
  capabilities: {
    ...DELIVERY_BARE.capabilities,
    submitBlockers: DELIVERY_BARE.capabilities.submitBlockers.filter((b) => b !== 'NO_LINES'),
  },
  totals: {
    ...PICKUP.totals,
    deliveryFee: DELIVERY_BARE.totals.deliveryFee,
    payable: Number((PICKUP.totals.gross + DELIVERY_BARE.totals.deliveryFee.amount).toFixed(2)),
  },
}

/** A shallow patch that reaches the three nests the states actually vary in. */
function state(
  base: SessionState,
  patch: {
    header?: Partial<SessionState['header']>
    capabilities?: Partial<SessionState['capabilities']>
    deliveryFee?: Partial<SessionState['totals']['deliveryFee']>
  },
): SessionState {
  return {
    ...base,
    header: { ...base.header, ...patch.header },
    capabilities: { ...base.capabilities, ...patch.capabilities },
    totals: {
      ...base.totals,
      deliveryFee: { ...base.totals.deliveryFee, ...patch.deliveryFee },
    },
  }
}

export interface Scenario {
  key: string
  label: string
  /** What this state is here to prove — shown in the switcher and asserted by
   *  the drive, so a screenshot is never the only record of the claim. */
  proves: string
  /** True where no live server can produce this state today (177's rule: an
   *  unreachable path is drawn AND named). */
  stubbed?: boolean
  state: SessionState
}

export const SCENARIOS: Scenario[] = [
  {
    key: 'delivery',
    label: 'Delivery — the baseline',
    proves: 'Six chips: fulfilment first, slot present, payment settled. The receipt quotes the fee and the threshold sentence.',
    state: DELIVERY,
  },
  {
    key: 'pickup',
    label: 'Collection — the capture',
    proves: 'The wire\'s own pickup state: no slot chip, the rail says Collecting from, and the delivery region is ABSENT rather than SAR 0.00.',
    state: PICKUP,
  },
  {
    key: 'pickupUnchosen',
    label: 'Collection, no store chosen',
    proves: 'plantSource seededAtOpen shuts the item gate, blocks submit through the server\'s own STORE_NOT_CHOSEN, and the rail says nobody has chosen.',
    state: state(PICKUP, {
      header: { plantSource: 'seededAtOpen' },
      capabilities: {
        canAddItem: false,
        canConfirmSeededStore: true,
        submitBlockers: ['STORE_NOT_CHOSEN', 'MISSING_SOURCE_REFERENCE'],
      },
    }),
  },
  {
    key: 'pickupChosen',
    label: 'Collection, store chosen',
    proves: 'chosenForPickup — the store reads as chosen and carries no (derived) parenthetical, because there is no address it could have come from.',
    state: state(PICKUP, { header: { plantSource: 'chosenForPickup' } }),
  },
  {
    key: 'deliveryPaidOnline',
    label: 'Delivery, paid online',
    proves: 'The payment chip is an independent axis — delivery + online is legal, and Submit.cs:196 derived the opposite.',
    state: state(DELIVERY, { header: { paymentType: 'Online' } }),
  },
  {
    key: 'pickupPaidOnline',
    label: 'Collection, paid online',
    proves: 'The fourth combination. All four are legal (§2.4).',
    state: state(PICKUP, { header: { paymentType: 'Online' } }),
  },
  {
    key: 'waivedThreshold',
    label: 'Fee waived — over the threshold',
    proves: 'The waived word carries its REASON. Today the explaining sentence vanishes at the instant it becomes true (156).',
    stubbed: true,
    state: state(DELIVERY, {
      deliveryFee: { amount: 0, waived: true, waivedReason: 'ThresholdReached' },
    }),
  },
  {
    key: 'waivedCampaign',
    label: 'Fee waived — a campaign',
    proves: 'The branch the client could NEVER infer: under the threshold and still free. Inferring it from gross vs thresholdGross would say the wrong thing out loud.',
    stubbed: true,
    state: state(DELIVERY, {
      deliveryFee: { amount: 0, waived: true, waivedReason: 'PromotionalWindow' },
    }),
  },
  {
    key: 'waivedUnknown',
    label: 'Fee waived — an unknown reason',
    proves: 'A future category degrades to the bare word (§9), which is exactly v1.4 behaviour — never a guess, never a throw.',
    stubbed: true,
    state: state(DELIVERY, {
      deliveryFee: { amount: 0, waived: true, waivedReason: 'SomethingNewer' },
    }),
  },
  {
    key: 'lockedSource',
    label: 'A delivery-only source',
    proves: 'canChangeFulfilment:false — the chip stops being a control and SAYS WHY. The surviving half of 175\'s "P2E forces online + delivery-only sources".',
    stubbed: true,
    state: state(DELIVERY, {
      header: { documentSource: 'WSFD', sourceReference: 'WSF-40218' },
      capabilities: {
        canChangeFulfilment: false,
        capabilityReasons: { canChangeFulfilment: 'DELIVERY_ONLY_SOURCE' },
        submitBlockers: ['MISSING_SLOT'],
      },
    }),
  },
  {
    key: 'lockedPayment',
    label: 'A forced payment type',
    proves: 'canChangePaymentType:false — implemented although §2.4 says NO phase-1 order reaches it, because a capability the client ignores is the failure §2 exists to prevent.',
    stubbed: true,
    state: state(DELIVERY, {
      header: { paymentType: 'Online', paymentTypeForcedReason: 'PAYMENT_TYPE_FORCED' },
      capabilities: {
        canChangePaymentType: false,
        capabilityReasons: { canChangePaymentType: 'PAYMENT_TYPE_FORCED' },
      },
    }),
  },
]

export const DEFAULT_SCENARIO = SCENARIOS[0].key
