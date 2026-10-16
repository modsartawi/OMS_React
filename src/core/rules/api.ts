import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  RuleBlockCatalogue,
  RuleCampaign,
  RuleCampaignCreate,
  RuleCampaignDraft,
  RuleCampaignListRow,
  RuleFormulaCheck,
  RuleFormulaCheckRequest,
  RuleLookupItem,
  RuleLookupKind,
} from '@/core/models/rule-campaign'

// The rule-campaign doors (spec 2737). Every endpoint string of the family lives in THIS file —
// campaigns, catalogue, lookups, validate, simulate, lifecycle, coupons and sessions as later
// slices add them — so ticket 520 re-points one file. Calls go through @/core/api
// (.claude/rules/api-envelope.md); a refusal is the standard envelope, read with apiErrorMessage.
//
// It sits in `core/` because the simulator (514), Priority (513) and support (518, 519) read
// campaigns too, and a feature may not import another feature's api.

// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const CAMPAIGNS = 'RuleCampaign/Campaigns'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const CATALOGUE = 'RuleCampaign/Catalogue'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const LOOKUPS: Record<RuleLookupKind, string> = {
  categories: 'RuleCampaign/Lookups/Categories',
  collections: 'RuleCampaign/Lookups/Collections',
  materials: 'RuleCampaign/Lookups/Materials',
}
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const FORMULA_CHECK = 'RuleCampaign/Formula/Check'

/** Every campaign query — a write refreshes them all. */
export const RULE_CAMPAIGNS_KEY = ['rule-campaigns'] as const

/** One campaign, keyed by its id — the workspace shell and every page inside it share it. */
export const ruleCampaignKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'one', id] as const

export const ruleCampaignApi = {
  /** GET RuleCampaign/Campaigns — every campaign, unfiltered; the list counts and filters locally,
   *  because scheduled / running / expired are read at the reader's local now. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  list(): Promise<RuleCampaignListRow[]> {
    return api.get<RuleCampaignListRow[]>(CAMPAIGNS)
  },

  /** GET RuleCampaign/Campaigns/{id} — the whole campaign, rules included. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  get(id: string): Promise<RuleCampaign> {
    return api.get<RuleCampaign>(`${CAMPAIGNS}/${encodeURIComponent(id)}`)
  },

  /** POST RuleCampaign/Campaigns — a new draft from a name and features (BackOffice 2758); HQ
   *  answers with the whole draft, its code and id minted there. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  create(body: RuleCampaignCreate): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(CAMPAIGNS, body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Copy — an independent draft copied from a campaign
   *  (BackOffice 2759); HQ names it "<name> (copy)" and answers with the new draft. The original
   *  is untouched. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  copy(id: string): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(`${CAMPAIGNS}/${encodeURIComponent(id)}/Copy`, {})
  },

  /** PUT RuleCampaign/Campaigns/{id}/Draft — save the campaign's draft rules (ticket 505,
   *  BackOffice 2758); HQ answers with the whole campaign as saved. A campaign HQ will not let the
   *  reader edit is refused on the standard envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveDraft(id: string, body: RuleCampaignDraft): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(`${CAMPAIGNS}/${encodeURIComponent(id)}/Draft`, body)
  },

  /** GET RuleCampaign/Catalogue — the block catalogue: condition and effect types, their fields,
   *  units and palette groups (BackOffice 2758). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  catalogue(): Promise<RuleBlockCatalogue> {
    return api.get<RuleBlockCatalogue>(CATALOGUE)
  },

  /** GET RuleCampaign/Lookups/{Categories|Collections|Materials}?search= — what "Certain items…"
   *  picks from (ticket 506, BackOffice 2758): HQ matches a code or a name (a material by its SKU
   *  or its name) and answers the first hits. An empty search answers the first hits too. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  lookup(kind: RuleLookupKind, search: string): Promise<RuleLookupItem[]> {
    return api.get<RuleLookupItem[]>(LOOKUPS[kind], { search })
  },

  /** POST RuleCampaign/Formula/Check — the ƒx helper's validator (ticket 507, BackOffice 2758): HQ
   *  parses the formula against the rule's filters and values, answers its errors with the span of
   *  the bad word, or its type and its result on HQ's sample basket. A bad formula is an answer
   *  (`ok: false`), not a refusal; a refusal means the check could not be made. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  checkFormula(body: RuleFormulaCheckRequest): Promise<RuleFormulaCheck> {
    return api.post<RuleFormulaCheck>(FORMULA_CHECK, body)
  },
}

/**
 * A formula check's query options: one call per formula and the rule it is read in, kept while
 * the same formula is on screen, so an Undo back to it does not ask again.
 */
export const ruleFormulaCheckQuery = (body: RuleFormulaCheckRequest) => ({
  queryKey: ['rule-formula-check', body] as const,
  queryFn: () => ruleCampaignApi.checkFormula(body),
  staleTime: 5 * 60_000,
  retry: false as const,
})

/** A lookup's query options: one read per kind and search, kept a few minutes. */
export const ruleLookupQuery = (kind: RuleLookupKind, search: string) => ({
  queryKey: ['rule-lookup', kind, search] as const,
  queryFn: () => ruleCampaignApi.lookup(kind, search),
  staleTime: 5 * 60_000,
  retry: false as const,
})

/**
 * The block catalogue's query options (ticket 504). It changes only with an HQ release, so it is
 * fetched once per page load and kept: every builder page and every campaign share the one read.
 */
export const ruleCatalogueQuery = () => ({
  queryKey: ['rule-catalogue'] as const,
  queryFn: () => ruleCampaignApi.catalogue(),
  staleTime: Infinity,
  gcTime: Infinity,
  retry: false as const,
})

/** The list's query options. */
export const ruleCampaignsQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'list'] as const,
  queryFn: () => ruleCampaignApi.list(),
  retry: false as const,
})

/**
 * A draft HQ just saved (ticket 505): the campaign's own query takes HQ's answer, so every page of
 * its workspace reads the saved rules, and the list is read afresh.
 */
export function rememberSavedDraft(queryClient: QueryClient, campaign: RuleCampaign): void {
  queryClient.setQueryData(ruleCampaignKey(campaign.id), campaign)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}

/** One campaign's query options — the same key wherever it is read, so one call serves them all. */
export const ruleCampaignQuery = (id: string) => ({
  queryKey: ruleCampaignKey(id),
  queryFn: () => ruleCampaignApi.get(id),
  retry: false as const,
})

/**
 * A new draft HQ just made (a create or a copy, ticket 502): its own query is seeded, so its
 * dashboard opens without asking again, and the list is read afresh to count it.
 */
export function rememberNewDraft(queryClient: QueryClient, draft: RuleCampaign): void {
  queryClient.setQueryData(ruleCampaignKey(draft.id), draft)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}
