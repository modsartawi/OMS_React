/**
 * sp_Blitz on the Health check panel as the page reads it (oms 919; BackOffice spec 4016 D18, door 4039). Pure — pinned
 * by `blitz-helpers.test.ts`. Running it is a View read; installing and removing it are Act jobs on the write rail.
 */
import { apiErrorCode } from '@/core/api'
import type { StoreDbBlitz, StoreDbBlitzFinding, StoreDbBlitzState } from '@/core/models/store-database'
import type { Permissions } from '@/core/permissions'
import { canActStoreDb, canViewStoreDb } from '../access'

/** The refusal of `GET StoreDatabase/Blitz` when the procedure is absent (409, `StoreDatabaseBlitz.BlitzNotInstalled`). */
export const BLITZ_NOT_INSTALLED = 'BLITZ_NOT_INSTALLED'

export interface BlitzControls {
  run: boolean
  install: boolean
  remove: boolean
}

/**
 * Which sp_Blitz controls show: Run with View; Install with Act (also over an installed one — it reinstalls the HQ
 * build, e.g. a newer version); Remove with Act where it is installed. When the store door does not say (`null`), both
 * Act controls show and the door's refusal tells the rest.
 */
export function blitzControls(p: Permissions, state: StoreDbBlitzState | null | undefined): BlitzControls {
  const act = canActStoreDb(p)
  return { run: canViewStoreDb(p), install: act, remove: act && state?.installed !== false }
}

/** The findings, most urgent first (sp_Blitz's own order within one priority). A missing list is none. */
export function blitzFindings(data: Partial<StoreDbBlitz> | null | undefined): StoreDbBlitzFinding[] {
  return [...(data?.findings ?? [])].sort((a, b) => a.priority - b.priority)
}

/**
 * sp_Blitz's install state as far as this page knows it. BO 4039 is open and no read carries the state (not the Store
 * door), so it is unknown (`null`) until sp_Blitz is run: a report says installed (HQ's recorded build, `""` = none), a
 * `BLITZ_NOT_INSTALLED` refusal says not; any other failure leaves it unknown.
 */
export function blitzState(report: Pick<StoreDbBlitz, 'installedVersion'> | null | undefined, err: unknown): StoreDbBlitzState | null {
  if (report) return { installed: true, version: report.installedVersion?.trim() || null }
  if (blitzNotInstalled(err)) return { installed: false, version: null }
  return null
}

/** The door refused because sp_Blitz is not on the store — shown plainly, with Install beside it for Act. */
export const blitzNotInstalled = (err: unknown): boolean => err != null && apiErrorCode(err) === BLITZ_NOT_INSTALLED

/**
 * A finding's "read more" address as a link target: only an absolute `http:` / `https:` address. Anything else the
 * server sends (`javascript:`, `data:`, a relative path) is no link at all — a server value never runs as script.
 */
export function blitzLink(url: string | null | undefined): string | null {
  const u = String(url ?? '').trim()
  return /^https?:\/\/[^/\s]/i.test(u) ? u : null
}
