/**
 * The Collections area's ONE access probe — **graduated to `core/` by ticket 268**.
 *
 * 🚩 Why it moved. `GET CollectionWeb/Access` had exactly one consumer while
 * `features/collection/inquiry` was the area's only feature (which is why 253 left
 * it there, on the `loyAccessApi` precedent). Spec 267 adds a **second** feature
 * under the same area and the same probe — `features/collection/settlement` — and a
 * feature may not import another feature's api (`.claude/rules/feature-structure.md`).
 * So the probe takes the same road `@/core/oms/api` (125), `@/core/bonus-buy/api`
 * (118) and `@/core/nphies/api` (211) each took when their second consumer appeared.
 *
 * ⚠️ **Only the shared half moved.** The per-screen predicates stay with the screens
 * that own them — `canOpenCollections`/`Acrs`/`Deposits`/`Attempts` in
 * `features/collection/inquiry/api`, `canOpenSettlement` in
 * `features/collection/settlement/api`. The grants are independent by design (244
 * §10), and a screen's reading of its own grant is that screen's business; what the
 * area shares is the key, the options and the call.
 */
import { api } from '@/core/api'
import type { CollectionAccessResult } from '@/core/models/collection'

/**
 * The ONE cache key every Collections nav leaf and every Collections screen's own
 * in-page guard share, so a gated area costs **one** network call and not one per
 * consumer. Exported rather than re-spelled at each site: a typo in a string
 * literal would not fail a build, it would silently split the cache entry and let
 * the nav and a screen disagree about whether the session is allowed in.
 */
export const COLLECTION_ACCESS_KEY = ['collection', 'access'] as const

/**
 * …and the ONE set of options every reader of that key passes.
 *
 * 🚩 The key alone was not enough once a second reader appeared (ticket 257's
 * `Collections ▸` gate, beside `ScreenGate`'s own): react-query merges the options
 * of concurrent observers, so a screen that quietly dropped `retry: false` would
 * make a **refused** probe retry under a gate whose whole ruling is to fail closed
 * on the first no. The options travel with the key, spelled once.
 *
 * `staleTime: Infinity` because a grant does not change inside a page life;
 * `retry: false` because a 403 is an answer and not an outage.
 */
export function collectionAccessQuery() {
  return {
    queryKey: COLLECTION_ACCESS_KEY,
    queryFn: () => collectionAccessApi.access(),
    staleTime: Infinity,
    retry: false,
  } as const
}

export const collectionAccessApi = {
  /**
   * `GET CollectionWeb/Access` → the area's booleans. Cookie-gated and deliberately
   * **not** grant-gated: it must be able to answer a session that holds nothing.
   *
   * ⚠️ **Fails closed.** No 404-tolerant catch, unlike the `Notifications/Access`
   * and `Bby/Access` probes which degrade to *allowed* while their endpoints are
   * unbuilt. These screens are the chain's cash, and 253 asks for exactly this: an
   * unknown or failed probe hides the group rather than offering a screen the
   * server will refuse. The shell already treats a pending or errored probe as
   * hidden, so failing closed is the *absence* of a catch rather than code.
   */
  access(): Promise<CollectionAccessResult> {
    return api.get<CollectionAccessResult>('CollectionWeb/Access')
  },
}
