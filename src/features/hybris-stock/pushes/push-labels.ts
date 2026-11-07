import type { HybrisStockPushRow, HybrisStockPushStatus, HybrisStockPushType, HybrisStockTarget } from '@/core/models/hybris-stock'
import type { Severity } from '@/core/ui/severity'

// How a push reads (spec 3447 stories 41–48; ticket 849). Pure: no React, no `t` — each function
// answers the KEY in `hybris-stock-pushes`.
//
// 🚩 A sent push reads **"Delivered to hot folder"**, never "live on the website": OMS counts a push as
// sent once its file is in the hot folder, and Hybris's own import is not read (story 42). And a shadow
// push says, every time, that Hybris does not import it (story 48).

export const PUSH_TYPES: readonly HybrisStockPushType[] = ['D', 'F', 'S', 'M']
export const PUSH_STATUSES: readonly HybrisStockPushStatus[] = ['R', 'S', 'E']

export type TypeReading = 'delta' | 'full' | 'storeNow' | 'materialsNow' | 'unknown'
const TYPE: Record<HybrisStockPushType, TypeReading> = { D: 'delta', F: 'full', S: 'storeNow', M: 'materialsNow' }

export function typeLabel(type: string | null | undefined): `type.${TypeReading}` {
  return `type.${TYPE[type as HybrisStockPushType] ?? 'unknown'}`
}

export type StatusReading = 'running' | 'delivered' | 'failed' | 'unknown'
const STATUS: Record<HybrisStockPushStatus, StatusReading> = { R: 'running', S: 'delivered', E: 'failed' }
const STATUS_SEV: Record<StatusReading, Severity> = { running: 'mute', delivered: 'ok', failed: 'bad', unknown: 'mute' }

export function statusLabel(status: string | null | undefined): { key: `status.${StatusReading}`; sev: Severity } {
  const reading = STATUS[status as HybrisStockPushStatus] ?? 'unknown'
  return { key: `status.${reading}`, sev: STATUS_SEV[reading] }
}

export type TargetReading = 'shadow' | 'live' | 'unknown'

/** Where the push's files went. Only an exact `live` reads live; anything else is not claimed. */
export function targetLabel(target: string | null | undefined): { key: `target.${TargetReading}`; sev: Severity } {
  const reading: TargetReading = target === 'shadow' || target === 'live' ? (target as HybrisStockTarget) : 'unknown'
  return { key: `target.${reading}`, sev: reading === 'shadow' ? 'warn' : reading === 'live' ? 'go' : 'mute' }
}

const DAY = 24 * 60 * 60 * 1000

/**
 * The push's lines are gone: the retention sweeper removed them (`linesSwept`), or the push is older
 * than the retention window (15 days by default) by the screen's clock — so the drawer says they were
 * swept instead of reading an empty page as "no lines".
 */
export function linesSwept(push: Pick<HybrisStockPushRow, 'linesSwept' | 'startedAt'>, retentionDays: number, now: Date): boolean {
  if (push.linesSwept === true) return true
  const started = new Date(push.startedAt).getTime()
  return Number.isFinite(started) && now.getTime() - started > retentionDays * DAY
}
