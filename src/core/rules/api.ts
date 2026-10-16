import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  RuleBlockCatalogue,
  RuleBudgetLimitChange,
  RuleBudgetUsage,
  RuleCampaign,
  RuleCampaignCoupon,
  RuleCampaignBudgets,
  RuleCampaignChecks,
  RuleCampaignAudience,
  RuleCampaignCreate,
  RuleCampaignDetails,
  RuleCampaignDraft,
  RuleCampaignFeatures,
  RuleCampaignFromTemplate,
  RuleCampaignListRow,
  RuleCampaignOffline,
  RuleCampaignRoles,
  RuleCampaignSchedule,
  RuleCampaignTemplate,
  RuleCampaignTransition,
  RuleCampaignVersion,
  RuleCampaignVersionDetail,
  RuleCouponBatch,
  RuleCouponBatchCreate,
  RuleCouponImportCheck,
  RuleCouponImportRow,
  RuleCouponUnusedDeleted,
  RuleEvaluationOrder,
  RuleFormulaCheck,
  RuleFormulaCheckRequest,
  RuleLookupItem,
  RuleLookupKind,
  RuleOfflineVerdict,
  RuleSession,
  RuleSessionAccess,
  RuleSessionCancelled,
  RuleSessionListQuery,
  RuleSessionRow,
  RuleSimRequest,
  RuleSimResult,
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
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const VERSIONS = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/Versions`
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const ORDER = 'RuleCampaign/Order'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const TEMPLATES = 'RuleCampaign/Templates'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const SIMULATE = 'RuleCampaign/Simulate'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
// (the coupon doors' own contract is BackOffice 2755)
const COUPONS = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/Coupons`
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
// (the support doors' own contract is BackOffice 2760)
const SESSIONS = 'RuleCampaign/Sessions'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
// Not under SESSIONS: a sale id could read `Access`.
const SESSION_ACCESS = 'RuleCampaign/SessionAccess'

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

  /** GET RuleCampaign/Templates — every template, enabled or not, with its placeholders and the
   *  draft they fill (ticket 503, BackOffice 2759). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  templates(): Promise<RuleCampaignTemplate[]> {
    return api.get<RuleCampaignTemplate[]>(TEMPLATES)
  },

  /** POST RuleCampaign/Templates/{id}/Create — a new draft from a template, its placeholders filled
   *  (ticket 503, BackOffice 2759); HQ checks the values, mints the code and id, and answers with the
   *  whole draft. A disabled template or a value out of its bounds is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  createFromTemplate(templateId: string, body: RuleCampaignFromTemplate): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(`${TEMPLATES}/${encodeURIComponent(templateId)}/Create`, body)
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

  /** GET RuleCampaign/Campaigns/{id}/Versions — every published version with who, when and the
   *  note (ticket 512, BackOffice 2759); a campaign never activated has none. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  versions(id: string): Promise<RuleCampaignVersion[]> {
    return api.get<RuleCampaignVersion[]>(VERSIONS(id))
  },

  /** GET RuleCampaign/Campaigns/{id}/Versions/{version} — one version with its rules as published,
   *  for reading only (ticket 512, BackOffice 2759). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  version(id: string, version: number): Promise<RuleCampaignVersionDetail> {
    return api.get<RuleCampaignVersionDetail>(`${VERSIONS(id)}/${version}`)
  },

  /** POST RuleCampaign/Campaigns/{id}/Versions/{version}/Restore — the version becomes the
   *  campaign's NEW draft, replacing the draft it had; the live version is untouched (ticket 512,
   *  BackOffice 2759). HQ answers the whole campaign as a draft. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  restore(id: string, version: number): Promise<RuleCampaign> {
    return api.post<RuleCampaign>(`${VERSIONS(id)}/${version}/Restore`, {})
  },

  /** GET RuleCampaign/Order — the DRAFT evaluation order: the stackable base list with the groups
   *  placed in it (ticket 513, BackOffice 2759, ADR 0090). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  order(): Promise<RuleEvaluationOrder> {
    return api.get<RuleEvaluationOrder>(ORDER)
  },

  /** PUT RuleCampaign/Order — save the whole draft order (ticket 513, BackOffice 2759); it reaches
   *  tills only with the next published version. HQ answers the order as saved (a new group may come
   *  back with HQ's own id). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  saveOrder(body: RuleEvaluationOrder): Promise<RuleEvaluationOrder> {
    return api.put<RuleEvaluationOrder>(ORDER, body)
  },

  /** POST RuleCampaign/Simulate — the dry run (ticket 514, BackOffice 2758): HQ prices the basket at
   *  the store, member, channel and local moment given, on live versions or working copies, and
   *  answers per-line and session effects, a trace per campaign and the near misses. Nothing is
   *  held, closed or counted. A basket HQ cannot price (an unknown SKU or store) is refused on the
   *  standard envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  simulate(body: RuleSimRequest): Promise<RuleSimResult> {
    return api.post<RuleSimResult>(SIMULATE, body)
  },

  /** GET RuleCampaign/Campaigns/{id}/Coupons — every code of a coupon campaign with its status,
   *  uses, member, batch and validity (ticket 515, BackOffice 2755); the page searches and filters
   *  them itself. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  coupons(id: string): Promise<RuleCampaignCoupon[]> {
    return api.get<RuleCampaignCoupon[]>(COUPONS(id))
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Batches — one batch of random, universal or personal
   *  codes (ticket 515, BackOffice 2755); HQ mints the codes and answers the batch id and the count.
   *  A code already taken, or a campaign without the coupons feature, is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  createCoupons(id: string, body: RuleCouponBatchCreate): Promise<RuleCouponBatch> {
    return api.post<RuleCouponBatch>(`${COUPONS(id)}/Batches`, body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Imports/Check — HQ's check of a CSV import's rows
   *  before it is sent: the codes SIS.Coupons already holds and the member ids it does not know
   *  (ticket 516, BackOffice 2755). Nothing is imported. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  checkCouponImport(id: string, rows: RuleCouponImportRow[]): Promise<RuleCouponImportCheck> {
    return api.post<RuleCouponImportCheck>(`${COUPONS(id)}/Imports/Check`, { rows })
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Imports — the checked rows as one new batch of
   *  `imported` codes (ticket 516, BackOffice 2755); HQ answers the batch id and the count. A row
   *  taken since the check is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  importCoupons(id: string, rows: RuleCouponImportRow[]): Promise<RuleCouponBatch> {
    return api.post<RuleCouponBatch>(`${COUPONS(id)}/Imports`, { rows })
  },

  /** DELETE RuleCampaign/Campaigns/{id}/Coupons/Batches/{batch}/Unused — removes the batch's unused
   *  codes; a used, disabled or expired code stays for the history (ticket 516, BackOffice 2755). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  deleteUnusedCoupons(id: string, batch: string): Promise<RuleCouponUnusedDeleted> {
    return api.del<RuleCouponUnusedDeleted>(`${COUPONS(id)}/Batches/${encodeURIComponent(batch)}/Unused`)
  },

  /** GET RuleCampaign/Sessions?store=&date=&status= — one store's customer sessions on one local
   *  day, in one status or all (ticket 518, BackOffice 2760). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  sessions(q: RuleSessionListQuery): Promise<RuleSessionRow[]> {
    return api.get<RuleSessionRow[]>(SESSIONS, { store: q.store, date: q.date, status: q.status })
  },

  /** GET RuleCampaign/Sessions/{saleId} — one session whole: calls, holds, journal and budget
   *  movements, refusals, its cart with each line's effects and units, and each campaign's outcome
   *  (ticket 518, BackOffice 2760). An unknown sale id is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  session(saleId: string): Promise<RuleSession> {
    return api.get<RuleSession>(`${SESSIONS}/${encodeURIComponent(saleId)}`)
  },

  /** GET RuleCampaign/SessionAccess — whether the reader may cancel a session (ticket 518,
   *  BackOffice 2760's Ua permission): what the page draws. The cancel door still refuses. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  sessionAccess(): Promise<RuleSessionAccess> {
    return api.get<RuleSessionAccess>(SESSION_ACCESS)
  },

  /** POST RuleCampaign/Sessions/{saleId}/Cancel — support cancels a session (ticket 518, BackOffice
   *  2760): HQ rolls back its budgets, coupon uses, created codes and points, and answers the
   *  session cancelled with what it rolled back. A reader without the permission, or a session HQ
   *  will not cancel, is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  cancelSession(saleId: string): Promise<RuleSessionCancelled> {
    return api.post<RuleSessionCancelled>(`${SESSIONS}/${encodeURIComponent(saleId)}/Cancel`, {})
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
  const before = queryClient.getQueryData<RuleCampaign>(ruleCampaignKey(campaign.id))
  queryClient.setQueryData(ruleCampaignKey(campaign.id), campaign)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  // An activation publishes a version (512): the list is read afresh only when the live one moved.
  if (before?.live?.version !== campaign.live?.version) void queryClient.invalidateQueries({ queryKey: ruleCampaignVersionsKey(campaign.id) })
}

/** A draft HQ just deleted: its own queries go, and the list is read afresh. */
export function forgetDeleted(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: ruleCampaignKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignChecksKey(id) })
  queryClient.removeQueries({ queryKey: ruleOfflineVerdictKey(id) })
  queryClient.removeQueries({ queryKey: ruleBudgetUsageKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionsKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionKey(id) })
  queryClient.removeQueries({ queryKey: ruleCouponsKey(id) })
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

/** The templates' query options (ticket 503): read when the dialog's template tab first opens,
 *  kept a few minutes. */
export const ruleTemplatesQuery = () => ({
  queryKey: ['rule-templates'] as const,
  queryFn: () => ruleCampaignApi.templates(),
  staleTime: 5 * 60_000,
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

/** A campaign's versions list, keyed under the campaign queries. */
export const ruleCampaignVersionsKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'versions', id] as const
/** A campaign's opened versions (by number after it) — apart from the list, so re-reading the list
 *  never re-reads a version, which never changes. */
export const ruleCampaignVersionKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'version', id] as const

/** The versions list's query options (ticket 512): an activation re-reads it (`rememberTransition`). */
export const ruleCampaignVersionsQuery = (id: string) => ({
  queryKey: ruleCampaignVersionsKey(id),
  queryFn: () => ruleCampaignApi.versions(id),
  retry: false as const,
})

/** One version's query options. A published version never changes, so it is read once and kept. */
export const ruleCampaignVersionQuery = (id: string, version: number) => ({
  queryKey: [...ruleCampaignVersionKey(id), version] as const,
  queryFn: () => ruleCampaignApi.version(id, version),
  staleTime: Infinity,
  retry: false as const,
})

/** The draft evaluation order's query options (ticket 513). Read afresh each time Priority opens
 *  (no stale time), never on a focus: the page holds the reader's unsaved order over it. */
export const ruleOrderQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'order'] as const,
  queryFn: () => ruleCampaignApi.order(),
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

/** A campaign's coupon codes, keyed under the campaign queries. */
export const ruleCouponsKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'coupons', id] as const

/** The coupon codes' query options (ticket 515): a create re-reads them; tills redeem codes, so —
 *  like the budget counters — they are read afresh when the reader comes back to the tab. */
export const ruleCouponsQuery = (id: string) => ({
  queryKey: ruleCouponsKey(id),
  queryFn: () => ruleCampaignApi.coupons(id),
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** Every customer-session query — a cancel refreshes the lists. */
export const RULE_SESSIONS_KEY = ['rule-sessions'] as const

/** One session, keyed by its sale id. */
export const ruleSessionKey = (saleId: string) => [...RULE_SESSIONS_KEY, 'one', saleId] as const

/** The sessions list's query options (ticket 518): asked only once a store is chosen. Tills move
 *  sessions along, so it is read afresh when the reader comes back to the tab. */
export const ruleSessionsQuery = (q: RuleSessionListQuery) => ({
  queryKey: [...RULE_SESSIONS_KEY, 'list', q] as const,
  queryFn: () => ruleCampaignApi.sessions(q),
  enabled: !!q.store && !!q.date,
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** One session's query options (ticket 518). */
export const ruleSessionQuery = (saleId: string) => ({
  queryKey: ruleSessionKey(saleId),
  queryFn: () => ruleCampaignApi.session(saleId),
  retry: false as const,
})

/** The reader's session rights (ticket 518): read once, never retried (the door fails closed). */
export const ruleSessionAccessQuery = () => ({
  queryKey: [...RULE_SESSIONS_KEY, 'access'] as const,
  queryFn: () => ruleCampaignApi.sessionAccess(),
  staleTime: 5 * 60_000,
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

/**
 * A session HQ just cancelled: its own query takes HQ's answer — under the sale id it was looked up
 * by as well as HQ's own, should HQ match an id typed otherwise — and so does its row in every list
 * already read, so Back never shows it in its old status while the lists are read afresh.
 */
export function rememberCancelledSession(queryClient: QueryClient, lookedUp: string, session: RuleSession): void {
  queryClient.setQueryData(ruleSessionKey(lookedUp), session)
  queryClient.setQueryData(ruleSessionKey(session.id), session)
  const { status, lastActivity, gross, discount, net } = session
  queryClient.setQueriesData<RuleSessionRow[]>({ queryKey: [...RULE_SESSIONS_KEY, 'list'] }, (rows) =>
    rows?.map((r) => (r.id === session.id ? { ...r, status, lastActivity, gross, discount, net } : r)),
  )
  void queryClient.invalidateQueries({ queryKey: [...RULE_SESSIONS_KEY, 'list'] })
}
