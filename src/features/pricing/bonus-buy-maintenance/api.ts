/**
 * Bonus Buy Maintenance's server calls (BackOffice spec 2374, ticket 416).
 *
 * Every one goes through `@/core/api` (`.claude/rules/api-envelope.md`). Business outcomes —
 * a refusal, a delete of an activated bonus buy, a stale version — are in-band 200s carrying
 * a `BbyMaintainOutcome`; HTTP errors are infrastructure only (403 without the grant).
 *
 * The routes match the shipped `BbyMaintainWebEndpoints` (BackOffice 2376–2382, reconciled at
 * ticket 417). The drive still stubs them: no dev SIS.Api is known to carry the doors yet.
 */
import { api } from '@/core/api'
import type {
  BbyBonusBuyDocument,
  BbyBackToPlannedRequest,
  BbyBonusBuyWire,
  BbyCouponMaterialRequest,
  BbyCouponMaterialResult,
  BbyMaintainAccessResult,
  BbyMarkTestedRequest,
  BbyMaintainOutcome,
  BbyPromotion,
  BbyPromotionSave,
} from '@/core/models/bonus-buy-maintenance'
import type { BbyUploadResult } from '@/core/models/bonus-buy-upload'
import { uploadForm, type UploadOptions } from './upload'

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

/** The tester grant, read off the SAME access answer — no second probe. Fail closed, as above. */
export const canMarkTested = (r: BbyMaintainAccessResult | null | undefined): boolean => r?.canTest === true

export const promotionListKey = ['bonus-buy-maintenance', 'promotions'] as const
export const promotionKey = (promoNumber: string) =>
  ['bonus-buy-maintenance', 'promotion', promoNumber] as const
export const bonusBuyKey = (bbyNumber: string) => ['bonus-buy-maintenance', 'bonus-buy', bbyNumber] as const

export const bbyMaintainApi = {
  access(): Promise<BbyMaintainAccessResult> {
    return api.get<BbyMaintainAccessResult>(`${BASE}/Access`)
  },

  promotions(): Promise<BbyPromotion[]> {
    return api.get<BbyPromotion[]>(`${BASE}/Promotion/List`)
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

  /** The whole bonus buy, SAP (read-only) or OMS, plus the `version` a change sends back (2379).
   *  A number naming nothing is an in-band `status: 'notFound'`. */
  bonusBuy(bbyNumber: string): Promise<BbyBonusBuyDocument> {
    return api.get<BbyBonusBuyDocument>(`${BASE}/BonusBuy/${encodeURIComponent(bbyNumber)}`)
  },

  /** Check: the dry run of Save — every refusal and warning, writing nothing (`valid` | `refused`). */
  validate(body: BbyBonusBuyWire): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Validate`, body)
  },

  /** Create (no number: the server mints `OMS…`, Planned) or change, at the version it read. */
  save(body: BbyBonusBuyWire): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Save`, body)
  },

  /** Any bonus buy, SAP or OMS → a new Planned `OMS…` under `promoNumber`. */
  copy(sourceNumber: string, promoNumber: string): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/Copy`, { sourceNumber, promoNumber })
  },

  /**
   * Planned → Tested (spec 2396). The server re-runs the validator and refuses the bonus buy's
   * last writer (four eyes); every refusal comes back in-band. Spec 2396 reading, reconcile when
   * BackOffice 2397 ships — the body is the spec's `{ number, note }`.
   */
  markTested(body: BbyMarkTestedRequest): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/MarkTested`, body)
  },

  /**
   * Tested / Activated / Deactivated → Planned (spec 2396): clears the test mark, and pulls an
   * Activated offer off the tills. Spec 2396 reading, reconcile when BackOffice 2398 ships.
   */
  backToPlanned(body: BbyBackToPlannedRequest): Promise<BbyMaintainOutcome> {
    return api.post<BbyMaintainOutcome>(`${BASE}/BonusBuy/BackToPlanned`, body)
  },

  /**
   * A new coupon material for a Buy line (spec 2396 story 44): every call mints a NEW `COUP…`
   * number, never a cached one. Spec 2396 reading, reconcile when BackOffice 2404 ships.
   */
  generateCouponMaterial(body: BbyCouponMaterialRequest): Promise<BbyCouponMaterialResult> {
    return api.post<BbyCouponMaterialResult>(`${BASE}/CouponMaterial/Generate`, body)
  },

  /**
   * SAP's 22-column upload file into its `P…` promotion (BackOffice 2381/2382), all or nothing.
   * A refusal is an in-band `refused` with every bad row; HTTP errors are infrastructure only.
   */
  upload(file: File, options: UploadOptions): Promise<BbyUploadResult> {
    return api.upload<BbyUploadResult>(`${BASE}/Upload`, uploadForm(file, options))
  },
}
