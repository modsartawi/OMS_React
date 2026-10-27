import { useTranslation } from 'react-i18next'
import { Loader2, ShieldAlert } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'

// The insurance rules area's small page pieces, drawn by every feature of the area (oms 607–617; review 3126).
// Namespace-agnostic: a feature passes its own namespace or its own text.

/**
 * A bare 403 on a read — "You do not have access", never an empty screen (no probe until 618). The words are
 * the feature's own `access.deniedTitle` / `access.deniedHint` in `ns` (each feature names the grant it needs).
 */
export function DeniedCard({ hook, ns }: { hook: string; ns: string }) {
  const { t } = useTranslation(ns)
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}

/** A spinner and the feature's own words for what is loading. */
export function Loading({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {text}
    </div>
  )
}

/** "who · when" — a user id and a local wall-clock, one machine pair isolated once. Nothing when no one. */
export function ByAt({ by, at }: { by?: string | null; at?: string | null }) {
  if (!by) return null
  return <Ltr>{at ? formatPair(by, formatDateTime(at)) : by}</Ltr>
}

/** A table's header cell, body cell and figure cell. */
export const TH = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
export const TD = 'px-2 py-1.5 align-top'
export const NUM = 'px-2 py-1.5 text-end align-top tabular-nums'
