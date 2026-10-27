import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import Ltr from '@/core/ui/Ltr'
import { formatDateTime } from '@/core/util/date-format'
import { formatPair } from '@/core/util/bidi'
import type { EditionState } from './editions'

// Small pieces both Editions pages draw (ticket 613), in the `insurance-editions` namespace.

const STATE_SEV: Record<EditionState, Severity> = { pending: 'warn', live: 'ok', retired: 'mute' }

export function EditionStateBadge({ state }: { state: EditionState }) {
  const { t } = useTranslation('insurance-editions')
  return (
    <span data-edition-state={state}>
      <StatusBadge sev={STATE_SEV[state] ?? 'mute'}>{t(`state.${state}`, { defaultValue: state })}</StatusBadge>
    </span>
  )
}

/** "who · when" — a user id and a local wall-clock, one machine pair isolated once. Nothing when no one. */
export function ByAt({ by, at }: { by?: string | null; at?: string | null }) {
  if (!by) return null
  return <Ltr>{at ? formatPair(by, formatDateTime(at)) : by}</Ltr>
}

/** A bare 403 on an Editions read — "You do not have access", never an empty page (no probe until 618). */
export function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('insurance-editions')
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}
