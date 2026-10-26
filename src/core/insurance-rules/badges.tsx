import { useTranslation } from 'react-i18next'
import { SEVERITY_BADGE, type Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import { fsi } from '@/core/util/bidi'
import type { GuardFlag, GuardSeverity, GuardState } from './model'

// The insurance rules' state, severity and flag pills (ticket 607) — one look for the Guards list, the rule
// page and every later screen that names a rule (608–617). Words from the `insurance-rules` namespace.

const STATE_SEV: Record<GuardState, Severity> = { draft: 'mute', waiting: 'warn', shadow: 'go', live: 'ok', disabled: 'mute' }
/**
 * REFUSE > OVERRIDE > WARN: danger, violet, attention. OVERRIDE takes the `post` family (the prototype's violet;
 * `StatusBadge` has no violet severity), so the pill is drawn here in StatusBadge's own shape.
 */
const SEVERITY_CLASS: Record<GuardSeverity, string> = {
  REFUSE: SEVERITY_BADGE.bad,
  OVERRIDE: 'bg-post-050 text-post-800',
  WARN: SEVERITY_BADGE.warn,
}

export function GuardStateBadge({ state }: { state: GuardState }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <span data-state={state}>
      <StatusBadge sev={STATE_SEV[state] ?? 'mute'}>{t(`state.${state}`, { defaultValue: state })}</StatusBadge>
    </span>
  )
}

export function GuardSeverityBadge({ severity }: { severity: GuardSeverity }) {
  const { t } = useTranslation('insurance-rules')
  return (
    <span data-severity={severity}>
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_CLASS[severity] ?? SEVERITY_BADGE.mute}`}>
        {t(`severity.${severity}`, { defaultValue: severity })}
      </span>
    </span>
  )
}

/** The metrics' flags on a rule: noisy / silent / jump, each with since when (the tooltip names it too). */
export function GuardFlags({ flags }: { flags: readonly GuardFlag[] }) {
  const { t } = useTranslation('insurance-rules')
  if (flags.length === 0) return null
  return (
    <span className="inline-flex flex-wrap items-center gap-1" data-flags="">
      {flags.map((f) => (
        <span
          key={f.kind}
          data-flag={f.kind}
          data-since={f.since}
          title={`${t(`flag.${f.kind}Hint`)} ${t('flag.since', { since: fsi(formatDay(f.since)) })}`}
        >
          <StatusBadge sev={f.kind === 'silent' ? 'mute' : 'warn'}>{t(`flag.${f.kind}`)}</StatusBadge>
        </span>
      ))}
    </span>
  )
}

/** A rule id, a machine value: isolated, monospaced. */
export function RuleId({ id }: { id: string }) {
  return (
    <code className="font-mono text-[12px]" data-rule-id="">
      <Ltr>{id}</Ltr>
    </code>
  )
}
