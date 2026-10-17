import type { RuleCampaign, RuleCampaignRoles, RuleCampaignStatus } from '@/core/models/rule-campaign'

// The approval split on a campaign's dashboard (ticket 511). Pure: which acts the reader may take
// on a campaign in its state, and the pre-activation steps read off the draft. The server's
// refusal is the backstop — this only decides what is drawn, never what is allowed.
//
// The states are PROVISIONAL (BackOffice 2759 unwritten; the ticket's default ruled):
// draft → waiting for approval → (sent back → draft) | live → disabled.

/** An act on the dashboard: an author asks or deletes a draft; an approver activates, sends back
 *  or disables. */
export type ApprovalAction = 'askForApproval' | 'deleteDraft' | 'activate' | 'sendBack' | 'disable'

/** Every act, in the order the dashboard draws them. */
export const APPROVAL_ACTIONS: readonly ApprovalAction[] = ['askForApproval', 'activate', 'sendBack', 'disable', 'deleteDraft']

/**
 * The acts the reader is offered on a campaign. An author never activates, sends back or disables;
 * an approver never asks for approval or deletes a draft. A reader with both roles is offered both
 * sets — whether one person may approve their own request is the server's to refuse. A status this
 * client does not know offers nothing.
 */
export function actionsFor(
  campaign: { status: RuleCampaignStatus; live: RuleCampaign['live'] },
  roles: RuleCampaignRoles,
): ApprovalAction[] {
  const offered = new Set<ApprovalAction>()
  const { status, live } = campaign
  if (roles.author && status === 'draft') {
    offered.add('askForApproval')
    // A campaign that was ever published is not a draft to throw away: tills have run it.
    if (!live) offered.add('deleteDraft')
  }
  if (roles.approver) {
    if (status === 'waitingForApproval') {
      offered.add('activate')
      offered.add('sendBack')
    }
    // Disabling stops what tills run. Changes waiting over a live version are sent back first:
    // disabling then would strand the request.
    if (status === 'live') offered.add('disable')
  }
  return APPROVAL_ACTIONS.filter((a) => offered.has(a))
}

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
  campaign: Pick<RuleCampaign, 'name' | 'rules' | 'schedule' | 'budgets'>,
  checksBlocked: boolean | null,
): PreActivationStep[] {
  const { name, rules, schedule, budgets } = campaign
  return [
    { key: 'named', done: !!name.en.trim() && !!name.ar.trim(), page: 'settings/details' },
    { key: 'rules', done: rules.length > 0 && checksBlocked === false, page: 'rules' },
    { key: 'schedule', done: !!(schedule.from || schedule.until), page: 'settings/schedule' },
    { key: 'budgets', done: budgets.length > 0, page: 'settings/budgets' },
  ]
}

/** The steps show until the campaign is first published: afterwards they are history. */
export const showsSteps = (campaign: Pick<RuleCampaign, 'status' | 'live'>): boolean =>
  !campaign.live && (campaign.status === 'draft' || campaign.status === 'waitingForApproval')
