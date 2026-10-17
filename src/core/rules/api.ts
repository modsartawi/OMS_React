import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  RuleBlockCatalogue,
  RuleBudgetLimitChange,
  RuleBudgetUsage,
  RuleCampaignCoupon,
  RuleCampaignFromTemplate,
  RuleCampaignListRow,
  RuleCampaignRoles,
  RuleCampaignTemplate,
  RuleCampaignTransition,
  RuleCampaignVersion,
  RuleCampaignVersionDetail,
  RuleCouponBatch,
  RuleCouponBatchCreate,
  RuleCouponFound,
  RuleCouponImportCheck,
  RuleCouponImportRow,
  RuleCouponUnusedDeleted,
  RuleDraft,
  RuleDraftDeleted,
  RuleDraftSave,
  RuleEvaluationOrder,
  RuleLookupItem,
  RuleLookupKind,
  RuleMember,
  RuleMemberBudget,
  RuleMemberKey,
  RuleSimRequest,
  RuleSimResult,
  RuleWalletCoupon,
} from '@/core/models/rule-campaign'
import type {
  RuleSessionListQuery,
  RuleSessionLookup,
  RuleSessionSummary,
  RuleSupportCancelReply,
  RuleSupportCancelRequest,
} from '@/core/models/rule-session'

// The rule-campaign doors (spec 2737). Every endpoint string of the family lives in THIS file —
// campaigns, catalogue, lookups, validate, simulate, lifecycle, coupons and sessions as later
// slices add them — so ticket 520 re-points one file. Calls go through @/core/api
// (.claude/rules/api-envelope.md); a refusal is the standard envelope, read with apiErrorMessage.
//
// It sits in `core/` because the simulator (514), Priority (513) and support (518, 519) read
// campaigns too, and a feature may not import another feature's api.

// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const CAMPAIGNS = 'RuleCampaign/Campaigns'
// The draft doors (BackOffice 2758 + 2759): POST, cookie session + the rule-author grant.
const DRAFT_LOAD = 'Rules/Authoring/Drafts/Load'
const DRAFT_SAVE = 'Rules/Authoring/Drafts/Save'
const DRAFT_DELETE = 'Rules/Authoring/Drafts/Delete'
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
const ROLES = 'RuleCampaign/Roles'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
const LIFECYCLE = (id: string, act: 'AskForApproval' | 'Activate' | 'SendBack' | 'Disable') =>
  `${CAMPAIGNS}/${encodeURIComponent(id)}/${act}`

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
// PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
const COUPONS = (id: string) => `${CAMPAIGNS}/${encodeURIComponent(id)}/Coupons`
// Support's doors (BackOffice 2760): their own grant, `BackOfficeScreen[RuleSupport]` — 03 to read,
// 02 to cancel. A reader without it gets a bare 403 with no body.
const SUPPORT_SESSIONS = 'Rules/Support/Sessions'
const SUPPORT_SESSION = 'Rules/Support/Session'
const SUPPORT_CANCEL = 'Rules/Support/Cancel'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
// (the coupon finder's contract is BackOffice 2754's; it names no door yet)
const COUPON_FIND = 'RuleCampaign/Coupons'
// PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
// (a member's wallet is BackOffice 2754's, the budgets they used 2744's; neither names a door yet)
const MEMBERS = 'RuleCampaign/Members'

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

  /** POST Rules/Authoring/Drafts/Load { campaign } — the campaign's draft whole, at its revision;
   *  with no draft, the newest version (`source: published`, revision 0). 404
   *  `RULES_DRAFT_NOT_FOUND` when neither exists. */
  load(campaign: string): Promise<RuleDraft> {
    return api.post<RuleDraft>(DRAFT_LOAD, { campaign })
  },

  /** POST Rules/Authoring/Drafts/Save { campaign, features, revision, tree? } — the draft's whole
   *  state at the revision loaded; HQ answers the draft one revision higher, `state: editing`.
   *  Revision 0 with a new id creates the campaign (there is no create door). 409
   *  `RULES_DRAFT_STALE` (load again) / `RULES_DRAFT_PENDING` (frozen while it waits). */
  save(body: RuleDraftSave): Promise<RuleDraft> {
    return api.post<RuleDraft>(DRAFT_SAVE, body)
  },

  /** POST Rules/Authoring/Drafts/Delete { campaign, revision } — the dashboard's "delete draft"; a
   *  live campaign stays live. 409 `RULES_DRAFT_STALE` / `RULES_DRAFT_PENDING`. */
  deleteDraft(campaign: string, revision: number): Promise<RuleDraftDeleted> {
    return api.post<RuleDraftDeleted>(DRAFT_DELETE, { campaign, revision })
  },

  /** POST RuleCampaign/Campaigns/{id}/Copy — an independent draft copied from a campaign
   *  (BackOffice 2759); HQ names it "<name> (copy)" and answers with the new draft. The original
   *  is untouched. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  copy(id: string): Promise<RuleDraft> {
    return api.post<RuleDraft>(`${CAMPAIGNS}/${encodeURIComponent(id)}/Copy`, {})
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
  createFromTemplate(templateId: string, body: RuleCampaignFromTemplate): Promise<RuleDraft> {
    return api.post<RuleDraft>(`${TEMPLATES}/${encodeURIComponent(templateId)}/Create`, body)
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

  /** GET RuleCampaign/Roles — the reader's roles on rule campaigns (ticket 511, BackOffice 2759's
   *  Ua permissions): what the dashboard draws. The server still refuses what the reader may not do. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  roles(): Promise<RuleCampaignRoles> {
    return api.get<RuleCampaignRoles>(ROLES)
  },

  /** POST RuleCampaign/Campaigns/{id}/AskForApproval — an author sends the SAVED draft to an
   *  approver with an optional note (ticket 511, BackOffice 2759); HQ answers the campaign waiting. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  askForApproval(id: string, body: RuleCampaignTransition): Promise<RuleDraft> {
    return api.post<RuleDraft>(LIFECYCLE(id, 'AskForApproval'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Activate — an approver publishes the waiting draft as a new
   *  version (ticket 511, BackOffice 2759); HQ answers the campaign live. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  activate(id: string, body: RuleCampaignTransition): Promise<RuleDraft> {
    return api.post<RuleDraft>(LIFECYCLE(id, 'Activate'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/SendBack — an approver returns the waiting draft to its author
   *  with a note (ticket 511, BackOffice 2759); HQ answers the campaign as a draft again. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  sendBack(id: string, body: RuleCampaignTransition): Promise<RuleDraft> {
    return api.post<RuleDraft>(LIFECYCLE(id, 'SendBack'), body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Disable — an approver stops a live campaign (ticket 511,
   *  BackOffice 2759): sales already open keep it, new sales do not get it. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  disable(id: string, body: RuleCampaignTransition): Promise<RuleDraft> {
    return api.post<RuleDraft>(LIFECYCLE(id, 'Disable'), body)
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
  changeLimit(id: string, budgetId: string, body: RuleBudgetLimitChange): Promise<RuleDraft> {
    return api.put<RuleDraft>(BUDGET_LIMIT(id, budgetId), body)
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
  restore(id: string, version: number): Promise<RuleDraft> {
    return api.post<RuleDraft>(`${VERSIONS(id)}/${version}/Restore`, {})
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
  // PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
  coupons(id: string): Promise<RuleCampaignCoupon[]> {
    return api.get<RuleCampaignCoupon[]>(COUPONS(id))
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Batches — one batch of random, universal or personal
   *  codes (ticket 515, BackOffice 2755); HQ mints the codes and answers the batch id and the count.
   *  A code already taken, or a campaign without the coupons feature, is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
  createCoupons(id: string, body: RuleCouponBatchCreate): Promise<RuleCouponBatch> {
    return api.post<RuleCouponBatch>(`${COUPONS(id)}/Batches`, body)
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Imports/Check — HQ's check of a CSV import's rows
   *  before it is sent: the codes SIS.Coupons already holds and the member ids it does not know
   *  (ticket 516, BackOffice 2755). Nothing is imported. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
  checkCouponImport(id: string, rows: RuleCouponImportRow[]): Promise<RuleCouponImportCheck> {
    return api.post<RuleCouponImportCheck>(`${COUPONS(id)}/Imports/Check`, { rows })
  },

  /** POST RuleCampaign/Campaigns/{id}/Coupons/Imports — the checked rows as one new batch of
   *  `imported` codes (ticket 516, BackOffice 2755); HQ answers the batch id and the count. A row
   *  taken since the check is refused on the envelope. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
  importCoupons(id: string, rows: RuleCouponImportRow[]): Promise<RuleCouponBatch> {
    return api.post<RuleCouponBatch>(`${COUPONS(id)}/Imports`, { rows })
  },

  /** DELETE RuleCampaign/Campaigns/{id}/Coupons/Batches/{batch}/Unused — removes the batch's unused
   *  codes; a used, disabled or expired code stays for the history (ticket 516, BackOffice 2755). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2755; re-point in ticket 520
  deleteUnusedCoupons(id: string, batch: string): Promise<RuleCouponUnusedDeleted> {
    return api.del<RuleCouponUnusedDeleted>(`${COUPONS(id)}/Batches/${encodeURIComponent(batch)}/Unused`)
  },

  /** GET Rules/Support/Sessions?storeCode=&from=&to=&state=&take= — one store's customer sessions
   *  between two local days, in one state or all, newest first by `openedAt` (ticket 527). */
  sessions(q: RuleSessionListQuery): Promise<RuleSessionSummary[]> {
    return api.get<RuleSessionSummary[]>(SUPPORT_SESSIONS, { storeCode: q.storeCode, from: q.from, to: q.to, state: q.state, take: q.take })
  },

  /** GET Rules/Support/Session?sessionId= — one sale whole: its calls with their replies, cart,
   *  effects, holds, budget journal and events, refusals, coupon, created codes and points posted
   *  (ticket 527). An unknown sale is a 404 `RULES_SESSION_NOT_FOUND`. */
  session(sessionId: string): Promise<RuleSessionLookup> {
    return api.get<RuleSessionLookup>(SUPPORT_SESSION, { sessionId })
  },

  /** POST Rules/Support/Cancel { sessionId, requestId, reason } — support cancels a session (ticket
   *  527): a paying one releases its holds, a closed or partly returned one is a full return. The
   *  answer is the rollback and the session after; the same `requestId` again is `repeated: true`
   *  and moved nothing. */
  cancelSession(body: RuleSupportCancelRequest): Promise<RuleSupportCancelReply> {
    return api.post<RuleSupportCancelReply>(SUPPORT_CANCEL, body)
  },

  /** GET RuleCampaign/Coupons/{code} — one code across every campaign: its campaign, batch, status,
   *  validity, bound member and uses (ticket 519). An unknown code is refused (404). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  findCoupon(code: string): Promise<RuleCouponFound> {
    return api.get<RuleCouponFound>(`${COUPON_FIND}/${encodeURIComponent(code)}`)
  },

  /** GET RuleCampaign/Members?loyaltyId= | ?mobile= — the members matching one key (ticket 519):
   *  none, one, or — a mobile shared by several — more than one. */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  findMembers(by: RuleMemberKey, value: string): Promise<RuleMember[]> {
    return api.get<RuleMember[]>(MEMBERS, { [by]: value })
  },

  /** GET RuleCampaign/Members/{id}/Wallet — the member's coupon wallet (ticket 519, BackOffice 2754). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  memberWallet(id: string): Promise<RuleWalletCoupon[]> {
    return api.get<RuleWalletCoupon[]>(`${MEMBERS}/${encodeURIComponent(id)}/Wallet`)
  },

  /** GET RuleCampaign/Members/{id}/Budgets — the profile-scope budgets the member has used, each
   *  counter in its current period (ticket 519, BackOffice 2744). */
  // PROVISIONAL - shapes invented ahead of BackOffice 2758/2759; re-point in ticket 520
  memberBudgets(id: string): Promise<RuleMemberBudget[]> {
    return api.get<RuleMemberBudget[]>(`${MEMBERS}/${encodeURIComponent(id)}/Budgets`)
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
export function rememberTransition(queryClient: QueryClient, draft: RuleDraft): void {
  const before = queryClient.getQueryData<RuleDraft>(ruleCampaignKey(draft.code))
  queryClient.setQueryData(ruleCampaignKey(draft.code), draft)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  // An activation publishes a version (512): the list is read afresh only when the live one moved.
  if (before?.publishedVersionNo !== draft.publishedVersionNo) void queryClient.invalidateQueries({ queryKey: ruleCampaignVersionsKey(draft.code) })
}

/** A draft HQ just deleted: its own queries go, and the list is read afresh. */
export function forgetDeleted(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: ruleCampaignKey(id) })
  queryClient.removeQueries({ queryKey: ruleBudgetUsageKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionsKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionKey(id) })
  queryClient.removeQueries({ queryKey: ruleCouponsKey(id) })
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}

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
 * A draft HQ just saved (Drafts/Save, ticket 522): the campaign's own query takes HQ's answer — its
 * new revision and its validation (the checks pill and Offline read it) — so every page of its
 * workspace reads the saved draft, and the list is read afresh.
 */
export function rememberSavedDraft(queryClient: QueryClient, draft: RuleDraft): void {
  queryClient.setQueryData(ruleCampaignKey(draft.code), draft)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  // A budget added, changed or deleted (510) changes what is counted against it.
  void queryClient.invalidateQueries({ queryKey: ruleBudgetUsageKey(draft.code) })
}

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

/** One campaign's draft (Drafts/Load) — the same key wherever it is read, so one call serves them all. */
export const ruleCampaignQuery = (id: string) => ({
  queryKey: ruleCampaignKey(id),
  queryFn: () => ruleCampaignApi.load(id),
  retry: false as const,
})

/**
 * A new draft HQ just made (a create or a copy, ticket 502): its own query is seeded, so its
 * dashboard opens without asking again, and the list is read afresh to count it.
 */
export function rememberNewDraft(queryClient: QueryClient, draft: RuleDraft): void {
  queryClient.setQueryData(ruleCampaignKey(draft.code), draft)
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

/** The sessions list's query options (ticket 527): asked only once a store is chosen. Tills move
 *  sessions along, so it is read afresh when the reader comes back to the tab. */
export const ruleSessionsQuery = (q: RuleSessionListQuery) => ({
  queryKey: [...RULE_SESSIONS_KEY, 'list', q] as const,
  queryFn: () => ruleCampaignApi.sessions(q),
  enabled: !!q.storeCode,
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** One session's query options (ticket 527). */
export const ruleSessionQuery = (saleId: string) => ({
  queryKey: ruleSessionKey(saleId),
  queryFn: () => ruleCampaignApi.session(saleId),
  retry: false as const,
})

/**
 * A session HQ just cancelled: its own query takes HQ's lookup after the cancel — under the sale id
 * it was looked up by as well as HQ's own, should HQ match an id typed otherwise — and so does its
 * row in every list already read, so Back never shows it in its old state while the lists are read
 * afresh.
 */
export function rememberCancelledSession(queryClient: QueryClient, lookedUp: string, lookup: RuleSessionLookup): void {
  const row = lookup.session
  queryClient.setQueryData(ruleSessionKey(lookedUp), lookup)
  queryClient.setQueryData(ruleSessionKey(row.sessionId), lookup)
  queryClient.setQueriesData<RuleSessionSummary[]>({ queryKey: [...RULE_SESSIONS_KEY, 'list'] }, (rows) =>
    rows?.map((r) => (r.sessionId === row.sessionId ? row : r)),
  )
  void queryClient.invalidateQueries({ queryKey: [...RULE_SESSIONS_KEY, 'list'] })
  // The rollback frees coupon uses and budget counters: support's look-ups (519) read afresh.
  void queryClient.invalidateQueries({ queryKey: RULE_SUPPORT_KEY })
}

/** Support's look-ups (ticket 519): a code, a member and what the member holds. Tills redeem codes
 *  and count budgets, so each is read afresh when the reader comes back to the tab. */
export const RULE_SUPPORT_KEY = ['rule-support'] as const

/** One code's query options: asked only once a code is entered. */
export const ruleCouponFindQuery = (code: string) => ({
  queryKey: [...RULE_SUPPORT_KEY, 'coupon', code] as const,
  queryFn: () => ruleCampaignApi.findCoupon(code),
  enabled: !!code,
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** The members matching a key: asked only once a value is entered. */
export const ruleMembersQuery = (by: RuleMemberKey, value: string) => ({
  queryKey: [...RULE_SUPPORT_KEY, 'members', by, value] as const,
  queryFn: () => ruleCampaignApi.findMembers(by, value),
  enabled: !!value,
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** A member's coupon wallet. */
export const ruleMemberWalletQuery = (id: string) => ({
  queryKey: [...RULE_SUPPORT_KEY, 'wallet', id] as const,
  queryFn: () => ruleCampaignApi.memberWallet(id),
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** The budgets a member has used. */
export const ruleMemberBudgetsQuery = (id: string) => ({
  queryKey: [...RULE_SUPPORT_KEY, 'budgets', id] as const,
  queryFn: () => ruleCampaignApi.memberBudgets(id),
  refetchOnWindowFocus: true as const,
  retry: false as const,
})
