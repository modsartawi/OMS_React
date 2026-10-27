import { useTranslation } from 'react-i18next'
import { ShieldAlert } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import type { CodedWord } from './model'

// Small pieces both pages of the Review feature draw (ticket 614).

export const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60'
export const TH = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
export const TD = 'px-2 py-1.5 align-top'

/** A bare 403 on a read — "You do not have access", never an empty list (no probe until 618). */
export function DeniedCard({ hook }: { hook: string }) {
  const { t } = useTranslation('insurance-review')
  return (
    <div className="mx-auto my-6 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" {...{ [`data-${hook}`]: '' }}>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
    </div>
  )
}

/** A reason code with its words, `code · words`, one isolate (a pair led by a machine value). */
export function ReasonText({ code, reasons }: { code: string | null; reasons: readonly CodedWord[] | undefined }) {
  const { i18n } = useTranslation()
  if (!code) return null
  const word = reasons?.find((r) => r.code === code)
  const words = word ? (i18n.language.startsWith('ar') ? word.ar : word.en) : ''
  return (
    <span data-reason={code}>
      <Ltr>{formatPair(code, words)}</Ltr>
    </span>
  )
}

/** A machine value (store, pharmacist, patient key, item code): isolated, monospaced. */
export function Code({ value, hook }: { value: string; hook?: string }) {
  return (
    <span className="font-mono text-[12px]" {...(hook ? { [`data-${hook}`]: '' } : {})}>
      <Ltr>{value}</Ltr>
    </span>
  )
}
