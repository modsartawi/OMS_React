/**
 * PROTOTYPE (wayfinder ticket 176) — the fulfilment axis's consequences, derived
 * once, in one place.
 *
 * The mode is one wire field (`header.deliveryType`, §2.2) and **five** things on
 * screen: the chip that sets it, whether the slot chip exists at all, what the
 * rail's second block is, whether the receipt has a delivery region, and how the
 * payment chip is worded. Every one of those is a *rendering* of the same fact,
 * so they are derived together — a console that asked `deliveryType` in five
 * components is a console where four of them eventually get it right.
 *
 * 🚩 **Nothing here is a rule.** Every consequence below is already the server's:
 * `submitBlockers` drops `MISSING_SLOT` under pickup, `canOpenAddressBook` goes
 * false, `deliveryFee.amount` goes 0 — all three are capture-confirmed in
 * [09](.issues/assets/136-cc-contract/09-fulfilment-flip.json). This module only
 * decides what the agent *sees*, which is the half the wire cannot carry.
 */
import type { SessionCapabilities, SessionHeader } from '@/core/models/callcenter'
import type { DeliveryFeeView } from './basket-view'

/** §2.2 — the field is optional (a v1.0 server does not send it) and its absence
 *  means `Delivery`. Read through here so the fallback lives in one place. */
export function isPickup(header: SessionHeader): boolean {
  return header.deliveryType === 'PickInStore'
}

/**
 * What the rail's second block is. The two modes ask two different questions
 * about the same order, so they are two blocks rather than one block with a
 * conditional label.
 *
 * 🚩 `retainedAddress` is the ticket's own question, answered *yes*: under
 * pickup the caller's address leaves the projection entirely
 * (capture 09 — `address: null`), and an agent who cannot see that it is kept has
 * no way to know a flip back will move the store. The trace is drawn from the
 * client's own memory of the last address the ORDER held, never from a re-read:
 * the sidecar holds the truth and the console is only saying *there was one*.
 */
export type RailBlock = 'address' | 'collection'

export function railBlock(header: SessionHeader): RailBlock {
  return isPickup(header) ? 'collection' : 'address'
}

/**
 * Whether the receipt draws a delivery region at all.
 *
 * 🚩 **Absent, not zero** — [156](.issues/156-delivery-fee-shared-rule.md)'s
 * ruling, and it is capture-confirmed rather than theoretical: capture 09's
 * pickup state is `{ amount: 0, waived: false, thresholdGross: 100 }`, against
 * which today's receipt draws **`Delivery SAR 0.00`** and, underneath it,
 * *"free over SAR 100"* — a delivery promise on an order nobody is delivering.
 * The block still ships on the wire so the flip back re-quotes instantly; the
 * console simply does not draw it.
 */
export function showsDeliveryRegion(header: SessionHeader): boolean {
  return !isPickup(header)
}

/**
 * The delivery line, as words rather than as a boolean pair.
 *
 * - `amount` — the fee stands, and `thresholdGross` is what the agent can say
 *   out loud while the caller is still deciding.
 * - `waived` — it fell away, **and why**. `waivedReason` is the server's own
 *   branch (§2.5); the console never infers it by comparing `gross` against
 *   `thresholdGross`, which is right today and wrong the day
 *   `ConfiguredOverride` becomes reachable.
 * - `waivedNoReason` — a pre-1.5 server. The bare word, which is v1.4's
 *   behaviour, rather than a guessed sentence.
 */
export type FeeLine =
  | { kind: 'amount'; amount: number; thresholdGross: number | null }
  | { kind: 'waived'; reason: string }
  | { kind: 'waivedNoReason' }

export function feeLine(fee: DeliveryFeeView): FeeLine {
  if (!fee.waived)
    return { kind: 'amount', amount: fee.amount, thresholdGross: fee.thresholdGross }
  return fee.waivedReason ? { kind: 'waived', reason: fee.waivedReason } : { kind: 'waivedNoReason' }
}

/**
 * The payment chip's wording key.
 *
 * 🚩 **The mode words it; the wire never changes** (§2.4). Under `PickInStore` a
 * chip reading *Cash on delivery* describes an order nobody delivers, so the
 * console says *Pay on collection* while `paymentType` stays `"CashOnDelivery"`
 * on the wire and `"C"` in the column. Wording follows the caller's experience;
 * the value follows OMS.
 *
 * An unrecognised value (a future `Receivable`, which no phase-1 path produces)
 * returns `null` and the chip draws the server's own value — degrade, never
 * throw (§9).
 */
export function paymentWordKey(header: SessionHeader): string | null {
  const value = header.paymentType ?? 'CashOnDelivery'
  if (value === 'CashOnDelivery') return isPickup(header) ? 'payOnCollection' : 'cashOnDelivery'
  if (value === 'Online') return 'paidOnline'
  if (value === 'Receivable') return 'receivable'
  return null
}

/**
 * Whether the mode control is a control at all, and why not.
 *
 * The one rule in phase 1 that can shut this axis is a **delivery-only document
 * source** — `DocumentSourcePolicyService`'s `SupportsPickInStore`, false for
 * WSFD / P2E / DKSW. 🚩 It is the *surviving* half of 175's
 * "P2E forces online + the delivery-only sources":
 * [155](.issues/155-payment-type-cod-or-online.md) found the payment half sits on
 * the **kind** axis, where every forcing kind is out of phase 1. This half is a
 * source rule, and phase 1 has sources.
 *
 * It is a `capabilities` answer, never a client-side list of source codes: the
 * membership is table data on the server, so a console holding the list would be
 * a second opinion that goes stale silently.
 */
export type FulfilmentGate =
  | { open: true }
  | { open: false; reason: string | null }

export function fulfilmentGate(capabilities: SessionCapabilities): FulfilmentGate {
  return capabilityGate(capabilities, 'canChangeFulfilment')
}

/**
 * The same question for any `can*` — *is this a control, and if not, why not*.
 *
 * Both enumerated chips need it: fulfilment can be shut by a delivery-only
 * source, and `canChangePaymentType: false` is a state the console must
 * implement even though ⚠ **no phase-1 order reaches it** (§2.4 — every forcing
 * rule is a kind rule and every forcing kind is out of scope). It is proved from
 * a stubbed state, and the drive says so.
 */
export function capabilityGate(
  capabilities: SessionCapabilities,
  name: 'canChangeFulfilment' | 'canChangePaymentType' | 'canApplyCoupon',
): FulfilmentGate {
  // Absent means a server older than the field, and §9's rule is that a client
  // ignores what it does not know rather than assuming the worst — the door
  // refuses anyway, in words.
  if (capabilities[name] !== false) return { open: true }
  return { open: false, reason: capabilities.capabilityReasons?.[name] ?? null }
}
