import { api, ApiError } from '@/core/api'
import type {
  BbyDetailDto,
  BbyGroupMembersDto,
  BbyInquiryAccessResult,
  BbySide,
} from '@/core/models/bonus-buy-inquiry'

// The two DETAIL-side bonus-buy reads (contracts 057/058). They live in `@/core/`
// alongside the modal they feed (ticket 112): the detail modal is today opened by the
// Bonus Buy Inquiry grid and is about to be opened by the Simulation screen too (118),
// and a feature may never import another feature — so the modal and its calls graduate
// up to the shared layer ahead of that second consumer. The list/search + access probe
// stay with the inquiry screen, which is the only consumer of those.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md): it unwraps the
// SIS.Api envelope, returns `.data`, and maps failures to a typed ApiError.
const BASE = 'Bby'

/** Raw wire shape of GET Bby/Access (backend TBD; mirrors the sibling
 *  BonusBuyDownloadWeb/Access `{ screenAllowed }` probe). */
interface BbyAccessWire {
  screenAllowed: boolean
}

/** The bonus-buy screen-open grant probe. It lived with the inquiry feature while that
 *  screen was its only consumer; ticket 118 makes the Simulation screen a second one —
 *  and a feature may never import another feature — so it graduates to `@/core/`
 *  alongside the detail call and the modal, exactly as ticket 112 moved those. The
 *  behaviour is carried over UNCHANGED, deliberately: see the degrade note below.
 *
 *  ⚠️ GET Bby/Access does NOT exist in SIS.Api yet. A 404 or a network error is caught
 *  and mapped to `{ screenAllowed: true, probed: false }` — "unknown → shown", which is
 *  correct for the read-only inquiry screen it was written for (spec 061 / contract
 *  057 §4): the list endpoint's own 403 ACCESS_DENIED stays the authoritative security
 *  boundary, so a degraded probe costs a wasted navigation at worst.
 *
 *  `probed` is the flag that lets a stricter caller refuse that degradation. The
 *  Simulation rail gates its bonus-buy-details control on `probed && screenAllowed`,
 *  because there an unknown grant would put a button on every promotion card that
 *  fails on every click. Unknown means ABSENT at that call site; unknown means SHOWN
 *  here. One probe, two readings — which is why the flag rides on the result rather
 *  than the degrade being decided inside. */
export const bonusBuyAccessApi = {
  access(): Promise<BbyInquiryAccessResult> {
    return api
      .get<BbyAccessWire>(`${BASE}/Access`)
      .then((r) => ({ screenAllowed: r.screenAllowed === true, probed: true }))
      .catch((err) => {
        if (err instanceof ApiError && (err.statusCode === 404 || err.kind === 'network'))
          return { screenAllowed: true, probed: false }
        throw err
      })
  },
}

export const bonusBuyDetailApi = {
  // The Details modal payload (066). Self-contained BbyDetailDto (header + org +
  // buy[]/get[] or totalDiscount). ⚠️ GET Bby/Detail does NOT exist in SIS.Api yet
  // (code-complete / runtime-blocked, contract 058). A missing detail record is a
  // BUSINESS outcome — HTTP 404 carrying `BBY_NOT_FOUND` in the envelope — which
  // request() maps to a business ApiError; the modal surfaces its message via
  // apiErrorMessage/apiErrorCode, never a generic "unexpected".
  detail(bbyNumber: string): Promise<BbyDetailDto> {
    return api.get<BbyDetailDto>(`${BASE}/Detail`, { bbyNumber })
  },

  // The grouping members drilldown (067). One page of the members standing behind a
  // Buy/Get grouping's "N members" chip — Buy keyed by `matGrouping`, Get by
  // `condNumber` (the `side` param selects), so a ~1,000-SKU grouping never bloats the
  // Detail payload. ⚠️ GET Bby/GroupingMembers does NOT exist in SIS.Api yet
  // (code-complete / runtime-blocked, contract 058 §3); the drilldown drives against a
  // mocked envelope. buildQuery keeps every param (all are present), so no pre-filter.
  groupingMembers(args: {
    bbyNumber: string
    side: BbySide
    groupingKey: string
    page: number
    pageSize: number
  }): Promise<BbyGroupMembersDto> {
    return api.get<BbyGroupMembersDto>(`${BASE}/GroupingMembers`, args)
  },
}
