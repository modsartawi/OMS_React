// A campaign's id, which the author picks (BackOffice 2758: there is no create door, and Copy and
// "from a template" take the new id too, 2759). Shared by the no-promotion page's Create dialog and the
// workspace's Copy, so it sits in `core/rules`. Pure.

/** A campaign id (2758): at most 40 of `A-Z a-z 0-9 . _ -`. */
export const CAMPAIGN_ID_MAX = 40
const CAMPAIGN_ID = /^[A-Za-z0-9._-]+$/

/** The static leaves under `/campaigns/…`: a campaign with one of these ids would be shadowed
 *  (`no-promotion` by its page; `promotions` by `/campaigns/promotions/:promotionCode`, which takes its
 *  workspace's pages). */
export const RESERVED_CAMPAIGN_IDS: readonly string[] = ['priority', 'simulator', 'sessions', 'coupon-finder', 'customers', 'promotions', 'no-promotion']

/** An id suggested from a name: upper-case, every other character a dash, at most 40. */
export function suggestCampaignId(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9._-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+/, '')
    .slice(0, CAMPAIGN_ID_MAX)
    .replace(/-+$/, '')
}

export type CampaignIdProblem = 'idRequired' | 'idTooLong' | 'idCharacters' | 'idReserved'

/**
 * Why an id cannot be used, or null. A reserved leaf is refused in any case. An id another campaign
 * already holds is not checked here: ticket 535 retired the composed campaigns list it was checked
 * against (BackOffice brief 2848; rebuilding every campaign in the browser grows with every
 * promotion ever kept). Copy and "from a template" are refused by HQ, 409 `RULES_CAMPAIGN_EXISTS`, shown in their
 * dialog. ⚠ A blank Create is NOT: it is a first `Drafts/Save` at revision 0, which HQ takes over a
 * live campaign with no draft as that campaign's new draft (its live rules untouched until an
 * approver activates it). Accepted by 535's ruled default; a server guard is a BackOffice ask
 * (`.afk/HITL-535.md`).
 */
export function campaignIdProblem(id: string): CampaignIdProblem | null {
  if (!id) return 'idRequired'
  if (id.length > CAMPAIGN_ID_MAX) return 'idTooLong'
  if (!CAMPAIGN_ID.test(id)) return 'idCharacters'
  if (RESERVED_CAMPAIGN_IDS.includes(id.toLowerCase())) return 'idReserved'
  return null
}

/** The id a copy is offered: the source's with `-COPY`, kept within 40. */
export const copyIdOf = (source: string): string => `${source.slice(0, CAMPAIGN_ID_MAX - 5).replace(/[-._]+$/, '')}-COPY`
