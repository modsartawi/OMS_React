/**
 * Every decision the bonded-return screen makes, in one dependency-free module
 * (spec 289 D3): no React, no `t()`, no network, no clock. This slice carries
 * the first of them — the **line projection**.
 *
 * It lives beside `change-store.ts` and `reschedule.ts` for the same reason
 * those do: the arithmetic is where a regression is silent, and none of it
 * needs a browser to be exercised.
 */
import { describeConditionType } from '@/core/constants/oms-codes'
import type { SdDistrictModel } from '@/core/models/lookups'
import { districtCityName } from './change-store'
import type {
  CreateReturnAddress,
  CreateReturnRequest,
  ReturnReason,
  SdDocumentAddressModel,
  SdDocumentLineModel,
  TransactionConditionModel,
} from '@/core/models/sd-document'

/**
 * The two return reasons.
 *
 * **Provenance: BackOffice spec 1283 §2** (`ReturnReasonPolicy`'s set, and
 * nothing else), transcribed by spec 289 and living with the rest of that §2
 * transcription in `core/models/sd-document.ts` — re-exported here so the screen
 * keeps reading its vocabulary off one module. This repo does not own the union
 * and does not get to add to it.
 *
 * `RTRF` — *return and refund*: the courier collects and the refund follows the
 * goods. `RF` — *refund only*: refunded now, nothing is collected, the customer
 * keeps the goods. The second is an irreversible money movement with nothing
 * coming back, which is why the screen pre-selects **neither** (D5).
 */
export type { ReturnReason }

/** One line as the return screen offers it. */
export interface ReturnableLine {
  lineNumber: number
  itemNumber: string
  itemDescription: string
  uom: string
  /**
   * The line's own unit price, carried here so the grid never reaches back past
   * the projection into the raw lines — the projection decides which lines
   * exist, and a row that had to re-find itself by `lineNumber` could re-admit
   * one the projection had just excluded.
   *
   * Read-only CONTEXT on screen. It is not on the wire in either direction
   * (spec 289 D9): the server recomputes discount and VAT pro-rata.
   */
  unitPrice: number
  /** What was delivered — the line's `quantity`. */
  delivered: number
  /** What earlier returns have already taken back. */
  returned: number
  /** `delivered − returned`, never below zero. The cap on what may be sent back. */
  remaining: number
}

/** The projection: the rows to render, and what was left out of them. */
export interface ReturnableLineProjection {
  rows: ReturnableLine[]
  /**
   * How many lines were omitted because nothing is left on them. The grid
   * renders what it is handed and the header states this count — a line that
   * silently vanishes is a line an operator will look for.
   */
  hiddenCount: number
  /**
   * How many lines were omitted because they were **never returnable at all** —
   * struck from the delivery, or delivered in no quantity.
   *
   * Kept apart from `hiddenCount` because the two say different things and only
   * one of them is a fact about earlier returns: folding a struck line into the
   * returned tally makes the grid header — and the command's own exhausted
   * tooltip — state something that never happened.
   */
  notReturnableCount: number
}

/**
 * A payload number, or `0`.
 *
 * ⚠ `returnedQuantity` is a BackOffice spec 1283 §2b addition that does not
 * exist on the wire yet, so it is **optional** on the model and absent on every
 * captured payload. Absent means *nothing has been returned* — never `NaN`,
 * which would poison `remaining` and every comparison downstream.
 */
function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Hold a number inside `[low, high]`. */
function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/**
 * Project a delivery's lines into the rows a return may be created from.
 *
 * `remaining = quantity − returnedQuantity`, per 1283 §2b's own formula. A line
 * with nothing left is **omitted from the rows and counted in the tally** —
 * hiding is the projection's job, not the grid's.
 *
 * A remainder is clamped to `[0, delivered]`. A server that reports more
 * returned than delivered — or, while the field's spelling is still a guess,
 * one that reports it negative — is a data question, and neither answer is a
 * licence to offer a quantity outside what was delivered.
 *
 * **A struck line is never offered.** `deleted` lines render struck in the Items
 * grid rather than vanishing, and a line struck from the delivery is not goods a
 * customer can send back. They leave through the second tally, not the returned
 * one — as does a line delivered in no quantity, which has nothing to give back
 * and never had anything taken.
 */
export function returnableLines(
  lines: SdDocumentLineModel[] | null | undefined,
): ReturnableLineProjection {
  const rows: ReturnableLine[] = []
  let hiddenCount = 0
  let notReturnableCount = 0

  for (const line of lines ?? []) {
    const delivered = Math.max(0, finiteOrZero(line.quantity))
    const returned = finiteOrZero(line.returnedQuantity)
    const remaining = clamp(delivered - returned, 0, delivered)
    if (line.deleted || delivered <= 0) {
      notReturnableCount += 1
      continue
    }
    if (remaining <= 0) {
      hiddenCount += 1
      continue
    }
    rows.push({
      lineNumber: line.lineNumber,
      itemNumber: line.itemNumber,
      itemDescription: line.itemDescription,
      uom: line.uom,
      unitPrice: finiteOrZero(line.unitPrice),
      delivered,
      returned,
      remaining,
    })
  }

  return { rows, hiddenCount, notReturnableCount }
}

/**
 * Hold a return quantity inside `[1, remaining]`.
 *
 * Applied to the steppers **and** to typed input, which is the whole point:
 * `−` disabling at 1 and `+` at the cap makes zero unreachable by pressing, and
 * this makes the keyboard no way around either end. Anything that is not a
 * finite number — a cleared box, a pasted word, a `NaN` — reads as the low end
 * rather than as zero, because a ticked line always returns at least one.
 *
 * The low end wins over the cap when they cross: a row with nothing left is not
 * rendered at all (the projection hides it), so a `0` cap here is a state that
 * has no row to belong to, and answering `0` would be a quantity the screen
 * promised could never exist.
 */
export function clampReturnQuantity(value: unknown, remaining: number): number {
  const cap = Math.max(1, finiteOrZero(remaining))
  const typed = typeof value === 'number' ? value : Number(String(value ?? '').trim())
  if (!Number.isFinite(typed) || String(value ?? '').trim() === '') return 1
  return clamp(typed, 1, cap)
}

/**
 * The condition CATEGORY that means *delivery fee* — the WPF's own filter,
 * unchanged.
 *
 * ⚠ **A display constant in this repo, and a considered exception** (spec 289
 * D4). The conditions list arrives whole; there is no *is a header fee* flag on
 * the wire and BackOffice spec 1283 does not add one. This does **not** reopen
 * 1267's refusal of a second `BZ02`: that code is a value a running program
 * branches on to decide whether **money moves**, so a second copy diverges
 * silently. This one decides only **which rows are drawn** — the server re-reads
 * the rate for every type it is handed and owns the money regardless, and a
 * wrong filter is visible on screen the instant it is wrong.
 *
 * ⚠ **Known gap, for the joining ticket to carry as a drift report.** On the
 * captured payload `8000000121` the category comes back **blank on every row**,
 * including its `DFEE` header fee — so on such a document this projection offers
 * nothing. That is the fail-closed direction (a fee not offered is a concession
 * not made, never money invented), and widening the filter to the `DFEE` type
 * would be a second code branching on money. Left as spec 289 D4 wrote it.
 */
const DELIVERY_FEE_CATEGORY = 'F'

/** One delivery fee as the return screen offers it back. */
export interface RefundableFee {
  /**
   * The condition type — the ONLY part of this row that ever reaches the wire
   * (`conditionTypes`, ticket 294). It is also the row's identity on screen,
   * and deliberately so: were a delivery ever to carry two header rows of one
   * type, they would tick together, because the request can only name the type
   * once and a screen offering to refund half of it would be a lie about what
   * the server is going to do. No live capture carries such a pair.
   */
  condType: string
  /** The server-resolved description, falling back to the legacy code map. */
  description: string
  /**
   * ⚠ **The rate — `condAmount`, never `condValue`.** On a header row
   * `condValue` is structurally `.000` (live: `8000000174` reads
   * `condAmount: 12, condValue: 0`), so reading it is a **silent zero**: no
   * exception, a green suite, and a fee that displays as costing nothing.
   *
   * DISPLAY only. It is context for the operator's decision and never leaves
   * the client — the server re-reads the rate itself.
   */
  amount: number
}

/**
 * Project a delivery's conditions into the delivery fees a return may carry
 * back.
 *
 * Two filters, and both matter:
 *
 * - **`condDocumentLine === 0`** — the header row alone. One ticked fee exists
 *   as the item-0 row *and* as one distributed (`originOfCond: 'H'`) copy per
 *   line; taking both charges the concession twice. The copies are neither
 *   included nor summed.
 * - **the delivery-fee category** — so a header payment or discount row is not
 *   offered as something refundable.
 *
 * Order is the wire's own: the conditions arrive in the order the pricing
 * procedure stepped them, and re-sorting a two-row grid would only hide that.
 */
export function refundableFees(
  conditions: TransactionConditionModel[] | null | undefined,
): RefundableFee[] {
  return (conditions ?? [])
    .filter(
      (condition) =>
        condition.condDocumentLine === 0 &&
        textOrEmpty(condition.condCategory).trim() === DELIVERY_FEE_CATEGORY,
    )
    .map((condition) => ({
      condType: textOrEmpty(condition.condType).trim(),
      description: describeConditionType(condition.condType, condition.conditionDescription),
      amount: finiteOrZero(condition.condAmount),
    }))
}

/**
 * One line as the operator has left it: ticked or not, and the quantity in its
 * box — `null` while the box is cleared, which is a state the gate must name
 * rather than silently repair.
 */
export interface ReturnLineSelection {
  picked: boolean
  quantity: number | null
}

/**
 * What the submit bar says: an i18n **key and its parameters**, never a
 * sentence. `t()` lives at the call site (spec 289 D3), so this module stays
 * dependency-free and the copy stays in `document.json`.
 */
export type SubmitGateKey =
  | 'returnDocument.gate.selectLines'
  | 'returnDocument.gate.quantityAtLeastOne'
  | 'returnDocument.gate.chooseReason'
  | 'returnDocument.gate.summary'

export interface SubmitGateOutcome {
  ok: boolean
  /**
   * Narrowed to the keys this gate can name, so a typo is a compile error
   * rather than a raw key rendered into the submit bar.
   */
  key: SubmitGateKey
  params?: Record<string, number>
  /**
   * The fee half of the ready summary — *3 lines · 1 fee* (spec 289 story 41).
   *
   * Its OWN key and count rather than a second parameter on `summary`, because
   * the two counts are independent and one i18n key can pluralise only one of
   * them: *3 lines · 1 fees* is exactly the copy defect that produces. The
   * caller joins the two, as it already joins the address summary's parts.
   *
   * Absent when no fee is ticked, and absent on a blocked bar: a ticked fee is
   * not a step towards submitting, and naming it beside a complaint would read
   * as progress the operator has not made.
   */
  fees?: { key: 'returnDocument.gate.summaryFees'; params: { count: number } }
}

/**
 * The submit gate: **one** missing thing at a time, in the order the operator
 * must act — select a line, then give it a quantity. A list of complaints is
 * not more useful than the next thing to do.
 *
 * Once nothing is missing the same strip flips to a plain summary of what is
 * selected, so it reports readiness as well as blocking it.
 *
 * The third sentence — *choose what happens to the goods* — is the reason fork's
 * (ticket 292), and it comes **last of the three**: an unchosen reason is the
 * only one of them that stands between a filled-in screen and an irreversible
 * refund, so it is the sentence the operator is left looking at.
 */
export function submitGate(
  lines: readonly ReturnLineSelection[],
  reason: ReturnReason | null,
  feeCount = 0,
): SubmitGateOutcome {
  const picked = lines.filter((line) => line.picked)
  if (picked.length === 0) return { ok: false, key: 'returnDocument.gate.selectLines' }
  if (picked.some((line) => !(typeof line.quantity === 'number' && line.quantity >= 1))) {
    return { ok: false, key: 'returnDocument.gate.quantityAtLeastOne' }
  }
  // Nothing chosen is a missing thing, never a default: `RF` refunds now with
  // nothing coming back, and a pre-selected radio is exactly how that gets
  // clicked through (D5).
  if (reason === null) return { ok: false, key: 'returnDocument.gate.chooseReason' }
  return {
    ok: true,
    key: 'returnDocument.gate.summary',
    params: { count: picked.length },
    // Story 41 reads *3 lines · 1 fee*. A fee is never a MISSING thing — none
    // ticked is the ordinary case and the deliberate one — so it only ever adds
    // to the summary, never blocks it.
    ...(feeCount > 0
      ? { fees: { key: 'returnDocument.gate.summaryFees' as const, params: { count: feeCount } } }
      : {}),
  }
}

/**
 * The pickup address as it will post with the return — **exactly** the field set
 * `CreateReturnAddress` carries (BackOffice spec 1283 §2, transcribed by spec
 * 289), so the request builder (294) hands it over without reshaping it.
 *
 * It is a DRAFT: edits live in the dialog and are discarded on cancel. The
 * address on the delivery is never touched — only the one that posts.
 */
export type PickupAddress = CreateReturnAddress

/** A payload string, or `''` — never `undefined`, which uncontrols an input. */
function textOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Seed the pickup draft from the delivery's own shipping address.
 *
 * It is pre-filled and right nearly always — which is why the panel opens
 * collapsed to a one-line summary rather than as an open six-field form.
 *
 * **GPS is carried through unedited** (D6): there is no map picker on this
 * screen, so the delivery's coordinates are the ones the carrier gets. A
 * delivery with no address at all yields a blank but fully-formed draft, so
 * every field is still editable and no input flips from controlled to
 * uncontrolled the moment it is typed into.
 */
export function pickupAddressFrom(
  address: SdDocumentAddressModel | null | undefined,
): PickupAddress {
  return {
    street1: textOrEmpty(address?.street1),
    street2: textOrEmpty(address?.street2),
    cityCode: textOrEmpty(address?.cityCode),
    cityName: textOrEmpty(address?.cityName),
    districtCode: textOrEmpty(address?.districtCode),
    districtName: textOrEmpty(address?.districtName),
    postalCode: textOrEmpty(address?.postalCode),
    buildingNumber: textOrEmpty(address?.buildingNumber),
    shortAddress: textOrEmpty(address?.shortAddress),
    gpsLat: finiteOrZero(address?.gpsLat),
    gpsLon: finiteOrZero(address?.gpsLon),
  }
}

/**
 * Apply a chosen district to the draft, **deriving the city from it** the way
 * `change-store.ts` already does (English name, falling back to Arabic).
 *
 * The city is derived rather than typed because the district is what the courier
 * routes on: a district and a city that disagree is a collection that fails, and
 * the pair only stays consistent if one of them is read-only.
 *
 * Nothing else moves. A district is not an address — the street, the building,
 * the postal code, the short address and the GPS are the operator's to correct
 * and must not be silently rewritten under a picker.
 */
export function applyPickupDistrict(
  address: PickupAddress,
  district: SdDistrictModel | null | undefined,
): PickupAddress {
  if (!district) return address
  return {
    ...address,
    districtCode: textOrEmpty(district.districtCode),
    districtName: districtLabel(district),
    cityCode: textOrEmpty(district.cityCode),
    cityName: districtCityName(district),
  }
}

/**
 * How a district is NAMED — English, falling back to Arabic, falling back to its
 * own code.
 *
 * One function because the picker's `<option>` label and the value written into
 * the draft must be the same string: a district labelled by its code and then
 * applied as a blank name is a field that empties itself the moment it is
 * chosen. The city half of the pair is `change-store.ts`'s `districtCityName`,
 * reused rather than re-spelled (D6 — "the way `change-store.ts` already does
 * it").
 */
export function districtLabel(district: SdDistrictModel): string {
  return (
    textOrEmpty(district.districtNameEn).trim() ||
    textOrEmpty(district.districtNameAr).trim() ||
    textOrEmpty(district.districtCode).trim()
  )
}

/**
 * Make the draft's district/city pair agree with the lookup row it is standing
 * on, or hand the SAME object back when it already does.
 *
 * The picker matches a district on the pair and then on the code alone, so a
 * delivery whose `cityCode` is blank or stale still shows the district the
 * lookup carries. That match is a DISPLAY fallback, and left there it splits the
 * screen from the payload: the operator reads a selected district beside an
 * empty City, and the return posts a `districtCode` with `cityCode: ''` — a
 * pair no courier can route on. Reconciling writes exactly what re-picking that
 * same row would write, so the fallback stops being a way to submit a broken
 * address without ever touching the control.
 *
 * **Identity is the signal.** An address that already agrees comes back by
 * reference, so a caller can apply this on every render and only actually
 * write when something moved. It never runs on the pinned delivery row
 * (`district` is `null` there) — that row is the way back, not a mismatch.
 */
export function reconcilePickupDistrict(
  address: PickupAddress,
  district: SdDistrictModel | null | undefined,
): PickupAddress {
  if (!district) return address
  const applied = applyPickupDistrict(address, district)
  const agrees =
    applied.districtCode === address.districtCode &&
    applied.districtName === address.districtName &&
    applied.cityCode === address.cityCode &&
    applied.cityName === address.cityName
  return agrees ? address : applied
}

/**
 * Put the delivery's own district and city back, exactly as they arrived.
 *
 * The way BACK from a correction: the picker keeps the delivery's district
 * visible even when the lookup does not carry it, so choosing it again has to
 * mean something. Here rather than in the component so every write to the
 * district/city pair lives in one module.
 */
export function restorePickupDistrict(
  address: PickupAddress,
  delivered: PickupAddress,
): PickupAddress {
  return {
    ...address,
    districtCode: delivered.districtCode,
    districtName: delivered.districtName,
    cityCode: delivered.cityCode,
    cityName: delivered.cityName,
  }
}

/**
 * The collapsed panel's one line, as its parts: *district, city* · *street
 * building* · *short address*. The caller joins them — this module renders
 * nothing and knows no separator glyph.
 *
 * Blanks are dropped rather than left as gaps, so a half-filled address reads as
 * a short line instead of one made of punctuation.
 */
export function pickupAddressSummary(address: PickupAddress): string[] {
  const where = [address.districtName, address.cityName].map((s) => s.trim()).filter(Boolean)
  const street = [address.street1, address.buildingNumber].map((s) => s.trim()).filter(Boolean)
  return [where.join(', '), street.join(' '), address.shortAddress.trim()].filter(Boolean)
}

/**
 * The screen, as the operator has left it — everything the request is built
 * from, and nothing else.
 *
 * The rows and the fees are the PROJECTIONS, not the raw payload: a selection
 * can only reach the wire through a row the projection admitted, so a tick left
 * behind by a line or a fee that is no longer offered cannot ride along.
 */
export interface CreateReturnDraft {
  /** Minted once per dialog OPENING and kept across retries (spec 289 D7). */
  requestId: string
  /** A DELIVERY number — the document the screen was opened on. */
  refDeliveryNo: string
  reason: ReturnReason
  rows: readonly ReturnableLine[]
  /** Per-line state, keyed by `lineNumber`. */
  selections: Readonly<Record<number, ReturnLineSelection>>
  fees: readonly RefundableFee[]
  /** Which fees are ticked, keyed by condition TYPE. */
  feePicks: Readonly<Record<string, boolean>>
  address: PickupAddress
  note: string
}

/**
 * Screen state → the body that posts to `SdDocumentWeb/CreateReturn`.
 *
 * ⚠ **The single most valuable function in this wave**, because it is the one
 * place a client-supplied amount could reappear. What it carries:
 *
 * - **ticked lines only**, each at its clamped quantity — the same
 *   `[1, remaining]` range the steppers and the typed box land in, applied once
 *   more here so a body is never built carrying a quantity the server refuses;
 * - **ticked fee TYPES only** — which fee carries back, never how much. The rate
 *   the grid displayed is context for the operator and stays on the screen;
 * - **`shippingAddress` omitted entirely under `RF`**, independently of what the
 *   address panel did, so the panel and the payload cannot disagree (D5);
 * - a **blank note omitted** rather than sent as `''`;
 * - ⚠ **not one field carrying an amount** — no price, discount, VAT, fee or
 *   total, in either direction. A client-supplied refund figure is
 *   *structurally impossible* rather than validated against.
 *
 * It mints nothing and reads no clock: the `requestId` arrives from the caller
 * precisely so a retry can hand back the same one.
 */
/**
 * Which fee TYPES a set of ticks actually carries back.
 *
 * Filtered through the PROJECTION rather than off the tick map: a tick left
 * behind by a fee the grid no longer offers is stale state, not a decision. One
 * function because the submit bar counts what the request posts — two copies of
 * this predicate is how the bar comes to say *1 fee* while the body names none.
 */
export function pickedFeeTypes(
  fees: readonly RefundableFee[],
  feePicks: Readonly<Record<string, boolean>>,
): string[] {
  return fees.filter((fee) => feePicks[fee.condType] === true).map((fee) => fee.condType)
}

export function buildCreateReturnRequest(draft: CreateReturnDraft): CreateReturnRequest {
  const lines = draft.rows
    .filter((row) => draft.selections[row.lineNumber]?.picked === true)
    .map((row) => ({
      lineNumber: row.lineNumber,
      itemNumber: row.itemNumber,
      quantity: clampReturnQuantity(draft.selections[row.lineNumber]?.quantity, row.remaining),
    }))

  const note = draft.note.trim()

  return {
    requestId: draft.requestId,
    refDeliveryNo: draft.refDeliveryNo,
    reason: draft.reason,
    lines,
    conditionTypes: pickedFeeTypes(draft.fees, draft.feePicks),
    // Absent, not empty: `RF` books no collection, so an address on the body
    // would describe a courier visit that is never going to happen.
    ...(draft.reason === 'RF' ? {} : { shippingAddress: { ...draft.address } }),
    ...(note === '' ? {} : { note }),
  }
}
