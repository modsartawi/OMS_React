import { api } from '@/core/api'
import type { BbyDetailDto, BbyGroupMembersDto, BbySide } from '@/core/models/bonus-buy-inquiry'
import type { Permissions } from '@/core/permissions'

// The two DETAIL-side bonus-buy reads (contracts 057/058). They live in `@/core/`
// alongside the modal they feed (ticket 112): the detail modal is today opened by the
// Bonus Buy Inquiry grid and is about to be opened by the Simulation screen too (118),
// and a feature may never import another feature — so the modal and its calls graduate
// up to the shared layer ahead of that second consumer. Ticket 118 is that consumer
// arriving, and it brought the screen's grant predicate up here too for the same reason.
// Only the list/search stays with the inquiry screen, which is still its one consumer.
//
// Every call goes through @/core/api (see .claude/rules/api-envelope.md): it unwraps the
// SIS.Api envelope, returns `.data`, and maps failures to a typed ApiError.
const BASE = 'Bby'

/** The bonus-buy inquiry grant (`BbyInquiry:03`), off the one permissions answer (oms 909). Read by the
 *  menu's nav gate, the inquiry screen's guard and the Simulation rail's details control, so the three
 *  cannot disagree. The old `Bby/Access` probe's 404-tolerant "unknown ⇒ shown" fallback went with it: a
 *  grant answer is never unknown now, only pending (hidden) or in. */
export const canOpenBbyInquiry = (p: Permissions): boolean => p.has('BbyInquiry:03')

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
