import type { HybrisStockPushRow, HybrisStockPushStatus, HybrisStockPushType, HybrisStockTarget } from '@/core/models/hybris-stock'
import type { Severity } from '@/core/ui/severity'

// How a push reads (spec 3447 stories 41–48; ticket 849). Pure: no React, no `t` — each function
// answers the KEY in `hybris-stock-pushes`. It reads the push LOG's words (`delta`, `sent`, …), the
// ones the `type=` / `status=` filters take too.
//
// 🚩 A sent push reads **"Delivered to hot folder"**, never "live on the website": OMS counts a push as
// sent once its file is in the hot folder, and Hybris's own import is not read (story 42). And a shadow
// push says, every time, that Hybris does not import it (story 48).

export const PUSH_TYPES: readonly HybrisStockPushType[] = ['delta', 'full', 'now-store', 'now-materials']
export const PUSH_STATUSES: readonly HybrisStockPushStatus[] = ['running', 'sent', 'failed']

export type TypeReading = 'delta' | 'full' | 'storeNow' | 'materialsNow' | 'unknown'
const TYPE: Record<HybrisStockPushType, TypeReading> = { delta: 'delta', full: 'full', 'now-store': 'storeNow', 'now-materials': 'materialsNow' }

export function typeLabel(type: string | null | undefined): `type.${TypeReading}` {
  return `type.${(Object.hasOwn(TYPE, type ?? '') && TYPE[type as HybrisStockPushType]) || 'unknown'}`
}

export type StatusReading = 'running' | 'delivered' | 'failed' | 'unknown'
const STATUS: Record<HybrisStockPushStatus, StatusReading> = { running: 'running', sent: 'delivered', failed: 'failed' }
const STATUS_SEV: Record<StatusReading, Severity> = { running: 'mute', delivered: 'ok', failed: 'bad', unknown: 'mute' }

export function statusLabel(status: string | null | undefined): { key: `status.${StatusReading}`; sev: Severity } {
  const reading = (Object.hasOwn(STATUS, status ?? '') && STATUS[status as HybrisStockPushStatus]) || 'unknown'
  return { key: `status.${reading}`, sev: STATUS_SEV[reading] }
}

export type TargetReading = 'shadow' | 'live' | 'unknown'

/** Where the push's files went. Only an exact `live` reads live; anything else is not claimed. */
export function targetLabel(target: string | null | undefined): { key: `target.${TargetReading}`; sev: Severity } {
  const reading: TargetReading = target === 'shadow' || target === 'live' ? (target as HybrisStockTarget) : 'unknown'
  return { key: `target.${reading}`, sev: reading === 'shadow' ? 'warn' : reading === 'live' ? 'go' : 'mute' }
}

/**
 * The push's lines are gone: the server said so (`linesKept: false` — past `lineRetentionDays`), so the
 * drawer says they were swept instead of reading an empty page as "no lines". The server decides; the
 * screen's clock does not.
 */
export function linesGone(push: Pick<HybrisStockPushRow, 'linesKept'> | null | undefined): boolean {
  return push?.linesKept === false
}

/**
 * A split push that is still running has written only some of its files. Each part is named as it is
 * uploaded (the partner's file names, BackOffice 2026-11-09), so `fileNames` grows while the push runs and is
 * empty until the first part is up. Answers how many are written of how many, so the drawer does not read
 * that as "no file written"; `null` once the push is finished, or when every file is already named.
 */
export function filesSoFar(
  push: Pick<HybrisStockPushRow, 'status' | 'fileNames' | 'fileCount' | 'parts'>,
): { written: number; total: number } | null {
  const written = (push.fileNames ?? []).length
  const total = push.parts?.total ?? push.fileCount
  return push.status === 'running' && total > written ? { written, total } : null
}
