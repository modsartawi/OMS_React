import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import type { GuardLineOutcome } from '@/core/insurance-rules/guard-check'
import { SEVERITY_BADGE, type Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import type { TraceValue } from './simulate'

// Small pieces the Simulate and Back-test tabs share (ticket 612).

/** A bare 403 — "You do not have access", never an empty answer (no probe until 618). */
export function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('insurance-simulator')
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}

export function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {children}
    </div>
  )
}

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

export const INPUT =
  'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60 aria-[invalid=true]:border-danger'
export const TH = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
export const TD = 'px-2 py-1.5 align-top'
export const NUM = 'px-2 py-1.5 text-end align-top tabular-nums'
