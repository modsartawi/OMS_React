import type { RuleCampaign, RuleDraft } from '@/core/models/rule-campaign'

// The approval split on a campaign's dashboard (tickets 511, 524). Pure: which acts a campaign in
// its state offers, what HQ's refusal of one means, and the pre-activation steps read off the draft.
//
// The states are the draft's (BackOffice 2759): a draft is editing → pending → (sentBack → editing)
// | activated, beside the live campaign's Published | Disabled | ''. HQ has no roles door (BO ask B,
// ticket 529): every door carries its own grant — 02 to ask, 06 to activate, send back or disable —
// and a reader without it is refused with a bare 403. So the acts follow the STATE, and the grant
// is HQ's to refuse.

/** An act on the dashboard: an author asks or deletes a draft; an approver activates, sends back
 *  or disables. */
export type ApprovalAction = 'askForApproval' | 'deleteDraft' | 'activate' | 'sendBack' | 'disable'

/** Every act, in the order the dashboard draws them. */
export const APPROVAL_ACTIONS: readonly ApprovalAction[] = ['askForApproval', 'activate', 'sendBack', 'disable', 'deleteDraft']

/**
 * The acts a campaign in its state offers. A draft being edited or sent back may be asked for or
 * deleted (Drafts/Delete leaves a live campaign live); a pending one is frozen and waits for an
 * approver to activate or send it back; a live campaign may be disabled, unless changes wait over
 * it (they are sent back first: disabling then would strand the request). A state this client does
 * not know offers nothing.
 */
export function actionsFor(draft: Pick<RuleDraft, 'source' | 'state' | 'campaignStatus'>): ApprovalAction[] {
  const offered = new Set<ApprovalAction>()
  const hasDraft = draft.source === 'draft'
  const pending = hasDraft && draft.state === 'pending'
  if (hasDraft && (draft.state === 'editing' || draft.state === 'sentBack')) {
    offered.add('askForApproval')
    offered.add('deleteDraft')
  }
  if (pending) {
    offered.add('activate')
    offered.add('sendBack')
  }
  if (draft.campaignStatus === 'Published' && !pending) offered.add('disable')
  return APPROVAL_ACTIONS.filter((a) => offered.has(a))
}

/** A note's longest length — a sentence or two for the approver, the author or the version history. */
export const APPROVAL_NOTE_MAX = 500

/** Which acts take a note: asking, sending back and disabling require one (`RULES_REASON_REQUIRED`
 *  otherwise); an activation's note is optional; deleting a draft takes none. */
export const APPROVAL_NOTE: Record<ApprovalAction, 'required' | 'optional' | null> = {
  askForApproval: 'required',
  activate: 'optional',
  sendBack: 'required',
  disable: 'required',
  deleteDraft: null,
}

/** Whether an act's note lets it be sent: a required one holds something besides spaces. */
export const noteReady = (action: ApprovalAction, note: string): boolean =>
  APPROVAL_NOTE[action] !== 'required' || note.trim().length > 0

/** The words a dialog act's body is read in: Delete draft says what deleting leaves behind — a live
 *  campaign stays live; a disabled one, in no version, leaves the list with its draft. */
export function dialogBodyKey(action: ApprovalAction, campaignStatus: RuleDraft['campaignStatus']): 'body' | 'bodyLive' | 'bodyDisabled' {
  if (action !== 'deleteDraft') return 'body'
  return campaignStatus === 'Published' ? 'bodyLive' : campaignStatus === 'Disabled' ? 'bodyDisabled' : 'body'
}

/** HQ's refusals of the approval doors that the dashboard says in its own words. */
export type ApprovalRefusalReason =
  | 'denied'
  | 'selfApproval'
  | 'notPending'
  | 'orderStale'
  | 'notLive'
  | 'draftStale'
  | 'draftPending'
  | 'invalidCampaign'
  | 'reasonRequired'

/** What the dashboard offers beside a refusal: read the campaign again, or send the draft back. */
export type ApprovalRefusalOffer = 'reload' | 'sendBack' | null

export interface ApprovalRefusal {
  reason: ApprovalRefusalReason
  offer: ApprovalRefusalOffer
}

const REASON_BY_CODE: Record<string, ApprovalRefusalReason> = {
  RULES_SELF_APPROVAL: 'selfApproval',
  RULES_NOT_PENDING: 'notPending',
  RULES_ORDER_STALE: 'orderStale',
  RULES_NOT_LIVE: 'notLive',
  RULES_DRAFT_STALE: 'draftStale',
  RULES_DRAFT_PENDING: 'draftPending',
  RULES_INVALID_CAMPAIGN: 'invalidCampaign',
  RULES_REASON_REQUIRED: 'reasonRequired',
}

/**
 * What a refusal of an approval act means, by HQ's code (BackOffice 2759), or null for one the
 * dashboard has no words for (its envelope message is shown as it is).
 *
 * - a bare 403 (no code): the reader lacks the door's grant — 02 to ask or delete, 06 to activate,
 *   send back or disable;
 * - `RULES_SELF_APPROVAL` (403): the approver asked for it or wrote the draft — another approver;
 * - `RULES_NOT_PENDING`, `RULES_NOT_LIVE`, `RULES_DRAFT_STALE`: the campaign moved since it was read —
 *   read it again;
 * - `RULES_ORDER_STALE`: the draft's order was edited from a live order that changed since; it stays
 *   pending and is never published over that change — send it back (when the act was Activate);
 * - `RULES_INVALID_CAMPAIGN` at Activate: the live ruleset moved under the draft — send it back too.
 */
export function approvalRefusal(action: ApprovalAction, code: string | null, bareDenial: boolean): ApprovalRefusal | null {
  if (bareDenial) return { reason: 'denied', offer: null }
  const reason = code ? REASON_BY_CODE[code] : undefined
  if (!reason) return null
  const offer: ApprovalRefusalOffer =
    reason === 'notPending' || reason === 'notLive' || reason === 'draftStale' || reason === 'draftPending'
      ? 'reload'
      : (reason === 'orderStale' || reason === 'invalidCampaign') && action === 'activate'
        ? 'sendBack'
        : null
  return { reason, offer }
}

/** The grant a bare 403 says is missing: the author's (02) or the approver's (06). */
export const grantOf = (action: ApprovalAction): 'author' | 'approver' =>
  action === 'askForApproval' || action === 'deleteDraft' ? 'author' : 'approver'

/** What holds back an act that sends or publishes the saved draft. */
export type ChecksGate = 'noRules' | 'checking' | 'unavailable' | 'errors' | null

/**
 * The gate on the saved draft: no rule at all holds it back (the prototype's "Rules are required
 * before activation"), then HQ's checks (508) — not read yet, not readable (fail closed), or an
 * error. Warnings never hold it back.
 */
export function draftGate(ruleCount: number, checks: { failed: boolean; blocked: boolean | null }): ChecksGate {
  if (ruleCount === 0) return 'noRules'
  if (checks.failed) return 'unavailable'
  if (checks.blocked === null) return 'checking'
  return checks.blocked ? 'errors' : null
}

/**
 * Why an act cannot be taken yet, or null when it can. Asking for approval and activating both send
 * the SAVED draft, so both wait for HQ's checks (508) and an error blocks them; a check that could
 * not be made blocks them too (fail closed). The other acts do not depend on the rules.
 */
export function actionGate(action: ApprovalAction, checks: ChecksGate): ChecksGate {
  return action === 'askForApproval' || action === 'activate' ? checks : null
}

export type PreActivationStepKey = 'named' | 'rules' | 'schedule' | 'budgets'

export interface PreActivationStep {
  key: PreActivationStepKey
  done: boolean
  /** The workspace page that fixes it, relative to `/campaigns/:id`. */
  page: string
}

/**
 * The steps to consider before activating (the prototype's "Consider the following steps"), read
 * off the draft: named in both languages, rules that HQ's checks pass, a schedule, a budget. Only
 * the rules block approval (through the checks); the others are advice. `checksBlocked` null =
 * the checks are not read yet or could not be read — the rules step is not ticked meanwhile.
 */
export function preActivationSteps(
  campaign: Pick<RuleCampaign, 'name' | 'rules' | 'window' | 'budgets'>,
  checksBlocked: boolean | null,
): PreActivationStep[] {
  const { name, rules, window, budgets = [] } = campaign
  return [
    { key: 'named', done: !!name.en.trim() && !!name.ar.trim(), page: 'settings/details' },
    { key: 'rules', done: rules.length > 0 && checksBlocked === false, page: 'rules' },
    { key: 'schedule', done: !!(window?.from || window?.until), page: 'settings/schedule' },
    { key: 'budgets', done: budgets.length > 0, page: 'settings/budgets' },
  ]
}

/** The steps show until the campaign is first published: afterwards they are history. */
export const showsSteps = (draft: Pick<RuleDraft, 'publishedVersionNo' | 'campaignStatus'>): boolean =>
  draft.publishedVersionNo === 0 && draft.campaignStatus === ''
