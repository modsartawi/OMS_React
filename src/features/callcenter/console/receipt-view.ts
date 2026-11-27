/**
 * What the summary column's receipt READS (spec 983 D6, ticket 986): Original ·
 * Discount · Subtotal · VAT · Delivery fee · Total, and *Caller saves …*.
 *
 * 🚩 **Engine truth, read and not computed** (contract §2.1). It takes `totals` and
 * nothing else, and every figure it returns is one the server sent. Original and
 * Discount are C1's `beforeDiscount` and `discount` (v1.13); on a v1.12 server
 * they are absent and the rows are hidden — never derived from `net` and the fired
 * promotions, which would be the client finding a figure by subtraction.
 */
import type { SessionTotals } from '@/core/models/callcenter'
import { receiptView } from './basket-view'
import { feeLine, type WordedWaivedReason } from './fulfilment-view'

export type ReceiptFigureId = 'original' | 'discount' | 'subtotal' | 'vat'

export interface ReceiptFigure {
  id: ReceiptFigureId
  /** Verbatim from `totals`. `discount` is the server's positive amount; the
   *  component draws it with a minus sign — a sign is wording, not arithmetic. */
  amount: number
}

export type ReceiptFee =
  | { kind: 'amount'; amount: number; thresholdGross: number | null }
  /** Struck out and marked *free*: `struck` is the waived fee's own amount (null
   *  when the server sent nought — nothing to strike), `reason` the server's
   *  branch, or null for a branch this console has no sentence for (§9). */
  | { kind: 'waived'; struck: number | null; reason: WordedWaivedReason | null }

export interface Receipt {
  figures: ReceiptFigure[]
  /** `null` on a collection order (absent, not zero — 176) or with no fee block (§9). */
  fee: ReceiptFee | null
  total: number
  /** The *Caller saves …* pill: the server's `discount` where it is above nought,
   *  else `null` (no pill). */
  saves: number | null
}

const isMoney = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

export function receipt(totals: SessionTotals, { delivering }: { delivering: boolean }): Receipt {
  const base = receiptView(totals)
  // Both or neither: half a pair would show an Original with no Discount under it
  // (or the reverse), which reads as a figure the server did not mean.
  const carriesC1 = isMoney(totals.beforeDiscount) && isMoney(totals.discount)
  const figures: ReceiptFigure[] = [
    ...(carriesC1
      ? [
          { id: 'original' as const, amount: totals.beforeDiscount as number },
          { id: 'discount' as const, amount: totals.discount as number },
        ]
      : []),
    { id: 'subtotal', amount: base.net },
    { id: 'vat', amount: base.vat },
  ]

  let fee: ReceiptFee | null = null
  if (delivering && base.delivery) {
    const line = feeLine(base.delivery)
    fee =
      line.kind === 'amount'
        ? line
        : {
            kind: 'waived',
            struck: base.delivery.amount > 0 ? base.delivery.amount : null,
            reason: line.kind === 'waived' ? line.reason : null,
          }
  }

  return {
    figures,
    fee,
    total: base.payable,
    saves: carriesC1 && (totals.discount as number) > 0 ? (totals.discount as number) : null,
  }
}
