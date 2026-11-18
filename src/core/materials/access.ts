import type { Permissions } from '@/core/permissions'

// The Materials area's grants (spec 2544, ticket 451), read off the one permissions answer since oms 914 (BackOffice
// spec 4002). Pure: no React, no `t`.
//
// Each leaf of the Materials menu group and each page's in-page gate read their grant through the SAME predicate here,
// so a nav and a screen can never disagree. In `@/core/` because four features read them and a feature may never import
// another. ⚠ `ItemInquiryCustome` is the seed's (WPF ControllerID's) spelling — no final r.

/** Material search + detail (`ItemInquiryCustome:03`) — the search leaf's and both pages' one predicate. */
export const canSearchMaterials = (p: Permissions): boolean => p.has('ItemInquiryCustome:03')

/** Stock check (`MaterialStockInquiry:03`) — its leaf, its page, and "check stock for selected" on the search page. */
export const canCheckStock = (p: Permissions): boolean => p.has('MaterialStockInquiry:03')

/** GS1 check (`Gs1SerialInquiry:03`) — its leaf's and its page's one predicate. */
export const canCheckGs1 = (p: Permissions): boolean => p.has('Gs1SerialInquiry:03')

/** The detail's Stock tab needs BOTH the search grant and the stock grant (spec 2544, Grants). */
export const canSeeMaterialStock = (p: Permissions): boolean => canSearchMaterials(p) && canCheckStock(p)
