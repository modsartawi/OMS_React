import type { DispatchCallout, DispatchCourierQuote, LocalDateTime } from '@/core/models/dispatch-board'
import { formatMoney } from '@/core/util/number-format'

// A callout's courier quote and its express flag (BackOffice spec 3306, door 3311 — oms ticket 712). In `@/core/`
// beside `view.ts` because the board's row, its inspector and the Release lock dialog (shared with Delivery
// details) all read them. Pure: no React, no `t` — label KEYS live in the `dispatch-board` namespace.

/**
 * What the board shows of a quote: nothing (no quote yet), an attention flag (`NoCourier` / `Failed`), a quiet
 * prediction (`Quoted`), or an outcome the client does not know, quietly as it came.
 */
export type CourierQuoteView =
  | { kind: 'none' }
  | { kind: 'flag'; key: string; outcome: string; checkedAt: LocalDateTime }
  | { kind: 'quoted'; company: string; money: string; eta: string; checkedAt: LocalDateTime }
  | { kind: 'other'; raw: string; checkedAt: LocalDateTime }

const FLAGGED = ['NoCourier', 'Failed']

export function courierQuoteView(q: DispatchCourierQuote | null | undefined): CourierQuoteView {
  if (!q) return { kind: 'none' }
  if (FLAGGED.includes(q.outcome)) return { kind: 'flag', key: `quote.${q.outcome}`, outcome: q.outcome, checkedAt: q.checkedAt }
  if (q.outcome === 'Quoted') {
    return {
      kind: 'quoted',
      company: q.deliveryCompanyName ?? '',
      // Price and currency are ONE machine value, isolated once where shown (bidi rule).
      money: [formatMoney(q.price), q.currency ?? ''].filter(Boolean).join(' '),
      eta: q.estimatedDeliveryDate ?? '',
      checkedAt: q.checkedAt,
    }
  }
  return { kind: 'other', raw: q.outcome, checkedAt: q.checkedAt }
}

/** An express delivery keeps its store once its OTO order exists: releasing its lock frees no store move. */
export function releaseFreesNoMove(c: Partial<Pick<DispatchCallout, 'isExpressDelivery'>>): boolean {
  return c.isExpressDelivery === true
}
