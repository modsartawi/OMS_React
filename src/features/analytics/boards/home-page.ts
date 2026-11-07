/**
 * The analytics Home (ticket 840, BackOffice spec 3437 §G, user stories 3–7, 16) — pure: no React, no i18n.
 *
 * Home reads `GET Analytics/Home` and shows three sections in a fixed order: Recent (≤ 10), Pinned (all) and New in
 * Certified (5). The server re-checks every item against what I can see now, so a section never links to a
 * refusal (story 16); the web only caps the lists in case a server sends more. The New buttons are an author's.
 */
import { NEW_BOARD_PATH, NEW_REPORT_PATH, NEW_VIEW_PATH } from '@/core/analytics-routes'
import type { AnalyticsAccess, AnalyticsHome, AnalyticsItem, AnalyticsPinState } from '@/core/models/analytics'
import { canAuthorAnalytics } from './access'
import { readItems } from './wire'

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})

/** `GET Analytics/Home` → its three lists, each read as the Items door's rows are; an absent list is empty. */
export function readHome(raw: unknown): AnalyticsHome {
  const h = obj(raw)
  return { recent: readItems(h.recent ?? []), pinned: readItems(h.pinned ?? []), newestCertified: readItems(h.newestCertified ?? []) }
}

/** `…/Pin` → `{ itemId, pinned }`; an answer without them reads as the call asked (both doors are idempotent). */
export function readPinState(raw: unknown, id: string, asked: boolean): AnalyticsPinState {
  const p = obj(raw)
  return { itemId: typeof p.itemId === 'string' && p.itemId ? p.itemId : id, pinned: typeof p.pinned === 'boolean' ? p.pinned : asked }
}

export type HomeSectionKey = 'recent' | 'pinned' | 'newestCertified'

export interface HomeSection {
  key: HomeSectionKey
  items: AnalyticsItem[]
  empty: boolean
}

/** What each section keeps at most (3437 §A: 10 recent, all pins, 5 newest certified). */
const CAP: Record<HomeSectionKey, number> = { recent: 10, pinned: Infinity, newestCertified: 5 }
const ORDER: readonly HomeSectionKey[] = ['recent', 'pinned', 'newestCertified']

/** Home's sections in their order, each with its own empty state. */
export function homeSections(home: AnalyticsHome): HomeSection[] {
  return ORDER.map((key) => {
    const items = home[key].slice(0, CAP[key])
    return { key, items, empty: items.length === 0 }
  })
}

export interface HomeNewLink {
  key: 'view' | 'board' | 'report'
  to: string
}

/** Home's New buttons: an author's three; a runner (or a probe not yet answered) builds nothing (822). */
export function homeNewLinks(access: AnalyticsAccess | null | undefined): HomeNewLink[] {
  if (!canAuthorAnalytics(access)) return []
  return [
    { key: 'view', to: NEW_VIEW_PATH },
    { key: 'board', to: NEW_BOARD_PATH },
    { key: 'report', to: NEW_REPORT_PATH },
  ]
}
