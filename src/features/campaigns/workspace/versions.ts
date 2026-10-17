import type { RuleCampaignVersion, RuleDraft } from '@/core/models/rule-campaign'

// The Versions page's rules (ticket 512). Pure: which version is marked live, and what Restore does
// on a campaign in its state. The server's refusal is the backstop — this only decides what is
// drawn and whether to ask first, never what is allowed.
//
// Restore makes a version the campaign's NEW draft (BackOffice 2759), never an in-place rollback:
// the version tills run stays live until that draft is approved and activated.

/** Why Restore is held on the whole campaign. */
export type RestoreHold = 'waiting' | 'disabled'

/** What Restore on one version does: after asking, or not at all (and why). */
export type RestoreGuard = 'ask' | RestoreHold

/** What the page reads off the loaded draft (ticket 522). */
type CampaignLife = Pick<RuleDraft, 'source' | 'state' | 'campaignStatus' | 'publishedVersionNo'>

/**
 * Restore held on the whole campaign, and why — or null.
 *
 * - **waiting** — a request waits for an approver: HQ does not change the draft under it, so it is
 *   sent back first. A status this client does not know is held the same way, never restored blind.
 * - **disabled** — tills run nothing of a disabled campaign, and the approval life (511) offers no
 *   way back from disabled: a restored draft there would read as changes over a live version that
 *   is not running. Copying the campaign starts it again.
 */
export function restoreHeld(campaign: CampaignLife): RestoreHold | null {
  // A pending draft is frozen (409 `RULES_DRAFT_PENDING`); an unknown draft state is held the same.
  if (campaign.source === 'draft' && campaign.state !== 'editing' && campaign.state !== 'sentBack') return 'waiting'
  return campaign.campaignStatus === 'Disabled' ? 'disabled' : null
}

/**
 * Restore on a version of a campaign in its state.
 *
 * - **ask** — a draft or a live campaign: the restore replaces its draft, and the draft may hold
 *   saved work that is not published (a request sent back, or rule edits saved over the live
 *   version — saving keeps a live campaign live). Every version asks, the live one too: restoring
 *   it is how saved edits are thrown away.
 * - **waiting** / **disabled** — held on the whole campaign (`restoreHeld`).
 *
 * ⚠️ PROVISIONAL (2759 unwritten): nothing tells this client whether a live campaign's draft
 * differs from its live version, so it never infers "no work" from the status. Once 2759 gives a
 * draft-changed flag, a live campaign with no work may restore at once.
 */
export function restoreGuard(campaign: CampaignLife): RestoreGuard {
  return restoreHeld(campaign) ?? 'ask'
}

/**
 * How a version is marked: `live` while tills run it (a draft or a request over it changes nothing
 * for them), `disabled` for a disabled campaign's last version, otherwise nothing.
 */
export function versionMark(campaign: CampaignLife, version: number): 'live' | 'disabled' | null {
  if (campaign.publishedVersionNo !== version) return null
  return campaign.campaignStatus === 'Disabled' ? 'disabled' : 'live'
}

/** Versions newest first, by number — whatever order HQ answers them in. */
export const newestFirst = (versions: readonly RuleCampaignVersion[]): RuleCampaignVersion[] =>
  [...versions].sort((a, b) => b.version - a.version)
