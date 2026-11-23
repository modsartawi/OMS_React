/**
 * Bonus Buy Bulk Change's server calls (BackOffice spec 4190, server tickets 4192 + 4193; oms 958).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`). Business outcomes — a row
 * refused, a batch refused whole — are in-band 200s; HTTP errors are infrastructure only (403 without
 * the grant). The routes sit on the bonus-buy maintenance group, behind the same grant (`BbyMaintain:03`).
 *
 * 🚩 GUESSED routes: BackOffice 4192/4193 were unbuilt when this was written. Reconcile when they ship
 * (the contract note of ticket 958 lists every guess).
 */
import { api } from '@/core/api'
import type { BbyPromotion } from '@/core/models/bonus-buy-maintenance'
import type {
  BbyBulkChangeRequest,
  BbyBulkChangeResult,
  BbyBulkListRow,
  BbyBulkMarkTestedRequest,
  BbyBulkMarkTestedResult,
} from '@/core/models/bonus-buy-bulk'

// The screen and the nav leaf read the maintenance grant itself (spec 4190 story 47: nobody new gains the power).
export { canOpenBbyMaintain as canOpenBbyBulkChange } from '@/core/bonus-buy/access'

const BASE = 'BbyMaintainWeb'

export const bulkListKey = (promoNumber: string) => ['bonus-buy-bulk-change', 'list', promoNumber] as const
export const bulkPromotionsKey = ['bonus-buy-bulk-change', 'promotions'] as const

export const bbyBulkChangeApi = {
  /** The promotion filter's choices: the shipped `Promotion/List` (its bonus buys are not read here). */
  promotions(): Promise<BbyPromotion[]> {
    return api.get<BbyPromotion[]>(`${BASE}/Promotion/List`)
  },

  /** Every OMS bonus buy across promotions, Planned and locked alike; a blank promotion is all of them. */
  list(promoNumber: string): Promise<BbyBulkListRow[]> {
    return api.get<BbyBulkListRow[]>(`${BASE}/BonusBuy/BulkList`, { promoNumber })
  },

  /** The bulk change: `dryRun` computes and validates every row and writes nothing (the preview). */
  change(body: BbyBulkChangeRequest): Promise<BbyBulkChangeResult> {
    return api.post<BbyBulkChangeResult>(`${BASE}/BonusBuy/BulkChange`, body)
  },

  /** Bulk Mark Tested (oms 959, BackOffice 4194, tester grant `BbyMaintain:04`). 🚩 Guessed route. */
  markTested(body: BbyBulkMarkTestedRequest): Promise<BbyBulkMarkTestedResult> {
    return api.post<BbyBulkMarkTestedResult>(`${BASE}/BonusBuy/BulkMarkTested`, body)
  },
}
