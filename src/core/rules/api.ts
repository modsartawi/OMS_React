import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  RuleBlockCatalogue,
  RuleBudgetLimitChange,
  RuleBudgetUsage,
  RuleCampaign,
  RuleCampaignBudgets,
  RuleCampaignChecks,
  RuleCampaignAudience,
  RuleCampaignCreate,
  RuleCampaignDetails,
  RuleCampaignDraft,
  RuleCampaignFeatures,
  RuleCampaignListRow,
  RuleCampaignOffline,
  RuleCampaignRoles,
  RuleCampaignSchedule,
  RuleCampaignTransition,
  RuleFormulaCheck,
  RuleFormulaCheckRequest,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
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
  countries: 'RuleCampaign/Lookups/Countries',
  channels: 'RuleCampaign/Lookups/Channels',
  stores: 'RuleCampaign/Lookups/Stores',
}
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const FORMULA_CHECK = 'RuleCampaign/Formula/Check'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const VALIDATE = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/Validate`

// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const ROLES = 'RuleCampaign/Roles'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const LIFECYCLE = (id: string, act: 'AskForApproval' | 'Activate' | 'SendBack' | 'Disable') =>
  `${CAMPAIGNS}/${encodeURIComponent(id)}/${act}`

// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const SETTINGS = (id: string, part: 'Details' | 'Schedule' | 'Audience' | 'Features' | 'Budgets' | 'Offline') =>
  `${CAMPAIGNS}/${encodeURIComponent(id)}/Settings/${part}`
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const OFFLINE_VERDICT = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/OfflineVerdict`
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const BUDGET_USAGE = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/BudgetUsage`
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const BUDGET_LIMIT = (id: string, budgetId: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/Budgets/${encodeURIComponent(budgetId)}/Limit`

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

  /** GET RuleCampaign/Lookups/{Categories|Collections|Materials|Countries|Channels|Stores}?search=
   *  — what "Certain items…" (ticket 506) and Settings ▸ Audience (509) pick from (BackOffice
   *  2758): HQ matches a code or a name (a material by its SKU or its name) and answers the first
   *  hits. An empty search answers the first hits too. */
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

  /** GET RuleCampaign/Campaigns/{id}/Validate — HQ's checks of the campaign's saved draft (ticket
   *  508, BackOffice 2758): errors and warnings, each pointed at rule → block → field by id. A draft
   *  with problems is an answer, not a refusal; a refusal means the check could not be made. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  validate(id: string): Promise<RuleCampaignChecks> {
    return api.get<RuleCampaignChecks>(VALIDATE(id))
  },

  /** GET RuleCampaign/Roles — the reader's roles on rule campaigns (ticket 511, BackOffice 2759's
   *  Ua permissions): what the dashboard draws. The server still refuses what the reader may not do. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  roles(): Promise<RuleCampaignRoles> {
    return api.get<RuleCampaignRoles>(ROLES)
  },

  /** POST RuleCampaign/Campaigns/{id}/AskForApproval — an author sends the SAVED draft to an
   *  approver with an optional note (ticket 511, BackOffice 2759); HQ answers the campaign waiting. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  askForApproval(id: string, body: RuleCampaignTransition): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(LIFECYCLE(id, 'AskForApproval'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Activate — an approver publishes the waiting draft as a new
   *  version (ticket 511, BackOffice 2759); HQ answers the campaign live. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  activate(id: string, body: RuleCampaignTransition): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(LIFECYCLE(id, 'Activate'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/SendBack — an approver returns the waiting draft to its author
   *  with a note (ticket 511, BackOffice 2759); HQ answers the campaign as a draft again. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  sendBack(id: string, body: RuleCampaignTransition): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(LIFECYCLE(id, 'SendBack'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Disable — an approver stops a live campaign (ticket 511,
   *  BackOffice 2759): sales already open keep it, new sales do not get it. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  disable(id: string, body: RuleCampaignTransition): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(LIFECYCLE(id, 'Disable'), body)
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Details — the name in both languages and the
   *  description (ticket 509, BackOffice 2758); HQ answers the whole campaign as saved. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveDetails(id: string, body: RuleCampaignDetails): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Details'), body)
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Schedule — local days and daily hours, never a `Z`
   *  (ticket 509, BackOffice 2758); HQ answers the whole campaign as saved. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveSchedule(id: string, body: RuleCampaignSchedule): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Schedule'), body)
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Audience — countries, channels, stores and members
   *  (ticket 509, BackOffice 2758); HQ answers the whole campaign as saved. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveAudience(id: string, body: RuleCampaignAudience): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Audience'), body)
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Features — coupons and points (ticket 509,
   *  BackOffice 2758). Switching one off while a block uses it is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveFeatures(id: string, body: RuleCampaignFeatures): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Features'), body)
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Offline — "online only" (ticket 509, BackOffice
   *  2758); HQ answers the whole campaign as saved. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveOffline(id: string, body: RuleCampaignOffline): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Offline'), body)
  },

  /** GET RuleCampaign/Campaigns/{id}/OfflineVerdict — HQ's offline-safe verdict on the saved draft
   *  and its reasons (ticket 509, BackOffice 2758): HQ works it out, never the client. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  offlineVerdict(id: string): Promise<RuleOfflineVerdict> {
    return api.get<RuleOfflineVerdict>(OFFLINE_VERDICT(id))
  },

  /** PUT RuleCampaign/Campaigns/{id}/Settings/Budgets — every budget of the campaign: one added,
   *  changed or deleted (ticket 510, BackOffice 2758); HQ answers the whole campaign as saved. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveBudgets(id: string, body: RuleCampaignBudgets): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(SETTINGS(id, 'Budgets'), body)
  },

  /** GET RuleCampaign/Campaigns/{id}/BudgetUsage — a live campaign's counters, one per budget, in
   *  its current period (ticket 510, BackOffice 2744). A counter may be past its limit. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  budgetUsage(id: string): Promise<RuleBudgetUsage[]> {
    return api.get<RuleBudgetUsage[]>(BUDGET_USAGE(id))
  },

  /** PUT RuleCampaign/Campaigns/{id}/Budgets/{budgetId}/Limit — a live budget's new limit (ticket
   *  510, BackOffice 2744). Limits are live settings outside the version pin (ADR 0091): it applies
   *  at once, nothing is republished, and no counter is reset. HQ answers the whole campaign. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  changeLimit(id: string, budgetId: string, body: RuleBudgetLimitChange): Promise<RuleCampaign> {
    return api.put<RuleCampaign>(BUDGET_LIMIT(id, budgetId), body)
  },

  /** DELETE RuleCampaign/Campaigns/{id} — an author deletes a draft that was never published
   *  (ticket 511, BackOffice 2759). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  remove(id: string): Promise<unknown> {
    return api.del<unknown>(`${CAMPAIGNS}/${encodeURIComponent(id)}`)
  },
}

/** The reader's roles' query options: read once a session-ish, never retried (the door fails closed). */
export const ruleCampaignRolesQuery = () => ({
  queryKey: ['rule-campaign-roles'] as const,
  queryFn: () => ruleCampaignApi.roles(),
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

/**
 * A campaign HQ just moved along its approval life (ticket 511): its own query takes HQ's answer,
 * so the dashboard's State and the shell's badge follow, and the list is read afresh so its state
 * tiles count it under the new state.
 */
export function rememberTransition(queryClient: QueryClient, campaign: RuleCampaign): void {
  queryClient.setQueryData(ruleCampaignKey(campaign.id), campaign)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}

/** A draft HQ just deleted: its own queries go, and the list is read afresh. */
export function forgetDeleted(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: ruleCampaignKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignChecksKey(id) })
  queryClient.removeQueries({ queryKey: ruleOfflineVerdictKey(id) })
  queryClient.removeQueries({ queryKey: ruleBudgetUsageKey(id) })
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}

/** A campaign's checks, keyed under the campaign queries: a Save re-reads them (`rememberSavedDraft`). */
export const ruleCampaignChecksKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'checks', id] as const

/**
 * The checks' query options (ticket 508). The builder's pill and the dashboard's approval (511)
 * read the same query, so they always agree on whether an error blocks approval.
 */
export const ruleCampaignChecksQuery = (id: string) => ({
  queryKey: ruleCampaignChecksKey(id),
  queryFn: () => ruleCampaignApi.validate(id),
  // HQ's answer changes only with a save, which re-reads it: no re-ask on focus or remount.
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

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
 * its workspace reads the saved rules, and the list and the draft's checks are read afresh.
 */
export function rememberSavedDraft(queryClient: QueryClient, campaign: RuleCampaign): void {
  queryClient.setQueryData(ruleCampaignKey(campaign.id), campaign)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  // HQ validates the draft it saved (ticket 508): its checks are read afresh, and so is its offline
  // verdict (509), which the rules decide.
  void queryClient.invalidateQueries({ queryKey: ruleCampaignChecksKey(campaign.id) })
  void queryClient.invalidateQueries({ queryKey: ruleOfflineVerdictKey(campaign.id) })
  // A budget added, changed or deleted (510) changes what is counted against it.
  void queryClient.invalidateQueries({ queryKey: ruleBudgetUsageKey(campaign.id) })
}

/** A campaign's offline verdict, keyed under the campaign queries. */
export const ruleOfflineVerdictKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'offline', id] as const

/** The offline verdict's query options (ticket 509): it changes only with a save, which re-reads it. */
export const ruleOfflineVerdictQuery = (id: string) => ({
  queryKey: ruleOfflineVerdictKey(id),
  queryFn: () => ruleCampaignApi.offlineVerdict(id),
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

/** A live campaign's budget counters, keyed under the campaign queries. */
export const ruleBudgetUsageKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'budget-usage', id] as const

/** The budget counters' query options (ticket 510): tills move them, so — unlike the app's other
 *  reads — they are read afresh when the reader comes back to the tab. */
export const ruleBudgetUsageQuery = (id: string) => ({
  queryKey: ruleBudgetUsageKey(id),
  queryFn: () => ruleCampaignApi.budgetUsage(id),
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

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
