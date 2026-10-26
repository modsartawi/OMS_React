/**
 * The location card's reading (575, BackOffice spec 2482; rows and rules: BackOffice 2468;
 * wire: contract v1.12 §3) — pure, so every row, tick and note is proved without a browser.
 *
 * - **The rows** (`locationCard`): what the customer sent, compared against the order's
 *   address AS IT STANDS NOW → one row per field, its default tick and its note.
 * - **The body** (`applyBody`): the ticks, and only the ticks. 🚩 **The values never travel**:
 *   the server reads the pin, the Short Address and the details off the capture it holds.
 * - **The refusals** (`applyRefusal`): where each `ApplyLocation` refusal is drawn.
 *
 * 🚩 **Display only.** The server decides every rule again (contract §3) — a blank never
 * wipes, details only into an EMPTY line 2. The card mirrors those rules so the agent is not
 * offered a tick the server would ignore; it is never the only guard.
 */
import { apiErrorCode, apiErrorMessage, ApiError } from '@/core/api'
import {
  CCL,
  LOCATION_LINK_REFUSED,
  type ApplyLocationRequest,
  type LocationCapture,
  type LocationPinSource,
  type SessionAddress,
} from '@/core/models/callcenter'

export interface LocationCardPin {
  source: LocationPinSource
  /** ±N m on a phone pin; always `0` on a hand-placed one. */
  accuracyMeters: number
  /** `lat, lon` at six decimals — ONE machine value, isolated once where drawn. */
  coordinates: string
  /** Google Maps' search URL for the pin (2468). Opened in a new tab. */
  mapsUrl: string
  /** The order already holds a different, non-null pin: the row says it replaces it. */
  replacesEarlier: boolean
}

export interface LocationCardShortAddress {
  /** The captured code, or `null` when the customer skipped it. */
  code: string | null
  /** The order's own code, only when it is set and differs from the captured one. */
  orderHas: string | null
  /** `false` when not given — a blank never wipes, so there is nothing to tick. */
  tickable: boolean
}

export interface LocationCardDetails {
  /** The customer's text, or `null` when they gave none. */
  text: string | null
  /**
   * - `tick`: *into Address line 2* (the order's line 2 is empty);
   * - `copy`: line 2 is already filled — a Copy button and the note, no tick;
   * - `none`: the customer gave no details.
   */
  mode: 'tick' | 'copy' | 'none'
}

export interface LocationTicks {
  pin: boolean
  shortAddress: boolean
  details: boolean
  saveToCustomer: boolean
}

export interface LocationCard {
  pin: LocationCardPin
  shortAddress: LocationCardShortAddress
  details: LocationCardDetails
  /** Whether *Also save to this customer address* is drawn: a customer is attached AND the
   *  order has an address. */
  saveToCustomer: boolean
  /** Whether *Create address from this location* is drawn in the save row's place (576): a
   *  customer is attached (their book is where the address goes) and the order has NO address.
   *  With no customer, neither is drawn. */
  createAddress: boolean
  /** The default ticks: the pin, the Short Address and the details ticked where they can be;
   *  save to customer never. */
  ticks: LocationTicks
}

const blank = (text: string | null | undefined) => !text || text.trim() === ''

/** Six decimals — the server's `DECIMAL(9,6)`, so the card reads what is stored. */
const coord = (value: number) => value.toFixed(6)

/** Google Maps' search URL for a pin (2468). */
export function mapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(lat)},${coord(lon)}`
}

/**
 * The card for one capture. `address` is `header.address` as it stands now (`null` when the
 * order has none); `customerAttached` is whether a customer is on the order.
 */
export function locationCard(
  capture: LocationCapture,
  address: SessionAddress | null,
  customerAttached: boolean,
): LocationCard {
  const orderLat = address?.gpsLat ?? null
  const orderLon = address?.gpsLon ?? null
  const replacesEarlier =
    orderLat !== null &&
    orderLon !== null &&
    (coord(orderLat) !== coord(capture.gpsLat) || coord(orderLon) !== coord(capture.gpsLon))

  const code = blank(capture.shortAddress) ? null : capture.shortAddress.trim()
  const orderCode = blank(address?.shortAddress) ? null : address!.shortAddress!.trim()

  const text = blank(capture.addressDetails) ? null : capture.addressDetails.trim()
  // `line2` absent (a pre-1.12 server) cannot be shown to be empty, so it reads as filled:
  // offering a tick the server might ignore is worse than offering Copy.
  const line2Empty = address === null || address.line2 === null || (address.line2 !== undefined && blank(address.line2))
  const detailsMode: LocationCardDetails['mode'] = text === null ? 'none' : line2Empty ? 'tick' : 'copy'

  return {
    pin: {
      source: capture.pinSource,
      accuracyMeters: capture.accuracyMeters,
      coordinates: `${coord(capture.gpsLat)}, ${coord(capture.gpsLon)}`,
      mapsUrl: mapsUrl(capture.gpsLat, capture.gpsLon),
      replacesEarlier,
    },
    shortAddress: {
      code,
      orderHas: code !== null && orderCode !== null && orderCode !== code ? orderCode : null,
      tickable: code !== null,
    },
    details: { text, mode: detailsMode },
    saveToCustomer: customerAttached && address !== null,
    createAddress: customerAttached && address === null,
    ticks: {
      pin: true,
      shortAddress: code !== null,
      details: detailsMode === 'tick',
      saveToCustomer: false,
    },
  }
}

/**
 * `POST CallCenterWeb/ApplyLocation`'s body (§3), field for field. 🚩 **Only the ticks** —
 * and only ticks the card offered: a row with nothing to apply (a Short Address not given,
 * a line 2 already filled, save to customer hidden) is sent `false`, whatever the state
 * holds. Everything unticked still stamps Applied: the agent reviewed it and took nothing.
 */
export function applyBody(
  transactionId: string,
  requestId: string,
  token: string,
  card: LocationCard,
  ticks: LocationTicks,
): ApplyLocationRequest {
  return {
    transactionId,
    requestId,
    token,
    applyPin: ticks.pin,
    applyShortAddress: card.shortAddress.tickable && ticks.shortAddress,
    applyDetails: card.details.mode === 'tick' && ticks.details,
    saveToCustomer: card.saveToCustomer && ticks.saveToCustomer,
  }
}

/**
 * The stamp after *Create address from this location* (576, open question 1 — the
 * recommended option, an overrulable ruling): once the created address is on the order, the
 * capture is applied with the pin, the Short Address and the details ticked and
 * `saveToCustomer: false`. It is idempotent against the values the create just wrote (the
 * server's rules: a blank never wipes, details only into an EMPTY line 2), and stamps Applied
 * in the same transaction — so the trail says what happened to the capture. The ticks are sent
 * raw, not ANDed with the card: the card now compares against the address the capture itself
 * filled, and the server decides every rule again.
 */
export function stampAfterCreate(transactionId: string, requestId: string, token: string): ApplyLocationRequest {
  return {
    transactionId,
    requestId,
    token,
    applyPin: true,
    applyShortAddress: true,
    applyDetails: true,
    saveToCustomer: false,
  }
}

/**
 * Where an `ApplyLocation` refusal is drawn (§3, §4).
 * - `refetch` (`CCL-00031`, already applied or discarded): re-read, then the chip or strip;
 * - `retry` (`CCL-00030`, nothing captured yet): keep the card, retry once on the next poll;
 * - `gone` (`CCL-00006`, no such link for this agent and order): drop the card, Send again;
 * - `hide` (`CCL-00001`, not configured): drop the card and the action;
 * - `save`: the two save-to-customer refusals, inline on that tick — the card stays;
 * - `card`: anything else, on the card, in the server's words where it gave any.
 *
 * `SESSION_BUSY` and the dead-order faults are the verb path's (`runGuarded`) before they
 * are this card's: a spent busy schedule lands here as `card`.
 */
export type ApplyRefusal =
  | { at: 'refetch' }
  | { at: 'retry' }
  | { at: 'gone' }
  | { at: 'hide' }
  | { at: 'save'; key: string }
  | { at: 'card'; text: string }
  | { at: 'card'; key: string }

const SAVE_REFUSALS: Record<string, string> = {
  NO_CUSTOMER_ATTACHED: 'location.card.refused.noCustomer',
  ADDRESS_NOT_FOR_CUSTOMER: 'location.card.refused.notTheirs',
}

/** `LOCATION_LINK_REFUSED`'s `detail.code` — on the envelope's `data`, where the door puts
 *  every refusal's extras. */
function linkCode(err: unknown): string | null {
  const data = err instanceof ApiError ? err.data : null
  const code = data && typeof data === 'object' ? (data as { code?: unknown }).code : null
  return typeof code === 'string' ? code : null
}

export function applyRefusal(err: unknown): ApplyRefusal {
  const code = apiErrorCode(err)
  if (code === LOCATION_LINK_REFUSED) {
    switch (linkCode(err)) {
      case CCL.alreadyStamped:
        return { at: 'refetch' }
      case CCL.nothingCaptured:
        return { at: 'retry' }
      case CCL.noSuchLink:
        return { at: 'gone' }
      case CCL.notConfigured:
        return { at: 'hide' }
    }
  }
  if (code && SAVE_REFUSALS[code]) return { at: 'save', key: SAVE_REFUSALS[code] }
  const text = apiErrorMessage(err, '')
  return text ? { at: 'card', text } : { at: 'card', key: 'location.card.failed' }
}

/** The server's unset stamp is `0001-01-01T00:00:00`. */
const stampSet = (at: string | null | undefined): at is string => !!at && !at.startsWith('0001-01-01')

/** Whether the capture was already applied or discarded — the chip or the strip, never the
 *  card (`CCL-00031`'s re-read, or a capture another press already stamped). */
export function captureStamp(capture: LocationCapture): { kind: 'applied' | 'discarded'; at: string } | null {
  if (stampSet(capture.appliedAt)) return { kind: 'applied', at: capture.appliedAt }
  if (stampSet(capture.discardedAt)) return { kind: 'discarded', at: capture.discardedAt }
  return null
}
