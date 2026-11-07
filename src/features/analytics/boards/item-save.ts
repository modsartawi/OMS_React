import { apiErrorCode, apiErrorData, apiErrorMessage } from '@/core/api'
import type { AnalyticsItem, AnalyticsTier } from '@/core/models/analytics'

/**
 * The save path's pure pieces (spec 766 §C/§F, ticket 776), kind-agnostic: a view (775) and a board (777)
 * save through the same doors and the same refusals.
 *
 * - `ANALYTICS-403` "not yours to edit in place" → the screen offers **Save as my copy**.
 * - `ANALYTICS-405` "someone saved a newer revision" → names who and when; offers a copy or a reload.
 *   ⚠ §C does not say where who/when ride: read here from the refusal's `data.updatedBy` / `data.updatedAt`
 *   (and `data.revision`), BackOffice 3378 to confirm; absent, the server's message stands alone.
 * Anything else is `null`: the caller words it (406/407/410 in the editor, else `analyticsRefusal`).
 */
export type SaveRefusal =
  | { kind: 'not-yours' }
  | { kind: 'conflict'; by: string | null; at: string | null; revision: number | null; message: string }

export function saveRefusal(err: unknown): SaveRefusal | null {
  const code = apiErrorCode(err)
  if (code === 'ANALYTICS-403') return { kind: 'not-yours' }
  if (code === 'ANALYTICS-405') {
    const data = apiErrorData(err)
    const said = (k: string): unknown => (data && typeof data === 'object' ? (data as Record<string, unknown>)[k] : undefined)
    const text = (v: unknown) => (typeof v === 'string' && v ? v : null)
    const revision = said('revision')
    return {
      kind: 'conflict',
      by: text(said('updatedBy')),
      at: text(said('updatedAt')),
      revision: typeof revision === 'number' ? revision : null,
      message: apiErrorMessage(err, ''),
    }
  }
  return null
}

/**
 * The item an editor was opened on: what the save path needs to PUT in place (`id`, `baseRevision`) or copy,
 * and what decides the tier's actions (`./item-actions`). Kind-agnostic. Carried in the editor seed.
 */
export interface EditingItem {
  id: string
  kind: 'view' | 'board' | 'report'
  owner: string
  tier: AnalyticsTier
  revision: number
  copiedFrom?: string | null
  sourceChangedSinceCopy: boolean
}

export function editingItemOf(item: Pick<AnalyticsItem, 'id' | 'owner' | 'tier' | 'revision' | 'copiedFrom' | 'sourceChangedSinceCopy'> & { kind: 'view' | 'board' | 'report' }): EditingItem {
  return {
    id: item.id,
    kind: item.kind,
    owner: item.owner,
    tier: item.tier,
    revision: item.revision,
    copiedFrom: item.copiedFrom ?? null,
    sourceChangedSinceCopy: item.sourceChangedSinceCopy === true,
  }
}

/** A copy whose source has moved on since it was copied (story 64): "the original changed since you copied it". */
export const sourceMovedOn = (item: { copiedFrom?: string | null; sourceChangedSinceCopy?: boolean } | null | undefined): boolean =>
  !!item?.copiedFrom && item.sourceChangedSinceCopy === true
