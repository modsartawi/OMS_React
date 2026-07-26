import { api } from '@/core/api'
import type { OmsAccessResult } from '@/core/models/oms-access'

// The OMS screen-access probe (ticket 125, backend BackOffice 750). It lives in `@/core/`
// rather than with the deliveries feature because it has THREE consumers — the menu's OMS
// leaf, `DeliveriesPage`'s guard and `DocumentDetailsPage`'s guard — and the two features
// may never import each other (.claude/rules/feature-structure.md). This is exactly the
// move ticket 118 made for the bonus-buy probe, for the same reason.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md): it unwraps the
// SIS.Api envelope, returns `.data`, and maps failures to a typed ApiError.
//
// The door this probes, stated once for both OMS features: `SdDocumentWeb/*` is cookie-only
// and grant-filtered. The `SdDocument/*` paths the two features used until ticket 125 carry
// `ApiKeyEndpointFilter` and NO grant filter, so any authenticated session — including a
// store employee holding no role at all — could list delivery documents, deep-link into
// `/oms/document/:no` and reschedule one. Payload shapes are identical by 750's Boundaries,
// so nothing in `core/models/` moved. Two endpoints deliberately did NOT move:
// `Slots/AvailableSlots/{storeCode}` (750 OQ2) and the five session-stable lookups in
// `core/services/lookups` (`storeDetails` feeds the store switcher on every screen).

/** The ONE cache key the three consumers share, so a gated OMS screen costs one network
 *  call and not three. Exported rather than re-spelled at each site: a typo in a string
 *  literal would not fail a build, it would silently split the cache entry. */
export const OMS_ACCESS_KEY = ['oms', 'access'] as const

export const omsAccessApi = {
  /**
   * GET SdDocumentWeb/Access → `{ canOpenList, canOpenDetail }`.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch, unlike the
   * `Notifications/Access` and `Bby/Access` probes which degrade to allowed because
   * their endpoints did not exist server-side yet. This endpoint ships with BackOffice
   * 750 and what sits behind it is a write door, so an unreachable probe must hide the
   * screen rather than reveal it: a rejected promise leaves the menu item hidden (the
   * shell treats pending OR error as hidden) and both pages on their denied card.
   */
  access(): Promise<OmsAccessResult> {
    return api.get<OmsAccessResult>('SdDocumentWeb/Access')
  },
}
