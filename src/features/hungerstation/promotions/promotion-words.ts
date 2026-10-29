import type { TFunction } from 'i18next'
import type { HungerStationDiscountSubtype, HungerStationPromotionReason, HungerStationPromotionType } from '@/core/models/hungerstation'

// The contract's closed vocabularies (BackOffice spec 3201 § Vocabulary), listed ONCE, and each in
// words. Pure apart from the `t` a caller passes. A value the contract does not name is handed
// back as itself (the caller isolates it), so a cell is never blank.

/** The types, in the order the editor offers them. */
export const PROMOTION_TYPES: readonly HungerStationPromotionType[] = ['STRIKETHROUGH', 'SAME_ITEM_BUNDLE']

/** The discount subtypes, in the order the editor offers them. */
export const DISCOUNT_SUBTYPES: readonly HungerStationDiscountSubtype[] = ['PERCENTAGE', 'ABSOLUTE', 'FINAL_PRICE']

/** HungerStation's reporting reasons, `COMPETITIVENESS` (the default) first. */
export const HS_REASONS: readonly HungerStationPromotionReason[] = ['COMPETITIVENESS', 'OVERSTOCK', 'DELISTING', 'EXPIRING_SOON', 'NMR', 'TRADING']

const one = <T extends string>(list: readonly T[]) => (v: unknown): v is T => (list as readonly unknown[]).includes(v)

export const isPromotionType = one(PROMOTION_TYPES)
export const isSubtype = one(DISCOUNT_SUBTYPES)
export const isHsReason = one(HS_REASONS)

/** A type in words; one the contract does not name, as sent. */
export const typeText = (t: TFunction, type: string): string => (isPromotionType(type) ? t(`types.${type}`) : type)

/** A subtype in words; one the contract does not name, as sent; none, blank. */
export const subtypeText = (t: TFunction, subtype: string | null): string => (isSubtype(subtype) ? t(`subtypes.${subtype}`) : (subtype ?? ''))

/** A HungerStation reason in words; one the contract does not name, as sent. */
export const hsReasonText = (t: TFunction, reason: string): string => (isHsReason(reason) ? t(`hsReasons.${reason}`) : reason)
