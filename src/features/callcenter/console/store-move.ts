/**
 * A plant rebind, as ONE action from the first send to the commit (ticket 167).
 *
 * Changing where a non-empty basket is fulfilled from — by picking an address or
 * by overriding the store deliberately — is two round trips of the **same**
 * action: a send that answers `200` with the **unchanged** state and a
 * `pendingConfirmation` token (CONTRACT.md §5), and a re-send of the same verb
 * carrying that token, which commits exactly what was previewed.
 *
 * Three properties live here rather than in the page, because they are rules
 * rather than rendering:
 *
 * 1. 🚩 **One user action keeps one `requestId`** (law 3 / §4), *including the
 *    re-send that carries the token* and including the re-send that drops it
 *    after `CONFIRM_TOKEN_STALE`. A fresh id on the confirm would make the
 *    server's ledger see two actions on the verb that re-prices a real basket —
 *    the double-apply the ring buffer exists to prevent. The id is minted in
 *    exactly one place (`beginStoreMove`) and every other function here carries
 *    it forward; there is no second call site that *could* mint one.
 * 2. **The preview is read defensively.** `pendingConfirmation.detail` is
 *    `unknown` by the model's own hand (§9 — unknown fields are ignored by rule,
 *    and a minor server version may add to this block). A missing array is an
 *    empty section, never a crash over money.
 * 3. **The offending lines ride both the preview and the refusal.**
 *    `REBIND_REFUSED` is atomic and names the lines that stopped it; where the
 *    envelope carries them they are read from there, and where it does not the
 *    preview the agent was just shown already holds them. Either way the banner
 *    can name the line — which is the whole of "nothing was changed, fix this
 *    line".
 */
import type { PendingConfirmation } from '@/core/models/callcenter'
import { newRequestId } from './api'

/** Which verb moves the plant. `address` derives it (§5.1's usual path);
 *  `store` is the explicit operator override. Same protocol, same modal. */
export type StoreMoveKind = 'address' | 'store'

export interface StoreMove {
  kind: StoreMoveKind
  /** `addressNumber` for an address move, `storeCode` for an override. */
  target: string
  /** Minted once, at `beginStoreMove`, and never re-minted for this action. */
  requestId: string
  /** The token pinning a previewed diff. Absent on the first send, and dropped
   *  again on a re-preview — a token is single-use and two-minute (§5). */
  confirmToken?: string
}

/**
 * A genuinely new action: the agent picked an address, or chose a store. This is
 * the ONLY function in the console that mints a rebind's id.
 *
 * `mint` is injected so the pure test can watch the discipline with ids it can
 * name, rather than by pattern-matching ULIDs.
 */
export function beginStoreMove(
  kind: StoreMoveKind,
  target: string,
  mint: () => string = newRequestId,
): StoreMove {
  return { kind, target, requestId: mint() }
}

/** The confirm re-send: the same verb, the same id, plus the token (§5). */
export function committingStoreMove(move: StoreMove, confirmToken: string): StoreMove {
  return { ...move, confirmToken }
}

/**
 * 🚩 The `CONFIRM_TOKEN_STALE` answer: the basket moved underneath the preview,
 * so the console re-sends **without** the token and shows a fresh preview. It
 * never commits a diff the agent did not see — and it is still the same action,
 * so it is still the same id.
 */
export function repreviewingStoreMove(move: StoreMove): StoreMove {
  const { confirmToken: _spent, ...rest } = move
  return rest
}

/** True while the move is holding a token — i.e. the next send commits. */
export function isCommitting(move: StoreMove | null): boolean {
  return move?.confirmToken !== undefined
}

export interface PreviewLineDiff {
  lineId: string
  itemNumber: string | null
  description: string | null
  fromGross: number
  toGross: number
  /** `toGross - fromGross`. Negative is cheaper at the new store. */
  delta: number
}

export interface PreviewPromotionMove {
  offerId: string
  description: string | null
  fromAmount: number
  toAmount: number
}

export interface PreviewAtpReFreeze {
  lineId: string
  fromQty: number | null
  toQty: number | null
  /** The re-frozen quantity leaves the line below availability. */
  belowAfter: boolean
}

export interface UnpriceableLine {
  lineId: string
  itemNumber: string | null
  description: string | null
  /** The server's machine reason (`NO_PRICE_AT_PLANT`). Shown as data, never
   *  as the sentence the agent reads. */
  reason: string | null
}

/** The `storeChange` diff, projected for the modal that has to name it. */
export interface StoreMovePreview {
  confirmToken: string
  fromPlant: string | null
  fromPlantName: string | null
  toPlant: string | null
  toPlantName: string | null
  lineDiffs: PreviewLineDiff[]
  promotionsMoved: PreviewPromotionMove[]
  /** Only the re-freezes that actually move a quantity — an unchanged row is
   *  noise in a sheet the agent has to read before committing. */
  atpReFreeze: PreviewAtpReFreeze[]
  unpriceableLines: UnpriceableLine[]
  /** The delivery fee either side of the move, where the server quoted it — the
   *  fee is recomputed at the new plant (§2.2) and is money on the caller's
   *  total like any other. `null` when the block carried none. */
  deliveryFee: { fromAmount: number; toAmount: number } | null
  /**
   * True when the diff moves no money at all: every line prices the same, no
   * promotion changes value, and the delivery fee is unchanged. The branch
   * moves; the caller's total does not.
   *
   * 🚩 The fee is part of this by necessity — a sheet that said *no line changes
   * price* while the delivery fee moved would be telling the agent the total
   * stands still when it does not.
   */
  moneyStandsStill: boolean
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

/**
 * The `pendingConfirmation` block, projected — or `null` when there is no store
 * change to preview.
 *
 * 🚩 It answers `null` for a `belowAtp` confirmation too. That kind is
 * [169](.issues/169-below-availability-accepted.md)'s and reuses this same modal
 * pattern; a store-move sheet that drew someone else's detail would be the
 * second confirmation mechanism this slice exists to prevent.
 */
export function storeMovePreview(
  pending: PendingConfirmation | null | undefined,
): StoreMovePreview | null {
  if (!pending || pending.kind !== 'storeChange' || !pending.confirmToken) return null
  const detail = asRecord(pending.detail)

  const lineDiffs: PreviewLineDiff[] = asArray(detail.lineDiffs).flatMap((row) => {
    const line = asRecord(row)
    const lineId = str(line.lineId)
    const fromGross = num(line.fromGross)
    const toGross = num(line.toGross)
    // A diff row with no line or no pair of figures cannot be drawn as a price
    // movement, and inventing a zero for it would be inventing money.
    if (!lineId || fromGross === null || toGross === null) return []
    return [
      {
        lineId,
        itemNumber: str(line.itemNumber),
        description: str(line.description),
        fromGross,
        toGross,
        delta: toGross - fromGross,
      },
    ]
  })

  const promotionsMoved: PreviewPromotionMove[] = asArray(detail.promotionsMoved).flatMap((row) => {
    const promo = asRecord(row)
    const offerId = str(promo.offerId)
    const fromAmount = num(promo.fromAmount)
    const toAmount = num(promo.toAmount)
    if (!offerId || fromAmount === null || toAmount === null) return []
    return [{ offerId, description: str(promo.description), fromAmount, toAmount }]
  })

  const atpReFreeze: PreviewAtpReFreeze[] = asArray(detail.atpReFreeze).flatMap((row) => {
    const atp = asRecord(row)
    const lineId = str(atp.lineId)
    if (!lineId) return []
    const fromQty = num(atp.fromQty)
    const toQty = num(atp.toQty)
    // An availability that re-freezes to the same number moved nothing, and the
    // sheet is read under time pressure.
    if (fromQty !== null && fromQty === toQty && atp.belowAfter !== true) return []
    return [{ lineId, fromQty, toQty, belowAfter: atp.belowAfter === true }]
  })

  const fee = asRecord(detail.deliveryFee)
  const feeFrom = num(fee.fromAmount)
  const feeTo = num(fee.toAmount)
  const deliveryFee = feeFrom !== null && feeTo !== null ? { fromAmount: feeFrom, toAmount: feeTo } : null

  return {
    confirmToken: pending.confirmToken,
    fromPlant: str(detail.fromPlant),
    fromPlantName: str(detail.fromPlantName),
    toPlant: str(detail.toPlant),
    toPlantName: str(detail.toPlantName),
    lineDiffs,
    promotionsMoved,
    atpReFreeze,
    unpriceableLines: unpriceableLines(detail.unpriceableLines) ?? [],
    deliveryFee,
    moneyStandsStill:
      lineDiffs.every((line) => line.delta === 0) &&
      promotionsMoved.every((promo) => promo.fromAmount === promo.toAmount) &&
      (deliveryFee === null || deliveryFee.fromAmount === deliveryFee.toAmount),
  }
}

/** `unpriceableLines[]` out of any envelope shape that carries it — the preview
 *  detail's, or `REBIND_REFUSED`'s `data`. `null` means "this payload carried
 *  none", which is what lets the caller fall back to the preview it holds. */
export function unpriceableLines(value: unknown): UnpriceableLine[] | null {
  const rows = Array.isArray(value) ? value : asRecord(value).unpriceableLines
  if (!Array.isArray(rows)) return null
  const lines = rows.flatMap((row) => {
    const line = asRecord(row)
    const lineId = str(line.lineId)
    if (!lineId) return []
    return [
      {
        lineId,
        itemNumber: str(line.itemNumber),
        description: str(line.description),
        reason: str(line.reason),
      },
    ]
  })
  return lines.length > 0 ? lines : null
}

/**
 * The atomic refusal, as the console draws it: the server's own sentence plus
 * the lines it named. `data` is the `ApiError`'s envelope body — `core/api.ts`
 * carries it through — and the preview the agent was just shown is the fallback,
 * because `unpriceableLines[]` rides both by design (§5.1).
 */
export interface RebindRefusal {
  /** Server-supplied, passed through as data (§7). */
  message: string
  lines: UnpriceableLine[]
}

export function rebindRefusal(
  message: string,
  errorData: unknown,
  preview: StoreMovePreview | null,
): RebindRefusal {
  return { message, lines: unpriceableLines(errorData) ?? preview?.unpriceableLines ?? [] }
}
