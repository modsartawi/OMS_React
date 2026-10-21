import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Lock } from 'lucide-react'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { pickSupportFailure } from './failure'
import { readStamp } from './diagnosis'
import { serialCell } from './serial'

/**
 * The small pieces the Pick support panel and the console share (ticket 496). They speak in the
 * `pick-support` namespace, the `central-invoice` precedent for a core module a feature also draws.
 */

/** A code the server sent (a shape, verdict, action, hold, state): shown AS the code; blank reads the dash. */
export function Code({ children }: { children: string | null | undefined }) {
  const { t } = useTranslation('pick-support')
  const v = (children ?? '').trim()
  if (!v) return <Ltr>{t('dash')}</Ltr>
  return (
    <Ltr>
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.75rem] text-foreground">{v}</code>
    </Ltr>
  )
}

/** A machine value (number, store, user id), or the dash when blank. */
export function Val({ value }: { value: string | number | null | undefined }) {
  const { t } = useTranslation('pick-support')
  const v = value == null ? '' : String(value).trim()
  return <Ltr>{v || t('dash')}</Ltr>
}

/**
 * A picked unit's serial (ticket 540, brief 2875): Restricted when the server withheld it, the
 * serial as sent (a machine value, `Ltr`), or the dash for a unit that never had one. The one cell
 * every serial column draws — the diagnosis units and the serial holds.
 */
export function Serial({ unit }: { unit: { serialNumber: string; serialWithheld?: boolean } }) {
  const { t } = useTranslation('pick-support')
  const cell = serialCell(unit)
  if (cell.kind === 'serial') return <Ltr>{cell.serial}</Ltr>
  if (cell.kind === 'none') return <Ltr>{t('dash')}</Ltr>
  return (
    <span
      title={t('serial.restrictedTip')}
      className="inline-flex items-center gap-1 text-muted-foreground italic"
      data-ps-serial-restricted=""
    >
      <Lock className="h-3 w-3 shrink-0" aria-hidden />
      {t('serial.restricted')}
    </span>
  )
}

/** The one-line "Serials are restricted for your account" over a serial column, without the serial grant. */
export function SerialsRestrictedNote() {
  const { t } = useTranslation('pick-support')
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted-foreground" data-ps-serials-note="">
      <Lock className="h-3 w-3 shrink-0" aria-hidden />
      {t('serial.restrictedNote')}
    </p>
  )
}

/** Free text in either script (a reason, a description), or the dash when blank. */
export function Text({ value }: { value: string | null | undefined }) {
  const { t } = useTranslation('pick-support')
  const v = (value ?? '').trim()
  return v ? <bdi>{v}</bdi> : <Ltr>{t('dash')}</Ltr>
}

/** A local wall-clock stamp, exactly as sent; the floor reads as the dash (rule 6). */
export function Stamp({ value }: { value: string | null | undefined }) {
  const { t } = useTranslation('pick-support')
  return <Ltr>{readStamp(value) ?? t('dash')}</Ltr>
}

/** When and by whom (`time · user`), one pair isolated once; a side never written drops out. */
export function StampBy({ at, by }: { at: string | null | undefined; by: string | null | undefined }) {
  const { t } = useTranslation('pick-support')
  return <Ltr>{formatPair(readStamp(at) ?? '', (by ?? '').trim()) || t('dash')}</Ltr>
}

/**
 * The server's English and Arabic, side by side, as the estate shows Arabic beside English. Each is
 * isolated as free text (a block `<bdi>`, direction from its own first strong letter), so the
 * English keeps its punctuation at its end under RTL and the Arabic under LTR.
 */
export function EnAr({ en, ar, name }: { en: string | null | undefined; ar: string | null | undefined; name?: string }) {
  const { t } = useTranslation('pick-support')
  return (
    <div className="grid gap-3 sm:grid-cols-2" data-ps-enar={name ?? ''}>
      <div>
        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">{t('lang.en')}</p>
        <bdi lang="en" className="block text-sm whitespace-pre-wrap" data-ps-en="">
          {en ?? ''}
        </bdi>
      </div>
      <div>
        <p className="text-[0.6875rem] font-medium tracking-wide text-muted-foreground uppercase">{t('lang.ar')}</p>
        <bdi lang="ar" className="block text-sm whitespace-pre-wrap" data-ps-ar="">
          {ar ?? ''}
        </bdi>
      </div>
    </div>
  )
}

/**
 * A Pick support door's failure: a bare 403 in the UI's own sentence, anything else as the
 * server's message WITH its code beside it (support quotes the code when they escalate).
 */
export function PickSupportFailureBanner({
  error,
  title,
  fallback,
  denied,
}: {
  error: unknown
  title: string
  fallback: string
  /** The bare 403's sentence, when the door is not a read (the fix: "…to apply fixes"). */
  denied?: string
}) {
  const { t } = useTranslation('pick-support')
  const failure = pickSupportFailure(error, fallback)
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-050 p-2.5 text-[0.8125rem] text-danger-800"
      data-ps-failure={failure.kind}
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>
        <p className="font-semibold">{failure.kind === 'denied' ? (denied ?? t('denied')) : title}</p>
        {failure.kind === 'refused' && (
          <p className="flex flex-wrap items-baseline gap-2">
            {failure.code && (
              <span data-ps-error-code={failure.code}>
                <Code>{failure.code}</Code>
              </span>
            )}
            <bdi data-ps-error-message="">{failure.message}</bdi>
          </p>
        )}
      </div>
    </div>
  )
}

/** A titled block of the panel. */
export function Section({ name, title, children, end }: { name: string; title: string; children: ReactNode; end?: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card p-3" data-ps-section={name}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {end}
      </div>
      {children}
    </section>
  )
}

export const TH = 'px-2 py-1 text-start text-xs font-medium whitespace-nowrap text-muted-foreground'
export const TD = 'px-2 py-1 align-top text-start'
