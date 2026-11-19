/**
 * The Health check panel's view model (oms 917, BackOffice 4032 door `GET StoreDatabase/HealthCheck`). Pure — pinned by
 * `health-helpers.test.ts`. The finding's detail and fix are server text, passed through as data.
 */
import type { StoreDbHealthCheck, StoreDbHealthFinding } from '@/core/models/store-database'
import type { Severity } from '@/core/ui/severity'

/**
 * The checks this bundle has words for (`StoreDatabaseHealthCheck`'s stable names). A check the server adds later is
 * shown by its own word — never hidden, never a raw key.
 */
export const KNOWN_CHECKS = [
  'AutoShrinkOn',
  'AutoCloseOn',
  'FullRecoveryNoLogBackup',
  'LogLargerThanData',
  'PageVerifyNotChecksum',
  'LastGoodCheckDb',
  'SuspectPages',
  'HighVlfCount',
  'NearSizeCap',
  'LargeTempdb',
  'ShortUptime',
  'NoFullBackup',
] as const

const KNOWN = new Set<string>(KNOWN_CHECKS)

/** The `sync-console` key naming a check, or `null` for one this bundle does not know. */
export const checkLabelKey = (check: string): string | null => (KNOWN.has(check) ? `storeDb.health.checks.${check}` : null)

/** A priority's chip: 1 urgent, 2 a warning, later ones advice. A finding is never drawn green. */
export function priorityBadge(priority: number): { labelKey: string; sev: Severity } {
  const sev: Severity = priority <= 1 ? 'bad' : priority === 2 ? 'warn' : 'go'
  return { labelKey: 'storeDb.health.priority', sev }
}

export interface HealthGroup {
  priority: number
  findings: StoreDbHealthFinding[]
}

/** The findings by priority, most urgent first; within a priority, the server's order. */
export function healthGroups(findings: readonly StoreDbHealthFinding[]): HealthGroup[] {
  const by = new Map<number, StoreDbHealthFinding[]>()
  for (const f of findings) {
    const list = by.get(f.priority)
    if (list) list.push(f)
    else by.set(f.priority, [f])
  }
  return [...by.entries()].sort(([a], [b]) => a - b).map(([priority, list]) => ({ priority, findings: list }))
}

/** A check that faulted (could not run) — the server's level `CheckFailed`; its detail says why. */
export const checkFailed = (finding: StoreDbHealthFinding): boolean => finding.level === 'CheckFailed'

/** Tolerant read of the door: fills a MISSING member only (an empty fix is none), derives nothing. */
export function healthCheckOf(data: Partial<StoreDbHealthCheck> | null): StoreDbHealthCheck {
  return {
    ...data,
    takenAt: data?.takenAt ?? null,
    findings: (data?.findings ?? []).map((f) => ({ ...f, fix: f.fix || null })),
  }
}
