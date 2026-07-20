import { api, ApiError } from '@/core/api'
import type {
  BbyDetailDto,
  BbyGroupMembersDto,
  BbyInquiryAccessResult,
  BbyListResult,
  BbySide,
} from '@/core/models/bonus-buy-inquiry'

// Every server call goes through @/core/api (see .claude/rules/api-envelope.md): it
// unwraps the SIS.Api envelope, returns `.data`, and maps failures to ApiError. The
// three inquiry read endpoints share the `Bby/*` prefix (contracts 057/058) — this
// slice (062) consumes the access probe + the list search; Detail/GroupingMembers
// arrive with the modal (066/067). All are DESIGNED contracts, built later on SIS.Api.
const BASE = 'Bby'

/** Raw wire shape of GET Bby/Access (backend TBD; mirrors the sibling
 *  BonusBuyDownloadWeb/Access `{ screenAllowed }` probe). */
interface BbyAccessWire {
  screenAllowed: boolean
}

export const bonusBuyInquiryApi = {
  // Screen-open grant probe. Drives BOTH the shell's permission-aware nav hiding
  // (issue 429) AND the page's own route-guard (shared ['bonus-buy-inquiry','access']
  // cache key → one call). ⚠️ GET Bby/Access does NOT exist in SIS.Api yet — a 404 or
  // a network error is caught and mapped to "unknown → shown" so this read-only
  // inquiry degrades gracefully (spec 061 / contract 057 §4). The list endpoint's own
  // 403 ACCESS_DENIED stays the authoritative security boundary.
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

  // The list/search. `params` comes from the pure `buildListParams` (list-params.ts);
  // buildQuery drops empty entries, so the client never pre-filters. Response carries
  // { rows (≤1000, CreatedAt desc), capReached }.
  list(params: Record<string, unknown>): Promise<BbyListResult> {
    return api.get<BbyListResult>(`${BASE}/List`, params)
  },

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
