/**
 * The demo order (owner ask 2026-11-03, spec 734 D12): the ONE setting the first example question
 * ("Why was order X late?") reads its order number from. Ticket 731 picks the order and sets it here.
 *
 * Empty: the example keeps the locale's placeholder ("X"), selected so typing the number replaces it.
 * Set: the example names that order, and nothing is selected.
 */
export const DEMO_ORDER_NO = ''

export interface LateExample {
  /** What the example names as its order: the demo order, or the placeholder. */
  orderNo: string
  /** The text to select in the box once filled: the placeholder, or null when a real order is named. */
  select: string | null
}

export function lateExample(demoOrderNo: string, placeholder: string): LateExample {
  const no = demoOrderNo.trim()
  return no ? { orderNo: no, select: null } : { orderNo: placeholder, select: placeholder }
}
