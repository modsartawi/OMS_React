import type { Permissions } from '@/core/permissions'

// The HungerStation area's grants (spec 3028, ticket 551; promotions spec 3201, ticket 665; oms 909: off the one
// permissions answer). Pure: no React, no `t`. Each leaf of the HungerStation menu group and each page's in-page gate
// read their grant through the SAME predicate here. The shape is Deliverect's (`@/core/deliverect/access`); the
// grants are this rail's own, each one `BackOfficeScreen[…,03]`.

/** Chains, stores and their stock sync (551–554): `HungerStationStores:03`. */
export const canManageStores = (p: Permissions): boolean => p.has('HungerStationStores:03')

/** The HungerStation material list (555): `HungerStationCatalog:03`. */
export const canManageCatalog = (p: Permissions): boolean => p.has('HungerStationCatalog:03')

/** The orders monitor and retry (556): `HungerStationOrders:03`. */
export const canViewOrders = (p: Permissions): boolean => p.has('HungerStationOrders:03')

/** HungerStation promotions (665–671): `HungerStationPromotions:03`. */
export const canManagePromotions = (p: Permissions): boolean => p.has('HungerStationPromotions:03')
