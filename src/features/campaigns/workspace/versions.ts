import type { RuleDraft, RuleVersionSummary } from '@/core/models/rule-campaign'

// The Versions page's rules (tickets 512, 524). Pure: which version is marked live, and what Restore
// does on a campaign in its state. The server's refusal is the backstop — this only decides what is
// drawn and whether to ask first, never what is allowed.
//
// Restore makes a version the campaign's DRAFT (`Versions/Restore`, BackOffice 2759), never an
// in-place rollback: the version tills run stays live until that draft is approved and activated.
// A disable makes a version too — the live one WITHOUT the campaign — which holds nothing of it to
// read or restore.

/** Why Restore is held on the whole campaign. */
export type RestoreHold = 'waiting'

/** What Restore on one version does: at once, after asking, or not at all (and why). */
export type RestoreGuard = 'now' | 'ask' | RestoreHold

/** What the page reads off the loaded draft (ticket 522). */
type CampaignLife = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus' | 'publishedVersionNo'>

/**
 * Restore held on the whole campaign, and why — or null. **waiting**: a request waits for an
 * approver, and HQ does not change the draft under it (409 `RULES_DRAFT_PENDING`), so it is sent
 * back first. A draft state this client does not know is held the same way, never restored blind.
 */
export function restoreHeld(campaign: CampaignLife): RestoreHold | null {
  return campaign.source === 'draft' && campaign.state !== 'editing' && campaign.state !== 'sentBack' ? 'waiting' : null
}

/**
 * Restore on a version of a campaign in its state.
 *
 * - **now** — Drafts/Load answered the live version (`source: published`): there is no draft, so the
 *   restore replaces nothing (it is sent at revision 0).
 * - **ask** — a draft exists, and it may hold saved work that is not published (a request sent back,
 *   or edits saved over the live version). There is still no draft-changed flag in 2759, so a draft
 *   always asks, the live version's restore too: restoring it is how saved edits are thrown away.
 * - **waiting** — held on the whole campaign (`restoreHeld`).
 */
export function restoreGuard(campaign: CampaignLife): RestoreGuard {
  return restoreHeld(campaign) ?? (campaign.source === 'draft' ? 'ask' : 'now')
}

/** The revision a restore is sent at: the draft's, or 0 without one. */
export const restoreRevision = (campaign: Pick<RuleDraft, 'source' | 'revision'>): number =>
  campaign.source === 'draft' ? campaign.revision : 0

/** Whether a version holds the campaign to read or restore: a publish does, a disable does not. */
export const holdsCampaign = (v: Pick<RuleVersionSummary, 'action'>): boolean => v.action === 'publish'

/**
 * How a version is marked: `live` while tills run it (a draft or a request over it changes nothing
 * for them), `disabled` for a disabled campaign's last published version, otherwise nothing.
 */
export function versionMark(
  campaign: CampaignLife,
  v: Pick<RuleVersionSummary, 'versionNo' | 'action'>,
): 'live' | 'disabled' | null {
  if (!holdsCampaign(v) || campaign.publishedVersionNo !== v.versionNo) return null
  return campaign.campaignStatus === 'Disabled' ? 'disabled' : 'live'
}

/** Versions newest first, by number — whatever order HQ answers them in. */
export const newestFirst = <V extends Pick<RuleVersionSummary, 'versionNo'>>(versions: readonly V[]): V[] =>
  [...versions].sort((a, b) => b.versionNo - a.versionNo)
