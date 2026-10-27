import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { GuardLineOutcome } from '@/core/insurance-rules/guard-check'
import { SEVERITY_BADGE, type Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import type { TraceValue } from './simulate'
import { INPUT as BOX } from '@/core/insurance-rules/parts'

// Small pieces the Simulate and Back-test tabs share (ticket 612).

/** A KPI tile: a label and one figure (the caller isolates it). */
export function Tile({ label, hook, tone, children }: { label: string; hook: string; tone?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-card px-3 py-2" data-tile={hook}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${tone ?? ''}`} data-figure="">
        {children}
      </div>
    </div>
  )
}

/**
 * A line's outcome: the most severe fired rule decides it (REFUSE > OVERRIDE > WARN), an HQ exception passes it.
 * OVERRIDE takes the `post` (violet) family, as the severity pill does; StatusBadge has no violet, so its shape is drawn here.
 */
const OUTCOME_CLASS: Record<GuardLineOutcome, string> = {
  pass: SEVERITY_BADGE.ok,
  refuse: SEVERITY_BADGE.bad,
  override: 'bg-post-050 text-post-800',
  warn: SEVERITY_BADGE.warn,
  exception: SEVERITY_BADGE.go,
}

export function OutcomeBadge({ outcome }: { outcome: GuardLineOutcome }) {
  const { t } = useTranslation('insurance-simulator')
  return (
    <span data-outcome={outcome}>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${OUTCOME_CLASS[outcome] ?? SEVERITY_BADGE.mute}`}>
        {t(`outcome.${outcome}`, { defaultValue: outcome })}
      </span>
    </span>
  )
}

/** A traced condition's value; a condition HQ did not read shows "not read". */
const TRACE_SEV: Record<string, Severity> = { true: 'go', false: 'mute', unknown: 'warn', unread: 'mute' }

export function TraceValueBadge({ value }: { value: TraceValue | null }) {
  const { t } = useTranslation('insurance-simulator')
  const key = value === null ? 'unread' : String(value)
  return (
    <span data-trace-value={key}>
      <StatusBadge sev={TRACE_SEV[key] ?? 'mute'}>{t(`trace.value.${key}`)}</StatusBadge>
    </span>
  )
}

export const INPUT = `${BOX} w-full aria-[invalid=true]:border-danger`
