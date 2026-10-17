import type { RuleCampaignListRow } from '@/core/models/rule-campaign'
import { CAMPAIGN_STATES, campaignState, type CampaignState } from '@/core/rules/campaign-state'

/** The tile that is on: one state, or every campaign. */
export type StateTile = CampaignState | 'all'

/** Each state's count at `now`, plus the total — the tiles' figures. */
export function stateCounts(rows: readonly RuleCampaignListRow[], now: Date): Record<StateTile, number> {
  const counts = Object.fromEntries([['all', rows.length], ...CAMPAIGN_STATES.map((s) => [s, 0])]) as Record<StateTile, number>
  for (const row of rows) counts[campaignState(row, now)]++
  return counts
}

/** Whether `row` is matched by the search text — its English or Arabic name, or its code. */
export function matchesSearch(row: RuleCampaignListRow, q: string): boolean {
  const needle = q.trim().toLocaleLowerCase()
  if (!needle) return true
  return [row.name.en, row.name.ar, row.code].some((v) => (v ?? '').toLocaleLowerCase().includes(needle))
}

/** The rows the grid shows: the tile's state (at `now`) and the search, together. */
export function visibleRows(
  rows: readonly RuleCampaignListRow[],
  tile: StateTile,
  q: string,
  now: Date,
): RuleCampaignListRow[] {
  return rows.filter((row) => (tile === 'all' || campaignState(row, now) === tile) && matchesSearch(row, q))
}

/** The tile named in the URL, or every campaign when it names none we know. */
export function tileFromParam(value: string | null): StateTile {
  return (CAMPAIGN_STATES as readonly string[]).includes(value ?? '') ? (value as CampaignState) : 'all'
}
