/**
 * Bupa line outcomes' grant (oms 899, BackOffice 3889), read off the one permissions answer (oms 914) — apart from
 * `./api` so the OMS menu leaf, which imports it eagerly, costs the main bundle only this.
 */
import type { Permissions } from '@/core/permissions'

/** `BupaLineOutcomes:03` — the menu leaf's and the page gate's one predicate. */
export const canViewBupaOutcomes = (p: Permissions): boolean => p.has('BupaLineOutcomes:03')
