/**
 * The rebind action, asserted at its edge: what the console sends, and what a
 * preview projects to.
 *
 * 🚩 The fixtures are read for SHAPE only (CONTRACT.md §11) — every value a case
 * turns on is set by the test.
 */
import { describe, expect, it } from 'vitest'
import type { PendingConfirmation } from '@/core/models/callcenter'
import { REBIND_PREVIEW, REBIND_REFUSAL_DATA } from './__fixtures__/payloads'
import { isCommitting } from './confirm-action'
import {
  beginStoreMove,
  committingStoreMove,
  rebindRefusal,
  repreviewingStoreMove,
  storeMovePreview,
  unpriceableLines,
} from './store-move'
import { newRequestId } from './api'

describe('oneActionKeepsOneRequestId', () => {
  it('mints one ULID per action', () => {
    const id = beginStoreMove('address', '77120').requestId
    // Crockford base32, 26 chars — timestamp-prefixed so a server-side ledger of
    // the last 50 sorts by mint order.
    expect(id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/)
    expect(newRequestId()).not.toBe(id)
  })

  it('reuses the id across the retry, the confirm and the re-preview', () => {
    const move = beginStoreMove('address', '77120', () => 'ACTION-1')

    // A retry of the action is the action: nothing here re-mints, so a caller
    // that re-sends `move` re-sends its id.
    expect(move.requestId).toBe('ACTION-1')
    expect(move.confirmToken).toBeUndefined()

    // §4 — the confirm re-send is the SAME action carrying the token.
    const committing = committingStoreMove(move, 'TOKEN-A')
    expect(committing.requestId).toBe('ACTION-1')
    expect(committing.confirmToken).toBe('TOKEN-A')
    expect(committing.kind).toBe('address')
    expect(committing.target).toBe('77120')

    // 🚩 CONFIRM_TOKEN_STALE: the token is dropped and the id is not. The console
    // re-previews rather than committing a diff the agent never saw.
    const repreviewing = repreviewingStoreMove(committing)
    expect(repreviewing.requestId).toBe('ACTION-1')
    expect('confirmToken' in repreviewing).toBe(false)

    // And a second token pins a second preview on the same action.
    expect(committingStoreMove(repreviewing, 'TOKEN-B')).toEqual({
      kind: 'address',
      target: '77120',
      requestId: 'ACTION-1',
      confirmToken: 'TOKEN-B',
    })
  })

  it('mints a new id only for a genuinely new action', () => {
    let n = 0
    const mint = () => `ACTION-${++n}`
    const first = beginStoreMove('address', '77120', mint)
    const sameTargetAgain = beginStoreMove('address', '77120', mint)
    const override = beginStoreMove('store', '1204', mint)

    // Even the same target twice is two actions — the agent asked twice, and a
    // replayed id would answer about the first one.
    expect(sameTargetAgain.requestId).not.toBe(first.requestId)
    expect(override.requestId).not.toBe(sameTargetAgain.requestId)
    expect(override.kind).toBe('store')
  })

  it('knows whether the next send commits or previews', () => {
    const move = beginStoreMove('store', '1204', () => 'ACTION-1')
    expect(isCommitting(null)).toBe(false)
    expect(isCommitting(move)).toBe(false)
    expect(isCommitting(committingStoreMove(move, 'TOKEN-A'))).toBe(true)
  })
})

describe('storeMovePreview', () => {
  it('projects the contract shape into a diff the sheet can name', () => {
    const preview = storeMovePreview(REBIND_PREVIEW)
    expect(preview).not.toBeNull()
    expect(preview!.confirmToken).toBe(REBIND_PREVIEW.confirmToken)
    expect(preview!.fromPlant).toBeTruthy()
    expect(preview!.toPlant).toBeTruthy()
    expect(preview!.lineDiffs.length).toBeGreaterThan(0)
    // The delta is the console's only derivation here, and it is arithmetic on
    // two engine figures rather than a price of its own.
    for (const line of preview!.lineDiffs)
      expect(line.delta).toBeCloseTo(line.toGross - line.fromGross, 10)
  })

  it('is null for anything that is not a store change', () => {
    expect(storeMovePreview(null)).toBeNull()
    expect(storeMovePreview(undefined)).toBeNull()
    // 🚩 169's kind reuses this modal pattern but not this projection.
    expect(
      storeMovePreview({
        kind: 'belowAtp',
        confirmToken: 'TOKEN-A',
        expiresInMs: 120_000,
        detail: { itemNumber: '100001', requested: 5, available: 2 },
      }),
    ).toBeNull()
    // A block with no token cannot be committed with, so it is not a preview.
    expect(
      storeMovePreview({ kind: 'storeChange', confirmToken: '', expiresInMs: 0, detail: {} } as PendingConfirmation),
    ).toBeNull()
  })

  it('degrades a detail block it does not recognise rather than throwing', () => {
    // §9 — a minor server version may add to `detail`, and `detail` is `unknown`
    // by the model's own hand. A missing section is an empty section.
    const preview = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: { toPlant: '1204', somethingNew: { nested: true } },
    })
    expect(preview).not.toBeNull()
    expect(preview!.lineDiffs).toEqual([])
    expect(preview!.promotionsMoved).toEqual([])
    expect(preview!.atpReFreeze).toEqual([])
    expect(preview!.unpriceableLines).toEqual([])
    expect(preview!.fromPlant).toBeNull()
    expect(preview!.toPlant).toBe('1204')
  })

  it('drops a diff row that carries no pair of figures — it will not invent a zero', () => {
    const preview = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        lineDiffs: [
          { lineId: 'L1', fromGross: 27.6, toGross: 25.3 },
          { lineId: 'L2', fromGross: 34.5 },
          { fromGross: 1, toGross: 2 },
        ],
        promotionsMoved: [{ offerId: 'BBY-4471', fromAmount: -8.4 }],
      },
    })
    expect(preview!.lineDiffs.map((l) => l.lineId)).toEqual(['L1'])
    expect(preview!.promotionsMoved).toEqual([])
  })

  it('says when the branch moves but the money does not', () => {
    const still = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        fromPlant: '1101',
        toPlant: '1204',
        lineDiffs: [{ lineId: 'L1', fromGross: 27.6, toGross: 27.6 }],
        promotionsMoved: [{ offerId: 'BBY-4471', fromAmount: -8.4, toAmount: -8.4 }],
      },
    })
    expect(still!.moneyStandsStill).toBe(true)

    const moves = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: { lineDiffs: [{ lineId: 'L1', fromGross: 27.6, toGross: 25.3 }] },
    })
    expect(moves!.moneyStandsStill).toBe(false)
  })

  it('counts the delivery fee as money — a total that moves is not standing still', () => {
    // 🚩 The fee is recomputed at the new plant (§2.2). A sheet that said "no
    // line changes price" while the fee moved would be telling the agent the
    // caller pays the same when they do not.
    const feeMoves = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        lineDiffs: [{ lineId: 'L1', fromGross: 27.6, toGross: 27.6 }],
        deliveryFee: { fromAmount: 15, toAmount: 0 },
      },
    })
    expect(feeMoves!.deliveryFee).toEqual({ fromAmount: 15, toAmount: 0 })
    expect(feeMoves!.moneyStandsStill).toBe(false)

    const feeStands = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        lineDiffs: [{ lineId: 'L1', fromGross: 27.6, toGross: 27.6 }],
        deliveryFee: { fromAmount: 15, toAmount: 15 },
      },
    })
    expect(feeStands!.moneyStandsStill).toBe(true)

    // A block that quoted no fee is not a fee of zero.
    const noFee = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: { deliveryFee: { fromAmount: 15 } },
    })
    expect(noFee!.deliveryFee).toBeNull()
    expect(noFee!.moneyStandsStill).toBe(true)
  })

  it('keeps only the availability rows that actually move', () => {
    const preview = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        atpReFreeze: [
          { lineId: 'L1', fromQty: 5, toQty: 5, belowAfter: false },
          { lineId: 'L2', fromQty: 40, toQty: 3, belowAfter: false },
          // Unchanged, but the line ends up below availability — that is the
          // fraud-signal case (§5.2) and must survive the filter.
          { lineId: 'L3', fromQty: 2, toQty: 2, belowAfter: true },
        ],
      },
    })
    expect(preview!.atpReFreeze.map((a) => a.lineId)).toEqual(['L2', 'L3'])
  })
})

describe('the atomic refusal names the line twice', () => {
  it('reads the offending lines off the refusal envelope when it carries them', () => {
    const lines = unpriceableLines(REBIND_REFUSAL_DATA)
    expect(lines).not.toBeNull()
    expect(lines!.length).toBeGreaterThan(0)
    expect(lines![0].lineId).toBeTruthy()
  })

  it('falls back to the preview the agent was just shown', () => {
    const preview = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: {
        unpriceableLines: [
          { lineId: 'L3', itemNumber: '300921', description: 'Compounded cream 50g', reason: 'NO_PRICE_AT_PLANT' },
        ],
      },
    })
    // `core/api.ts` carries an envelope's `data` onto the `ApiError`, but a
    // server that answers the refusal with none must still leave the banner able
    // to name the line — which is why it rides both (§5.1).
    const refusal = rebindRefusal('Nothing was changed.', null, preview)
    expect(refusal.message).toBe('Nothing was changed.')
    expect(refusal.lines.map((l) => l.lineId)).toEqual(['L3'])
    expect(refusal.lines[0].itemNumber).toBe('300921')
  })

  it('prefers the refusal envelope over the preview when the two disagree', () => {
    const preview = storeMovePreview({
      kind: 'storeChange',
      confirmToken: 'TOKEN-A',
      expiresInMs: 120_000,
      detail: { unpriceableLines: [{ lineId: 'L3' }] },
    })
    // The commit is where the truth is: the basket may have moved between the
    // preview and the re-send, which is precisely the case fixture 06 describes.
    const refusal = rebindRefusal('…', { unpriceableLines: [{ lineId: 'L9' }] }, preview)
    expect(refusal.lines.map((l) => l.lineId)).toEqual(['L9'])
  })

  it('answers null for a payload that names no line, so the caller can fall back', () => {
    expect(unpriceableLines(null)).toBeNull()
    expect(unpriceableLines({})).toBeNull()
    expect(unpriceableLines({ unpriceableLines: [] })).toBeNull()
    // A row with no line identity cannot tint a line and cannot name one.
    expect(unpriceableLines({ unpriceableLines: [{ itemNumber: '300921' }] })).toBeNull()
    expect(rebindRefusal('…', null, null).lines).toEqual([])
  })
})
