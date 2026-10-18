import type { QueryClient } from '@tanstack/react-query'
import { api } from '@/core/api'
import type {
  RuleBlockCatalogue,
  RuleBudgetLimitSet,
  RuleBudgetView,
  RuleCampaign,
  RuleApprovalBody,
  RuleApprovalItem,
  RuleApprovalStep,
  RuleCampaignListRow,
  RuleCopyBody,
  RuleCouponBatchCreate,
  RuleCouponBatchCreated,
  RuleCouponBatchDeletion,
  RuleCouponBatchExport,
  RuleCouponBatchSummary,
  RuleCouponFound,
  RuleDraft,
  RuleDraftDeleted,
  RuleDisableBody,
  RuleDraftSave,
  RuleDraftSummary,
  RuleFeature,
  RuleFromTemplateBody,
  RuleLookupItem,
  RuleLookupKind,
  RuleMember,
  RuleMemberBudget,
  RuleMemberKey,
  RuleOrder,
  RulePublishReply,
  RuleSimulateRequest,
  RuleSimulation,
  RuleTemplate,
  RuleValidateRequest,
  RuleValidation,
  RuleValueMapUpload,
  RuleVersionDetail,
  RuleVersionSummary,
  RuleWalletCoupon,
} from '@/core/models/rule-campaign'
import { RULE_FEATURES } from '@/core/models/rule-campaign'
import { composeCampaignList } from './campaign-list'
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

// The draft doors (BackOffice 2758 + 2759): POST, cookie session + the rule-author grant.
const DRAFT_LOAD = 'Rules/Authoring/Drafts/Load'
const DRAFT_SAVE = 'Rules/Authoring/Drafts/Save'
const DRAFT_DELETE = 'Rules/Authoring/Drafts/Delete'
const DRAFT_LIST = 'Rules/Authoring/Drafts/List'
// Approval, versions, order, copy and templates (BackOffice 2759): every door POST (the bodiless
// ones with an empty body), each with its own grant on BackOfficeScreen[RuleAuthoring, command] —
// 02 author, 06 approver, 03 reader. A session without it is a bare 403 with no body.
const APPROVAL_REQUEST = 'Rules/Authoring/Approvals/Request'
const APPROVAL_LIST = 'Rules/Authoring/Approvals/List'
const APPROVAL_HISTORY = 'Rules/Authoring/Approvals/History'
const APPROVAL_ACTIVATE = 'Rules/Authoring/Approvals/Activate'
const APPROVAL_SEND_BACK = 'Rules/Authoring/Approvals/SendBack'
const APPROVAL_DISABLE = 'Rules/Authoring/Approvals/Disable'
const VERSIONS_LIST = 'Rules/Authoring/Versions/List'
const VERSIONS_LOAD = 'Rules/Authoring/Versions/Load'
const VERSIONS_RESTORE = 'Rules/Authoring/Versions/Restore'
const ORDER = 'Rules/Authoring/Order'
const DRAFT_COPY = 'Rules/Authoring/Drafts/Copy'
const TEMPLATES_LIST = 'Rules/Authoring/Templates/List'
const DRAFT_FROM_TEMPLATE = 'Rules/Authoring/Drafts/FromTemplate'
// The builder's other doors (BackOffice 2758): POST, cookie session + the rule-author grant.
const CATALOGUE = 'Rules/Authoring/Catalogue'
const VALIDATE = 'Rules/Authoring/Validate'
const LOOKUP = (kind: RuleLookupKind) => `Rules/Authoring/Lookups/${kind}`
const VALUE_MAP_UPLOAD = 'Rules/Authoring/ValueMaps/Upload'
const BUDGETS = 'Rules/Authoring/Budgets'
const BUDGET_SET_LIMIT = 'Rules/Authoring/Budgets/SetLimit'

const SIMULATE = 'Rules/Authoring/Simulate'
// Campaign coupon batches (BackOffice 2755): every door POST, behind the rule-author grant.
const COUPON_BATCH_CREATE = 'Rules/Authoring/CouponBatches/Create'
const COUPON_BATCH_LIST = 'Rules/Authoring/CouponBatches/List'
const COUPON_BATCH_EXPORT = 'Rules/Authoring/CouponBatches/Export'
const COUPON_BATCH_DELETE_UNUSED = 'Rules/Authoring/CouponBatches/DeleteUnused'
// Support's doors (BackOffice 2760): their own grant, `BackOfficeScreen[RuleSupport]` — 03 to read,
// 02 to cancel. A reader without it gets a bare 403 with no body.
const SUPPORT_SESSIONS = 'Rules/Support/Sessions'
const SUPPORT_SESSION = 'Rules/Support/Session'
const SUPPORT_CANCEL = 'Rules/Support/Cancel'
// PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
// (the coupon finder's contract is BackOffice 2754's; it names no door yet)
const COUPON_FIND = 'RuleCampaign/Coupons'
// PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
// (a member's wallet is BackOffice 2754's, the budgets they used 2744's; neither names a door yet)
const MEMBERS = 'RuleCampaign/Members'

/** Every campaign query — a write refreshes them all. */
export const RULE_CAMPAIGNS_KEY = ['rule-campaigns'] as const

/** One campaign, keyed by its id — the workspace shell and every page inside it share it. */
export const ruleCampaignKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'one', id] as const

export const ruleCampaignApi = {
  /**
   * The campaigns list (ticket 524), unfiltered. HQ has no list door (BO ask A), so it is composed
   * (`composeCampaignList`) from POST Rules/Authoring/Drafts/List (the drafts and their state), POST
   * Rules/Authoring/Order (the live campaigns) and POST Rules/Authoring/Versions/Load of the order's
   * version (each live campaign's window). The list counts and filters locally, because scheduled /
   * running / expired are read at the reader's local now. A disabled campaign with no draft is in
   * none of the three, so it is not listed.
   */
  async list(): Promise<RuleCampaignListRow[]> {
    const [drafts, order] = await Promise.all([ruleCampaignApi.drafts(), ruleCampaignApi.order()])
    const live = order.versionNo > 0 ? await ruleCampaignApi.version(order.versionNo) : null
    return composeCampaignList(drafts, order, live?.ruleset ?? null)
  },

  /** POST Rules/Authoring/Drafts/List — every draft with its state, last saved first. */
  drafts(): Promise<RuleDraftSummary[]> {
    return api.post<RuleDraftSummary[]>(DRAFT_LIST, {})
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

  /** POST Rules/Authoring/Drafts/Copy { from, campaign, name? } (grant 02) — a NEW draft under the
   *  id the author picked: the source's draft (else its live campaign) with its features, `origin:
   *  copy:FROM`, no tree. The source is untouched. 409 `RULES_CAMPAIGN_EXISTS`; 404
   *  `RULES_DRAFT_NOT_FOUND`; `RULES_BAD_CAMPAIGN_CODE`. */
  copy(body: RuleCopyBody): Promise<RuleDraft> {
    return api.post<RuleDraft>(DRAFT_COPY, body)
  },

  /** POST Rules/Authoring/Templates/List (grant 03) — every template, by code, with its
   *  placeholders and each one's default. */
  templates(): Promise<RuleTemplate[]> {
    return api.post<RuleTemplate[]>(TEMPLATES_LIST, {})
  },

  /** POST Rules/Authoring/Drafts/FromTemplate { template, campaign, name?, values } (grant 02) — a
   *  new draft under the picked id: the template's campaign with each sent value at its
   *  placeholder's path (an unsent one keeps its default). 404 `RULES_TEMPLATE_NOT_FOUND`; 400
   *  `RULES_BAD_TEMPLATE`; 409 `RULES_CAMPAIGN_EXISTS`. */
  fromTemplate(body: RuleFromTemplateBody): Promise<RuleDraft> {
    return api.post<RuleDraft>(DRAFT_FROM_TEMPLATE, body)
  },

  /** POST Rules/Authoring/Catalogue { features } — the condition, effect and setting blocks a
   *  campaign with these features shows: a block of a feature it lacks is not listed. */
  catalogue(features: readonly RuleFeature[]): Promise<RuleBlockCatalogue> {
    return api.post<RuleBlockCatalogue>(CATALOGUE, { features })
  },

  /** POST Rules/Authoring/Validate { campaign, tree? } — HQ's checks of the campaign as the builder
   *  holds it (unsaved): errors and warnings pointed by `path`, and the offline verdict (null while
   *  errors stand). Nothing is stored. */
  validate(body: RuleValidateRequest): Promise<RuleValidation> {
    return api.post<RuleValidation>(VALIDATE, body)
  },

  /** POST Rules/Authoring/Lookups/{lookup} { q, campaign? } — at most 50 hits matching a code or a
   *  name. A material search shorter than three characters is refused (`RULES_BAD_LOOKUP`);
   *  `campaign` narrows a budgets lookup. */
  lookup(kind: RuleLookupKind, q: string, campaign?: string): Promise<RuleLookupItem[]> {
    return api.post<RuleLookupItem[]>(LOOKUP(kind), campaign ? { q, campaign } : { q })
  },

  /** POST Rules/Authoring/ValueMaps/Upload { campaign, csv } — the value map's entries read from a
   *  `material,number` CSV. Nothing is stored: the answer's `campaign` (null when refused) is saved
   *  as the draft. */
  uploadValueMap(campaign: RuleCampaign, csv: string): Promise<RuleValueMapUpload> {
    return api.post<RuleValueMapUpload>(VALUE_MAP_UPLOAD, { campaign, csv })
  },

  /** POST Rules/Authoring/Budgets { campaign } — the newest version's budgets with the limit in
   *  force and this period's used / held / overshoot, summed over every scope key (ADR 0091). */
  budgets(campaign: string): Promise<RuleBudgetView[]> {
    return api.post<RuleBudgetView[]>(BUDGETS, { campaign })
  },

  /** POST Rules/Authoring/Budgets/SetLimit { campaign, budget, limit } — a live limit, at once and
   *  without a republish; lowering it below a counter claws nothing back. 404
   *  `RULES_BUDGET_NOT_FOUND` for a budget the newest version does not declare. */
  setLimit(campaign: string, budget: string, limit: number): Promise<RuleBudgetLimitSet> {
    return api.post<RuleBudgetLimitSet>(BUDGET_SET_LIMIT, { campaign, budget, limit })
  },

  /** POST Rules/Authoring/Approvals/Request { campaign, revision, note } (grant 02) — the author
   *  asks for approval of the draft at the revision read, with a note (required): the draft is
   *  `pending` and frozen. 400 `RULES_INVALID_CAMPAIGN` / `RULES_REASON_REQUIRED`; 409
   *  `RULES_DRAFT_STALE` / `RULES_DRAFT_PENDING`. */
  requestApproval(body: RuleApprovalBody): Promise<RuleDraft> {
    return api.post<RuleDraft>(APPROVAL_REQUEST, body)
  },

  /** POST Rules/Authoring/Approvals/List (grant 03) — the drafts waiting, oldest request first, each
   *  beside the campaign as the live version holds it (null when it is not live). */
  approvals(): Promise<RuleApprovalItem[]> {
    return api.post<RuleApprovalItem[]>(APPROVAL_LIST, {})
  },

  /** POST Rules/Authoring/Approvals/History { campaign } (grant 03) — the approval trail, oldest first. */
  approvalHistory(campaign: string): Promise<RuleApprovalStep[]> {
    return api.post<RuleApprovalStep[]>(APPROVAL_HISTORY, { campaign })
  },

  /** POST Rules/Authoring/Approvals/Activate { campaign, revision, note? } (grant 06) — the publish:
   *  a new immutable version, and the draft goes. 403 `RULES_SELF_APPROVAL`; 409 `RULES_NOT_PENDING`
   *  / `RULES_DRAFT_STALE` / `RULES_ORDER_STALE`; 400 `RULES_INVALID_CAMPAIGN`. */
  activate(body: RuleApprovalBody): Promise<RulePublishReply> {
    return api.post<RulePublishReply>(APPROVAL_ACTIVATE, body)
  },

  /** POST Rules/Authoring/Approvals/SendBack { campaign, revision, note } (grant 06, note required)
   *  — the draft back to its author, `sentBack`. 409 `RULES_NOT_PENDING` / `RULES_DRAFT_STALE`. */
  sendBack(body: RuleApprovalBody): Promise<RuleDraft> {
    return api.post<RuleDraft>(APPROVAL_SEND_BACK, body)
  },

  /** POST Rules/Authoring/Approvals/Disable { campaign, note } (grant 06, note required) — the next
   *  version is the live one without the campaign. 409 `RULES_NOT_LIVE`. */
  disable(body: RuleDisableBody): Promise<RuleVersionSummary> {
    return api.post<RuleVersionSummary>(APPROVAL_DISABLE, body)
  },

  /** POST Rules/Authoring/Versions/List { campaign } (grant 03) — the versions the campaign's
   *  publishes and disable made, newest first. */
  versions(campaign: string): Promise<RuleVersionSummary[]> {
    return api.post<RuleVersionSummary[]>(VERSIONS_LIST, { campaign })
  },

  /** POST Rules/Authoring/Versions/Load { versionNo, campaign? } (grant 03) — one version: its
   *  ruleset, and the named campaign as it holds it. 404 `RULES_VERSION_NOT_FOUND`. */
  version(versionNo: number, campaign?: string): Promise<RuleVersionDetail> {
    return api.post<RuleVersionDetail>(VERSIONS_LOAD, campaign ? { versionNo, campaign } : { versionNo })
  },

  /** POST Rules/Authoring/Versions/Restore { campaign, versionNo, revision } (grant 02) — that
   *  version's campaign as the DRAFT (`origin: restore:N`), at the draft's revision (0 without one);
   *  the live version is untouched and the order is not restored. 404 `RULES_VERSION_NOT_FOUND`; 409
   *  `RULES_DRAFT_STALE` / `RULES_DRAFT_PENDING`. */
  restore(campaign: string, versionNo: number, revision: number): Promise<RuleDraft> {
    return api.post<RuleDraft>(VERSIONS_RESTORE, { campaign, versionNo, revision })
  },

  /** POST Rules/Authoring/Order (grant 03) — the LIVE evaluation order at the newest version. There
   *  is no order save: the edited tree goes out with a draft's Drafts/Save and publishes with that
   *  draft's version (an order edited from a live order that has changed since is refused at
   *  Activate, `RULES_ORDER_STALE`). */
  order(): Promise<RuleOrder> {
    return api.post<RuleOrder>(ORDER, {})
  },

  /** POST Rules/Authoring/Simulate — the dry run (ticket 525, BackOffice 2758): the `evaluate`
   *  request plus `campaign` (unsaved) or `draft` (a saved draft's id), neither = the newest version
   *  alone; the basket as `lines` or as an uploaded `csv`. Answers the per-line money and the whole
   *  `evaluate` reply; writes nothing. `RULES_INVALID_CAMPAIGN` (pointed at blocks), `RULES_BAD_BASKET`
   *  (by file line), `RULES_BAD_REQUEST`, 404 `RULES_DRAFT_NOT_FOUND`. */
  simulate(body: RuleSimulateRequest): Promise<RuleSimulation> {
    return api.post<RuleSimulation>(SIMULATE, body)
  },

  /** POST Rules/Authoring/CouponBatches/Create — one batch of random, universal, personal or
   *  imported codes under the campaign's coupon template, all or none (ticket 526). HQ answers the
   *  batch id, its codes and the budgets the dialog's checkboxes became, for the draft (ADR 0094).
   *  400 `RULES_BATCH_BAD` (an unknown member is named in its message), `RULES_BATCH_CODE_TAKEN`;
   *  400 / 404 `RULES_BATCH_TEMPLATE`. */
  createBatch(body: RuleCouponBatchCreate): Promise<RuleCouponBatchCreated> {
    return api.post<RuleCouponBatchCreated>(COUPON_BATCH_CREATE, body)
  },

  /** POST Rules/Authoring/CouponBatches/List { campaign } — the campaign's batches, newest first,
   *  with their used and disabled counts (not their codes). */
  batches(campaign: string): Promise<RuleCouponBatchSummary[]> {
    return api.post<RuleCouponBatchSummary[]>(COUPON_BATCH_LIST, { campaign })
  },

  /** POST Rules/Authoring/CouponBatches/Export { batchId } — the batch as HQ's CSV, one line per
   *  code, with the file name to save it as. 404 `RULES_BATCH_NOT_FOUND`. */
  exportBatch(batchId: string): Promise<RuleCouponBatchExport> {
    return api.post<RuleCouponBatchExport>(COUPON_BATCH_EXPORT, { batchId })
  },

  /** POST Rules/Authoring/CouponBatches/DeleteUnused { batchId } — deletes the batch's codes nobody
   *  used; a code ever redeemed is kept. 404 `RULES_BATCH_NOT_FOUND`. */
  deleteUnused(batchId: string): Promise<RuleCouponBatchDeletion> {
    return api.post<RuleCouponBatchDeletion>(COUPON_BATCH_DELETE_UNUSED, { batchId })
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
  // PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
  findCoupon(code: string): Promise<RuleCouponFound> {
    return api.get<RuleCouponFound>(`${COUPON_FIND}/${encodeURIComponent(code)}`)
  },

  /** GET RuleCampaign/Members?loyaltyId= | ?mobile= — the members matching one key (ticket 519):
   *  none, one, or — a mobile shared by several — more than one. */
  // PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
  findMembers(by: RuleMemberKey, value: string): Promise<RuleMember[]> {
    return api.get<RuleMember[]>(MEMBERS, { [by]: value })
  },

  /** GET RuleCampaign/Members/{id}/Wallet — the member's coupon wallet (ticket 519, BackOffice 2754). */
  // PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
  memberWallet(id: string): Promise<RuleWalletCoupon[]> {
    return api.get<RuleWalletCoupon[]>(`${MEMBERS}/${encodeURIComponent(id)}/Wallet`)
  },

  /** GET RuleCampaign/Members/{id}/Budgets — the profile-scope budgets the member has used, each
   *  counter in its current period (ticket 519, BackOffice 2744). */
  // PROVISIONAL - no door yet (BO ask D); re-point in ticket 529
  memberBudgets(id: string): Promise<RuleMemberBudget[]> {
    return api.get<RuleMemberBudget[]>(`${MEMBERS}/${encodeURIComponent(id)}/Budgets`)
  },
}

/**
 * A draft HQ just moved along its approval life (an ask or a send back, ticket 511): its own query
 * takes HQ's answer, so the dashboard's State and the shell's badge follow, and the list, the
 * waiting requests and the campaign's trail are read afresh.
 */
export function rememberTransition(queryClient: QueryClient, draft: RuleDraft): void {
  queryClient.setQueryData(ruleCampaignKey(draft.code), draft)
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  void queryClient.invalidateQueries({ queryKey: ruleApprovalsQuery().queryKey })
  void queryClient.invalidateQueries({ queryKey: ruleApprovalHistoryKey(draft.code) })
}

/**
 * A version HQ just made (an activation or a disable, ticket 511): neither answers the draft. After
 * an activation the campaign is read again (its draft is gone: Load answers the new live version).
 * After a disable it is NOT: with no draft, a disabled campaign is in no version and Load answers it
 * 404 (BO ask A), so its own query keeps what was loaded, marked Disabled. The list, its versions,
 * the order, the waiting requests and its trail are read afresh either way.
 */
export function rememberPublished(queryClient: QueryClient, code: string, act: 'activated' | 'disabled' = 'activated'): void {
  if (act === 'disabled') queryClient.setQueryData<RuleDraft>(ruleCampaignKey(code), (d) => (d ? { ...d, campaignStatus: 'Disabled' } : d))
  else void queryClient.invalidateQueries({ queryKey: ruleCampaignKey(code) })
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
  void queryClient.invalidateQueries({ queryKey: ruleCampaignVersionsKey(code) })
  void queryClient.invalidateQueries({ queryKey: ruleOrderQuery().queryKey })
  void queryClient.invalidateQueries({ queryKey: ruleApprovalsQuery().queryKey })
  void queryClient.invalidateQueries({ queryKey: ruleApprovalHistoryKey(code) })
  // A disable makes the next version without it, so its live budgets are gone with it.
  void queryClient.invalidateQueries({ queryKey: ruleBudgetsKey(code) })
}

/** A draft HQ just deleted: its own queries go, and the list is read afresh. */
export function forgetDeleted(queryClient: QueryClient, id: string): void {
  queryClient.removeQueries({ queryKey: ruleCampaignKey(id) })
  queryClient.removeQueries({ queryKey: ruleBudgetsKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionsKey(id) })
  queryClient.removeQueries({ queryKey: ruleCampaignVersionKey(id) })
  queryClient.removeQueries({ queryKey: ruleCouponBatchesKey(id) })
  queryClient.removeQueries({ queryKey: ruleCouponExportsKey(id) })
  queryClient.removeQueries({ queryKey: ruleApprovalHistoryKey(id) })
  void queryClient.invalidateQueries({ queryKey: ruleCampaignsQuery().queryKey })
}

/** A lookup's query options: one read per kind, search and campaign, kept a few minutes. */
export const ruleLookupQuery = (kind: RuleLookupKind, q: string, campaign?: string) => ({
  queryKey: ['rule-lookup', kind, q, campaign ?? ''] as const,
  queryFn: () => ruleCampaignApi.lookup(kind, q, campaign),
  staleTime: 5 * 60_000,
  retry: false as const,
})

/**
 * The block catalogue's query options (ticket 523): one read per set of features — the palette asks
 * again when the campaign's features change. A catalogue changes only with an HQ release, so each is
 * fetched once per page load and kept. The features are sorted, so one set is one key.
 */
export const ruleCatalogueQuery = (features: readonly RuleFeature[]) => {
  const on = [...new Set(features)].sort()
  return {
    queryKey: ['rule-catalogue', ...on] as const,
    queryFn: () => ruleCampaignApi.catalogue(on),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false as const,
  }
}

/** The catalogue with every feature on — what a block is READ through (504), whatever the
 *  campaign's own features: a block of a feature switched off since still reads as itself. */
export const ruleReadingCatalogueQuery = () => ruleCatalogueQuery(RULE_FEATURES)

/**
 * HQ's checks of the campaign as the builder holds it (ticket 523): the builder asks with the
 * unsaved campaign once its edits settle (the caller debounces), so the checks pill and the ƒx
 * helper point at what is on screen. One answer per campaign asked, kept.
 */
export const ruleValidateQuery = (body: RuleValidateRequest) => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'validate', body.campaign.id, JSON.stringify(body)] as const,
  queryFn: () => ruleCampaignApi.validate(body),
  staleTime: Infinity,
  gcTime: 60_000,
  retry: false as const,
})

/** The templates' query options (ticket 503, `Templates/List`): read when the dialog's template tab
 *  first opens, kept a few minutes. */
export const ruleTemplatesQuery = () => ({
  queryKey: ['rule-templates'] as const,
  queryFn: () => ruleCampaignApi.templates(),
  staleTime: 5 * 60_000,
  retry: false as const,
})

/** The list's query options: the composed list (`ruleCampaignApi.list`), one key for its three reads. */
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
  void queryClient.invalidateQueries({ queryKey: ruleBudgetsKey(draft.code) })
}

/** A live campaign's budgets as counted, keyed under the campaign queries. */
export const ruleBudgetsKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'budgets', id] as const

/** The budgets' query options (tickets 510, 523): tills move the counters, so — unlike the app's
 *  other reads — they are read afresh when the reader comes back to the tab. */
export const ruleBudgetsQuery = (id: string) => ({
  queryKey: ruleBudgetsKey(id),
  queryFn: () => ruleCampaignApi.budgets(id),
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

/** One version of a campaign (`Versions/Load { versionNo, campaign }`). A published version never
 *  changes, so it is read once and kept. */
export const ruleCampaignVersionQuery = (id: string, version: number) => ({
  queryKey: [...ruleCampaignVersionKey(id), version] as const,
  queryFn: () => ruleCampaignApi.version(version, id),
  staleTime: Infinity,
  retry: false as const,
})

/** The LIVE evaluation order's query options (ticket 513, `Rules/Authoring/Order`). Read afresh each
 *  time Priority opens (no stale time), never on a focus: the page holds the reader's unsaved order
 *  over it. */
export const ruleOrderQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'order'] as const,
  queryFn: () => ruleCampaignApi.order(),
  refetchOnWindowFocus: false as const,
  retry: false as const,
})

/** Every draft (`Drafts/List`) — the drafts Priority's order may ride with. Read afresh each time
 *  it is asked for. */
export const ruleDraftsQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'drafts'] as const,
  queryFn: () => ruleCampaignApi.drafts(),
  retry: false as const,
})

/** The drafts waiting for approval, each beside its live campaign (`Approvals/List`): the approver's
 *  comparison on a waiting draft's dashboard. */
export const ruleApprovalsQuery = () => ({
  queryKey: [...RULE_CAMPAIGNS_KEY, 'approvals'] as const,
  queryFn: () => ruleCampaignApi.approvals(),
  retry: false as const,
})

/** A campaign's approval trail, keyed under the campaign queries. */
export const ruleApprovalHistoryKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'approval-history', id] as const

/** The approval trail's query options (`Approvals/History`): the dashboard's trail. */
export const ruleApprovalHistoryQuery = (id: string) => ({
  queryKey: ruleApprovalHistoryKey(id),
  queryFn: () => ruleCampaignApi.approvalHistory(id),
  retry: false as const,
})

/** A campaign's coupon batches, keyed under the campaign queries. */
export const ruleCouponBatchesKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'coupon-batches', id] as const

/** The batches' query options (ticket 526): a create or a delete re-reads them; tills redeem codes,
 *  so — like the budget counters — they are read afresh when the reader comes back to the tab. */
export const ruleCouponBatchesQuery = (id: string) => ({
  queryKey: ruleCouponBatchesKey(id),
  queryFn: () => ruleCampaignApi.batches(id),
  refetchOnWindowFocus: true as const,
  retry: false as const,
})

/** A campaign's batch exports, keyed apart from its batches: a create re-reads the cheap list, not
 *  every batch's codes; a delete re-reads both. */
export const ruleCouponExportsKey = (id: string) => [...RULE_CAMPAIGNS_KEY, 'coupon-exports', id] as const
export const ruleCouponBatchExportKey = (id: string, batchId: string) => [...ruleCouponExportsKey(id), batchId] as const

/** The export's query options: opening a batch reads its codes from HQ's CSV (up to 10,000 lines),
 *  so — unlike the list — not again on every return to the tab. */
export const ruleCouponBatchExportQuery = (id: string, batchId: string) => ({
  queryKey: ruleCouponBatchExportKey(id, batchId),
  queryFn: () => ruleCampaignApi.exportBatch(batchId),
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
