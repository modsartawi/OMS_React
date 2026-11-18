import type { Permissions } from '@/core/permissions'

// The Deliverect area's grants (spec 2615, ticket 477; oms 909: off the one permissions answer). Pure: no React, no
// `t`. Each leaf of the Deliverect menu group and each page's in-page gate read their grant through the SAME
// predicate here, so a nav and a screen can never disagree. Each is one `BackOfficeScreen[…,03]` grant.

/** Stores (477), their stock sync (480) and store status (481): `DeliverectStores:03`. */
export const canManageStores = (p: Permissions): boolean => p.has('DeliverectStores:03')

/** The whitelist and platform exclusions (479), catalog and stock push: `DeliverectCatalog:03`. */
export const canManageCatalog = (p: Permissions): boolean => p.has('DeliverectCatalog:03')

/** The orders monitor (478): `DeliverectOrders:03`. */
export const canViewOrders = (p: Permissions): boolean => p.has('DeliverectOrders:03')

/** Accounts, delivery platforms and their terms (482): `DeliverectTerms:03`. */
export const canManageTerms = (p: Permissions): boolean => p.has('DeliverectTerms:03')

/**
 * Adding a delivery platform (`POST Platforms`, its own grant `DeliverectPlatformAdd:03`). Not a menu grant: it only
 * shows the page's "Add platform" button; the server re-checks the grant on the door.
 */
export const canAddPlatform = (p: Permissions): boolean => p.has('DeliverectPlatformAdd:03')
