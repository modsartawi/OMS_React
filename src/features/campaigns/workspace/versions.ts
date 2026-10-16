import type { RuleCampaign, RuleCampaignVersion } from '@/core/models/rule-campaign'

// The Versions page's rules (ticket 512). Pure: which version is marked live, and what Restore does
// on a campaign in its state. The server's refusal is the backstop — this only decides what is
// drawn and whether to ask first, never what is allowed.
//
// Restore makes a version the campaign's NEW draft (BackOffice 2759), never an in-place rollback:
// the version tills run stays live until that draft is approved and activated.

/** Why Restore is held on the whole campaign. */
export type RestoreHold = 'waiting' | 'disabled'

/** What Restore on one version does: at once, after asking, or not at all (and why). */
export type RestoreGuard = 'restore' | 'ask' | 'current' | RestoreHold

type CampaignLife = Pick<RuleCampaign, 'status' | 'live'>

/**
 * Restore held on the whole campaign, and why — or null.
 *
 * - **waiting** — a request waits for an approver: HQ does not change the draft under it, so it is
 *   sent back first. A status this client does not know is held the same way, never restored blind.
 * - **disabled** — tills run nothing of a disabled campaign, and the approval life (511) offers no
 *   way back from disabled: a restored draft there would read as changes over a live version that
 *   is not running. Copying the campaign starts it again.
 */
export function restoreHeld(campaign: Pick<RuleCampaign, 'status'>): RestoreHold | null {
  switch (campaign.status) {
    case 'draft':
    case 'live':
      return null
    case 'disabled':
      return 'disabled'
    default:
      return 'waiting'
  }
}

/**
 * Restore on `version` of a campaign in its state.
 *
 * - **ask** — the campaign is a draft: it holds work that is not published (changes over the live
 *   version, or a request sent back), and the restore replaces it. Even the live version itself may
 *   be restored then — that throws the changes away, so it asks too.
 * - **restore** — a live campaign's draft is its live version: nothing is lost.
 * - **current** — that live version is the draft already; restoring it changes nothing.
 * - **waiting** / **disabled** — held on the whole campaign (`restoreHeld`).
 *
 * ⚠️ PROVISIONAL (2759 unwritten): "the draft has work" is read from the status alone — 511's
 * life, where changes over a live version make it a draft again.
 */
export function restoreGuard(campaign: CampaignLife, version: number): RestoreGuard {
  const held = restoreHeld(campaign)
  if (held) return held
  if (campaign.status === 'draft') return 'ask'
  return campaign.live?.version === version ? 'current' : 'restore'
}

/**
 * How a version is marked: `live` while tills run it (a draft or a request over it changes nothing
 * for them), `disabled` for a disabled campaign's last version, otherwise nothing.
 */
export function versionMark(campaign: CampaignLife, version: number): 'live' | 'disabled' | null {
  if (campaign.live?.version !== version) return null
  return campaign.status === 'disabled' ? 'disabled' : 'live'
}

/** Versions newest first, by number — whatever order HQ answers them in. */
export const newestFirst = (versions: readonly RuleCampaignVersion[]): RuleCampaignVersion[] =>
  [...versions].sort((a, b) => b.version - a.version)
