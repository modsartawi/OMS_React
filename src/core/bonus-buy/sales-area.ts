/**
 * An OMS promotion's **sales area** (BackOffice spec 4096, glossary): the closed pair a promotion
 * is written for, and the currency its bonus buys' amounts are read in.
 *
 * - **KSA** = sales organization `1000`, channel `20`, `SAR`.
 * - **Bahrain** = sales organization `1000`, channel `21`, `BHD`.
 *
 * The server holds the same closed list (BO 4097) and refuses any other pair. The client keeps its
 * own copy only to offer the select and to read an old document that carries no pair: a promotion
 * without one is KSA, which is what every promotion was before 4096.
 *
 * Reconciled to the SHIPPED contract, BackOffice pricing2 e35485209 (`BbySalesAreas`,
 * `BbyPromotionDocument`, `BbyPromotionRequest`, `BbyUploadRequest`): the same two pairs and
 * currencies, the document's `salesOrganization` / `distributionChannel` / `currency`.
 *
 * Dependency-free so it runs in the node vitest environment.
 */

export type SalesAreaKey = 'ksa' | 'bahrain'

export interface SalesArea {
  /** The closed list's key, or `null` for a pair outside it (never relabelled KSA). */
  key: SalesAreaKey | null
  salesOrganization: string
  distributionChannel: string
  currency: string
}

/** One of the closed list's entries: always keyed. */
export interface KnownSalesArea extends SalesArea {
  key: SalesAreaKey
}

export const SALES_AREAS: readonly KnownSalesArea[] = [
  { key: 'ksa', salesOrganization: '1000', distributionChannel: '20', currency: 'SAR' },
  { key: 'bahrain', salesOrganization: '1000', distributionChannel: '21', currency: 'BHD' },
] as const

/** The default sales area: preselected on a new promotion, and what a document with no pair is. */
export const KSA: KnownSalesArea = SALES_AREAS[0]

/** The sales area a pair names, or `null` for a pair outside the closed list. */
export function salesAreaOf(
  salesOrganization: string | null | undefined,
  distributionChannel: string | null | undefined,
): KnownSalesArea | null {
  const org = (salesOrganization ?? '').trim()
  const channel = (distributionChannel ?? '').trim()
  return SALES_AREAS.find((a) => a.salesOrganization === org && a.distributionChannel === channel) ?? null
}

export function salesAreaByKey(key: SalesAreaKey): KnownSalesArea {
  return SALES_AREAS.find((a) => a.key === key) ?? KSA
}

/** The fields of a promotion document that carry its sales area (all optional: an old server sends none). */
export interface SalesAreaFields {
  salesOrganization?: string | null
  distributionChannel?: string | null
  currency?: string | null
}

/**
 * The sales area a promotion document is written for. No pair at all → KSA (an old server, or a
 * promotion from before 4096). A pair outside the list keeps its codes and the server's currency
 * (blank when the server sends none: unknown, never guessed), with `key: null`, so the screen tells
 * the truth rather than relabelling it KSA.
 */
export function readSalesArea(doc: SalesAreaFields | null | undefined): SalesArea {
  const org = (doc?.salesOrganization ?? '').trim()
  const channel = (doc?.distributionChannel ?? '').trim()
  if (!org && !channel) return KSA
  const known = salesAreaOf(org, channel)
  if (known) return { ...known, currency: (doc?.currency ?? '').trim() || known.currency }
  return { key: null, salesOrganization: org, distributionChannel: channel, currency: (doc?.currency ?? '').trim() }
}
