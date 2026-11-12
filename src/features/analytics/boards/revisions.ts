import type { AnalyticsRevision } from '@/core/models/analytics'
import { itemActions, type ItemActor, type ItemStanding } from './item-actions'

/**
 * An item's history (spec 766 §C/§F story 63, ticket 779), pure and kind-agnostic: a view and a board list
 * and revert the same way. A revert writes a NEW revision, so a revert is itself undone by reverting again.
 */

/** §C: `…/Revisions` returns the last 20; the list never shows more, whatever the door sends. */
export const REVISION_LIMIT = 20

/**
 * `GET Analytics/Item/{id}/Revisions` read defensively (kept here, not in `./wire`, beside its one reader).
 * ⚠ §C names the door, not its `data` shape: a bare array is read, and so is a `{ revisions }` page.
 * A row with no revision number is dropped: it could not be reverted to.
 */
export function readRevisions(raw: unknown): AnalyticsRevision[] {
  const rec = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
  const list = Array.isArray(raw) ? raw : Array.isArray(rec(raw).revisions) ? (rec(raw).revisions as unknown[]) : []
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  return list
    .map(rec)
    .filter((r) => typeof r.revision === 'number' && Number.isFinite(r.revision))
    .map((r) => ({
      revision: r.revision as number,
      // 890: the server names a revision's author and time `savedBy` / `savedAt` (`AnalyticsRevisionInfo`); the older
      // spelling is still read.
      updatedAt: text(r.savedAt) || text(r.updatedAt),
      updatedBy: text(r.savedBy) || text(r.updatedBy),
      revertedFrom: typeof r.revertedFrom === 'number' ? r.revertedFrom : null,
      // 826: an audience change or a reassign; any other kind reads as an ordinary row.
      ...(r.event === 'audience' || r.event === 'reassign' ? { event: r.event } : {}),
      ...(r.event === 'reassign' && text(r.owner) ? { owner: text(r.owner) } : {}),
    }))
}

export interface RevisionRow {
  revision: number
  by: string
  at: string
  /** The revision the screen is showing (the item's own `revision`). */
  viewing: boolean
  /** Every revision but the one being viewed can be reverted to. */
  canRevert: boolean
  /** A revert revision: the revision it copied. */
  revertedFrom: number | null
  /** 826: an audience change or a reassign (the new `owner`), not a revision: never viewed, never reverted to. */
  event?: 'audience' | 'reassign'
  owner?: string
}

/** The history panel's rows: newest first, at most `REVISION_LIMIT`, the revision being viewed marked. */
export function revisionList(revisions: AnalyticsRevision[], viewing: number): RevisionRow[] {
  // Newest first; at one revision number, its events (826) above it, newest first, since they came after it.
  const sorted = [...revisions].sort((a, b) => b.revision - a.revision || Number(!!b.event) - Number(!!a.event) || b.updatedAt.localeCompare(a.updatedAt))
  const kept = sorted.filter((r) => !r.event).slice(0, REVISION_LIMIT)
  const oldest = kept.length ? kept[kept.length - 1].revision : -Infinity
  return sorted
    .filter((r) => (r.event ? r.revision >= oldest : kept.includes(r)))
    .map((r) => ({
      revision: r.revision,
      by: r.updatedBy,
      at: r.updatedAt,
      viewing: !r.event && r.revision === viewing,
      canRevert: !r.event && r.revision !== viewing,
      revertedFrom: r.revertedFrom ?? null,
      ...(r.event ? { event: r.event } : {}),
      ...(r.owner ? { owner: r.owner } : {}),
    }))
}

/**
 * Story 63: only someone who may edit the item sees its history. "May edit" is 776's tier rule
 * (`./item-actions`): the item saves in place for this actor. Someone who would only save a copy does not.
 */
export const mayEditItem = (item: ItemStanding, actor: ItemActor): boolean => itemActions(item, actor).save === 'in-place'
