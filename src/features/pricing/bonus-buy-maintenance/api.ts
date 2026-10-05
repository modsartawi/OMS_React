/**
 * Bonus Buy Maintenance's server calls (BackOffice spec 2374, ticket 416).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`). Business outcomes —
 * a refusal, a delete of an activated bonus buy, a stale version — are in-band 200s carrying
 * a `BbyMaintainOutcome`; HTTP errors are infrastructure only (403 without the grant).
 *
 * ⚠️ BackOffice 2376 and 2380 had not shipped when this was built: every route here is the
 * spec's contract table, and the drive stubs them all.
 */
import { api } from '@/core/api'
import type {
  BbyMaintainAccessResult,
  BbyMaintainOutcome,
  BbyPromotion,
  BbyPromotionListItem,
  BbyPromotionSave,
} from '@/core/models/bonus-buy-maintenance'

const BASE = 'BbyMaintainWeb'

/** The ONE cache key the Pricing nav leaf and the screen's gate share (one call, not two). */
export const BBY_MAINTAIN_ACCESS_KEY = ['bonus-buy-maintenance', 'access'] as const

/** …and the one set of options every reader passes: a refusal is an answer, never retried. */
export function bbyMaintainAccessQuery() {
  return {
    queryKey: BBY_MAINTAIN_ACCESS_KEY,
    queryFn: () => bbyMaintainApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

/**
 * The grant's one reading, for the nav leaf and the screen gate alike. `=== true` and
 * nothing looser: this screen WRITES to every till's offers, so unlike `Bby/Access` an
 * unknown or malformed answer is a denial (fail closed).
 */
export const canOpenBbyMaintain = (r: BbyMaintainAccessResult | null | undefined): boolean =>
  r?.screenAllowed === true

export const promotionListKey = ['bonus-buy-maintenance', 'promotions'] as const
export const promotionKey = (promoNumber: string) =>
  ['bonus-buy-maintenance', 'promotion', promoNumber] as const

export const bbyMaintainApi = {
  access(): Promise<BbyMaintainAccessResult> {
    return api.get<BbyMaintainAccessResult>(`${BASE}/Access`)
  },

  promotions(): Promise<BbyPromotionListItem[]> {
    return api.get<BbyPromotionListItem[]>(`${BASE}/Promotion/List`)
  },

  promotion(promoNumber: string): Promise<BbyPromotion> {
    return api.get<BbyPromotion>(`${BASE}/Promotion/${encodeURIComponent(promoNumber)}`)
  },

  savePromotion(body: BbyPromotionSave): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/Promotion/Save`, body)
  },

  activatePromotion(promoNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/Promotion/Activate`, { promoNumber })
  },

  deactivatePromotion(promoNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/Promotion/Deactivate`, { promoNumber })
  },

  deletePromotion(promoNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/Promotion/Delete`, { promoNumber })
  },

  /** One number per call — the client loops for a multi-select (spec 2374). */
  activate(bbyNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Activate`, { bbyNumber })
  },

  deactivate(bbyNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Deactivate`, { bbyNumber })
  },

  delete(bbyNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Delete`, { bbyNumber })
  },

  /** Any bonus buy, SAP or OMS → a new Planned `OMS…` under `promoNumber`. */
  copy(sourceNumber: string, promoNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Copy`, { sourceNumber, promoNumber })
  },
}
