import type { RuleUploadCampaignItem, RuleUploadState, RuleUploadSummary } from '@/core/models/rule-upload'
import type { Severity } from '@/core/ui/severity'

/**
 * What the approver's screens make of an upload (ticket 532; BackOffice brief 2839 U3): pure, no
 * React, no i18n — the pages render these words through their own keys.
 *
 * The decided rules it serves: an upload is activated or sent back as a WHOLE (no per-campaign
 * approval, no edit — the fix for a bad campaign is a new workbook); the approver acts on the
 * revision they loaded, and a newer one makes theirs stale; four-eyes is HQ's to refuse.
 */

// ── the campaigns beside what is live ──

/** One campaign of an opened upload beside its live version. */
export type CampaignChange = 'new' | 'changed' | 'unchanged' | 'disabled'

/** A JSON value with its object keys in one order (arrays keep theirs: rules and items are ordered). */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    )
  return value
}

/** Whether two JSON values are equal, whatever order their keys come in. */
export const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b))

/**
 * - `disabled`: a `disabling` row — the upload no longer holds it (`campaign` null), an activation
 *   switches the live one off;
 * - `new`: nothing of that id is live (`live` null);
 * - `unchanged` / `changed`: both present, equal or not as JSON.
 */
export function compareCampaign(item: Pick<RuleUploadCampaignItem, 'campaign' | 'live'>): CampaignChange {
  if (item.campaign === null) return 'disabled'
  if (item.live === null) return 'new'
  return sameJson(item.campaign, item.live) ? 'unchanged' : 'changed'
}

export const CHANGE_SEV: Record<CampaignChange, Severity> = { new: 'go', changed: 'warn', unchanged: 'mute', disabled: 'bad' }

/** The upload's campaigns counted by change: the confirm dialog repeats them. */
export function campaignChanges(items: readonly RuleUploadCampaignItem[]): Record<'new' | 'changed' | 'unchanged', number> {
  const counts = { new: 0, changed: 0, unchanged: 0 }
  for (const item of items) {
    const change = compareCampaign(item)
    if (change !== 'disabled') counts[change]++
  }
  return counts
}

// ── the list and its state filter ──

/** The states this client has words for; HQ may send another, which renders as sent. */
export const UPLOAD_STATES = ['pending', 'sentBack', 'activated'] as const

export type KnownUploadState = (typeof UPLOAD_STATES)[number]

/** The filter: one listed state, or every upload. */
export type UploadStateFilter = KnownUploadState | 'all'

export const UPLOAD_STATE_FILTERS: readonly UploadStateFilter[] = [...UPLOAD_STATES, 'all']

/** The filter's default: what waits for an approver. */
export const DEFAULT_STATE_FILTER: UploadStateFilter = 'pending'

export const isKnownState = (state: RuleUploadState): state is KnownUploadState => (UPLOAD_STATES as readonly string[]).includes(state)

/** A deal's stacking this client has words for; another renders as sent. */
export const isKnownStacking = (stacking: string): stacking is 'compete' | 'stacks' => stacking === 'compete' || stacking === 'stacks'

export const STATE_SEV: Record<KnownUploadState, Severity> = { pending: 'go', sentBack: 'warn', activated: 'ok' }

/** The filter as the address holds it (`?state=`, absent = pending); anything unknown is the default. */
export function stateFilterFromParams(params: URLSearchParams): UploadStateFilter {
  const value = params.get('state') ?? ''
  return (UPLOAD_STATE_FILTERS as readonly string[]).includes(value) ? (value as UploadStateFilter) : DEFAULT_STATE_FILTER
}

export function stateFilterToParams(filter: UploadStateFilter): URLSearchParams {
  const out = new URLSearchParams()
  if (filter !== DEFAULT_STATE_FILTER) out.set('state', filter)
  return out
}

/** The rows the list shows, in HQ's order (newest upload first). "all" holds an unlisted state too. */
export function uploadListFilter(rows: readonly RuleUploadSummary[], filter: UploadStateFilter): RuleUploadSummary[] {
  return filter === 'all' ? [...rows] : rows.filter((r) => r.state === filter)
}

// ── a refused Activate or Send back ──

export type ReviewAction = 'activate' | 'sendBack'

/** HQ's refusals of the review doors that the screen says in its own words (BackOffice 2837). */
export type UploadRefusalReason =
  | 'denied'
  | 'selfApproval'
  | 'uploadStale'
  | 'notPending'
  | 'orderStale'
  | 'invalidCampaign'
  | 'reasonRequired'
  | 'notFound'
  | 'badRequest'

/** The next step the dialog shows beside a refusal: load the upload again, send it back, or go to the list. */
export type UploadRefusalNextStep = 'reload' | 'sendBack' | 'list' | null

export interface UploadRefusalView {
  /** Null for a code the screen has no words for: HQ's message is shown as it is. */
  reason: UploadRefusalReason | null
  next: UploadRefusalNextStep
  /** HQ's detail lines (a checker's line per campaign), one line each. */
  details: string[]
}

const REASON_BY_CODE: Record<string, UploadRefusalReason> = {
  RULES_SELF_APPROVAL: 'selfApproval',
  RULES_UPLOAD_STALE: 'uploadStale',
  RULES_NOT_PENDING: 'notPending',
  RULES_ORDER_STALE: 'orderStale',
  RULES_INVALID_CAMPAIGN: 'invalidCampaign',
  RULES_REASON_REQUIRED: 'reasonRequired',
  RULES_UPLOAD_NOT_FOUND: 'notFound',
  RULES_BAD_REQUEST: 'badRequest',
}

/**
 * What a refusal of Activate or Send back means, by HQ's code:
 *
 * - a bare 403 (no code): the session lacks the approver's grant (06);
 * - `RULES_SELF_APPROVAL` (403): whoever made the last revision — another approver acts;
 * - `RULES_UPLOAD_STALE`, `RULES_NOT_PENDING` (409): the upload moved since it was loaded — load it again;
 * - `RULES_ORDER_STALE` (409), `RULES_INVALID_CAMPAIGN` (400) at Activate: it stays pending and can
 *   never be activated as it is — send it back;
 * - `RULES_UPLOAD_NOT_FOUND` (404): a stale link — back to the list.
 */
export function uploadRefusalView(action: ReviewAction, refusal: { code: string | null; bareDenial: boolean; details: string[] }): UploadRefusalView {
  const details = refusal.details
  if (refusal.bareDenial) return { reason: 'denied', next: null, details }
  const reason = refusal.code ? (REASON_BY_CODE[refusal.code] ?? null) : null
  const next: UploadRefusalNextStep =
    reason === 'uploadStale' || reason === 'notPending'
      ? 'reload'
      : (reason === 'orderStale' || reason === 'invalidCampaign') && action === 'activate'
        ? 'sendBack'
        : reason === 'notFound'
          ? 'list'
          : null
  return { reason, next, details }
}
