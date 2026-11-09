// URL keys more than one Hybris stock page reads (BackOffice spec 3447). Here, in `@/core/`, because a
// feature may never import another (.claude/rules/feature-structure.md).

/** `?history=<storeCode>` — the stores page's history drawer, and the push log's material history at
 *  that store: the stores page links into the push log with it. */
export const HISTORY_PARAM = 'history'
